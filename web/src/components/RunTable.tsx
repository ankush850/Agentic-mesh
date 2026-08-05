import { Link } from "react-router-dom";
import { ArrowUpRight, Repeat } from "lucide-react";
import type { RunSummary } from "../../../shared/contracts";
import { cn } from "../lib/cn";
import { formatDuration, formatRelative, percent, targetLabel } from "../lib/format";
import { StatusBadge } from "./StatusBadge";
import { EmptyState } from "./ui/States";

interface RunTableProps {
  runs: RunSummary[];
  className?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

/** Dense run table shared by the dashboard and the history page. */
export function RunTable({
  runs,
  className,
  emptyTitle = "No runs yet",
  emptyDescription,
}: RunTableProps) {
  if (runs.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-muted">
            <th scope="col" className="px-4 py-2 font-medium">
              Run
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Ticket
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Target
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Status
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Tests
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Duration
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Started
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const passRate = percent(run.passed + run.healed, run.total);
            return (
              <tr
                key={run.runId}
                className="group border-b border-line/70 transition-colors hover:bg-surface-2/60"
              >
                <td className="px-4 py-3">
                  <Link
                    to={`/runs/${run.runId}`}
                    className="flex items-center gap-2 font-mono text-xs text-fg"
                  >
                    <span className="truncate">{run.runId}</span>
                    <ArrowUpRight
                      aria-hidden
                      className="h-3 w-3 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </Link>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted">
                    {run.mock ? (
                      <span className="rounded bg-flaky/15 px-1 py-0.5 text-flaky">mock</span>
                    ) : null}
                    {run.repeat > 1 ? (
                      <span className="inline-flex items-center gap-1">
                        <Repeat className="h-2.5 w-2.5" aria-hidden />×{run.repeat}
                      </span>
                    ) : null}
                    <span>{run.appVersion}</span>
                  </div>
                </td>
                <td className="max-w-[220px] px-4 py-3">
                  <p className="truncate text-xs font-medium text-fg">{run.ticketKey ?? "—"}</p>
                  <p className="truncate text-[11px] text-muted">
                    {run.ticketTitle ?? "Ad-hoc test cases"}
                  </p>
                </td>
                <td className="px-4 py-3 text-xs text-muted">{targetLabel(run.baseUrl)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={run.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-fg">
                      {run.passed + run.healed}/{run.total}
                    </span>
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3">
                      <span
                        className="block h-full rounded-full bg-passed"
                        style={{ width: `${passRate}%` }}
                      />
                    </span>
                  </div>
                  <div className="mt-0.5 flex gap-2 text-[10px]">
                    {run.failed > 0 ? (
                      <span className="text-failed">{run.failed} failed</span>
                    ) : null}
                    {run.healed > 0 ? (
                      <span className="text-healed">{run.healed} healed</span>
                    ) : null}
                    {run.flaky > 0 ? <span className="text-flaky">{run.flaky} flaky</span> : null}
                    {run.repairsCount > 0 ? (
                      <span className="text-muted">{run.repairsCount} repairs</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted">{formatDuration(run.durationMs)}</td>
                <td className="px-4 py-3 text-right text-xs text-muted">
                  {formatRelative(run.startedAt ?? run.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
