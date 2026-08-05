import { CheckCircle2, ChevronRight, Clock, Loader2, Sparkles, XCircle } from "lucide-react";
import type { RunStep } from "../../../shared/contracts";
import { cn } from "../lib/cn";
import { formatDuration } from "../lib/format";
import { stepTone, tones } from "../lib/status";
import { LocatorDiff } from "./LocatorDiff";

const STEP_ICONS = {
  pending: Clock,
  running: Loader2,
  passed: CheckCircle2,
  failed: XCircle,
  healed: Sparkles,
} as const;

export interface StepTimelineProps {
  steps: RunStep[];
  /** Reasoning text per step index, as streamed by the agent. */
  reasoning?: Record<number, string[]>;
  selectedIndex?: number;
  onSelect?: (step: RunStep) => void;
  className?: string;
  emptyLabel?: string;
}

/** Vertical step timeline with inline healing diff and streamed reasoning. */
export function StepTimeline({
  steps,
  reasoning = {},
  selectedIndex,
  onSelect,
  className,
  emptyLabel = "No steps recorded yet.",
}: StepTimelineProps) {
  if (steps.length === 0) {
    return (
      <p className={cn("px-1 py-6 text-center text-xs text-muted", className)}>{emptyLabel}</p>
    );
  }

  return (
    <ol className={cn("space-y-0", className)}>
      {steps.map((step, index) => {
        const tone = stepTone(step.status);
        const style = tones[tone];
        const Icon = STEP_ICONS[step.status];
        const isLast = index === steps.length - 1;
        const isSelected = selectedIndex === step.stepIndex;
        const notes = reasoning[step.stepIndex] ?? [];
        const interactive = Boolean(onSelect);

        const content = (
          <div className="min-w-0 flex-1 pb-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                Step {step.stepIndex + 1}
              </span>
              <span className="text-sm leading-snug text-fg">{step.description}</span>
              {step.cached ? (
                <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                  cached
                </span>
              ) : null}
              {step.durationMs !== undefined ? (
                <span className="text-[11px] text-muted">{formatDuration(step.durationMs)}</span>
              ) : null}
              {interactive ? (
                <ChevronRight
                  aria-hidden
                  className={cn(
                    "ml-auto h-3.5 w-3.5 text-muted transition-transform",
                    isSelected && "rotate-90",
                  )}
                />
              ) : null}
            </div>

            {step.status === "healed" && step.oldLocator && step.newLocator ? (
              <div className={cn("mt-2 rounded-lg border px-3 py-2", style.border, style.bg)}>
                <LocatorDiff oldLocator={step.oldLocator} newLocator={step.newLocator} />
              </div>
            ) : null}

            {step.error ? (
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg border border-failed/30 bg-failed/5 px-3 py-2 font-mono text-[11px] leading-relaxed text-failed">
                {step.error}
              </pre>
            ) : null}

            {notes.length > 0 ? (
              <ul className="mt-2 space-y-1 border-l border-line pl-3">
                {notes.map((note, noteIndex) => (
                  <li key={noteIndex} className="font-mono text-[11px] leading-relaxed text-muted">
                    {note}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );

        return (
          <li key={`${step.testId}-${step.stepIndex}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                  style.bg,
                  style.border,
                  style.text,
                )}
              >
                <Icon
                  aria-hidden
                  className={cn("h-3.5 w-3.5", step.status === "running" && "animate-spin")}
                />
                <span className="sr-only">{step.status}</span>
              </span>
              {!isLast ? <span aria-hidden className="w-px flex-1 bg-line" /> : null}
            </div>
            {interactive ? (
              <button
                type="button"
                onClick={() => onSelect?.(step)}
                aria-pressed={isSelected}
                className={cn(
                  "-mx-1 flex w-full items-start rounded-lg px-1 text-left transition-colors hover:bg-surface-2/60",
                  isSelected && "bg-surface-2/80",
                )}
              >
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
  );
}
