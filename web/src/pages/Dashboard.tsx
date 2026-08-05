import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Bug,
  Clock3,
  DollarSign,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { useHealth } from "../hooks/useHealth";
import { useRepairs, useRuns, useStats } from "../hooks/useRuns";
import { formatDuration, percent } from "../lib/format";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { StatCard } from "../components/StatCard";
import { PassRateTrend } from "../components/Charts";
import { RunTable } from "../components/RunTable";
import { SkeletonCard, ErrorState } from "../components/ui/States";
import { Badge } from "../components/ui/Badge";

export default function Dashboard() {
  const stats = useStats();
  const runs = useRuns();
  const pendingRepairs = useRepairs({ status: "pending" });
  const health = useHealth();

  if (stats.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
        </div>
        <SkeletonCard rows={6} />
      </div>
    );
  }

  if (stats.isError) {
    return (
      <ErrorState
        message={(stats.error as Error).message}
        onRetry={() => {
          void stats.refetch();
        }}
      />
    );
  }

  const totals = stats.data?.totals ?? {
    runs: 0,
    tests: 0,
    passed: 0,
    failed: 0,
    healed: 0,
    flaky: 0,
    repairs: 0,
  };
  const passRate = percent(totals.passed + totals.healed, totals.tests);
  const recentRuns = (runs.data ?? []).slice(0, 6);
  const pendingCount = pendingRepairs.data?.length ?? 0;
  const trend = stats.data?.passRateTrend ?? [];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <section className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Pass rate"
          value={`${passRate}%`}
          hint={`${totals.passed + totals.healed} of ${totals.tests} tests green`}
          tone="passed"
          icon={<Activity className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Self-healed"
          value={totals.healed}
          hint={`${totals.repairs} locator repairs recorded`}
          tone="healed"
          icon={<Sparkles className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Financial ROI Saved"
          value={`$${Math.round(totals.healed * 0.25 * 65)}`}
          hint={`${(totals.healed * 0.25).toFixed(1)} hrs dev triage saved ($65/hr)`}
          tone="healed"
          icon={<DollarSign className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Failures"
          value={totals.failed}
          hint={`${totals.flaky} flaky results across ${totals.runs} runs`}
          tone="failed"
          icon={<TriangleAlert className="h-4 w-4" aria-hidden />}
        />
        <StatCard
          label="Auto-filed bugs"
          value={(runs.data ?? []).flatMap((r: any) => r.tests ?? []).filter((t: any) => t.bugTicket).length}
          hint="Jira Bug tickets created automatically"
          tone="failed"
          icon={<Bug className="h-4 w-4" aria-hidden />}
        />
      </section>

      <div className="stagger grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader
            title="Pass rate trend"
            description="Last 12 runs — healed tests count as green"
            actions={<Badge tone="passed">{trend.length} runs</Badge>}
          />
          <CardBody className="pt-2">
            <PassRateTrend data={trend} />
          </CardBody>
        </Card>

        <div className="stagger space-y-4">
          <Card>
            <CardHeader
              title="Needs review"
              description="Repairs waiting for a human decision"
              actions={
                pendingCount > 0 ? (
                  <Link to="/repairs" className="text-xs text-accent hover:underline">
                    Open center
                  </Link>
                ) : undefined
              }
            />
            <CardBody>
              {pendingCount > 0 ? (
                <div className="space-y-3">
                  <p className="text-3xl font-semibold text-healed">{pendingCount}</p>
                  <p className="text-xs text-muted">
                    {(pendingRepairs.data ?? [])
                      .slice(0, 3)
                      .map((repair) => repair.stepDescription)
                      .join(" · ")}
                  </p>
                  <Link to="/repairs">
                    <Button variant="secondary" size="sm" className="w-full">
                      <Wrench className="h-3.5 w-3.5" aria-hidden />
                      Review repairs
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="flex items-center gap-3 py-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-passed/30 bg-passed/10 text-passed">
                    <ShieldCheck className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm text-fg">Nothing to review</p>
                    <p className="text-xs text-muted">Every repair has been triaged.</p>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Run queue" description="The engine executes one run at a time" />
            <CardBody className="space-y-2 text-xs text-muted">
              <div className="flex items-center justify-between">
                <span>Status</span>
                <Badge tone={health.data?.queue?.busy ? "running" : "queued"} dot>
                  {health.data?.queue?.busy ? "Executing" : "Idle"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Pending</span>
                <span className="text-fg">{health.data?.queue?.pending ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Avg. run</span>
                <span className="inline-flex items-center gap-1 text-fg">
                  <Clock3 className="h-3 w-3" aria-hidden />
                  {formatDuration(
                    totals.runs > 0
                      ? Math.round(
                          (runs.data ?? []).reduce((sum, run) => sum + run.durationMs, 0) /
                            Math.max((runs.data ?? []).length, 1),
                        )
                      : 0,
                  )}
                </span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="animate-rise">
        <CardHeader
          title="Recent runs"
          description="Newest first"
          actions={
            <Link
              to="/runs"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              All runs
              <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          }
        />
        {runs.isError ? (
          <ErrorState message={(runs.error as Error).message} onRetry={() => void runs.refetch()} />
        ) : (
          <RunTable
            runs={recentRuns}
            emptyTitle="No runs yet"
            emptyDescription="Start your first run from a Jira ticket or the bundled mock ticket."
          />
        )}
      </Card>
    </div>
  );
}
