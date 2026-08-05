import { useState } from "react";
import { Bug, ChevronDown, Image as ImageIcon, Sparkles } from "lucide-react";
import type { RunDetail } from "../../../../shared/contracts";
import { StepTimeline } from "../../components/StepTimeline";
import { StatusBadge } from "../../components/StatusBadge";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/States";
import { artifactUrl } from "../../lib/api";
import { cn } from "../../lib/cn";
import { formatDuration } from "../../lib/format";

export function TestsTab({ detail }: { detail: RunDetail }) {
  const [openId, setOpenId] = useState<string | null>(detail.tests[0]?.testId ?? null);

  if (detail.tests.length === 0) {
    return (
      <EmptyState title="No tests in this run" description="The engine returned no test results." />
    );
  }

  return (
    <div className="stagger space-y-3">
      {detail.tests.map((test) => {
        const open = openId === test.testId;
        const steps = detail.steps.filter((step) => step.testId === test.testId);
        const screenshot = artifactUrl(test.screenshotPath);
        const repairs = test.repairs?.length ?? 0;

        return (
          <Card key={test.testId} className="overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : test.testId)}
              aria-expanded={open}
              className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/50"
            >
              <StatusBadge status={test.status} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-fg">{test.title}</span>
                <span className="mt-0.5 block truncate text-[11px] text-muted">
                  {test.criterion}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3 text-[11px] text-muted">
                {repairs > 0 ? (
                  <span className="inline-flex items-center gap-1 text-healed">
                    <Sparkles className="h-3 w-3" aria-hidden />
                    {repairs}
                  </span>
                ) : null}
                {(test as any).bugTicket ? (
                  <span className="inline-flex items-center gap-1 text-red-500" title="Auto-filed bug ticket">
                    <Bug className="h-3 w-3" aria-hidden />
                    {(test as any).bugTicket.issueKey}
                  </span>
                ) : null}
                {screenshot ? (
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" aria-hidden />
                    shot
                  </span>
                ) : null}
                <span>{formatDuration(test.durationMs)}</span>
                <ChevronDown
                  aria-hidden
                  className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
                />
              </span>
            </button>

            {open ? (
              <div className="space-y-4 border-t border-line bg-surface-2/30 px-4 py-4">
                <dl className="grid gap-3 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted">
                      Acceptance criterion
                    </dt>
                    <dd className="mt-0.5 leading-relaxed text-fg">{test.criterion}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted">
                      Steps executed
                    </dt>
                    <dd className="mt-0.5 leading-relaxed text-fg">
                      {test.stepsExecuted ?? steps.length} step
                      {(test.stepsExecuted ?? steps.length) === 1 ? "" : "s"} ·{" "}
                      {formatDuration(test.durationMs)}
                    </dd>
                  </div>
                </dl>

                {test.error ? (
                  <div>
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-failed">Error</p>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-failed/30 bg-failed/5 px-3 py-2 font-mono text-[11px] leading-relaxed text-failed">
                      {test.error}
                    </pre>
                    {(test as any).bugTicket ? (
                      <a
                        href={(test as any).bugTicket.issueUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                      >
                        <Bug className="h-3 w-3" aria-hidden />
                        Auto-filed: {(test as any).bugTicket.issueKey}
                      </a>
                    ) : null}
                  </div>
                ) : null}

                <StepTimeline
                  steps={steps}
                  emptyLabel="Step telemetry was not captured for this test."
                />

                {screenshot ? (
                  <figure className="overflow-hidden rounded-lg border border-line">
                    <img
                      src={screenshot}
                      alt={`Final screenshot for ${test.title}`}
                      className="max-h-72 w-full object-cover object-top"
                      loading="lazy"
                    />
                    <figcaption className="border-t border-line bg-surface px-3 py-1.5 text-[10px] text-muted">
                      Final state captured by Playwright
                    </figcaption>
                  </figure>
                ) : null}

                {test.history && test.history.length > 1 ? (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                    History:
                    {test.history.map((entry, index) => (
                      <StatusBadge key={`${test.testId}-h-${index}`} status={entry} />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
