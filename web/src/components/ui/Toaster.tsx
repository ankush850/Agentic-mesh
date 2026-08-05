import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "../../lib/cn";
import { useToastStore, type ToastTone } from "../../store/toast";

const toneStyles: Record<ToastTone, { border: string; icon: string; Icon: typeof Info }> = {
  info: { border: "border-accent/40", icon: "text-accent", Icon: Info },
  success: { border: "border-passed/40", icon: "text-passed", Icon: CheckCircle2 },
  error: { border: "border-failed/40", icon: "text-failed", Icon: XCircle },
  warning: { border: "border-healed/40", icon: "text-healed", Icon: AlertTriangle },
};

/** Renders the global toast stack. Mounted once by the app shell. */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((toast) => {
        const style = toneStyles[toast.tone];
        return (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border bg-surface px-4 py-3 shadow-xl",
              style.border,
            )}
          >
            <style.Icon className={cn("mt-0.5 h-4 w-4 shrink-0", style.icon)} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">{toast.title}</p>
              {toast.description ? (
                <p className="mt-0.5 text-xs text-muted">{toast.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="rounded p-0.5 text-muted transition-colors hover:text-fg"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
