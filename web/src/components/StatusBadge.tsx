import { CheckCircle2, Clock, Loader2, Shuffle, Sparkles, XCircle } from "lucide-react";
import type { RunStatus, StepStatus, TestResultStatus } from "../../../shared/contracts";
import { cn } from "../lib/cn";
import { statusLabel } from "../lib/format";
import { toneOf, tones } from "../lib/status";

const ICONS = {
  passed: CheckCircle2,
  failed: XCircle,
  healed: Sparkles,
  flaky: Shuffle,
  running: Loader2,
  queued: Clock,
} as const;

interface StatusBadgeProps {
  status: RunStatus | StepStatus | TestResultStatus | string;
  label?: string;
  size?: "sm" | "md";
  className?: string;
  /** Hides the icon for dense tables where the dot is enough. */
  dotOnly?: boolean;
}

/** Canonical status renderer: colour + icon + text, always together. */
export function StatusBadge({
  status,
  label,
  size = "sm",
  className,
  dotOnly = false,
}: StatusBadgeProps) {
  const tone = toneOf(status);
  const style = tones[tone];
  const Icon = ICONS[tone];
  const text = label ?? statusLabel(status as TestResultStatus);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        style.bg,
        style.border,
        style.text,
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      {dotOnly ? (
        <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      ) : (
        <Icon
          aria-hidden
          className={cn(
            "shrink-0",
            size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5",
            tone === "running" && "animate-spin",
          )}
        />
      )}
      {text}
    </span>
  );
}
