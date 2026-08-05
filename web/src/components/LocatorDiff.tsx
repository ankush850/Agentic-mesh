import { diffChars } from "diff";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "../lib/cn";

interface LocatorDiffProps {
  oldLocator: string;
  newLocator: string;
  modelUsed?: string;
  confidence?: number;
  reason?: string;
  className?: string;
}

const CONFIDENCE_LABEL = (confidence: number): string => {
  if (confidence >= 0.9) return "high confidence";
  if (confidence >= 0.75) return "medium confidence";
  return "low confidence — review carefully";
};

/** Character-level diff between the original and the healed locator. */
export function LocatorDiff({
  oldLocator,
  newLocator,
  modelUsed,
  confidence,
  reason,
  className,
}: LocatorDiffProps) {
  const parts = diffChars(oldLocator, newLocator);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="min-w-0 rounded-lg border border-failed/25 bg-failed/5 px-3 py-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-failed">
            Old locator
          </p>
          <code className="block break-all font-mono text-xs leading-relaxed text-fg">
            {parts
              .filter((part) => !part.added)
              .map((part, index) => (
                <span
                  key={`old-${index}`}
                  className={
                    part.removed ? "rounded bg-failed/25 text-failed line-through" : undefined
                  }
                >
                  {part.value}
                </span>
              ))}
          </code>
        </div>

        <ArrowRight className="mx-auto hidden h-4 w-4 text-muted sm:block" aria-hidden />
        <ArrowRight className="mx-auto h-4 w-4 rotate-90 text-muted sm:hidden" aria-hidden />

        <div className="min-w-0 rounded-lg border border-passed/25 bg-passed/5 px-3 py-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-passed">
            Healed locator
          </p>
          <code className="block break-all font-mono text-xs leading-relaxed text-fg">
            {parts
              .filter((part) => !part.removed)
              .map((part, index) => (
                <span
                  key={`new-${index}`}
                  className={part.added ? "rounded bg-passed/25 text-passed" : undefined}
                >
                  {part.value}
                </span>
              ))}
          </code>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        {modelUsed ? (
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-healed" aria-hidden />
            <span className="font-mono">{modelUsed}</span>
          </span>
        ) : null}
        {typeof confidence === "number" ? (
          <span title="Model confidence in the healed locator">
            {(confidence * 100).toFixed(0)}% · {CONFIDENCE_LABEL(confidence)}
          </span>
        ) : null}
      </div>

      {reason ? <p className="text-xs leading-relaxed text-muted">{reason}</p> : null}
    </div>
  );
}
