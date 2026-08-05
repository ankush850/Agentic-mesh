import * as path from "path";
import { resolveRepoSource, RepoSourceResult } from "./repoSource";
import { classifyRepo, RepoClassification } from "./repoClassifier";
import { parseRepository, AppModel } from "./astParser";
import { compressAppModel, CompressedAppModelResult } from "./appModelCompressor";
import { runRepoLocally, RunningRepoInstance } from "./repoRunner";
import { generateTicketFromAppModel, GeneratedTicket } from "../jira/ticketFromRepo";
import { criteriaToSteps } from "../generator/criteriaToSteps";
import { AgenticMeshRunner } from "../runner/sentinelRunner";
import { buildHtmlReport, buildMarkdownReport, computeSummary, ReportSummary } from "../report/reportBuilder";
import { JiraClient } from "../jira/jiraClient";
import { TestResult, Ticket } from "../types";
import { logger } from "../logger";

export type RepoStage =
  | "source"
  | "classify"
  | "ast"
  | "compress"
  | "ticket"
  | "launch"
  | "execute"
  | "report"
  | "teardown"
  | "finished"
  | "error";

export interface RepoStageEvent {
  stage: RepoStage;
  message: string;
  data?: Record<string, any>;
  timestamp: string;
}

export interface ConnectRepoOptions {
  url?: string;
  localPath?: string;
  generateTicket?: boolean;
  ticketKey?: string;
  mutate?: boolean;
  confirmUntrusted?: boolean;
  dryRun?: boolean;
  autoBug?: boolean;
  focus?: string;
  onProgress?: (event: RepoStageEvent) => void;
}

export interface ConnectRepoResult {
  sourceType: "github" | "local";
  sourceLocation: string;
  commitSha: string | null;
  classification: RepoClassification;
  appModel: AppModel;
  compressionStats: CompressedAppModelResult["stats"];
  ticket: Ticket | GeneratedTicket;
  results: TestResult[];
  summary: ReportSummary;
  htmlReport: string;
  markdownReport: string;
  banner: string;
}

/**
 * End-to-end repository ingestion orchestrator.
 */
export async function connectRepo(options: ConnectRepoOptions): Promise<ConnectRepoResult> {
  const emit = (stage: RepoStage, message: string, data?: Record<string, any>) => {
    const event: RepoStageEvent = {
      stage,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
    logger.info({ stage, message }, `[REPO-INGEST] ${message}`);
    if (options.onProgress) {
      options.onProgress(event);
    }
  };

  let repoSource: RepoSourceResult | null = null;
  let runningApp: RunningRepoInstance | null = null;

  try {
    // 1. Ingest Repo Source
    emit("source", "Resolving and verifying repository source...");
    repoSource = await resolveRepoSource({
      url: options.url,
      localPath: options.localPath,
    });
    const sourceLocation = options.url || options.localPath || repoSource.repoPath;
    emit("source", "Repository source verified successfully", {
      repoPath: repoSource.repoPath,
      commitSha: repoSource.commitSha,
    });

    // 2. Classify Architecture & Produce Run Plan
    emit("classify", "Detecting runtime, framework, and build plan...");
    const classification = classifyRepo(repoSource.repoPath);
    emit("classify", `Classified as ${classification.type} (${classification.framework})`, {
      plan: classification.runPlan,
    });

    // 3. AST Parsing -> AppModel
    emit("ast", "Parsing codebase AST across HTML, CSS, and JS/TS/JSX...");
    const appModel = await parseRepository(repoSource.repoPath);
    const elementCount = appModel.stats?.elementCount ?? appModel.interactiveElements.length;
    emit("ast", `Extracted AppModel with ${elementCount} interactive elements`, {
      stats: appModel.stats,
    });

    // 4. Compress AppModel via Existing Token Optimizer
    emit("compress", "Compressing AppModel using Tree-Sitter & Token Optimizer...");
    const compressed = compressAppModel(appModel, { focusPage: options.focus });
    emit("compress", `Optimized tokens: saved ${compressed.stats.savingsPercent}% tokens`, {
      stats: compressed.stats,
    });

    // 5. Ticket Generation / Resolution
    let ticket: Ticket | GeneratedTicket;
    if (options.ticketKey) {
      emit("ticket", `Fetching requested Jira ticket "${options.ticketKey}"...`);
      const hasJiraEnv = Boolean(process.env.JIRA_BASE_URL && process.env.JIRA_API_TOKEN && process.env.JIRA_EMAIL);
      const jiraClient = new JiraClient({
        forceMock: !hasJiraEnv,
        strict: hasJiraEnv,
      });
      ticket = await jiraClient.fetchTicket(options.ticketKey);
    } else {
      emit("ticket", "Generating grounded SQA Jira ticket from AppModel...");
      ticket = await generateTicketFromAppModel({
        appModel,
        focus: options.focus,
        dryRun: options.dryRun ?? true,
      });
      emit("ticket", `Generated ticket ${ticket.key}: "${ticket.title || (ticket as any).summary}"`, {
        key: ticket.key,
        criteriaCount: ticket.acceptanceCriteria.length,
      });
    }

    // 6. Launch Application Locally
    emit("launch", "Launching application locally on 127.0.0.1...");
    runningApp = await runRepoLocally({
      repoPath: repoSource.repoPath,
      classification,
      confirmUntrusted: options.confirmUntrusted ?? true,
      onLog: (line) => emit("launch", line),
    });
    emit("launch", `Application listening and healthy at ${runningApp.url}`);

    // 7. Generate Test Steps & Execute with Tier 0 Self-Healing
    emit("execute", "Converting ticket acceptance criteria into executable steps...");
    const testCases = await criteriaToSteps(ticket);

    emit("execute", `Executing ${testCases.length} test cases with multi-tier healing...`, {
      testCaseCount: testCases.length,
    });

    const runner = new AgenticMeshRunner({
      baseUrl: runningApp.url,
      appModel,
      headless: true,
      autoBug: options.autoBug ?? (!options.dryRun),
      parentTicketKey: ticket.key,
    });

    const results = await runner.runTestCases(testCases);
    await runner.close();

    // 8. Generate Reports
    emit("report", "Compiling HTML and Markdown reports...");
    const summary = computeSummary(results);
    const htmlReport = buildHtmlReport(results, ticket);
    const markdownReport = buildMarkdownReport(results, ticket);

    const banner = `Third-party repo, tested locally, commit ${repoSource.commitSha || "local"}`;
    emit("finished", `Completed test execution: ${summary.passed} passed, ${summary.healed} healed, ${summary.failed} failed.`);

    return {
      sourceType: repoSource.sourceType,
      sourceLocation,
      commitSha: repoSource.commitSha,
      classification,
      appModel,
      compressionStats: compressed.stats,
      ticket,
      results,
      summary,
      htmlReport,
      markdownReport,
      banner,
    };
  } finally {
    // 9. Teardown & Cleanup
    emit("teardown", "Tearing down local instance and cleaning up...");
    if (runningApp) {
      await runningApp.teardown().catch(() => {});
    }
    if (repoSource) {
      await repoSource.cleanup().catch(() => {});
    }
    emit("teardown", "Teardown complete.");
  }
}
