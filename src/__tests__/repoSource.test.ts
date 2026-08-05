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

describe("repoSource", () => {
  describe("parseGitHubUrl", () => {
    it("correctly parses standard GitHub HTTPS URLs with and without .git", () => {
      expect(parseGitHubUrl("https://github.com/TaruN-Ruwali/UI_Test.git")).toEqual({
        owner: "TaruN-Ruwali",
        repo: "UI_Test",
      });
      expect(parseGitHubUrl("https://github.com/facebook/react")).toEqual({
        owner: "facebook",
        repo: "react",
      });
      expect(parseGitHubUrl("https://github.com/owner/repo/")).toEqual({
        owner: "owner",
        repo: "repo",
      });
    });

    it("returns null for non-github URLs or malformed strings", () => {
      expect(parseGitHubUrl("https://gitlab.com/owner/repo")).toBeNull();
      expect(parseGitHubUrl("not-a-url")).toBeNull();
      expect(parseGitHubUrl("https://github.com/")).toBeNull();
    });
  });

  describe("verifyPublicGitHubRepo", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("succeeds for public repo within size limits", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ private: false, size: 1024, default_branch: "main" }),
      } as any);

      const result = await verifyPublicGitHubRepo("owner", "repo", 10 * 1024 * 1024);
      expect(result.sizeBytes).toBe(1024 * 1024);
      expect(result.defaultBranch).toBe("main");
    });

    it("rejects private repo", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ private: true, size: 500 }),
      } as any);

      await expect(verifyPublicGitHubRepo("owner", "private-repo")).rejects.toThrow(
        /is private\. Only public repositories are allowed/
      );
    });

    it("rejects repo exceeding size limit", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ private: false, size: 150 * 1024 }), // 150 MB
      } as any);

      await expect(
        verifyPublicGitHubRepo("owner", "huge-repo", 100 * 1024 * 1024)
      ).rejects.toThrow(/exceeds maximum allowed limit/);
    });

    it("handles 404 not found", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "Not Found",
      } as any);

      await expect(verifyPublicGitHubRepo("owner", "nonexistent")).rejects.toThrow(
        /was not found or is private/
      );
    });
  });

  describe("validateLocalFolder", () => {
    const testDir = path.join(os.tmpdir(), "agentic-mesh-test-folder-" + Date.now());

    beforeEach(() => {
      fs.mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("accepts existing valid directories", () => {
      const resolved = validateLocalFolder(testDir);
      expect(resolved).toBe(path.resolve(testDir));
    });

    it("throws if folder does not exist", () => {
      expect(() => validateLocalFolder(path.join(testDir, "nonexistent"))).toThrow(
        /does not exist/
      );
    });

    it("throws if path is a file, not a directory", () => {
      const filePath = path.join(testDir, "file.txt");
      fs.writeFileSync(filePath, "test");
      expect(() => validateLocalFolder(filePath)).toThrow(/not a directory/);
    });

    it("enforces allowedRoot restriction", () => {
      const allowedRoot = path.join(testDir, "allowed");
      const outsideDir = path.join(testDir, "outside");
      fs.mkdirSync(allowedRoot);
      fs.mkdirSync(outsideDir);

      expect(() => validateLocalFolder(outsideDir, allowedRoot)).toThrow(
        /outside the configured allowed root/
      );
      expect(validateLocalFolder(allowedRoot, allowedRoot)).toBe(path.resolve(allowedRoot));
    });
  });

  describe("resolveRepoSource cleanup guarantee", () => {
    it("never deletes user-supplied local folder on cleanup()", async () => {
      const localDir = path.join(os.tmpdir(), "agentic-mesh-user-repo-" + Date.now());
      fs.mkdirSync(localDir, { recursive: true });
      fs.writeFileSync(path.join(localDir, "index.html"), "<h1>Test</h1>");

      const resolved = await resolveRepoSource({ localPath: localDir });
      expect(resolved.isTemp).toBe(false);
      expect(resolved.sourceType).toBe("local");

      // Execute cleanup
      await resolved.cleanup();

      // Ensure user directory was NOT deleted
      expect(fs.existsSync(localDir)).toBe(true);
      expect(fs.existsSync(path.join(localDir, "index.html"))).toBe(true);

      // Clean up test directory manually
      fs.rmSync(localDir, { recursive: true, force: true });
    });
  });
});
