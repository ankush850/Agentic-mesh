import * as path from "path";
import type { FastifyInstance } from "fastify";
import { FetchTicketRequestSchema, GenerateTestsRequestSchema } from "../../../shared/contracts";
import {
  criteriaToSteps,
  generateHeuristicTestCases,
} from "../../../src/generator/criteriaToSteps";
import { JiraClient, loadMockTicket } from "../../../src/jira/jiraClient";
import { env, providerStatus } from "../env";
import { badRequest, parse } from "../http";

export default async function intakeRoutes(app: FastifyInstance) {
  /** Fetch a ticket from Jira, or the bundled fixture when Jira is not configured. */
  app.post("/ticket/fetch", async (request) => {
    const body = parse(FetchTicketRequestSchema, request.body ?? {});
    const jiraAvailable = providerStatus().jira && !env.mockMode;

    if (body.useMock || !jiraAvailable) {
      return loadMockTicket(path.join(env.fixturesDir, "mock-ticket.json"));
    }

    // Real Jira mode: a key is required and failures must surface, never silently mock.
    if (!body.key) {
      throw badRequest("A Jira ticket key is required when the mock ticket is disabled.", "ticket_key_required");
    }
    try {
      return await new JiraClient({ strict: true }).fetchTicket(body.key);
    } catch (error) {
      throw badRequest(
        error instanceof Error ? error.message : `Could not fetch Jira ticket ${body.key}`,
        "jira_fetch_failed",
      );
    }
  });

  /** Convert acceptance criteria into executable test cases (LLM, with heuristic fallback). */
  app.post("/tests/generate", async (request) => {
    const body = parse(GenerateTestsRequestSchema, request.body);
    const testCases = env.mockMode
      ? generateHeuristicTestCases(body.ticket)
      : await criteriaToSteps(body.ticket);
    return { testCases };
  });
}
