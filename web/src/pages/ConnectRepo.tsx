import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  GitBranch,
  Folder,
  Sparkles,
  Play,
  FileText,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  ArrowRight,
  Plus,
  Trash2,
  Cpu,
} from "lucide-react";
import { api } from "../lib/api";
import { toast } from "../store/toast";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Input, Textarea, Switch } from "../components/ui/Field";

interface CriterionDraft {
  text: string;
  evidence?: { elements: string[]; source: string };
}

interface TicketPreviewState {
  key: string;
  summary: string;
  description: string;
  acceptanceCriteria: CriterionDraft[];
  reviewNotice: string;
  contentHash?: string;
  labels: string[];
}

const STAGES = [
  { key: "source", label: "Source" },
  { key: "classify", label: "Classify" },
  { key: "ast", label: "AST Parse" },
  { key: "compress", label: "Compress" },
  { key: "ticket", label: "Jira Ticket" },
  { key: "launch", label: "Local App" },
  { key: "execute", label: "Playwright" },
  { key: "report", label: "Reports" },
] as const;

export default function ConnectRepo() {
  const [sourceMode, setSourceMode] = useState<"github" | "local">("local");
  const [githubUrl, setGithubUrl] = useState("https://github.com/TaruN-Ruwali/UI_Test.git");
  const [localPath, setLocalPath] = useState("UI_Test");
  const [focus, setFocus] = useState("");
  const [existingTicketKey, setExistingTicketKey] = useState("SQA-34");
  const [confirmUntrusted, setConfirmUntrusted] = useState(true);
  const [dryRun, setDryRun] = useState(false);
  const [autoBug, setAutoBug] = useState(true);

  // Results State
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [completedStages, setCompletedStages] = useState<string[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [appModelStats, setAppModelStats] = useState<{
    pagesCount: number;
    componentsCount: number;
    elementsCount: number;
  } | null>(null);
  const [tokenSavings, setTokenSavings] = useState<{
    beforeTokens: number;
    afterTokens: number;
    savingsPercent: number;
  } | null>(null);
  const [ticketDraft, setTicketDraft] = useState<TicketPreviewState | null>(null);
  const [runResult, setRunResult] = useState<any | null>(null);

  // Mutation: Generate Ticket
  const ticketMutation = useMutation({
    mutationFn: async () => {
      setActiveStage("ast");
      const res = await api.generateRepoTicket({
        url: sourceMode === "github" ? githubUrl : undefined,
        localPath: sourceMode === "local" ? localPath : undefined,
        focus: focus || undefined,
        dryRun,
      });
      return res;
    },
    onSuccess: (data) => {
      setActiveStage(null);
      setAppModelStats(data.appModelSummary);
      setTicketDraft({
        key: data.ticket.key,
        summary: data.ticket.summary,
        description: data.ticket.description,
        reviewNotice: data.ticket.reviewNotice,
        contentHash: data.ticket.contentHash,
        labels: data.ticket.labels,
        acceptanceCriteria: data.ticket.acceptanceCriteria.map((c, i) => ({
          text: c,
          evidence: data.ticket.evidence?.find((e) => e.criterionIndex === i),
        })),
      });
      toast.success("Ticket Generated", `Grounded ticket ${data.ticket.key} created.`);
    },
    onError: (err: any) => {
      setActiveStage(null);
      toast.error("Ticket Generation Failed", err.message || "Failed to generate ticket.");
    },
  });

  // Mutation: Connect Repo & Run Pipeline
  const connectMutation = useMutation({
    mutationFn: async () => {
      setActiveStage("source");
      setCompletedStages([]);
      setRunResult(null);

      const timer = setInterval(() => {
        setActiveStage((prev) => {
          if (!prev) return "source";
          const idx = STAGES.findIndex((s) => s.key === prev);
          if (idx < STAGES.length - 1) {
            setCompletedStages((c) => [...new Set([...c, prev])]);
            return STAGES[idx + 1].key;
          }
          return prev;
        });
      }, 900);

      try {
        const res = await api.connectRepo({
          url: sourceMode === "github" ? githubUrl : undefined,
          localPath: sourceMode === "local" ? localPath : undefined,
          confirmUntrusted,
          dryRun,
          autoBug,
          ticketKey: existingTicketKey.trim() || ticketDraft?.key || undefined,
        });
        clearInterval(timer);
        return res;
      } catch (e) {
        clearInterval(timer);
        throw e;
      }
    },
    onSuccess: (data) => {
      setActiveStage(null);
      setCompletedStages(STAGES.map((s) => s.key));
      setBanner(data.banner);
      setRunResult(data);
      if (data.compressionStats) {
        setTokenSavings(data.compressionStats);
      }
      if (data.appModel?.stats) {
        setAppModelStats({
          pagesCount: data.appModel.pages?.length || 0,
          componentsCount: data.appModel.components?.length || 0,
          elementsCount: data.appModel.interactiveElements?.length || 0,
        });
      }
      toast.success("Execution Completed", `Tests executed for ${data.ticket.key}.`);
    },
    onError: (err: any) => {
      setActiveStage(null);
      toast.error("Connection Failed", err.message || "Pipeline execution failed.");
    },
  });

  const handleUpdateCriterion = (index: number, newText: string) => {
    if (!ticketDraft) return;
    const next = [...ticketDraft.acceptanceCriteria];
    next[index] = { ...next[index], text: newText };
    setTicketDraft({ ...ticketDraft, acceptanceCriteria: next });
  };

  const handleRemoveCriterion = (index: number) => {
    if (!ticketDraft) return;
    const next = ticketDraft.acceptanceCriteria.filter((_, i) => i !== index);
    setTicketDraft({ ...ticketDraft, acceptanceCriteria: next });
  };

  const handleAddCriterion = () => {
    if (!ticketDraft) return;
    const next = [
      ...ticketDraft.acceptanceCriteria,
      { text: "Given the page, when user interacts, then outcome should be verified" },
    ];
    setTicketDraft({ ...ticketDraft, acceptanceCriteria: next });
  };

  const sourceSelector = (
    <div className="flex rounded-lg border border-line p-1 bg-surface-2 text-xs">
      <button
        type="button"
        onClick={() => setSourceMode("local")}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition ${
          sourceMode === "local" ? "bg-surface shadow text-accent" : "text-muted"
        }`}
      >
        <Folder className="h-3.5 w-3.5" />
        Local Folder
      </button>
      <button
        type="button"
        onClick={() => setSourceMode("github")}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition ${
          sourceMode === "github" ? "bg-surface shadow text-accent" : "text-muted"
        }`}
      >
        <GitBranch className="h-3.5 w-3.5" />
        GitHub URL
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Third-Party Banner */}
      {banner && (
        <div className="flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-fg shadow-sm">
          <ShieldAlert className="h-5 w-5 text-accent shrink-0" />
          <span className="font-medium">{banner}</span>
          <span className="ml-auto text-xs text-muted">Sandbox isolation: local child process</span>
        </div>
      )}

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-fg">Connect Repository</h1>
        <p className="mt-1 text-sm text-muted">
          Ingest any GitHub repo or local folder, parse its AST into a typed AppModel, optimize
          tokens with Tree-sitter, generate grounded Jira tickets, and execute tests with Tier 0
          self-healing.
        </p>
      </div>

      {/* Main Connection Input Panel */}
      <Card>
        <CardHeader
          title="Repository Source"
          description="Provide a local folder or public GitHub repository"
          actions={sourceSelector}
        />
        <CardBody className="space-y-4">
          {sourceMode === "local" ? (
            <div>
              <label className="block text-xs font-medium text-fg mb-1">
                Local Folder Path (Read-Only)
              </label>
              <div className="flex gap-2">
                <Input
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  placeholder="e.g. UI_Test or D:/repos/my-app"
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  onClick={() => setLocalPath("UI_Test")}
                  className="text-xs shrink-0"
                >
                  Use UI_Test Demo
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted">
                Read in place without modifying source files. If build/install is needed, an
                isolated temporary copy is used.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-fg mb-1">Public GitHub URL</label>
              <Input
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/owner/repo.git"
                className="font-mono text-xs"
              />
              <p className="mt-1 text-xs text-muted">
                Cloned securely via <code>--depth 1</code> with a 100 MB size cap. Cleaned up
                automatically on teardown.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-fg mb-1">
                Attach Existing Jira Ticket Key (Optional)
              </label>
              <Input
                value={existingTicketKey}
                onChange={(e) => setExistingTicketKey(e.target.value)}
                placeholder="e.g. SQA-34 (leave blank to auto-generate)"
                className="text-xs font-mono"
              />
              <p className="mt-1 text-xs text-muted">
                Run directly against a Jira ticket like SQA-34.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-fg mb-1">
                Focus Page or Feature (Optional)
              </label>
              <Input
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="e.g. login, dashboard, checkout"
                className="text-xs"
              />
            </div>
            <div className="space-y-3">
              <Switch
                label="Confirm Untrusted Repos"
                description="Allow running unknown project frameworks"
                checked={confirmUntrusted}
                onChange={setConfirmUntrusted}
              />
              <Switch
                label="Dry Run Mode"
                description="Save to local fixtures without pushing to Jira"
                checked={dryRun}
                onChange={setDryRun}
              />
              <Switch
                label="Auto-file Jira Bug Tickets"
                description="Automatically create a Jira Bug with failure screenshot when tests fail"
                checked={autoBug}
                onChange={setAutoBug}
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-line pt-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Dry Run Mode:</span>
              <Badge tone={dryRun ? "running" : "passed"}>
                {dryRun ? "Local Fixtures (Mock)" : "Real Jira Push"}
              </Badge>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                disabled={ticketMutation.isPending || connectMutation.isPending}
                onClick={() => ticketMutation.mutate()}
                className="gap-2"
              >
                {ticketMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                ) : (
                  <Sparkles className="h-4 w-4 text-accent" />
                )}
                Generate SQA Ticket
              </Button>

              <Button
                variant="primary"
                disabled={ticketMutation.isPending || connectMutation.isPending}
                onClick={() => connectMutation.mutate()}
                className="gap-2"
              >
                {connectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Connect & Run Pipeline
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Stage Tracker */}
      {(activeStage || completedStages.length > 0) && (
        <Card>
          <CardHeader
            title="Pipeline Stage Tracker"
            description="Live execution flow from AST parsing to local runner and Tier 0 healing"
          />
          <CardBody>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {STAGES.map((s) => {
                const isCompleted = completedStages.includes(s.key);
                const isActive = activeStage === s.key;
                return (
                  <div
                    key={s.key}
                    className={`flex flex-col items-center justify-center rounded-lg border p-2 text-center text-xs transition ${
                      isActive
                        ? "border-accent bg-accent/10 font-medium text-accent"
                        : isCompleted
                        ? "border-passed/30 bg-passed/10 text-passed"
                        : "border-line bg-surface-2 text-muted"
                    }`}
                  >
                    {isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin mb-1 text-accent" />
                    ) : isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 mb-1 text-passed" />
                    ) : (
                      <div className="h-4 w-4 mb-1 rounded-full border border-muted/40" />
                    )}
                    <span>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* AppModel Summary & Token-Savings Badges */}
      {(appModelStats || tokenSavings) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardBody className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-accent shrink-0" />
              <div>
                <p className="text-xs text-muted">Parsed Pages</p>
                <p className="text-xl font-bold text-fg">{appModelStats?.pagesCount ?? 0}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-3">
              <Cpu className="h-8 w-8 text-cyan-400 shrink-0" />
              <div>
                <p className="text-xs text-muted">Components</p>
                <p className="text-xl font-bold text-fg">{appModelStats?.componentsCount ?? 0}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-accent shrink-0" />
              <div>
                <p className="text-xs text-muted">Interactive Elements</p>
                <p className="text-xl font-bold text-fg">{appModelStats?.elementsCount ?? 0}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-passed/20 flex items-center justify-center text-passed font-bold text-xs">
                %
              </div>
              <div>
                <p className="text-xs text-muted">Token Optimizer</p>
                <Badge tone="passed">
                  {tokenSavings ? `Saved ${tokenSavings.savingsPercent}%` : "Tree-Sitter Ready"}
                </Badge>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Editable Ticket Preview */}
      {ticketDraft && (
        <Card>
          <CardHeader
            title={`Generated Jira Ticket: ${ticketDraft.key}`}
            description="Auto-generated acceptance criteria with AST grounding evidence"
            actions={
              <div className="flex items-center gap-2">
                <Badge tone="flaky">{ticketDraft.reviewNotice}</Badge>
                <span className="text-xs text-muted font-mono">
                  Hash: {ticketDraft.contentHash?.slice(0, 8)}...
                </span>
              </div>
            }
          />
          <CardBody className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-fg mb-1">Summary</label>
              <Input
                value={ticketDraft.summary}
                onChange={(e) => setTicketDraft({ ...ticketDraft, summary: e.target.value })}
                className="font-medium text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-fg mb-1">Description</label>
              <Textarea
                rows={3}
                value={ticketDraft.description}
                onChange={(e) => setTicketDraft({ ...ticketDraft, description: e.target.value })}
                className="text-xs font-mono"
              />
            </div>

            {/* Acceptance Criteria */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-fg">
                  Acceptance Criteria (Gherkin Scenarios with AST Evidence)
                </label>
                <Button variant="ghost" onClick={handleAddCriterion} className="gap-1 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Add Criterion
                </Button>
              </div>

              <div className="space-y-2">
                {ticketDraft.acceptanceCriteria.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface-2 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold text-accent mt-2 shrink-0">
                        AC-{idx + 1}
                      </span>
                      <Input
                        value={item.text}
                        onChange={(e) => handleUpdateCriterion(idx, e.target.value)}
                        className="text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCriterion(idx)}
                        className="text-muted hover:text-failed transition p-1.5 mt-1 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* AST Evidence Tag */}
                    {item.evidence && (
                      <div className="flex items-center gap-2 text-[11px] text-muted pl-8">
                        <span className="font-semibold text-cyan-400">Grounding Evidence:</span>
                        <span>{item.evidence.elements.join(", ")}</span>
                        <code className="text-accent ml-auto">[{item.evidence.source}]</code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
              <span>Saved in fixtures/generated-tickets/{ticketDraft.key}.json</span>
              <Button
                variant="primary"
                disabled={connectMutation.isPending}
                onClick={() => connectMutation.mutate()}
                className="gap-2"
              >
                Execute Suite with Healed Locators
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Execution Results Summary */}
      {runResult && (
        <Card>
          <CardHeader
            title="Execution Report"
            description="Playwright test results, duration, and self-healed locators"
            actions={
              <div className="flex gap-2">
                <Badge tone="passed">{runResult.summary.passed} Passed</Badge>
                <Badge tone="healed">{runResult.summary.healed} Healed</Badge>
                <Badge tone={runResult.summary.failed > 0 ? "failed" : "passed"}>
                  {runResult.summary.failed} Failed
                </Badge>
              </div>
            }
          />
          <CardBody className="space-y-4">
            <div className="rounded-lg bg-surface-2 p-4 font-mono text-xs text-fg space-y-2 border border-line">
              <p>
                <strong>Target:</strong> {runResult.sourceLocation} ({runResult.sourceType})
              </p>
              <p>
                <strong>SHA:</strong> {runResult.commitSha || "Local directory"}
              </p>
              <p>
                <strong>Duration:</strong> {(runResult.summary.totalDurationMs / 1000).toFixed(2)}s
              </p>
              <p>
                <strong>Repairs Applied:</strong> {runResult.summary.repairsCount}
              </p>
            </div>

            {/* Test Results Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
                Executed Scenarios
              </h4>
              <div className="divide-y divide-line rounded-lg border border-line overflow-hidden">
                {runResult.results.map((r: any) => (
                  <div
                    key={r.testId}
                    className="flex items-center justify-between p-3 bg-surface hover:bg-surface-2 transition text-xs"
                  >
                    <div>
                      <span className="font-semibold text-fg mr-2">{r.testId}:</span>
                      <span className="text-muted">{r.title}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted">{(r.durationMs / 1000).toFixed(2)}s</span>
                      <Badge tone={r.status}>{r.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
