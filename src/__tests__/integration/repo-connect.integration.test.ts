import { describe, it, expect } from "vitest";
import * as path from "path";
import { connectRepo } from "../../repo/orchestrator";

const RUN_INTEGRATION = Boolean(
  process.env.TEST_REPO_CONNECT_INTEGRATION === "1" ||
  process.env.TEST_REPO_CONNECT_INTEGRATION === "true"
);

describe("Repo Connect Integration", () => {
  it.runIf(RUN_INTEGRATION)(
    "connects a static fixture repository end-to-end and executes test suite",
    async () => {
      const fixtureDir = path.resolve(process.cwd(), "fixtures/ast-samples/sample-site");

      const stagesEmitted: string[] = [];

      const result = await connectRepo({
        localPath: fixtureDir,
        dryRun: true,
        confirmUntrusted: true,
        onProgress: (event) => {
          stagesEmitted.push(event.stage);
        },
      });

      expect(result.sourceType).toBe("local");
      expect(result.classification.type).toBe("static");
      expect(result.appModel.pages.length).toBeGreaterThan(0);
      expect(result.compressionStats.savingsPercent).toBeDefined();
      expect(result.ticket.key).toMatch(/^SQA-\d+$/);
      expect(result.results).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.htmlReport).toContain("sample-site");
      expect(result.appModel.pages[0].title).toBe("Calculator & Task Tracker");
      expect(result.banner).toContain("Third-party repo, tested locally");

      expect(stagesEmitted).toContain("source");
      expect(stagesEmitted).toContain("classify");
      expect(stagesEmitted).toContain("ast");
      expect(stagesEmitted).toContain("compress");
      expect(stagesEmitted).toContain("ticket");
      expect(stagesEmitted).toContain("launch");
      expect(stagesEmitted).toContain("teardown");
    },
    60_000
  );

  it("safely skips integration test when TEST_REPO_CONNECT_INTEGRATION is not set", () => {
    if (!RUN_INTEGRATION) {
      expect(true).toBe(true);
    }
  });
});
