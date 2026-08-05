import * as fs from "fs";
import * as path from "path";
import type { RunEvent, RunEventPayloads, RunEventType } from "../../shared/contracts";
import { logger } from "../../src/logger";
import { runDir } from "./store";

type Listener = (event: RunEvent) => void;

/**
 * In-process event bus for live run telemetry.
 *
 * Every event is appended to `runs/<id>/events.ndjson` so the history survives
 * restarts and SSE clients can replay from `Last-Event-ID`.
 */
class EventBus {
  private listeners = new Map<string, Set<Listener>>();
  private counters = new Map<string, number>();

  private nextId(runId: string): string {
    let counter = this.counters.get(runId);
    if (counter === undefined) {
      counter = this.read(runId).length;
    }
    counter += 1;
    this.counters.set(runId, counter);
    return String(counter);
  }

  private eventsFile(runId: string): string {
    return path.join(runDir(runId), "events.ndjson");
  }

  emit<T extends RunEventType>(runId: string, type: T, data: RunEventPayloads[T]): RunEvent {
    const event = {
      id: this.nextId(runId),
      runId,
      ts: new Date().toISOString(),
      type,
      data,
    } as RunEvent;

    try {
      const dir = runDir(runId);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(this.eventsFile(runId), JSON.stringify(event) + "\n", "utf-8");
    } catch (err) {
      logger.warn({ err, runId }, "Could not persist run event");
    }

    for (const listener of this.listeners.get(runId) ?? []) {
      try {
        listener(event);
      } catch (err) {
        logger.warn({ err, runId }, "Run event listener failed");
      }
    }
    return event;
  }

  subscribe(runId: string, listener: Listener): () => void {
    const set = this.listeners.get(runId) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(runId, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(runId);
    };
  }

  /** Reads persisted events, optionally only those after `lastEventId`. */
  read(runId: string, lastEventId?: string): RunEvent[] {
    const file = this.eventsFile(runId);
    if (!fs.existsSync(file)) return [];
    const after = lastEventId ? Number.parseInt(lastEventId, 10) : Number.NaN;
    const lines = fs.readFileSync(file, "utf-8").split(/\r?\n/).filter(Boolean);
    const events: RunEvent[] = [];
    for (const line of lines) {
      try {
        const event = JSON.parse(line) as RunEvent;
        if (Number.isNaN(after) || Number.parseInt(event.id, 10) > after) {
          events.push(event);
        }
      } catch {
        // Skip corrupted line.
      }
    }
    return events;
  }

  /** True once the terminal event for a run has been written. */
  isTerminal(runId: string): boolean {
    const events = this.read(runId);
    return events.some((event) => event.type === "run.finished" || event.type === "run.error");
  }
}

export const eventBus = new EventBus();
