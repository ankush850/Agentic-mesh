import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as http from "http";
import { compressAppModel } from "../repo/appModelCompressor";
import {
  getFreePort,
  startStaticServer,
  runRepoLocally,
} from "../repo/repoRunner";
import { AppModel } from "../repo/astParser";
import { classifyRepo } from "../repo/repoClassifier";

describe("appModelCompressor", () => {
  const sampleAppModel: AppModel = {
    repoPath: "/app",
    totalFilesParsed: 2,
    parseErrors: [],
    components: [],
    pages: [
      {
        routeOrFile: "login.html",
        title: "Login Page",
        forms: [
          {
            id: "login-form",
            method: "POST",
            sourceFile: "login.html",
            startLine: 10,
            fields: [
              {
                tag: "input",
                id: "username",
                name: "username",
                type: "text",
                placeholder: "Username",
                required: true,
                sourceFingerprint: "fp1",
              },
              {
                tag: "input",
                id: "password",
                name: "password",
                type: "password",
                placeholder: "Password",
                required: true,
                sourceFingerprint: "fp2",
              },
            ],
            submitButtonText: "Sign In",
            submitSelector: "#login-btn",
          },
        ],
        interactiveElements: [
          {
            tag: "button",
            id: "login-btn",
            visibleText: "Sign In",
            sourceFile: "login.html",
            startLine: 15,
            treePosition: "body > form > button",
            sourceFingerprint: "fp3",
            eventHandlers: ["onclick"],
          },
        ],
        links: [
          {
            text: "Forgot Password",
            href: "/forgot.html",
            sourceFile: "login.html",
            startLine: 20,
          },
        ],
        conditionalRenderHints: ["error && <Alert />"],
      },
      {
        routeOrFile: "dashboard.html",
        title: "User Dashboard",
        forms: [],
        interactiveElements: [
          {
            tag: "button",
            id: "logout-btn",
            visibleText: "Log Out",
            sourceFile: "dashboard.html",
            startLine: 5,
            treePosition: "body > header > button",
            sourceFingerprint: "fp4",
            eventHandlers: ["onclick"],
          },
        ],
        links: [],
        conditionalRenderHints: [],
      },
    ],
  };

  it("compresses AppModel through the existing optimizer and calculates token savings", () => {
    const result = compressAppModel(sampleAppModel);

    expect(result.optimizedContext).toBeDefined();
    expect(result.optimizedContext).toContain("AGENTIC-MESH TREE-SITTER OPTIMIZED CODEBASE CONTEXT");
    expect(result.optimizedContext).toContain("login.html");
    expect(result.optimizedContext).toContain("dashboard.html");

    expect(result.stats.beforeTokens).toBeGreaterThan(0);
    expect(result.stats.afterTokens).toBeGreaterThan(0);
    expect(result.stats.pageCount).toBe(2);
  });

  it("filters pages when focusPage option is provided", () => {
    const result = compressAppModel(sampleAppModel, { focusPage: "dashboard" });

    expect(result.optimizedContext).toContain("dashboard.html");
    expect(result.optimizedContext).not.toContain("login.html");
    expect(result.stats.pageCount).toBe(1);
  });
});

describe("repoRunner", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sqa-runner-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("allocates a random free port on 127.0.0.1", async () => {
    const port = await getFreePort();
    expect(port).toBeGreaterThan(1024);
    expect(port).toBeLessThan(65535);
  });

  it("serves static files, prevents directory traversal, and handles root entry", async () => {
    fs.writeFileSync(path.join(tempDir, "index.html"), "<h1>Agentic-mesh Home</h1>");
    fs.writeFileSync(path.join(tempDir, "style.css"), "body { color: red; }");

    const port = await getFreePort();
    const { server, url } = await startStaticServer(tempDir, port, "index.html");

    try {
      // 1. Fetch root
      const resRoot = await fetch(url);
      expect(resRoot.status).toBe(200);
      const textRoot = await resRoot.text();
      expect(textRoot).toContain("Agentic-mesh Home");

      // 2. Fetch style.css
      const resCss = await fetch(`http://127.0.0.1:${port}/style.css`);
      expect(resCss.status).toBe(200);
      expect(resCss.headers.get("content-type")).toContain("text/css");

      // 3. Security: prevent traversal outside root
      const status = await new Promise<number>((resolve) => {
        const req = http.get(
          {
            hostname: "127.0.0.1",
            port,
            path: "/../secret.txt",
          },
          (res) => resolve(res.statusCode || 0)
        );
        req.on("error", () => resolve(0));
      });
      expect(status).toBe(403);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("runs a static repo locally and tears down cleanly", async () => {
    fs.writeFileSync(path.join(tempDir, "index.html"), "<html><body>App Loaded</body></html>");
    const classification = classifyRepo(tempDir);

    const instance = await runRepoLocally({
      repoPath: tempDir,
      classification,
    });

    try {
      expect(instance.url).toContain("127.0.0.1");
      const res = await fetch(instance.url);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("App Loaded");
    } finally {
      await instance.teardown();
    }
  });

  it("requires confirmUntrusted for unknown/experimental repos", async () => {
    // Empty directory has no html and no package.json -> unknown/experimental
    const classification = classifyRepo(tempDir);
    expect(classification.type).toBe("unknown");

    await expect(
      runRepoLocally({
        repoPath: tempDir,
        classification,
        confirmUntrusted: false,
      })
    ).rejects.toThrow("confirmUntrusted: true");
  });
});
