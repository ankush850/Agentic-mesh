import type { FastifyReply } from "fastify";
import { z } from "zod";
import { PathTraversalError, TargetNotAllowedError } from "./security";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, "not_found", `${what} not found`);
export const badRequest = (message: string, code = "bad_request") =>
  new ApiError(400, code, message);

/** Validates untrusted input with zod and surfaces a single readable message. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
      .join("; ");
    throw new ApiError(422, "validation_error", message);
  }
  return result.data as z.infer<T>;
}

export function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof ApiError) {
    return reply
      .status(error.statusCode)
      .send({ error: { code: error.code, message: error.message } });
  }
  // Domain errors carry their own code; surface them instead of a generic 500.
  if (error instanceof TargetNotAllowedError) {
    return reply.status(403).send({ error: { code: error.code, message: error.message } });
  }
  if (error instanceof PathTraversalError) {
    return reply.status(400).send({ error: { code: error.code, message: error.message } });
  }
  const message = error instanceof Error ? error.message : String(error);
  return reply.status(500).send({ error: { code: "internal_error", message } });
}
