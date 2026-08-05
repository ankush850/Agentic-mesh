import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import { z } from "zod";
import { logger } from "../logger";

const execFileAsync = promisify(execFile);

export const DEFAULT_MAX_REPO_BYTES = 100 * 1024 * 1024; // 100 MB

export const RepoSourceInputSchema = z
  .object({
    url: z.string().url().optional(),
    localPath: z.string().optional(),
    maxSizeBytes: z.number().positive().default(DEFAULT_MAX_REPO_BYTES),
    allowedRoot: z.string().optional(),
  })
  .refine((data) => data.url || data.localPath, {
    message: "Either 'url' or 'localPath' must be provided.",
  });

export type RepoSourceInput = z.input<typeof RepoSourceInputSchema>;

export interface RepoSourceResult {
  sourceType: "github" | "local";
  repoPath: string;
  commitSha: string | null;
  isTemp: boolean;
  cleanup: () => Promise<void>;
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "github.com") return null;
    const parts = parsed.pathname.replace(/^\//, "").replace(/\.git$/, "").split("/");
    if (parts.length < 2 || !parts[0] || !parts[1]) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

/**
 * Validates a GitHub repository using the unauthenticated GitHub API.
 * Ensures the repo is public and within the size limit.
 */
export async function verifyPublicGitHubRepo(
  owner: string,
  repo: string,
  maxSizeBytes: number = DEFAULT_MAX_REPO_BYTES,
  fetchFn: typeof fetch = fetch
): Promise<{ sizeBytes: number; defaultBranch: string }> {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const response = await fetchFn(apiUrl, {
    headers: {
      "User-Agent": "Agentic-mesh-RepoIngest",
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (response.status === 404) {
    throw new Error(`GitHub repository "${owner}/${repo}" was not found or is private.`);
  }

  if (!response.ok) {
    throw new Error(
      `GitHub API error (${response.status}) checking "${owner}/${repo}": ${await response.text()}`
    );
  }

  const data = (await response.json()) as {
    private?: boolean;
    size?: number; // size in KB
    default_branch?: string;
  };

  if (data.private) {
    throw new Error(`GitHub repository "${owner}/${repo}" is private. Only public repositories are allowed.`);
  }

  const sizeKb = data.size ?? 0;
  const sizeBytes = sizeKb * 1024;
  if (sizeBytes > maxSizeBytes) {
    throw new Error(
      `Repository size (${Math.round(sizeBytes / (1024 * 1024))} MB) exceeds maximum allowed limit (${Math.round(maxSizeBytes / (1024 * 1024))} MB).`
    );
  }

  return {
    sizeBytes,
    defaultBranch: data.default_branch || "main",
  };
}

/**
 * Confirms a local path is safe, exists, and does not escape configured roots or contain escaping symlinks.
 */
export function validateLocalFolder(localPath: string, allowedRoot?: string): string {
  const absPath = path.resolve(localPath);

  if (!fs.existsSync(absPath)) {
    throw new Error(`Local repository path does not exist: "${absPath}"`);
  }

  const stat = fs.statSync(absPath);
  if (!stat.isDirectory()) {
    throw new Error(`Local repository path is not a directory: "${absPath}"`);
  }

  const effectiveAllowedRoot = allowedRoot || process.env["AGENTIC-MESH_ALLOWED_REPO_ROOT"];
  if (effectiveAllowedRoot) {
    const absAllowed = path.resolve(effectiveAllowedRoot);
    const rel = path.relative(absAllowed, absPath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new Error(
        `Local path "${absPath}" is outside the configured allowed root: "${absAllowed}"`
      );
    }
  }

  // Symlink escape check for the root directory itself
  const realRoot = fs.realpathSync(absPath);
  if (effectiveAllowedRoot) {
    const absAllowed = path.resolve(effectiveAllowedRoot);
    const relReal = path.relative(absAllowed, realRoot);
    if (relReal.startsWith("..") || path.isAbsolute(relReal)) {
      throw new Error(`Symlink for repository root escapes allowed directory: "${absPath}"`);
    }
  }

  // Check top-level symlinks to prevent directory traversal
  try {
    const entries = fs.readdirSync(absPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        const fullChild = path.join(absPath, entry.name);
        try {
          const resolvedChild = fs.realpathSync(fullChild);
          const relChild = path.relative(realRoot, resolvedChild);
          if (relChild.startsWith("..") || path.isAbsolute(relChild)) {
            throw new Error(
              `Symlink "${entry.name}" escapes repository boundary ("${resolvedChild}")`
            );
          }
        } catch (symErr) {
          throw new Error(`Broken or escaping symlink detected: "${entry.name}"`);
        }
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes("escapes")) throw err;
    logger.warn({ err }, "Directory read check warning for symlinks");
  }

  return absPath;
}

/**
 * Reads Git commit SHA using local git CLI. Returns null if not a git repository.
 */
export async function getGitCommitSha(dir: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: dir,
      timeout: 5000,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Resolves repository source (GitHub URL or local folder) into a verified, readable location.
 */
export async function resolveRepoSource(input: RepoSourceInput): Promise<RepoSourceResult> {
  const validated = RepoSourceInputSchema.parse(input);

  if (validated.url) {
    const parsed = parseGitHubUrl(validated.url);
    if (!parsed) {
      throw new Error(
        `Invalid GitHub URL: "${validated.url}". Must be a valid github.com repository URL.`
      );
    }

    logger.info({ owner: parsed.owner, repo: parsed.repo }, "Verifying public GitHub repository...");
    await verifyPublicGitHubRepo(parsed.owner, parsed.repo, validated.maxSizeBytes);

    const tempDir = path.join(os.tmpdir(), `agentic-mesh-clone-${randomUUID()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    logger.info({ url: validated.url, tempDir }, "Cloning repository with depth 1...");
    try {
      await execFileAsync("git", ["clone", "--depth", "1", validated.url, tempDir], {
        timeout: 60_000,
      });
    } catch (err: any) {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      throw new Error(`Git clone failed for "${validated.url}": ${err.message}`);
    }

    const commitSha = await getGitCommitSha(tempDir);

    const cleanup = async () => {
      if (fs.existsSync(tempDir)) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
          logger.info({ tempDir }, "Cleaned up temporary clone.");
        } catch (rmErr) {
          logger.warn({ rmErr, tempDir }, "Failed to remove temporary clone directory.");
        }
      }
    };

    return {
      sourceType: "github",
      repoPath: tempDir,
      commitSha,
      isTemp: true,
      cleanup,
    };
  }

  if (validated.localPath) {
    const absPath = validateLocalFolder(validated.localPath, validated.allowedRoot);
    const commitSha = await getGitCommitSha(absPath);

    return {
      sourceType: "local",
      repoPath: absPath,
      commitSha,
      isTemp: false,
      // User-supplied folders are never deleted
      cleanup: async () => {},
    };
  }

  throw new Error("Either 'url' or 'localPath' must be provided.");
}
