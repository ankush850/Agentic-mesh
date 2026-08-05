import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  ariaLabel?: string;
}

/** Horizontal, keyboard-accessible tab bar (arrow keys move the selection). */
export function Tabs({ items, value, onChange, className, ariaLabel = "Sections" }: TabsProps) {
  const move = (delta: number) => {
    const index = items.findIndex((item) => item.id === value);
    if (index === -1) return;
    const next = (index + delta + items.length) % items.length;
    onChange(items[next].id);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap items-center gap-1 border-b border-line pb-px", className)}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") {
          event.preventDefault();
          move(1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          move(-1);
        }
      }}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-accent text-fg"
                : "border-transparent text-muted hover:border-line-strong hover:text-fg",
            )}
          >
            {item.icon}
            {item.label}
            {typeof item.count === "number" ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  active
                    ? "bg-highlight text-on-highlight"
                    : "bg-surface-3 text-muted",
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
