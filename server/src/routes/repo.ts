import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { connectRepo, ConnectRepoOptions } from "../../../src/repo/orchestrator";
import { resolveRepoSource } from "../../../src/repo/repoSource";
import { parseRepository } from "../../../src/repo/astParser";
import { generateTicketFromAppModel } from "../../../src/jira/ticketFromRepo";
import { parse } from "../http";

export const ConnectRepoBodySchema = z
  .object({
    url: z.string().url().optional(),
    localPath: z.string().optional(),
    generateTicket: z.boolean().optional(),
    ticketKey: z.string().optional(),
    mutate: z.boolean().optional(),
    confirmUntrusted: z.boolean().optional(),
    dryRun: z.boolean().optional(),
    autoBug: z.boolean().optional(),
  })
  .refine((data) => data.url || data.localPath, {
    message: "Either 'url' or 'localPath' must be provided.",
  });

export const GenerateTicketBodySchema = z
  .object({
    url: z.string().url().optional(),
    localPath: z.string().optional(),
    focus: z.string().optional(),
    dryRun: z.boolean().optional(),
  })
  .refine((data) => data.url || data.localPath, {
    message: "Either 'url' or 'localPath' must be provided.",
  });

export default async function repoRoutes(app: FastifyInstance) {
  /**
   * POST /api/repo/connect
   * Connects a repository (URL or local folder), parses AST, generates/executes tests,
   * self-heals locators, and builds execution reports.
   */
  app.post("/repo/connect", async (request, reply) => {
    const body = parse(ConnectRepoBodySchema, request.body);

    const result = await connectRepo({
      url: body.url,
      localPath: body.localPath,
      generateTicket: body.generateTicket,
      ticketKey: body.ticketKey,
      mutate: body.mutate,
      confirmUntrusted: body.confirmUntrusted ?? true,
      dryRun: body.dryRun ?? true,
      autoBug: body.autoBug,
    });

    return reply.status(200).send(result);
  });

  /**
   * POST /api/repo/ticket
   * Reads the repo folder (through the AppModel, not raw files) and produces
   * an acceptance-criteria-grounded ticket in project SQA.
   */
  app.post("/repo/ticket", async (request, reply) => {
    const body = parse(GenerateTicketBodySchema, request.body);

    const source = await resolveRepoSource({
      url: body.url,
      localPath: body.localPath,
    });

    try {
      const appModel = await parseRepository(source.repoPath);
      const ticket = await generateTicketFromAppModel({
        appModel,
        focus: body.focus,
        dryRun: body.dryRun ?? true,
      });

      return reply.status(200).send({
        ticket,
        appModelSummary: {
          pagesCount: appModel.pages.length,
          componentsCount: appModel.components.length,
          elementsCount: appModel.interactiveElements.length,
        },
      });
    } finally {
      await source.cleanup().catch(() => {});
    }
  });
}
