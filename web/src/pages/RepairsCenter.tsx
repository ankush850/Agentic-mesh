import { useMemo, useState } from "react";
import { Filter, ShieldCheck, Wrench } from "lucide-react";
import type { RepairView } from "../../../shared/contracts";
import { useRepairs, useReviewRepair } from "../hooks/useRuns";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Input, Select } from "../components/ui/Field";
import { RepairRow } from "../components/RepairRow";
import { EmptyState, ErrorState, SkeletonCard } from "../components/ui/States";
import { Tabs } from "../components/ui/Tabs";
import { tones } from "../lib/status";
import { cn } from "../lib/cn";

const STATUS_TABS = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "reverted", label: "Reverted" },
  { id: "all", label: "All" },
];

export default function RepairsCenter() {
  const [status, setStatus] = useState("pending");
  const [model, setModel] = useState("");
  const [minConfidence, setMinConfidence] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const repairs = useRepairs({ status: status === "all" ? undefined : status });
  const all = useRepairs({});
  const review = useReviewRepair();

  const counts = useMemo(() => {
    const list = all.data ?? [];
    return {
      pending: list.filter((repair) => !repair.review).length,
      approved: list.filter((repair) => repair.review?.decision === "approved").length,
      rejected: list.filter((repair) => repair.review?.decision === "rejected").length,
      reverted: list.filter((repair) => repair.review?.decision === "reverted").length,
    };
  }, [all.data]);

  const models = useMemo(
    () => Array.from(new Set((all.data ?? []).map((repair) => repair.modelUsed))).sort(),
    [all.data],
  );

  const visible: RepairView[] = (repairs.data ?? []).filter((repair) => {
    if (model && repair.modelUsed !== model) return false;
    if (minConfidence && repair.confidence < Number(minConfidence)) return false;
    return true;
  });

  const handleReview = (repairId: string, decision: "approved" | "rejected" | "reverted") => {
    setPendingId(repairId);
    review.mutate(
      { repairId, decision },
      { onSettled: () => setPendingId((current) => (current === repairId ? null : current)) },
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            { key: "pending", label: "Awaiting review", tone: "healed" as const },
            { key: "approved", label: "Approved", tone: "passed" as const },
            { key: "rejected", label: "Rejected", tone: "failed" as const },
            { key: "reverted", label: "Reverted", tone: "queued" as const },
          ] as const
        ).map((entry) => {
          const t = tones[entry.tone];
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => setStatus(entry.key)}
              className={cn(
                "surface-card box-hover flex items-center justify-between px-4 py-3 text-left",
                t.tile,
              )}
            >
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted">{entry.label}</p>
                <p className={cn("mt-1 text-2xl font-semibold", t.text)}>{counts[entry.key]}</p>
              </div>
              <Badge tone={entry.tone} dot solid>
                {entry.key}
              </Badge>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader
          title="Repair review queue"
          description="Approve to keep the healed locator, reject to flag it, or revert to clear the cache."
        />
        <CardBody className="space-y-4">
          <Tabs
            value={status}
            onChange={(value) => setStatus(value)}
            items={STATUS_TABS.map((tab) => ({
              id: tab.id,
              label: tab.label,
              count:
                tab.id === "all" ? (all.data ?? []).length : counts[tab.id as keyof typeof counts],
            }))}
            ariaLabel="Repair review status"
          />

          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted" aria-hidden />
            <Select
              value={model}
              onChange={(event) => setModel(event.target.value)}
              aria-label="Filter by model"
              className="w-56"
            >
              <option value="">All models</option>
              {models.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={minConfidence}
              onChange={(event) => setMinConfidence(event.target.value)}
              placeholder="Min confidence (0–1)"
              aria-label="Minimum confidence"
              className="w-48"
            />
            <span className="ml-auto text-xs text-muted">
              {visible.length} repair{visible.length === 1 ? "" : "s"}
            </span>
          </div>

          {repairs.isLoading ? (
            <div className="space-y-3">
              <SkeletonCard rows={3} />
              <SkeletonCard rows={3} />
            </div>
          ) : repairs.isError ? (
            <ErrorState
              message={(repairs.error as Error).message}
              onRetry={() => void repairs.refetch()}
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<Wrench className="h-5 w-5" aria-hidden />}
              title={status === "pending" ? "No repairs waiting" : "No repairs match these filters"}
              description={
                status === "pending"
                  ? "Everything has been triaged. New heals will show up here."
                  : "Try a different status, model or confidence threshold."
              }
              action={
                status !== "pending" ? (
                  <Button variant="secondary" size="sm" onClick={() => setStatus("pending")}>
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                    Show pending
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {visible.map((repair) => (
                <RepairRow
                  key={repair.repairId}
                  repair={repair}
                  reviewing={pendingId === repair.repairId}
                  onReview={handleReview}
                  className="border-line-strong/60"
                />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <p className="text-[11px] text-muted">
        Reverting a repair also clears the cached locator, so the next run resolves the element from
        scratch.
      </p>
    </div>
  );
}
