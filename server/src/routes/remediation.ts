import type { FastifyPluginAsync } from "fastify";
import { createHealedPR } from "../../../remediation/gitops_pr";
import { readRun } from "../store";

const remediationRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { runId: string } }>("/runs/:runId/create-pr", async (request, reply) => {
    const { runId } = request.params;
    const run = readRun(runId);

    if (!run) {
      return reply.status(404).send({ error: { message: `Run ${runId} not found` } });
    }

    const repairs = (run.repairs || []).map((r) => ({
      oldLocator: r.oldLocator,
      newLocator: r.newLocator,
      confidence: r.confidence,
    }));

    const result = await createHealedPR(runId, repairs);
    return reply.send(result);
  });
};

export default remediationRoutes;
