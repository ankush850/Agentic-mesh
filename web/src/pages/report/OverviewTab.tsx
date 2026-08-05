import { CheckCircle2, Clock3, Sparkles, Wrench } from "lucide-react";
import type { RunDetail } from "../../../../shared/contracts";
import { OutcomeDonut } from "../../components/Charts";
import { StatCard } from "../../components/StatCard";
import { StatusBadge } from "../../components/StatusBadge";
import { StepTimeline } from "../../components/StepTimeline";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/States";
import { formatDuration, percent } from "../../lib/format";

export function OverviewTab({ detail }: { detail: RunDetail }) {
  const { summary, tests, steps, ticket } = detail;
  const green = summary.passed + summary.healed;
  const byTest = new Map<string, typeof steps>();
  for (const step of steps) {
    const list = byTest.get(step.testId) ?? [];
    list.push(step);
    byTest.set(step.testId, list);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pass rate"
          value={`${percent(green, summary.total)}%`}
          hint={`${green} of ${summary.total} tests green`}
          tone="passed"
          icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Self-healed"
          value={summary.healed}
          hint={`${summary.repairsCount} locator repairs`}
          tone="healed"
          icon={<Sparkles className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Failures"
          value={summary.failed}
          hint={summary.flaky > 0 ? `${summary.flaky} flaky across repeats` : "No flaky results"}
          tone={summary.failed > 0 ? "failed" : "queued"}
          icon={<Wrench className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Duration"
          value={formatDuration(summary.durationMs)}
          hint={`${summary.repeat} attempt${summary.repeat === 1 ? "" : "s"} per test`}
          tone="running"
          icon={<Clock3 className="h-4 w-4" aria-hidden />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title="Outcome split" description="Healed tests count as passing" />
          <CardBody>
            <OutcomeDonut
              passed={summary.passed}
              failed={summary.failed}
              healed={summary.healed}
              flaky={summary.flaky}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={ticket ? `${ticket.key} acceptance criteria` : "Acceptance criteria"}
            description={ticket?.title ?? "No ticket attached to this run"}
          />
          <CardBody>
            {ticket ? (
              <ul className="space-y-2">
                {ticket.acceptanceCriteria.map((criterion) => (
                  <li key={criterion} className="flex gap-2 text-xs leading-relaxed text-muted">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                    />
                    {criterion}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Ad-hoc run"
                description="This run was started without a Jira ticket."
              />
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Execution timeline"
          description="Every step, in the order the agent executed it"
          actions={<StatusBadge status={summary.status} size="md" />}
        />
        <CardBody className="space-y-6">
          {tests.length === 0 ? (
            <EmptyState
              title="No tests recorded"
              description="The run has not produced results yet."
            />
          ) : (
            tests.map((test) => {
              const testSteps = byTest.get(test.testId) ?? [];
              return (
                <section key={test.testId} aria-labelledby={`timeline-${test.testId}`}>
                  <header className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 id={`timeline-${test.testId}`} className="text-sm font-medium text-fg">
                      {test.title}
                    </h3>
                    <StatusBadge status={test.status} />
                    <span className="text-[11px] text-muted">
                      {formatDuration(test.durationMs)}
                    </span>
                  </header>
                  <StepTimeline steps={testSteps} emptyLabel="No step telemetry for this test." />
                </section>
              );
            })
          )}
        </CardBody>
      </Card>
    </div>
  );
}
