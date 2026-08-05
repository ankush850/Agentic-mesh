import { useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Filter, Play, RefreshCw, Search, X } from "lucide-react";
import { RUN_STATUSES } from "../../../shared/contracts";
import { useRuns } from "../hooks/useRuns";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Input, Select } from "../components/ui/Field";
import { RunTable } from "../components/RunTable";
import { EmptyState, ErrorState, SkeletonCard } from "../components/ui/States";
import { statusLabel } from "../lib/format";

const PAGE_SIZE = 20;

export default function RunHistory() {
  const [status, setStatus] = useState("");
  const [ticket, setTicket] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const deferredTicket = useDeferredValue(ticket);

  const runs = useRuns({
    status: status || undefined,
    ticket: deferredTicket.trim() || undefined,
  });

  const filtered = useMemo(() => runs.data ?? [], [runs.data]);
  const visible = filtered.slice(0, limit);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Run history"
          description="Filter by status or ticket key. Healed runs count as passing."
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void runs.refetch()}
              loading={runs.isFetching}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Refresh
            </Button>
          }
        />
        <CardBody className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-56 flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted"
            />
            <Input
              value={ticket}
              onChange={(event) => {
                setTicket(event.target.value);
                setLimit(PAGE_SIZE);
              }}
              placeholder="Filter by ticket key (e.g. QA-101)"
              aria-label="Filter by ticket key"
              className="pl-9"
            />
            {ticket ? (
              <button
                type="button"
                onClick={() => setTicket("")}
                aria-label="Clear ticket filter"
                className="absolute right-2 top-2.5 rounded p-1 text-muted hover:text-fg"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted" aria-hidden />
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setLimit(PAGE_SIZE);
              }}
              aria-label="Filter by run status"
              className="w-40"
            >
              <option value="">All statuses</option>
              {RUN_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value)}
                </option>
              ))}
            </Select>
          </div>
          <span className="ml-auto text-xs text-muted">
            {filtered.length} run{filtered.length === 1 ? "" : "s"}
          </span>
        </CardBody>
      </Card>

      <Card>
        {runs.isLoading ? (
          <div className="space-y-3 p-5">
            <SkeletonCard rows={3} />
            <SkeletonCard rows={3} />
          </div>
        ) : runs.isError ? (
          <ErrorState message={(runs.error as Error).message} onRetry={() => void runs.refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={status || ticket ? "No runs match those filters" : "No runs recorded yet"}
            description={
              status || ticket
                ? "Try clearing the status filter or searching for a different ticket key."
                : "Start a run from the New Run page to populate the history."
            }
            action={
              <Link to="/runs/new">
                <Button size="sm">
                  <Play className="h-3.5 w-3.5" aria-hidden />
                  Start a run
                </Button>
              </Link>
            }
          />
        ) : (
          <>
            <RunTable runs={visible} />
            {filtered.length > visible.length ? (
              <div className="flex justify-center border-t border-line py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLimit((value) => value + PAGE_SIZE)}
                >
                  Load {Math.min(PAGE_SIZE, filtered.length - visible.length)} more
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
}
