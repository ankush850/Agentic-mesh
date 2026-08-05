import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  parseGitHubUrl,
  verifyPublicGitHubRepo,
  validateLocalFolder,
  resolveRepoSource,
  getGitCommitSha,
} from "../repo/repoSource";
import { classifyRepo } from "../repo/repoClassifier";

describe("repoSource", () => {
  describe("parseGitHubUrl", () => {
    it("parses valid github https and git urls", () => {
      const parsed1 = parseGitHubUrl("https://github.com/TaruN-Ruwali/UI_Test.git");
      expect(parsed1).toEqual({ owner: "TaruN-Ruwali", repo: "UI_Test" });

      const parsed2 = parseGitHubUrl("https://github.com/facebook/react");
      expect(parsed2).toEqual({ owner: "facebook", repo: "react" });
    });

    it("returns null for non-github or malformed urls", () => {
      expect(parseGitHubUrl("https://gitlab.com/owner/repo")).toBeNull();
      expect(parseGitHubUrl("not-a-url")).toBeNull();
      expect(parseGitHubUrl("https://github.com/only-owner")).toBeNull();
    });
  });

  describe("verifyPublicGitHubRepo", () => {
    it("returns repo details for public repository under size cap", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ private: false, size: 2048, default_branch: "main" }),
      });

      const res = await verifyPublicGitHubRepo("TaruN-Ruwali", "UI_Test", 10 * 1024 * 1024, mockFetch as any);
      expect(res.sizeBytes).toBe(2048 * 1024);
      expect(res.defaultBranch).toBe("main");
    });

    it("throws if repository is private", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ private: true, size: 1024 }),
      });

      await expect(
        verifyPublicGitHubRepo("org", "private-repo", 10 * 1024 * 1024, mockFetch as any)
      ).rejects.toThrow("private");
    });

    it("throws if repository exceeds size limit", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ private: false, size: 200 * 1024 }), // 200 MB
      });

      await expect(
        verifyPublicGitHubRepo("org", "huge-repo", 100 * 1024 * 1024, mockFetch as any)
      ).rejects.toThrow("exceeds maximum allowed limit");
    });

    it("throws if repository not found (404)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      await expect(
        verifyPublicGitHubRepo("org", "missing-repo", 100 * 1024 * 1024, mockFetch as any)
      ).rejects.toThrow("was not found or is private");
    });
  });

  describe("validateLocalFolder", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sqa-local-test-"));
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("accepts a valid directory", () => {
      const validated = validateLocalFolder(tempDir);
      expect(path.resolve(validated)).toBe(path.resolve(tempDir));
    });

    it("rejects non-existent directory", () => {
      expect(() => validateLocalFolder(path.join(tempDir, "does-not-exist"))).toThrow("does not exist");
    });

    it("rejects a file", () => {
      const filePath = path.join(tempDir, "file.txt");
      fs.writeFileSync(filePath, "hello");
      expect(() => validateLocalFolder(filePath)).toThrow("not a directory");
    });

    it("rejects paths outside allowedRoot", () => {
      const allowedRoot = path.join(tempDir, "allowed");
      const outside = path.join(tempDir, "outside");
      fs.mkdirSync(allowedRoot);
      fs.mkdirSync(outside);

      expect(() => validateLocalFolder(outside, allowedRoot)).toThrow("outside the configured allowed root");
      expect(path.resolve(validateLocalFolder(allowedRoot, allowedRoot))).toBe(path.resolve(allowedRoot));
    });
  });

  describe("resolveRepoSource", () => {
    it("handles local folder in place without deleting on cleanup", async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sqa-resolve-test-"));
      const result = await resolveRepoSource({ localPath: tempDir });

      expect(result.isTemp).toBe(false);
      expect(result.sourceType).toBe("local");
      expect(path.resolve(result.repoPath)).toBe(path.resolve(tempDir));

      await result.cleanup();
      expect(fs.existsSync(tempDir)).toBe(true);

      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("reads git commit SHA if the folder is a git repo", async () => {
      const currentDir = process.cwd();
      const sha = await getGitCommitSha(currentDir);
      if (fs.existsSync(path.join(currentDir, ".git"))) {
        expect(sha).toBeDefined();
        expect(sha?.length).toBeGreaterThan(10);
      } else {
        expect(sha).toBeNull();
      }
    });
  });
});

describe("repoClassifier", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sqa-classify-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("classifies static folder with index.html", () => {
    fs.writeFileSync(path.join(tempDir, "index.html"), "<html><body>Static</body></html>");
    const res = classifyRepo(tempDir);

    expect(res.type).toBe("static");
    expect(res.entryHtml).toBe("index.html");
    expect(res.runPlan.mode).toBe("static");
  });

  it("classifies existing UI_Test folder if present", () => {
    const uiTestPath = path.resolve(process.cwd(), "UI_Test");
    if (fs.existsSync(uiTestPath)) {
      const res = classifyRepo(uiTestPath);
      expect(res.type).toBe("static");
      expect(res.entryHtml).toBe("index.html");
      expect(res.runPlan.mode).toBe("static");
    }
  });

  it("classifies npm project with React and start command", () => {
    const pkg = {
      name: "my-react-app",
      scripts: {
        start: "react-scripts start",
        build: "react-scripts build",
      },
      dependencies: {
        react: "^18.2.0",
      },
    };
    fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify(pkg));

    const res = classifyRepo(tempDir);
    expect(res.type).toBe("npm");
    expect(res.framework).toBe("react");
    expect(res.runPlan.startCmd).toBe("npm start");
    expect(res.runPlan.mode).toBe("npm");
  });

  it("classifies prebuilt dist folder", () => {
    const distDir = path.join(tempDir, "dist");
    fs.mkdirSync(distDir);
    fs.writeFileSync(path.join(distDir, "index.html"), "<html><body>Dist</body></html>");

    const res = classifyRepo(tempDir);
    expect(res.type).toBe("prebuilt");
    expect(res.entryHtml).toBe("dist/index.html");
    expect(res.runPlan.mode).toBe("static");
  });
});
