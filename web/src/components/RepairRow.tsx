import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ExternalLink, RotateCcw, ShieldCheck, ShieldX, Undo2 } from "lucide-react";
import type { RepairView, ReviewDecision } from "../../../shared/contracts";
import { cn } from "../lib/cn";
import { formatDateTime, formatRelative } from "../lib/format";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { LocatorDiff } from "./LocatorDiff";
import { ScreenshotCompare } from "./ScreenshotCompare";

interface RepairRowProps {
  repair: RepairView;
  onReview: (repairId: string, decision: ReviewDecision, note?: string) => void;
  reviewing?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

const REVIEW_COPY: Record<ReviewDecision, string> = {
  approved: "Approved",
  rejected: "Rejected",
  reverted: "Reverted",
};

/** Expandable repair card: diff, evidence, model metadata and review actions. */
export function RepairRow({
  repair,
  onReview,
  reviewing = false,
  defaultOpen = false,
  className,
}: RepairRowProps) {
  const [open, setOpen] = useState(defaultOpen);
  const review = repair.review;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex flex-wrap items-start gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-healed/35 bg-healed/10 text-healed">
            <ShieldCheck className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-fg">{repair.stepDescription}</span>
              <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                step {repair.stepIndex + 1}
              </span>
              {review ? (
                <Badge
                  tone={
                    review.decision === "approved"
                      ? "passed"
                      : review.decision === "rejected"
                        ? "failed"
                        : "queued"
                  }
                >
                  {REVIEW_COPY[review.decision]}
                </Badge>
              ) : (
                <Badge tone="healed" dot>
                  Pending review
                </Badge>
              )}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
              <span className="font-mono">{repair.modelUsed}</span>
              <span>{Math.round(repair.confidence * 100)}% confidence</span>
              <span title={formatDateTime(repair.timestamp)}>
                {formatRelative(repair.timestamp)}
              </span>
              {repair.runTicketKey ? <span>{repair.runTicketKey}</span> : null}
            </span>
            <span className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px]">
              <span className="max-w-[46%] truncate rounded bg-failed/10 px-1.5 py-0.5 text-failed line-through">
                {repair.oldLocator}
              </span>
              <span aria-hidden className="text-muted">
                →
              </span>
              <span className="max-w-[46%] truncate rounded bg-passed/10 px-1.5 py-0.5 text-passed">
                {repair.newLocator}
              </span>
            </span>
          </span>
        </button>

        {/* Kept outside the toggle: a link nested in a button is invalid HTML
            and swallows the row click. */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Link
            to={`/runs/${repair.runId}`}
            className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
            title={`Open ${repair.runId}`}
          >
            {repair.runId.slice(0, 14)}…
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
          <ChevronDown
            aria-hidden
            className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")}
          />
        </div>
      </div>

      {open ? (
        <div className="space-y-4 border-t border-line bg-surface-2/40 px-4 py-4">
          <LocatorDiff
            oldLocator={repair.oldLocator}
            newLocator={repair.newLocator}
            modelUsed={repair.modelUsed}
            confidence={repair.confidence}
            reason={repair.reason}
          />

          {repair.beforeScreenshot || repair.afterScreenshot ? (
            <ScreenshotCompare before={repair.beforeScreenshot} after={repair.afterScreenshot} />
          ) : (
            <p className="text-[11px] text-muted">No screenshots were captured for this repair.</p>
          )}

          {review?.note ? (
            <p className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
              <span className="font-medium text-fg">Reviewer note: </span>
              {review.note}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="success"
              loading={reviewing}
              onClick={() => onReview(repair.repairId, "approved")}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Approve
            </Button>
            <Button
              size="sm"
              variant="danger"
              loading={reviewing}
              onClick={() => onReview(repair.repairId, "rejected")}
            >
              <ShieldX className="h-3.5 w-3.5" aria-hidden />
              Reject
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={reviewing}
              onClick={() => onReview(repair.repairId, "reverted")}
              title="Clears the cached healed locator so the next run resolves it again"
            >
              {review?.decision === "reverted" ? (
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Undo2 className="h-3.5 w-3.5" aria-hidden />
              )}
              Revert &amp; clear cache
            </Button>
            <span className="ml-auto text-[11px] text-muted">
              {review ? `Reviewed ${formatRelative(review.reviewedAt)}` : "Awaiting human review"}
            </span>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
