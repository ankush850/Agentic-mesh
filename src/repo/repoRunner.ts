import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import * as net from "net";
import * as os from "os";
import { spawn, ChildProcess } from "child_process";
import { RepoClassification } from "./repoClassifier";
import { logger } from "../logger";

export interface RepoRunnerOptions {
  repoPath: string;
  classification: RepoClassification;
  port?: number;
  confirmUntrusted?: boolean;
  onLog?: (line: string, isError: boolean) => void;
  healthTimeoutMs?: number;
}

export interface RunningRepoInstance {
  url: string;
  port: number;
  mode: "static" | "npm";
  isExperimental: boolean;
  teardown: () => Promise<void>;
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

/**
 * Finds a random available port on localhost (127.0.0.1).
 */
export async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address() as net.AddressInfo;
      srv.close(() => resolve(addr.port));
    });
    srv.on("error", reject);
  });
}

/**
 * Starts a minimal zero-dependency static HTTP server on 127.0.0.1.
 */
export async function startStaticServer(
  staticDir: string,
  port?: number,
  entryHtml?: string | null
): Promise<{ server: http.Server; port: number; url: string }> {
  const root = path.resolve(staticDir);
  const effectivePort = port ?? (await getFreePort());

  const server = http.createServer((req, res) => {
    let reqPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (reqPath === "/" && entryHtml) {
      reqPath = "/" + path.basename(entryHtml);
    } else if (reqPath === "/") {
      reqPath = "/index.html";
    }

    const safeFile = path.resolve(root, "." + reqPath);
    const rel = path.relative(root, safeFile);

    // Prevent directory traversal attacks
    if (rel.startsWith("..") || path.isAbsolute(rel) || req.url?.includes("..") || reqPath.includes("..")) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden");
      return;
    }

    if (!fs.existsSync(safeFile) || fs.statSync(safeFile).isDirectory()) {
      // Check fallback entryHtml for SPA routing (only if no file extension is specified)
      const hasExt = Boolean(path.extname(reqPath));
      if (!hasExt && entryHtml && fs.existsSync(path.resolve(root, entryHtml))) {
        const entryContent = fs.readFileSync(path.resolve(root, entryHtml));
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(entryContent);
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }

    const ext = path.extname(safeFile).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const fileContent = fs.readFileSync(safeFile);

    res.writeHead(200, { "Content-Type": contentType });
    res.end(fileContent);
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(effectivePort, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });

  const entrySuffix = entryHtml ? `/${path.basename(entryHtml)}` : "";
  const url = `http://127.0.0.1:${effectivePort}${entrySuffix}`;

  return { server, port: effectivePort, url };
}

/**
 * Polls URL until it returns a successful or redirect HTTP response.
 */
export async function waitForHealthy(
  url: string,
  timeoutMs: number = 30000,
  intervalMs: number = 500
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET", redirect: "manual" });
      if (res.status < 500) {
        return;
      }
    } catch {
      // Not yet ready
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Health check timed out after ${timeoutMs}ms waiting for "${url}".`);
}

/**
 * Force kills a process and all child processes recursively.
 */
export async function treeKill(child: ChildProcess): Promise<void> {
  const pid = child.pid;
  if (!pid) return;

  if (process.platform === "win32") {
    try {
      const { exec } = await import("child_process");
      await new Promise<void>((resolve) => {
        exec(`taskkill /pid ${pid} /T /F`, () => resolve());
      });
    } catch {
      // ignore
    }
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        child.kill("SIGKILL");
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Runs a repository locally using isolated child processes without secrets.
 */
export async function runRepoLocally(options: RepoRunnerOptions): Promise<RunningRepoInstance> {
  const { classification, confirmUntrusted } = options;
  const isExperimental = classification.runPlan.isExperimental || classification.type === "unknown";

  if (isExperimental && !confirmUntrusted) {
    throw new Error(
      "This repository has an unknown or experimental structure. Requires explicit confirmation (confirmUntrusted: true) before launching."
    );
  }

  const port = options.port ?? (await getFreePort());

  // 1. Static or Prebuilt Server
  if (classification.runPlan.mode === "static") {
    const serveDir = classification.runPlan.rootDir;
    logger.info({ serveDir, port }, "Starting local static server on 127.0.0.1...");

    const { server, url } = await startStaticServer(serveDir, port, classification.entryHtml);

    return {
      url,
      port,
      mode: "static",
      isExperimental,
      teardown: async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
        logger.info({ port }, "Static repo server stopped.");
      },
    };
  }

  // 2. NPM Application
  // Always work on an isolated temporary COPY for safety
  const tempCopyDir = path.join(
    os.tmpdir(),
    `agentic-mesh-app-run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  );
  const tempHomeDir = path.join(tempCopyDir, ".home");
  fs.mkdirSync(tempHomeDir, { recursive: true });

  logger.info({ from: options.repoPath, to: tempCopyDir }, "Creating isolated temporary copy for NPM app execution...");
  fs.cpSync(options.repoPath, tempCopyDir, {
    recursive: true,
    filter: (src) => !src.includes("node_modules") && !src.includes(".git"),
  });

  // Explicit minimal environment - NEVER spread process.env or leak API keys/tokens
  const isolatedEnv: NodeJS.ProcessEnv = {
    PATH: process.env.PATH || "",
    SYSTEMROOT: process.env.SYSTEMROOT || "",
    PORT: String(port),
    HOST: "127.0.0.1",
    NODE_ENV: "development",
    HOME: tempHomeDir,
    USERPROFILE: tempHomeDir,
    TMP: tempHomeDir,
    TEMP: tempHomeDir,
  };

  const log = (msg: string, isErr = false) => {
    if (options.onLog) options.onLog(msg, isErr);
  };

  // Run install command
  if (classification.runPlan.installCmd) {
    log(`Executing install: ${classification.runPlan.installCmd}`);
    const [installBin, ...installArgs] = classification.runPlan.installCmd.split(" ");
    await new Promise<void>((resolve, reject) => {
      const installProc = spawn(installBin, installArgs, {
        cwd: tempCopyDir,
        env: isolatedEnv,
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      installProc.stdout?.on("data", (d) => log(d.toString()));
      installProc.stderr?.on("data", (d) => log(d.toString(), true));

      const timer = setTimeout(() => {
        void treeKill(installProc);
        reject(new Error("NPM install timed out after 3 minutes."));
      }, 180000);

      installProc.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`NPM install failed with exit code ${code}`));
      });
    });
  }

  // Run start command
  const startCmd = classification.runPlan.startCmd || "npm start";
  log(`Starting app: ${startCmd}`);
  const [startBin, ...startArgs] = startCmd.split(" ");

  const child = spawn(startBin, startArgs, {
    cwd: tempCopyDir,
    env: isolatedEnv,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (d) => log(d.toString()));
  child.stderr?.on("data", (d) => log(d.toString(), true));

  const appUrl = `http://127.0.0.1:${port}`;
  const healthTimeout = options.healthTimeoutMs ?? 45000;

  try {
    await waitForHealthy(appUrl, healthTimeout);
  } catch (err) {
    await treeKill(child);
    try {
      fs.rmSync(tempCopyDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    throw err;
  }

  return {
    url: appUrl,
    port,
    mode: "npm",
    isExperimental,
    teardown: async () => {
      logger.info({ pid: child.pid }, "Tearing down NPM child process tree...");
      await treeKill(child);
      try {
        if (fs.existsSync(tempCopyDir)) {
          fs.rmSync(tempCopyDir, { recursive: true, force: true });
        }
      } catch (err) {
        logger.warn({ err, tempCopyDir }, "Failed to clean up temp app copy dir.");
      }
    },
  };
}
