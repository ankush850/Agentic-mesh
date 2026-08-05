import type { RunStatus, StepStatus, TestResultStatus } from "../../../shared/contracts";

export function formatDuration(ms: number | undefined | null): string {
  if (ms === undefined || ms === null || Number.isNaN(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function percent(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export function statusLabel(status: TestResultStatus | RunStatus | StepStatus): string {
  switch (status) {
    case "passed":
      return "Passed";
    case "failed":
      return "Failed";
    case "healed":
      return "Self-healed";
    case "flaky":
      return "Flaky";
    case "running":
      return "Running";
    case "queued":
      return "Queued";
    case "cancelled":
      return "Cancelled";
    case "error":
      return "Error";
    case "pending":
      return "Pending";
    default:
      return status;
  }
}

export function shortId(id: string): string {
  return id.length > 18 ? `${id.slice(0, 9)}…${id.slice(-5)}` : id;
}

/** Human label for a run target: hostname for URLs, a friendly name for the demo file. */
export function targetLabel(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    return url.protocol === "file:" ? "demo app" : url.host;
  } catch {
    return baseUrl;
  }
}
