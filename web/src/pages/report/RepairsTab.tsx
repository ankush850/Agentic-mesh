import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { RunDetail } from "../../../../shared/contracts";
import { useReviewRepair } from "../../hooks/useRuns";
import { RepairRow } from "../../components/RepairRow";
import { EmptyState } from "../../components/ui/States";
import { Badge } from "../../components/ui/Badge";

export function RepairsTab({ detail }: { detail: RunDetail }) {
  const review = useReviewRepair();
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (detail.repairs.length === 0) {
    return (
      <EmptyState
        title="No repairs in this run"
        description="Every locator resolved on the first attempt — nothing needed healing."
        icon={<ShieldCheck className="h-5 w-5" aria-hidden />}
      />
    );
  }

  const pending = detail.repairs.filter((repair) => !repair.review).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium text-fg">Locator repairs</h3>
        <Badge tone="healed">{detail.repairs.length} total</Badge>
        {pending > 0 ? (
          <Badge tone="running">{pending} awaiting review</Badge>
        ) : (
          <Badge tone="passed">All triaged</Badge>
        )}
      </div>

      {detail.repairs.map((repair, index) => (
        <RepairRow
          key={repair.repairId}
          repair={repair}
          defaultOpen={index === 0 && !repair.review}
          reviewing={pendingId === repair.repairId}
          onReview={(repairId, decision) => {
            setPendingId(repairId);
            review.mutate(
              { repairId, decision },
              {
                onSettled: () => setPendingId((current) => (current === repairId ? null : current)),
              },
            );
          }}
        />
      ))}
    </div>
  );
}
