import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bug,
  ArrowRight,
  Check,
  ClipboardList,
  FlaskConical,
  ListChecks,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import type { AppVersion, TestCase, Ticket } from "../../../shared/contracts";
import { api } from "../lib/api";
import { useHealth } from "../hooks/useHealth";
import { useSettings } from "../hooks/useRuns";
import { cn } from "../lib/cn";
import { toast } from "../store/toast";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Field, Input, Select, Switch, Textarea } from "../components/ui/Field";
import { EmptyState, ErrorState, SkeletonCard } from "../components/ui/States";

type Phase = 1 | 2 | 3;

const STEPS = [
  { id: 1, label: "Ticket", hint: "Pull the acceptance criteria", icon: ClipboardList },
  { id: 2, label: "Tests", hint: "Review generated steps", icon: ListChecks },
  { id: 3, label: "Run", hint: "Pick the target", icon: Play },
] as const;

const DEMO_URL = "file:///demo/index.html";

export default function NewRun() {
  const navigate = useNavigate();
  const settings = useSettings();
  const health = useHealth();
  const jiraConnected = Boolean(health.data?.providers.jira) && !health.data?.mockMode;

  const [phase, setPhase] = useState<Phase>(1);
  const [ticketKey, setTicketKey] = useState("");
  // Real Jira is the default whenever credentials are configured; mock only as fallback.
  const [useMock, setUseMock] = useState<boolean | undefined>(undefined);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [tests, setTests] = useState<TestCase[]>([]);
  const generatedFor = useRef<string | null>(null);

  const [targetMode, setTargetMode] = useState<"demo" | "url">("demo");
  const [baseUrl, setBaseUrl] = useState("http://localhost:3000");
  const [appVersion, setAppVersion] = useState<AppVersion>("v1");
  const [repeat, setRepeat] = useState(1);
  const [demoPage, setDemoPage] = useState("Croupt.html");
  const [autoBug, setAutoBug] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadDemo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".html")) {
      toast.error("Invalid file", "Please select a .html file.");
      return;
    }

    try {
      setIsUploading(true);
      const content = await file.text();
      const res = await api.uploadDemoPage({ filename: file.name, content });
      await demoPages.refetch();
      setDemoPage(res.page);
      toast.success("Demo page uploaded", `Added ${res.page} and selected it.`);
    } catch (err) {
      toast.error("Upload failed", (err as Error).message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const demoPages = useQuery({
    queryKey: ["demo-pages"],
    queryFn: api.demoPages,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (settings.data?.repeatDefault) setRepeat(settings.data.repeatDefault);
    const firstTarget = settings.data?.targets?.[0];
    if (firstTarget && !firstTarget.startsWith("file:")) setBaseUrl(firstTarget);
  }, [settings.data]);

  // Auto-sync selected demo page with available pages
  useEffect(() => {
    if (demoPages.data?.pages?.length && !demoPages.data.pages.includes(demoPage)) {
      setDemoPage(demoPages.data.pages[0]);
    }
  }, [demoPages.data?.pages]);

  const effectiveUseMock = useMock ?? !jiraConnected;

  const fetchTicket = useMutation({
    mutationFn: () => api.fetchTicket({ key: ticketKey.trim() || undefined, useMock: effectiveUseMock }),
    onSuccess: (result) => {
      setTicket(result);
      setTests([]);
      toast.success(`Loaded ${result.key}`, result.title);
      setPhase(2);
    },
    onError: (error: Error) => toast.error("Could not fetch the ticket", error.message),
  });

  const generate = useMutation({
    mutationFn: (input: Ticket) => api.generateTests({ ticket: input }),
    onSuccess: (result) => {
      setTests(result.testCases);
      if (result.testCases.length === 0) {
        toast.warning("No tests generated", "Add at least one acceptance criterion and try again.");
      } else {
        toast.success(`${result.testCases.length} tests ready`, "Edit any step before running.");
      }
    },
    onError: (error: Error) => toast.error("Test generation failed", error.message),
  });

  const createRun = useMutation({
    mutationFn: () =>
      api.createRun({
        testCases: tests,
        baseUrl: targetMode === "demo" ? DEMO_URL : baseUrl.trim(),
        repeat,
        appVersion,
        ticketKey: ticket?.key,
        useMock: effectiveUseMock,
        demoPage: targetMode === "demo" ? demoPage : undefined,
        autoBug,
      }),
    onSuccess: (result) => {
      toast.success("Run queued", "Streaming the agent activity now.");
      navigate(`/runs/${result.runId}/live`);
    },
    onError: (error: Error) => toast.error("Could not start the run", error.message),
  });

  useEffect(() => {
    if (phase !== 2 || !ticket) return;
    // Generate once per ticket; retries are explicit via the Regenerate button.
    if (generatedFor.current === ticket.key) return;
    generatedFor.current = ticket.key;
    if (tests.length === 0) generate.mutate(ticket);
  }, [phase, ticket, tests.length, generate]);

  const patchTest = (index: number, patch: Partial<TestCase>) => {
    setTests((current) => current.map((test, i) => (i === index ? { ...test, ...patch } : test)));
  };

  const patchStep = (testIndex: number, stepIndex: number, description: string) => {
    setTests((current) =>
      current.map((test, i) =>
        i === testIndex
          ? {
              ...test,
              steps: test.steps.map((step, s) =>
                s === stepIndex ? { ...step, description } : step,
              ),
            }
          : test,
      ),
    );
  };

  const removeStep = (testIndex: number, stepIndex: number) => {
    setTests((current) =>
      current.map((test, i) =>
        i === testIndex ? { ...test, steps: test.steps.filter((_, s) => s !== stepIndex) } : test,
      ),
    );
  };

  const addStep = (testIndex: number) => {
    setTests((current) =>
      current.map((test, i) =>
        i === testIndex ? { ...test, steps: [...test.steps, { description: "New step" }] } : test,
      ),
    );
  };

  const removeTest = (index: number) =>
    setTests((current) => current.filter((_, i) => i !== index));

  const testsValid =
    tests.length > 0 &&
    tests.every(
      (test) =>
        test.title.trim().length > 0 &&
        test.criterion.trim().length > 0 &&
        test.steps.length > 0 &&
        test.steps.every((step) => step.description.trim().length > 0),
    );

  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="flex flex-wrap items-center gap-3">
          {STEPS.map((step, index) => {
            const active = phase === step.id;
            const complete = phase > step.id;
            const Icon = step.icon;
            return (
              <div key={step.id} className="flex flex-1 items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (step.id === 1 || (step.id === 2 && ticket) || (step.id === 3 && ticket))
                      setPhase(step.id);
                  }}
                  disabled={step.id > 1 && !ticket}
                  className={cn(
                    "flex min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                    active ? "bg-surface-2" : "hover:bg-surface-2/60",
                    step.id > 1 && !ticket && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                      complete && "border-passed/40 bg-passed/15 text-passed",
                      active && !complete && "border-accent/50 bg-accent/15 text-accent",
                      !active && !complete && "border-line bg-surface-3 text-muted",
                    )}
                  >
                    {complete ? (
                      <Check className="h-4 w-4" aria-hidden />
                    ) : (
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-xs font-semibold",
                        active ? "text-fg" : "text-muted",
                      )}
                    >
                      {step.id}. {step.label}
                    </span>
                    <span className="block truncate text-[11px] text-muted">{step.hint}</span>
                  </span>
                </button>
                {index < STEPS.length - 1 ? (
                  <span aria-hidden className="hidden h-px flex-1 bg-line sm:block" />
                ) : null}
              </div>
            );
          })}
        </CardBody>
      </Card>

      {phase === 1 ? (
        <Card>
          <CardHeader
            title="Where do the tests come from?"
            description={
              jiraConnected
                ? "Jira is connected — fetch a real ticket by its key. Or switch to the bundled mock ticket for an offline demo."
                : "Jira credentials are not configured on the server, so the bundled mock ticket is used. Add JIRA_* variables to .env to enable real tickets."
            }
          />
          <CardBody className="space-y-4">
            <Field
              label="Jira ticket key"
              hint={
                effectiveUseMock
                  ? "Ignored while the mock ticket is enabled."
                  : "Example: SQA-42. The ticket must exist in your Jira project and contain acceptance criteria."
              }
            >
              {(props) => (
                // The button sits in the *control* row, not beside the whole
                // Field. It used to be a sibling of the Field in an `items-end`
                // flex row, which aligned it to the bottom of the two-line hint
                // and left it hanging ~38px below the input it belongs to.
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    {...props}
                    className="min-w-56 flex-1"
                    value={ticketKey}
                    onChange={(event) => setTicketKey(event.target.value)}
                    placeholder={jiraConnected ? "SQA-42" : "QA-101"}
                    disabled={effectiveUseMock}
                  />
                  <Button
                    loading={fetchTicket.isPending}
                    disabled={
                      health.isPending || (!effectiveUseMock && ticketKey.trim().length === 0)
                    }
                    onClick={() => fetchTicket.mutate()}
                  >
                    <Wand2 className="h-4 w-4" aria-hidden />
                    {effectiveUseMock ? "Load mock ticket" : "Fetch from Jira"}
                  </Button>
                </div>
              )}
            </Field>

            <div className="max-w-md rounded-xl border border-line bg-surface-2 p-3">
              <Switch
                checked={effectiveUseMock}
                onChange={setUseMock}
                label="Use the bundled mock ticket"
                description={
                  jiraConnected
                    ? "Off by default — turn on to demo without touching your Jira project."
                    : "No Jira credentials required — great for demos and offline work."
                }
              />
            </div>

            {fetchTicket.isError ? (
              <p role="alert" className="text-xs text-failed">
                {(fetchTicket.error as Error).message}
              </p>
            ) : null}

            {ticket ? (
              <div className="rounded-xl border border-passed/30 bg-passed/5 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="passed">{ticket.key}</Badge>
                  <span className="text-sm font-medium text-fg">{ticket.title}</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">{ticket.description}</p>
                <ul className="mt-3 space-y-1.5">
                  {ticket.acceptanceCriteria.map((criterion) => (
                    <li key={criterion} className="flex gap-2 text-xs text-fg">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-passed" aria-hidden />
                      {criterion}
                    </li>
                  ))}
                </ul>
                <Button className="mt-4" size="sm" onClick={() => setPhase(2)}>
                  Continue to tests
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            ) : (
              <EmptyState
                icon={<ClipboardList className="h-5 w-5" aria-hidden />}
                title="No ticket loaded"
                description="Fetch a ticket to turn its acceptance criteria into executable tests."
              />
            )}
          </CardBody>
        </Card>
      ) : null}

      {phase === 2 ? (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Generated test plan"
              description="Every step is editable — the agent executes exactly what you see."
              actions={
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={generate.isPending}
                    disabled={!ticket}
                    onClick={() => ticket && generate.mutate(ticket)}
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    Regenerate
                  </Button>
                  <Button size="sm" disabled={!testsValid} onClick={() => setPhase(3)}>
                    Continue
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
              }
            />
            <CardBody className="space-y-3">
              {generate.isPending ? (
                <>
                  <SkeletonCard rows={4} />
                  <SkeletonCard rows={4} />
                </>
              ) : generate.isError ? (
                <ErrorState
                  message={(generate.error as Error).message}
                  onRetry={() => ticket && generate.mutate(ticket)}
                />
              ) : tests.length === 0 ? (
                <EmptyState
                  icon={<Sparkles className="h-5 w-5" aria-hidden />}
                  title="Nothing generated yet"
                  description="Use Regenerate to ask the generator again."
                />
              ) : (
                tests.map((test, testIndex) => (
                  <div key={test.id} className="rounded-xl border border-line bg-surface-2/50 p-4">
                    <div className="flex flex-wrap items-start gap-2">
                      <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-muted">
                        {test.id}
                      </span>
                      <Input
                        value={test.title}
                        onChange={(event) => patchTest(testIndex, { title: event.target.value })}
                        aria-label={`Title for ${test.id}`}
                        className="min-w-48 flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTest(testIndex)}
                        aria-label={`Remove ${test.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-failed" aria-hidden />
                      </Button>
                    </div>

                    <div className="mt-3">
                      <Field label="Acceptance criterion">
                        {(props) => (
                          <Textarea
                            {...props}
                            value={test.criterion}
                            rows={2}
                            onChange={(event) =>
                              patchTest(testIndex, { criterion: event.target.value })
                            }
                            className="min-h-16 text-xs"
                          />
                        )}
                      </Field>
                    </div>

                    <ol className="mt-3 space-y-2">
                      {test.steps.map((step, stepIndex) => (
                        <li key={stepIndex} className="flex items-center gap-2">
                          <span className="w-6 shrink-0 text-right font-mono text-[10px] text-muted">
                            {stepIndex + 1}
                          </span>
                          <Input
                            value={step.description}
                            onChange={(event) =>
                              patchStep(testIndex, stepIndex, event.target.value)
                            }
                            aria-label={`Step ${stepIndex + 1} of ${test.id}`}
                            className="h-9 flex-1 text-xs"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeStep(testIndex, stepIndex)}
                            disabled={test.steps.length <= 1}
                            aria-label="Remove step"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted" aria-hidden />
                          </Button>
                        </li>
                      ))}
                    </ol>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => addStep(testIndex)}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      Add step
                    </Button>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setPhase(1)}>
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Back to ticket
            </Button>
            <p className="text-[11px] text-muted">
              {tests.length} test{tests.length === 1 ? "" : "s"} ·{" "}
              {tests.reduce((sum, test) => sum + test.steps.length, 0)} steps
            </p>
          </div>
        </div>
      ) : null}

      {phase === 3 ? (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Target and options"
              description="Only allow-listed targets can be executed."
            />
            <CardBody className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Target">
                  {(props) => (
                    <Select
                      {...props}
                      value={targetMode}
                      onChange={(event) => setTargetMode(event.target.value as "demo" | "url")}
                    >
                      <option value="demo">Bundled demo app</option>
                      <option value="url">Custom URL</option>
                    </Select>
                  )}
                </Field>

                {targetMode === "demo" ? (
                  <Field
                    label="Demo page"
                    hint="Pick the UI that matches the ticket, or upload your own HTML file."
                  >
                    {(props) => (
                      <div className="flex items-center gap-2">
                        <Select
                          {...props}
                          value={demoPage}
                          onChange={(event) => setDemoPage(event.target.value)}
                          className="flex-1"
                        >
                          {(demoPages.data?.pages?.length
                            ? demoPages.data.pages
                            : ["Croupt.html"]
                          ).map((page) => (
                            <option key={page} value={page}>
                              {page}
                            </option>
                          ))}
                        </Select>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".html"
                          className="hidden"
                          onChange={handleUploadDemo}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs"
                        >
                          <Upload className="h-3.5 w-3.5" aria-hidden />
                          {isUploading ? "Uploading..." : "Upload HTML"}
                        </Button>
                      </div>
                    )}
                  </Field>
                ) : (
                  <Field label="Base URL" hint="Must match ALLOWED_TARGETS on the server.">
                    {(props) => (
                      <Input
                        {...props}
                        value={baseUrl}
                        onChange={(event) => setBaseUrl(event.target.value)}
                        placeholder="http://localhost:3000"
                      />
                    )}
                  </Field>
                )}
                {targetMode === "demo" && demoPage === "index.html" ? (
                  <Field
                    label="Demo version"
                    hint="v2 renames the demo's ids so you can watch self-healing repair broken locators."
                  >
                    {(props) => (
                      <Select
                        {...props}
                        value={appVersion}
                        onChange={(event) => setAppVersion(event.target.value as AppVersion)}
                      >
                        <option value="v1">v1 — stable ids</option>
                        <option value="v2">v2 — broken ids (heal demo)</option>
                      </Select>
                    )}
                  </Field>
                ) : (
                  <div className="hidden sm:block" aria-hidden />
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Repeat each test" hint="More attempts reveal flakiness (1–10).">
                  {(props) => (
                    <Input
                      {...props}
                      type="number"
                      min={1}
                      max={10}
                      value={repeat}
                      onChange={(event) =>
                        setRepeat(Math.min(10, Math.max(1, Number(event.target.value) || 1)))
                      }
                    />
                  )}
                </Field>
                <Field label="Attach to ticket">
                  {(props) => <Input {...props} value={ticket?.key ?? ""} readOnly />}
                </Field>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 p-3">
                <div>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-fg">
                    <Bug className="h-3.5 w-3.5 text-failed" aria-hidden />
                    Auto-file Jira Bug Tickets
                  </span>
                  <span className="block text-[11px] text-muted">
                    Automatically create a Jira Bug with failure screenshot when tests fail permanently.
                  </span>
                </div>
                <Switch checked={autoBug} onChange={setAutoBug} label="Auto-file Jira Bug" />
              </div>

              {targetMode === "url" && !/^https?:\/\//.test(baseUrl) ? (
                <p className="text-xs text-failed">A custom target must be an http(s) URL.</p>
              ) : null}

              <div className="rounded-xl border border-line bg-surface-2 p-3 text-[11px] leading-relaxed text-muted">
                <span className="font-medium text-fg">{tests.length} tests</span> ·{" "}
                {tests.reduce((sum, test) => sum + test.steps.length, 0)} steps · ×{repeat} repeat
                {repeat === 1 ? "" : "s"} ·{" "}
                {targetMode === "demo"
                  ? demoPage === "index.html"
                    ? `demo/index.html (${appVersion})`
                    : `demo/${demoPage}`
                  : baseUrl || "no target"}
              </div>

              {createRun.isError ? (
                <p role="alert" className="text-xs text-failed">
                  {(createRun.error as Error).message}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={() => setPhase(2)}>
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Back to tests
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setTargetMode("demo");
                  setAppVersion("v2");
                  toast.info("Demo mode armed", "Running against the renamed ids of demo v2.");
                }}
              >
                <FlaskConical className="h-4 w-4" aria-hidden />
                Break the app first
              </Button>
              <Button
                loading={createRun.isPending}
                disabled={!testsValid || (targetMode === "url" && !/^https?:\/\//.test(baseUrl))}
                onClick={() => createRun.mutate()}
              >
                <Play className="h-4 w-4" aria-hidden />
                Start run
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
