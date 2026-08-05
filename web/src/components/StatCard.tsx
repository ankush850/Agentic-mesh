import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { tones, type Tone } from "../lib/status";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  className?: string;
}

/** Compact KPI tile used across the dashboard and run overview. */
export function StatCard({ label, value, hint, icon, tone, className }: StatCardProps) {
  const t = tone ? tones[tone] : null;
  return (
    <div className={cn("surface-card box-hover group flex flex-col gap-2 p-4", t?.tile, className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</span>
        {icon ? (
          <span
            className={cn(
              // The tile lifts as a whole; the icon answers a beat more strongly.
              "flex h-7 w-7 items-center justify-center rounded-lg transition-transform duration-200 ease-out group-hover:scale-110",
              // Solid tone chip: the tile behind it is already tinted the same
              // hue, so a translucent chip would disappear into the wash.
              t ? cn(t.dot, "text-on-accent") : "border border-line bg-surface-2 text-muted",
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
      {/* The figure carries the colour; the label and hint stay neutral so the
          tile never reads as three competing tones. */}
      <div className={cn("text-2xl font-semibold tracking-tight", t ? t.text : "text-fg")}>
        {value}
      </div>
      {hint ? <div className="text-[11px] text-muted">{hint}</div> : null}
    </div>
  );
}
