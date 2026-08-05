import { useEffect, useRef, useState } from "react";
import { RunEventSchema, type RunEvent } from "../../../shared/contracts";
import { isTerminalRunStatus } from "../lib/status";

export interface RunStream {
  events: RunEvent[];
  connected: boolean;
  finished: boolean;
  /** Set when the EventSource drops; the hook keeps retrying on its own. */
  streamError: string | null;
}

/**
 * Subscribes to `/api/runs/:id/events`.
 *
 * The server replays `events.ndjson` on connect, so a late subscriber (or a
 * reconnect) still receives the full history. Duplicate ids are dropped.
 */
export function useRunEvents(runId: string | undefined): RunStream {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [finished, setFinished] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!runId) return;

    setEvents([]);
    setFinished(false);
    setStreamError(null);
    seen.current = new Set<string>();

    const source = new EventSource(`/api/runs/${encodeURIComponent(runId)}/events`);

    source.onopen = () => {
      setConnected(true);
      setStreamError(null);
    };

    source.onerror = () => {
      setConnected(false);
      // EventSource retries automatically; surface it without breaking the view.
      setStreamError("Live stream interrupted — reconnecting…");
    };

    source.onmessage = (message: MessageEvent<string>) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(message.data);
      } catch {
        return;
      }
      const result = RunEventSchema.safeParse(parsed);
      if (!result.success) return;

      const runEvent = result.data;
      if (seen.current.has(runEvent.id)) return;
      seen.current.add(runEvent.id);

      setEvents((previous) => [...previous, runEvent]);

      // Ignore a `run.finished` whose summary is still running: the run is not
      // actually over, and closing here would freeze the console mid-flight.
      const terminal =
        runEvent.type === "run.error" ||
        (runEvent.type === "run.finished" && isTerminalRunStatus(runEvent.data.summary.status));

      if (terminal) {
        setFinished(true);
        setConnected(false);
        source.close();
      }
    };

    return () => source.close();
  }, [runId]);

  return { events, connected, finished, streamError };
}
