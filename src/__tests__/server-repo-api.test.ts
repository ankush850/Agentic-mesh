import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-mesh-repo-api-"));
process.env.UI_MOCK = "1";
process.env.RUNS_DIR = path.join(tmpRoot, "runs");
process.env.RATE_LIMIT_PER_MINUTE = "100000";
process.env.ALLOWED_TARGETS = "";

const { buildApp } = await import("../../server/src/app");

describe("Server Repo API (/api/repo/*)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
  });

  describe("POST /api/repo/ticket", () => {
    it("generates an SQA ticket with acceptance criteria from local UI_Test", async () => {
      const uiTestFolder = path.resolve(process.cwd(), "UI_Test");
      const folderToTest = fs.existsSync(uiTestFolder) ? uiTestFolder : tmpRoot;

      const res = await app.inject({
        method: "POST",
        url: "/api/repo/ticket",
        payload: { localPath: folderToTest, dryRun: true },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.ticket).toBeDefined();
      expect(json.ticket.key).toMatch(/^SQA-\d+$/);
      expect(json.ticket.labels).toContain("agentic-mesh-generated");
      expect(json.ticket.reviewNotice).toBe("auto-generated, needs human review");
      expect(json.ticket.acceptanceCriteria.length).toBeGreaterThan(0);
      expect(json.appModelSummary).toBeDefined();
      expect(json.appModelSummary.pagesCount).toBeGreaterThanOrEqual(1);
    });

    it("rejects request when neither url nor localPath is supplied", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/repo/ticket",
        payload: { dryRun: true },
      });

      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe("POST /api/repo/connect", () => {
    it("rejects connect request without url or localPath", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/repo/connect",
        payload: { dryRun: true },
      });

      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });

    it("runs connectRepo on static fixture site and returns summary, banner, and stats", async () => {
      // Create static test fixture
      const fixtureDir = path.join(tmpRoot, "static-site");
      fs.mkdirSync(fixtureDir, { recursive: true });
      fs.writeFileSync(
        path.join(fixtureDir, "index.html"),
        `<!DOCTYPE html><html><body><button id="cta-btn">Click Me</button></body></html>`
      );

      const res = await app.inject({
        method: "POST",
        url: "/api/repo/connect",
        payload: {
          localPath: fixtureDir,
          dryRun: true,
          confirmUntrusted: true,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.sourceType).toBe("local");
      expect(json.banner).toContain("Third-party repo, tested locally");
      expect(json.appModel).toBeDefined();
      expect(json.compressionStats).toBeDefined();
      expect(json.ticket).toBeDefined();
      expect(json.summary).toBeDefined();
    });
  });
});

