import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, Cpu, Globe2, KeyRound, Monitor, Save, Ticket } from "lucide-react";
import { api } from "../lib/api";
import { useHealth } from "../hooks/useHealth";
import { useSettings } from "../hooks/useRuns";
import { toast } from "../store/toast";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Field, Input } from "../components/ui/Field";
import { ErrorState, SkeletonCard } from "../components/ui/States";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const settings = useSettings();
  const health = useHealth();

  const [groqModel, setGroqModel] = useState("");
  const [geminiModel, setGeminiModel] = useState("");
  const [repeatDefault, setRepeatDefault] = useState(1);

  useEffect(() => {
    if (!settings.data) return;
    setGroqModel(settings.data.models.groq);
    setGeminiModel(settings.data.models.gemini);
    setRepeatDefault(settings.data.repeatDefault);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () =>
      api.updateSettings({
        models: { groq: groqModel, gemini: geminiModel },
        repeatDefault,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved", "Stored server-side in runs/_settings.json.");
    },
    onError: (error: Error) => toast.error("Could not save settings", error.message),
  });

  if (settings.isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonCard rows={4} />
        <SkeletonCard rows={3} />
      </div>
    );
  }

  if (settings.isError) {
    return (
      <ErrorState
        message={(settings.error as Error).message}
        onRetry={() => void settings.refetch()}
      />
    );
  }

  const targets = settings.data?.targets ?? [];

  return (
    <div className="stagger space-y-5">
      <div className="stagger grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Models"
            description="Names only — API keys live in server environment variables."
            actions={<Badge tone="healed">server-side</Badge>}
          />
          <CardBody className="space-y-4">
            <Field label="Groq model" hint="Primary model for test generation and locator healing.">
              {(props) => (
                <Input
                  {...props}
                  value={groqModel}
                  onChange={(event) => setGroqModel(event.target.value)}
                />
              )}
            </Field>
            <Field
              label="Gemini model"
              hint="Fallback model when Groq is rate-limited or unavailable."
            >
              {(props) => (
                <Input
                  {...props}
                  value={geminiModel}
                  onChange={(event) => setGeminiModel(event.target.value)}
                />
              )}
            </Field>
            <Field label="Default repeats" hint="Attempts per test when starting a run (1–10).">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={1}
                  max={10}
                  value={repeatDefault}
                  onChange={(event) =>
                    setRepeatDefault(Math.min(10, Math.max(1, Number(event.target.value) || 1)))
                  }
                />
              )}
            </Field>
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              <Save className="h-4 w-4" aria-hidden />
              Save settings
            </Button>
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Providers"
              description="Detected from environment variables at boot."
            />
            <CardBody className="space-y-2 text-xs">
              {[
                { label: "Groq", ok: health.data?.providers.groq, icon: Bot, vars: "GROQ_API_KEY" },
                {
                  label: "Gemini",
                  ok: health.data?.providers.gemini,
                  icon: Cpu,
                  vars: "GEMINI_API_KEY",
                },
                {
                  label: "Jira",
                  ok: health.data?.providers.jira,
                  icon: Ticket,
                  vars: "JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN",
                },
              ].map(({ label, ok, icon: Icon, vars }) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 transition-colors hover:border-line-strong hover:bg-surface-3"
                >
                  <span className="flex items-center gap-2 text-fg">
                    <Icon className="h-3.5 w-3.5 text-muted" aria-hidden />
                    {label}
                  </span>
                  <span className="flex items-center gap-2">
                    <code className="font-mono text-[10px] text-muted">{vars}</code>
                    <Badge tone={ok ? "passed" : "queued"} dot>
                      {ok ? "configured" : "missing"}
                    </Badge>
                  </span>
                </div>
              ))}
              <p className="pt-1 text-[11px] leading-relaxed text-muted">
                Missing keys fall back to mock mode. Values are never returned by the API.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Allowed targets"
          description="Runs are rejected unless the base URL matches this list."
          actions={<Badge tone="queued">{settings.data?.demoAppVersion ?? "v1"} demo</Badge>}
        />
        <CardBody className="space-y-3">
          {targets.length === 0 ? (
            <p className="text-xs text-muted">
              No explicit allow-list — the built-in defaults are in effect.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {targets.map((target) => (
                <li
                  key={target}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1 font-mono text-[11px] text-fg transition-colors hover:border-line-strong hover:bg-surface-3"
                >
                  <Globe2 className="h-3 w-3 text-muted" aria-hidden />
                  {target}
                </li>
              ))}
            </ul>
          )}
          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
            <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Add entries with <code className="mx-1 font-mono text-fg">ALLOWED_TARGETS</code> in{" "}
            <code className="mx-1 font-mono text-fg">server/.env</code> and restart the API. The
            bundled demo app is always allowed.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Runtime" description="Read-only information about this deployment" />
        <CardBody className="grid gap-3 text-xs sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 transition-colors hover:border-line-strong hover:bg-surface-3">
            <p className="text-[10px] uppercase tracking-wider text-muted">UI version</p>
            <p className="mt-1 font-mono text-fg">1.0.0</p>
          </div>
          <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 transition-colors hover:border-line-strong hover:bg-surface-3">
            <p className="text-[10px] uppercase tracking-wider text-muted">Mode</p>
            <p className="mt-1 flex items-center gap-1.5 font-mono text-fg">
              <Monitor className="h-3 w-3 text-muted" aria-hidden />
              {health.data?.mockMode ? "mock" : "live"}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 transition-colors hover:border-line-strong hover:bg-surface-3">
            <p className="text-[10px] uppercase tracking-wider text-muted">Queue</p>
            <p className="mt-1 font-mono text-fg">
              {health.data?.queue?.busy ? "busy" : "idle"} · {health.data?.queue?.pending ?? 0}{" "}
              pending
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
