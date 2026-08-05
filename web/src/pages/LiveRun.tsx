import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  CircleDot,
  FileCode2,
  Radio,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useRun } from "../hooks/useRuns";
import { useRunEvents } from "../hooks/useRunEvents";
import { api } from "../lib/api";
import { buildLiveModel, liveProgress } from "../lib/liveModel";
import { formatDuration, percent } from "../lib/format";
import { cn } from "../lib/cn";
import { useLiveStore } from "../store/live";
import { toast } from "../store/toast";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Dialog } from "../components/ui/Dialog";
import { EmptyState, ErrorState, SkeletonCard } from "../components/ui/States";
import { StatusBadge } from "../components/StatusBadge";
import { StepTimeline } from "../components/StepTimeline";

/** Window during which a fresh heal is highlighted in the banner. */
const HEAL_BANNER_MS = 7000;

export default function LiveRun() {
  const { runId } = useParams<{ runId: string }>();
  const detail = useRun(runId);
  const stream = useRunEvents(runId);
  const { selectedTestId, selectTest, follow, setFollow } = useLiveStore();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const model = useMemo(
    () => buildLiveModel(detail.data, stream.events),
    [detail.data, stream.events],
  );
  const progress = liveProgress(model);
  const summary = model.summary ?? detail.data?.summary;
  const running = summary ? summary.status === "running" || summary.status === "queued" : true;
  const finished = summary ? !running || stream.finished : false;

  // Follow the agent: when a test starts running, jump to it.
  useEffect(() => {
    const activeTest = model.tests.find((test) => test.status === "running");
    const fallback = model.tests[0];
    const current = model.tests.find((test) => test.testId === selectedTestId);
    if (follow && activeTest && current?.status !== "running") {
      selectTest(activeTest.testId);
    } else if (!selectedTestId && fallback) {
      selectTest(fallback.testId);
    }
  }, [follow, model.tests, selectedTestId, selectTest]);

  // Auto-scroll the timeline while following the stream.
  useEffect(() => {
    if (!follow) return;
    const node = timelineRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [follow, stream.events.length]);

  const cancel = useMutation({
    mutationFn: () => api.cancelRun(runId as string),
    onSuccess: () => {
      toast.warning("Cancellation requested", "The agent stops after the current step.");
      setConfirmCancel(false);
    },
    onError: (error: Error) => toast.error("Could not cancel the run", error.message),
  });

  const latestHeal = model.heals.at(-1);
  const healFresh =
    latestHeal !== undefined && Date.now() - new Date(latestHeal.at).getTime() < HEAL_BANNER_MS;

  if (detail.isLoading && stream.events.length === 0) {
    return (
      <div className="space-y-4">
        <SkeletonCard rows={3} />
        <SkeletonCard rows={6} />
      </div>
    );
  }

  if (detail.isError && stream.events.length === 0) {
    return (
      <ErrorState
        title="Could not attach to this run"
        message={(detail.error as Error).message}
        onRetry={() => void detail.refetch()}
      />
    );
  }

  const selected = model.tests.find((test) => test.testId === selectedTestId) ?? model.tests[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to={runId ? `/runs/${runId}` : "/runs"}
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to run
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={stream.connected ? "passed" : finished ? "queued" : "healed"} dot>
            {stream.connected ? "Live" : finished ? "Stream closed" : "Reconnecting"}
          </Badge>
          {follow ? <Badge tone="running">Auto-follow</Badge> : <Badge tone="queued">Manual</Badge>}
        </div>
      </div>

      {stream.streamError && !finished ? (
        <p className="flex items-center gap-2 rounded-lg border border-healed/30 bg-healed/10 px-3 py-2 text-xs text-healed">
          <WifiOff className="h-3.5 w-3.5" aria-hidden />
          {stream.streamError} Falling back to polling.
        </p>
      ) : null}

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <StatusBadge status={summary?.status ?? "running"} size="md" />
                {summary?.mock ? <Badge tone="flaky">mock run</Badge> : null}
                {summary?.appVersion ? <Badge tone="queued">{summary.appVersion}</Badge> : null}
              </div>
              <h2 className="truncate text-lg font-semibold tracking-tight text-fg">
                {detail.data?.ticket
                  ? `${detail.data.ticket.key} — ${detail.data.ticket.title}`
                  : "Live run"}
              </h2>
              <p className="mt-0.5 font-mono text-[11px] text-muted">{runId}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {running ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setConfirmCancel(true)}
                  loading={cancel.isPending}
                >
                  <Ban className="h-3.5 w-3.5" aria-hidden />
                  Cancel run
                </Button>
              ) : (
                <Link to={`/runs/${runId}`}>
                  <Button size="sm">
                    <FileCode2 className="h-3.5 w-3.5" aria-hidden />
                    Open report
                  </Button>
                </Link>
              )}
              <a href={runId ? api.exportUrl(runId, "html") : "#"} target="_blank" rel="noreferrer">
                <Button variant="secondary" size="sm">
                  Engine report
                </Button>
              </a>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
              <span>
                {progress.done} of {progress.total} tests complete
              </span>
              <span>{percent(progress.done, Math.max(progress.total, 1))}%</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-surface-3"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.done}
              aria-label="Run progress"
            >
              <motion.div
                className="h-full rounded-full bg-accent"
                initial={false}
                animate={{ width: `${percent(progress.done, Math.max(progress.total, 1))}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
          </div>

          <AnimatePresence>
            {healFresh && latestHeal ? (
              <motion.div
                key={`${latestHeal.testId}-${latestHeal.stepIndex}`}
                initial={{ opacity: 0, y: -8, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                className="overflow-hidden rounded-xl border border-healed/40 bg-healed/10 px-4 py-3"
                role="status"
              >
                <div className="flex items-start gap-3">
                  <motion.span
                    animate={{ rotate: [0, 12, -8, 0], scale: [1, 1.12, 1] }}
                    transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 1.4 }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-healed/50 bg-healed/20 text-healed"
                  >
                    <Sparkles className="h-4 w-4" aria-hidden />
                  </motion.span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-healed">
                      Healing a broken locator — no test failed
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px]">
                      <span className="rounded bg-failed/15 px-1.5 py-0.5 text-failed line-through">
                        {latestHeal.oldLocator}
                      </span>
                      <span aria-hidden className="text-muted">
                        →
                      </span>
                      <span className="rounded bg-passed/15 px-1.5 py-0.5 text-passed">
                        {latestHeal.newLocator}
                      </span>
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                      {latestHeal.modelUsed} · {Math.round(latestHeal.confidence * 100)}% confidence
                      · {latestHeal.testId} step {latestHeal.stepIndex + 1}
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {model.error ? (
            <p
              role="alert"
              className="rounded-lg border border-failed/30 bg-failed/10 px-3 py-2 text-xs text-failed"
            >
              {model.error}
            </p>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <Card className="h-fit">
          <CardHeader
            title="Tests"
            description={`${progress.total} planned`}
            actions={
              <button
                type="button"
                onClick={() => setFollow(!follow)}
                className="text-[11px] text-accent hover:underline"
              >
                {follow ? "Stop following" : "Follow agent"}
              </button>
            }
          />
          <CardBody className="space-y-1 p-2">
            {model.tests.length === 0 ? (
              <EmptyState
                title="Waiting for the agent"
                description="The first test starts shortly."
                className="py-8"
              />
            ) : (
              model.tests.map((test) => {
                const active = test.testId === selected?.testId;
                return (
                  <button
                    key={test.testId}
                    type="button"
                    onClick={() => {
                      selectTest(test.testId);
                      setFollow(false);
                    }}
                    aria-current={active || undefined}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                      active ? "bg-surface-2" : "hover:bg-surface-2/60",
                    )}
                  >
                    <span className="mt-0.5">
                      {test.status === "running" ? (
                        <CircleDot className="h-3.5 w-3.5 animate-pulse text-running" aria-hidden />
                      ) : test.status === "passed" || test.status === "healed" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-passed" aria-hidden />
                      ) : (
                        <span
                          aria-hidden
                          className="block h-3.5 w-3.5 rounded-full border border-line-strong"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-fg">
                        {test.title}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-[10px] text-muted">
                        <span>{test.steps.length} steps</span>
                        {test.durationMs ? <span>{formatDuration(test.durationMs)}</span> : null}
                      </span>
                    </span>
                    {test.status === "healed" ? (
                      <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-healed" aria-hidden />
                    ) : null}
                  </button>
                );
              })
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={selected ? selected.title : "Step timeline"}
            description={selected ? `${selected.steps.length} steps` : "Waiting for the first step"}
            actions={selected ? <StatusBadge status={selected.status} /> : undefined}
          />
          <CardBody>
            <div ref={timelineRef} className="max-h-[540px] overflow-y-auto pr-1">
              {selected ? (
                <StepTimeline
                  steps={selected.steps}
                  reasoning={model.reasoning[selected.testId]}
                  emptyLabel="No steps streamed yet."
                />
              ) : (
                <EmptyState
                  title="Nothing streaming yet"
                  description="Reasoning appears as soon as a step starts."
                />
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
        {stream.connected ? (
          <span className="inline-flex items-center gap-1.5">
            <Wifi className="h-3.5 w-3.5 text-passed" aria-hidden />
            SSE connected — {stream.events.length} events received
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5" aria-hidden />
            Polling for updates
          </span>
        )}
        {model.lastEventAt ? (
          <span>Last event {new Date(model.lastEventAt).toLocaleTimeString()}</span>
        ) : null}
      </div>

      <Dialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancel this run?"
        description="The agent stops after the current step. Finished results are kept."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
              Keep running
            </Button>
            <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>
              Cancel run
            </Button>
          </>
        }
      />
    </div>
  );
}
