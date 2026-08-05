import * as path from "path";
import { DEFAULT_TARGETS, env } from "./env";

/**
 * Target allowlist enforcement. Only the demo app, localhost and saucedemo.com
 * are reachable by default; `ALLOWED_TARGETS` replaces the list entirely.
 */
export function isAllowedTarget(rawUrl: string): boolean {
  const allowlist = env.allowedTargets.length > 0 ? env.allowedTargets : DEFAULT_TARGETS;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol === "file:") {
    const normalised = path.resolve(decodeURIComponent(parsed.pathname.replace(/^\//, "")));
    return normalised === path.resolve(env.demoAppPath);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  const origin = `${parsed.protocol}//${parsed.hostname.toLowerCase()}`;
  return allowlist.some((entry) => {
    try {
      const allowed = new URL(entry);
      const sameHost = `${allowed.protocol}//${allowed.hostname.toLowerCase()}` === origin;
      // An allowlist entry without an explicit port matches any port (localhost dev servers).
      return sameHost && (allowed.port === "" || allowed.port === parsed.port);
    } catch {
      return entry.toLowerCase() === parsed.hostname.toLowerCase();
    }
  });
}

export class TargetNotAllowedError extends Error {
  public readonly code = "target_not_allowed";
  constructor(url: string) {
    super(`Target "${url}" is not in the allowlist. Configure ALLOWED_TARGETS to permit it.`);
  }
}

export function assertAllowedTarget(rawUrl: string): void {
  if (!isAllowedTarget(rawUrl)) {
    throw new TargetNotAllowedError(rawUrl);
  }
}

export class PathTraversalError extends Error {
  public readonly code = "invalid_path";
  constructor(requested: string) {
    super(`Refusing to serve "${requested}" outside of the run directory.`);
  }
}

/** Resolves `relative` inside `rootDir`, rejecting traversal and absolute escapes. */
export function resolveInside(rootDir: string, relative: string): string {
  const root = path.resolve(rootDir);
  const decoded = decodeURIComponent(relative).replace(/^[/\\]+/, "");
  const target = path.resolve(root, decoded);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (target !== root && !target.startsWith(prefix)) {
    throw new PathTraversalError(relative);
  }
  return target;
}

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Fixed-window rate limiter. Keeps the API dependency free. */
export function rateLimit(key: string, limit = env.rateLimitPerMinute, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

/** Trims free-text note input and strips control characters. */
export function sanitizeNote(note: string | undefined): string | undefined {
  if (!note) return undefined;
  return (
    note
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .slice(0, 500)
      .trim() || undefined
  );
}
