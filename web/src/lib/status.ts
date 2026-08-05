import type { RunStatus, StepStatus, TestResultStatus } from "../../../shared/contracts";

/**
 * Single source of truth for status colouring.
 *
 * The palette is fixed by the product spec: passed = green, failed = red,
 * healed = amber, flaky = violet. Every place that renders a status pulls its
 * tone from here so the UI can never drift.
 *
 * `color` is a CSS custom property reference, not a literal: the chart code
 * feeds it straight into SVG `fill` / `stroke`, which resolve `var()` against
 * the active theme. That keeps index.css the only place a colour is written
 * down, and makes a chart's tone follow dark/light exactly like the badge does.
 */
export type Tone = "passed" | "failed" | "healed" | "flaky" | "running" | "queued";

interface ToneStyle {
  text: string;
  bg: string;
  border: string;
  dot: string;
  /** Full-tile treatment for KPI boxes. The class itself lives in index.css so
   * the tint stays a single-sourced colour rather than an inline literal. */
  tile: string;
  /** CSS var, for canvas / SVG charts that cannot use Tailwind classes. */
  color: string;
}

export const tones: Record<Tone, ToneStyle> = {
  passed: {
    text: "text-passed",
    bg: "bg-passed/10",
    border: "border-passed/35",
    dot: "bg-passed",
    tile: "tile-passed",
    color: "var(--passed)",
  },
  failed: {
    text: "text-failed",
    bg: "bg-failed/10",
    border: "border-failed/35",
    dot: "bg-failed",
    tile: "tile-failed",
    color: "var(--failed)",
  },
  healed: {
    text: "text-healed",
    bg: "bg-healed/10",
    border: "border-healed/35",
    dot: "bg-healed",
    tile: "tile-healed",
    color: "var(--healed)",
  },
  flaky: {
    text: "text-flaky",
    bg: "bg-flaky/10",
    border: "border-flaky/35",
    dot: "bg-flaky",
    tile: "tile-flaky",
    color: "var(--flaky)",
  },
  running: {
    text: "text-running",
    bg: "bg-running/10",
    border: "border-running/35",
    dot: "bg-running",
    tile: "tile-running",
    color: "var(--running)",
  },
  queued: {
    text: "text-muted",
    bg: "bg-surface-3",
    border: "border-line-strong",
    dot: "bg-queued",
    tile: "tile-queued",
    color: "var(--queued)",
  },
};

const RUN_TONES: Record<RunStatus, Tone> = {
  queued: "queued",
  running: "running",
  passed: "passed",
  failed: "failed",
  cancelled: "queued",
  error: "failed",
};

const STEP_TONES: Record<StepStatus, Tone> = {
  pending: "queued",
  running: "running",
  passed: "passed",
  failed: "failed",
  healed: "healed",
};

export function runTone(status: RunStatus): Tone {
  return RUN_TONES[status];
}

export function stepTone(status: StepStatus): Tone {
  return STEP_TONES[status];
}

/** Accepts `TestResultStatus` plus the looser strings found in test history. */
export function testTone(status: TestResultStatus | string): Tone {
  switch (status) {
    case "passed":
      return "passed";
    case "failed":
      return "failed";
    case "healed":
      return "healed";
    case "flaky":
      return "flaky";
    default:
      return "queued";
  }
}

export function toneOf(status: RunStatus | StepStatus | TestResultStatus | string): Tone {
  if (status in RUN_TONES) return RUN_TONES[status as RunStatus];
  if (status in STEP_TONES) return STEP_TONES[status as StepStatus];
  return testTone(status);
}

/** Human-friendly label used in badges, tables and screen-reader text. */
export function toneLabel(tone: Tone): string {
  switch (tone) {
    case "passed":
      return "Passed";
    case "failed":
      return "Failed";
    case "healed":
      return "Healed";
    case "flaky":
      return "Flaky";
    case "running":
      return "Running";
    default:
      return "Queued";
  }
}

export const isTerminalRunStatus = (status: RunStatus): boolean =>
  status === "passed" || status === "failed" || status === "cancelled" || status === "error";
