import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "./Button";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("shimmer h-4 w-full rounded-md", className)} />;
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="surface-card space-y-3 p-5">
      <Skeleton className="h-3 w-24" />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className={index === 0 ? "h-8 w-2/3" : "h-3 w-full"} />
      ))}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface-2 text-muted">
        {icon ?? <Inbox className="h-5 w-5" aria-hidden />}
      </div>
      <div>
        <p className="text-sm font-medium text-fg">{title}</p>
        {description ? (
          <p className="mx-auto mt-1 max-w-md text-xs text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-failed/40 bg-failed/10 text-failed">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </div>
      <div>
        <p className="text-sm font-medium text-fg">{title}</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
