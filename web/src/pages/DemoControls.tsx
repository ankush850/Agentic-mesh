import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bug, FlaskConical, Sparkles, Wrench } from "lucide-react";
import type { AppVersion } from "../../../shared/contracts";
import { api } from "../lib/api";
import { useHealth } from "../hooks/useHealth";
import { useSettings } from "../hooks/useRuns";
import { cn } from "../lib/cn";
import { toast } from "../store/toast";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { SkeletonCard } from "../components/ui/States";

const DEMO_URL = "file:///demo/index.html";

const RENAMES: Array<{ v1: string; v2: string; role: string }> = [
  { v1: "#username", v2: "#user-account-input", role: "Login identifier" },
  { v1: "#password", v2: "#user-secret-key", role: "Password field" },
  { v1: "#login-btn", v2: "#btn-submit-auth", role: "Submit login" },
  { v1: "#todo-input", v2: "#task-entry-field", role: "Task input" },
  { v1: "#add-todo-btn", v2: "#create-task-button", role: "Add task" },
  { v1: "#logout-btn", v2: "#btn-terminate-session", role: "Log out" },
];

export default function DemoControls() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const settings = useSettings();
  const health = useHealth();
  const [showcasing, setShowcasing] = useState(false);

  const currentVersion: AppVersion = settings.data?.demoAppVersion ?? "v1";

  const setVersion = useMutation({
    mutationFn: (version: AppVersion) => api.setDemoAppVersion(version),
    onSuccess: ({ version }) => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success(
        `Demo app switched to ${version}`,
        version === "v2"
          ? "Every element id changed — locators will break."
          : "Original selectors restored.",
      );
    },
    onError: (error: Error) => toast.error("Could not switch the demo app", error.message),
  });

  async function runShowcase() {
    setShowcasing(true);
    try {
      await api.setDemoAppVersion("v2");
      const ticket = await api.fetchTicket({ useMock: true });
      const { testCases } = await api.generateTests({ ticket });
      if (testCases.length === 0)
        throw new Error("The generator returned no tests for the mock ticket.");
      const { runId } = await api.createRun({
        testCases,
        baseUrl: DEMO_URL,
        repeat: 2,
        appVersion: "v2",
        ticketKey: ticket.key,
      });
      toast.success("Showcase running", "Watch the agent heal the renamed selectors.");
      navigate(`/runs/${runId}/live`);
    } catch (error) {
      toast.error("Showcase failed", (error as Error).message);
    } finally {
      setShowcasing(false);
    }
  }

  if (settings.isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonCard rows={3} />
        <SkeletonCard rows={6} />
      </div>
    );
  }

  return (
    <div className="stagger space-y-5">
      <Card>
        <CardHeader
          title="Break the app"
          description="Switch the bundled demo app to v2. Every element id is renamed, so stored locators stop matching."
          actions={
            <Badge tone={currentVersion === "v2" ? "failed" : "passed"}>
              serving {currentVersion}
            </Badge>
          }
        />
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                {
                  version: "v1" as const,
                  title: "v1 — stable",
                  description: "Original ids. Tests pass with direct selectors.",
                  icon: FlaskConical,
                  tone: "passed" as const,
                },
                {
                  version: "v2" as const,
                  title: "v2 — renamed",
                  description: "All ids changed. Perfect for triggering self-healing.",
                  icon: Bug,
                  tone: "failed" as const,
                },
              ] as const
            ).map(({ version, title, description, icon: Icon, tone }) => {
              const active = currentVersion === version;
              return (
                <button
                  key={version}
                  type="button"
                  onClick={() => setVersion.mutate(version)}
                  aria-pressed={active}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                    active
                      ? "border-accent/50 bg-accent/10"
                      : "border-line bg-surface-2 hover:border-line-strong",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                      tone === "passed"
                        ? "border-passed/35 bg-passed/10 text-passed"
                        : "border-failed/35 bg-failed/10 text-failed",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-medium text-fg">
                      {title}
                      {active ? <Badge tone="running">active</Badge> : null}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                      {description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              loading={setVersion.isPending}
              onClick={() => setVersion.mutate(currentVersion === "v2" ? "v1" : "v2")}
            >
              <Bug className="h-4 w-4" aria-hidden />
              {currentVersion === "v2" ? "Restore v1" : "Break the app (switch to v2)"}
            </Button>
            {health.data?.mockMode ? (
              <span className="text-[11px] text-muted">
                Mock mode: runs replay scripted events, no browser needed.
              </span>
            ) : (
              <span className="text-[11px] text-muted">
                Real mode: a headed Chromium will open for each run.
              </span>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="One-click showcase"
          description="Switch to v2, generate tests from the mock ticket, run them twice and open the live console."
          actions={<Badge tone="healed">~60 seconds</Badge>}
        />
        <CardBody className="space-y-4">
          <ol className="grid gap-2 text-xs text-muted sm:grid-cols-4">
            {[
              "Serve demo v2 (ids renamed)",
              "Generate tests from QA-101",
              "Run each test twice",
              "Watch healing + review repairs",
            ].map((step, index) => (
              <li
                key={step}
                className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2"
              >
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-highlight text-[10px] font-semibold text-on-highlight">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-center gap-2">
            <Button loading={showcasing} onClick={() => void runShowcase()}>
              <Sparkles className="h-4 w-4" aria-hidden />
              Run the showcase
            </Button>
            <Button variant="secondary" onClick={() => navigate("/repairs")}>
              <Wrench className="h-4 w-4" aria-hidden />
              Open repairs
            </Button>
            <Button variant="ghost" onClick={() => navigate("/runs/new")}>
              Configure manually
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Selector map" description="What changes between the two demo versions" />
        <CardBody className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-muted">
                <th scope="col" className="px-3 py-2 font-medium">
                  Element
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  v1
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  v2
                </th>
              </tr>
            </thead>
            <tbody>
              {RENAMES.map((row) => (
                <tr key={row.v1} className="border-b border-line/60 transition-colors hover:bg-surface-2/60">
                  <td className="px-3 py-2 text-muted">{row.role}</td>
                  <td className="px-3 py-2 font-mono text-passed">{row.v1}</td>
                  <td className="px-3 py-2 font-mono text-healed">{row.v2}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
