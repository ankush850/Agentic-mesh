import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { runRepoLocally, startStaticServer, waitForHealthy } from "../repo/repoRunner";
import { RepoClassification } from "../repo/repoClassifier";

describe("repoRunner", () => {
  const tmpDir = path.join(os.tmpdir(), "agentic-mesh-runner-test-" + Date.now());

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "index.html"), "<html><body>Hello Static</body></html>");
    fs.writeFileSync(path.join(tmpDir, "style.css"), "body { color: blue; }");
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("starts a local static server on 127.0.0.1 with a random free port and serves assets", async () => {
    const { server, port, url } = await startStaticServer(tmpDir);

    expect(port).toBeGreaterThan(1000);
    expect(url).toBe(`http://127.0.0.1:${port}`);

    const resHtml = await fetch(url);
    expect(resHtml.status).toBe(200);
    expect(await resHtml.text()).toContain("Hello Static");

    const resCss = await fetch(`${url}/style.css`);
    expect(resCss.status).toBe(200);
    expect(await resCss.text()).toContain("color: blue;");

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("runs a static repo via runRepoLocally and tears it down cleanly", async () => {
    const classification: RepoClassification = {
      type: "static",
      framework: "none",
      entryHtml: "index.html",
      hasPackageJson: false,
      runPlan: {
        mode: "static",
        rootDir: tmpDir,
        installCmd: null,
        startCmd: null,
        isExperimental: false,
        description: "Static test site",
      },
    };

    const instance = await runRepoLocally({
      repoPath: tmpDir,
      classification,
    });

    expect(instance.mode).toBe("static");
    expect(instance.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+/);

    const check = await fetch(instance.url);
    expect(check.status).toBe(200);

    await instance.teardown();

    // Verify teardown stopped the server
    await expect(fetch(instance.url)).rejects.toThrow();
  });

  it("refuses to run unknown experimental repos without confirmUntrusted: true", async () => {
    const classification: RepoClassification = {
      type: "unknown",
      framework: "none",
      entryHtml: null,
      hasPackageJson: false,
      runPlan: {
        mode: "static",
        rootDir: tmpDir,
        installCmd: null,
        startCmd: null,
        isExperimental: true,
        description: "Unknown repo",
      },
    };

    await expect(
      runRepoLocally({
        repoPath: tmpDir,
        classification,
        confirmUntrusted: false,
      })
    ).rejects.toThrow(/requires explicit confirmation/i);
  });
});
