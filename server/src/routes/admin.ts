import type { FastifyInstance } from "fastify";
import {
  DemoAppVersionRequestSchema,
  JiraPostRequestSchema,
  SettingsUpdateSchema,
  type RunSummary,
  type Settings,
  type Stats,
} from "../../../shared/contracts";
import { JiraClient } from "../../../src/jira/jiraClient";
import { logger } from "../../../src/logger";
import { env, providerStatus, DEFAULT_TARGETS } from "../env";
import { badRequest, notFound, parse } from "../http";
import { getSettings, setDemoAppVersion, updateSettings } from "../settings";
import { listRuns, readRun, toRepairViews } from "../store";

function buildJiraPreview(runId: string, ticketKey: string) {
  const run = readRun(runId);
  if (!run) throw notFound("Run");
  const { summary } = run;
  const repairs = toRepairViews(run);

  const lines = [
    `*Agentic-mesh autonomous run* \`${runId}\``,
    `Ticket: ${ticketKey} | Target: ${summary.baseUrl} (demo ${summary.appVersion})`,
    `Total: ${summary.total} | Passed: ${summary.passed} | Healed: ${summary.healed} | Flaky: ${summary.flaky} | Failed: ${summary.failed}`,
    `Self-healing repairs: ${repairs.length}`,
    ...repairs
      .slice(0, 5)
      .map(
        (repair) =>
          `- ${repair.testId} step ${repair.stepIndex + 1}: ${repair.oldLocator} -> ${repair.newLocator} (${Math.round(repair.confidence * 100)}%)`,
      ),
  ];
  return { preview: lines.join("\n"), summary };
}

export default async function adminRoutes(app: FastifyInstance) {
  app.get("/stats", async (): Promise<Stats> => {
    const runs = listRuns();
    const summaries = runs.map((run) => run.summary);
    const tests = runs.flatMap((run) => run.tests);
    const repairs = runs.flatMap((run) => toRepairViews(run));

    const totals = {
      runs: summaries.length,
      tests: tests.length,
      passed: summaries.reduce((sum, entry) => sum + entry.passed, 0),
      failed: summaries.reduce((sum, entry) => sum + entry.failed, 0),
      healed: summaries.reduce((sum, entry) => sum + entry.healed, 0),
      flaky: summaries.reduce((sum, entry) => sum + entry.flaky, 0),
      repairs: repairs.length,
    };

    const chronological: RunSummary[] = [...summaries].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );

    const passRateTrend = chronological.slice(-12).map((summary) => ({
      runId: summary.runId,
      label: summary.runId.replace(/^run-/, "").slice(0, 11),
      passRate:
        summary.total > 0
          ? Math.round(((summary.passed + summary.healed) / summary.total) * 100)
          : 0,
      createdAt: summary.createdAt,
    }));

    const steps = runs.flatMap((run) => run.steps);

    return {
      totals,
      passRateTrend,
      // One generation call per criterion plus one repair decision per heal.
      llmCalls: tests.length + repairs.length,
      cacheHits: steps.filter((step) => step.cached).length,
      repairsAutoApproved: repairs.filter(
        (repair) =>
          repair.review?.decision === "approved" || (!repair.review && repair.confidence >= 0.9),
      ).length,
      // Estimates: ~0.8 min of manual execution per test, ~2.5 min of debugging per repair.
      estimatedMinutesSaved: Math.round((tests.length * 0.8 + repairs.length * 2.5) * 10) / 10,
    };
  });

  app.post("/demo/app-version", async (request) => {
    const body = parse(DemoAppVersionRequestSchema, request.body);
    const version = setDemoAppVersion(body.version);
    logger.info({ version }, "Demo app version switched");
    return { version };
  });

  app.post("/jira/post-result", async (request) => {
    const body = parse(JiraPostRequestSchema, request.body);
    const { preview } = buildJiraPreview(body.runId, body.ticketKey);
    const dryRun = body.dryRun !== false;

    if (dryRun) {
      return { preview, posted: false };
    }
    if (!providerStatus().jira) {
      throw badRequest(
        "Jira is not configured on the server. Set JIRA_* environment variables first.",
      );
    }

    const posted = await new JiraClient().postResult(body.ticketKey, preview);
    return { preview, posted };
  });

  app.get("/settings", async (): Promise<Settings> => {
    const settings = getSettings();
    return {
      models: settings.models,
      repeatDefault: settings.repeatDefault,
      targets: env.allowedTargets.length > 0 ? env.allowedTargets : DEFAULT_TARGETS,
      theme: settings.theme,
      demoAppVersion: settings.demoAppVersion,
    };
  });

  app.put("/settings", async (request) => {
    const body = parse(SettingsUpdateSchema, request.body);
    const next = updateSettings({
      repeatDefault: body.repeatDefault,
      theme: body.theme,
      models: body.models && {
        groq: body.models.groq ?? getSettings().models.groq,
        gemini: body.models.gemini ?? getSettings().models.gemini,
      },
    });

    return {
      models: next.models,
      repeatDefault: next.repeatDefault,
      targets: env.allowedTargets.length > 0 ? env.allowedTargets : DEFAULT_TARGETS,
      theme: next.theme,
      demoAppVersion: next.demoAppVersion,
    } satisfies Settings;
  });
}
