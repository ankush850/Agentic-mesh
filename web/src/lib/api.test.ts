import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiClientError, artifactUrl } from "./api";

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const health = {
  ok: true,
  version: "1.0.0",
  mockMode: true,
  providers: { groq: false, gemini: false, jira: false },
  queue: { busy: false, pending: 0 },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("parses a valid response against the contract schema", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(health));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.health()).resolves.toMatchObject({ mockMode: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({ headers: { "Content-Type": "application/json" } }),
    );
  });

  it("fails loudly when the server drifts from the contract", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ ok: "yes" })));

    await expect(api.health()).rejects.toMatchObject({ code: "contract_mismatch" });
  });

  it("maps the server error envelope to a typed error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { code: "target_not_allowed", message: "Nope" } },
            { status: 403, statusText: "Forbidden" },
          ),
        ),
    );

    const error = await api.listRuns().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ code: "target_not_allowed", message: "Nope", status: 403 });
  });

  it("reports network failures with a stable code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));

    await expect(api.stats()).rejects.toMatchObject({ code: "network_error" });
  });

  it("serialises query filters and repair decisions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await api.listRepairs({ status: "pending", minConfidence: 0.8 });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/repairs?status=pending&minConfidence=0.8");

    fetchMock.mockResolvedValue(jsonResponse({}));
    await api.reviewRepair("run-1:TC-02:2", "approved", "looks right").catch(() => undefined);

    expect(fetchMock.mock.calls[1][0]).toBe("/api/repairs/run-1%3ATC-02%3A2/review");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ decision: "approved", note: "looks right" }),
    });
  });

  it("builds export links the browser can download directly", () => {
    expect(api.exportUrl("run-1", "md")).toBe("/api/runs/run-1/export?format=md");
  });
});

describe("artifactUrl", () => {
  it("leaves API paths and data URLs untouched", () => {
    expect(artifactUrl("/api/runs/run-1/artifacts/screenshots/a.png")).toBe(
      "/api/runs/run-1/artifacts/screenshots/a.png",
    );
    expect(artifactUrl("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
  });

  it("prefixes bare engine paths and skips empty values", () => {
    expect(artifactUrl("screenshots/a.png")).toBe("/api/screenshots/a.png");
    expect(artifactUrl(undefined)).toBeUndefined();
  });
});
