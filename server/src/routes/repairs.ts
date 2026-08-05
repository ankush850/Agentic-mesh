import type { FastifyInstance } from "fastify";
import {
  RepairListQuerySchema,
  ReviewRequestSchema,
  type ReviewRecord,
} from "../../../shared/contracts";
import { getRedis } from "../../../src/redis";
import { logger } from "../../../src/logger";
import { badRequest, notFound, parse } from "../http";
import { sanitizeNote } from "../security";
import { listRuns, readRun, saveReview, toRepairViews } from "../store";

function splitRepairId(repairId: string): { runId: string; testId: string; stepIndex: number } {
  const parts = repairId.split(":");
  const rawStep = parts.pop();
  const testId = parts.pop();
  const stepIndex = Number(rawStep);
  if (!testId || !rawStep || Number.isNaN(stepIndex) || parts.length === 0) {
    throw badRequest("Repair id must look like <runId>:<testId>:<stepIndex>");
  }
  return { runId: parts.join(":"), testId, stepIndex };
}

/** Best-effort invalidation of the engine step cache for a reverted repair. */
async function clearCachedStep(testId: string, stepDescription: string): Promise<boolean> {
  try {
    const redis = getRedis();
    if (!redis) return false;
    await redis.del(`step:${testId}:${stepDescription}`);
    return true;
  } catch (error) {
    logger.warn({ error, testId }, "Could not clear cached step for reverted repair");
    return false;
  }
}

export default async function repairRoutes(app: FastifyInstance) {
  app.get("/repairs", async (request) => {
    const query = parse(RepairListQuerySchema, request.query ?? {});
    return listRuns()
      .flatMap((run) => toRepairViews(run))
      .filter((repair) => {
        if (query.status === "pending") return repair.review === null;
        if (query.status) return repair.review?.decision === query.status;
        return true;
      })
      .filter((repair) => (query.runId ? repair.runId === query.runId : true))
      .filter((repair) =>
        query.model ? repair.modelUsed.toLowerCase().includes(query.model.toLowerCase()) : true,
      )
      .filter((repair) =>
        query.minConfidence === undefined ? true : repair.confidence >= query.minConfidence,
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  });

  app.post("/repairs/:id/review", async (request) => {
    const repairId = decodeURIComponent((request.params as { id: string }).id);
    const body = parse(ReviewRequestSchema, request.body);

    const { runId, testId, stepIndex } = splitRepairId(repairId);
    const run = readRun(runId);
    if (!run) throw notFound("Run");

    const target = toRepairViews(run).find((repair) => repair.repairId === repairId);
    if (!target) throw notFound("Repair");

    const review: ReviewRecord = {
      repairId,
      decision: body.decision,
      note: sanitizeNote(body.note),
      reviewedAt: new Date().toISOString(),
    };

    saveReview(run, review);

    if (body.decision === "reverted") {
      const cleared = await clearCachedStep(testId, target.stepDescription);
      logger.info({ repairId, stepIndex, cleared }, "Repair reverted");
    }

    return { ...target, review };
  });
}
