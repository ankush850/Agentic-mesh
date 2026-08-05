import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { tones, type Tone } from "../../lib/status";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  icon?: ReactNode;
  dot?: boolean;
  /** Filled treatment, for sitting on a surface that is already washed in the
   * same hue — a translucent pill there would sink into the tint. */
  solid?: boolean;
}

/** Small status pill. Always pairs colour with a text label (a11y requirement). */
export function Badge({
  tone = "queued",
  icon,
  dot = false,
  solid = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  const style = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        // White on any solid tone clears AA at 11px — the tightest is the queued
        // slate at 4.76:1, and stacking the translucent pill on a tinted tile
        // instead drops the healed amber to 3.97:1.
        solid
          ? cn(style.dot, "border-transparent text-on-accent")
          : [style.bg, style.border, style.text],
        className,
      )}
      {...rest}
    >
      {dot ? (
        <span
          aria-hidden
          className={cn("h-1.5 w-1.5 rounded-full", solid ? "bg-current" : style.dot)}
        />
      ) : null}
      {icon}
      {children}
    </span>
  );
}

export function CountPill({
  children,
  className,
}: HTMLAttributes<HTMLSpanElement> & { children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full bg-highlight px-1.5 text-[11px] font-semibold text-on-highlight",
        className,
      )}
    >
      {children}
    </span>
  );
}
