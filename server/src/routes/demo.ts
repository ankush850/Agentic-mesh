import * as fs from "fs";
import * as path from "path";
import type { FastifyInstance } from "fastify";
import { env } from "../env";
import { notFound } from "../http";
import { resolveInside } from "../security";

const DEFAULT_CROUPT_HTML = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>Corrupt Demo App — Developer Error Showcase</title>\n  <style>\n    :root {\n      --bg: #0f172a;\n      --card-bg: #1e293b;\n      --border: #334155;\n      --text: #f8fafc;\n      --muted: #94a3b8;\n      --danger: #ef4444;\n      --danger-bg: #450a0a;\n      --primary: #3b82f6;\n    }\n    * { box-sizing: border-box; margin: 0; padding: 0; }\n    body {\n      font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, monospace, sans-serif;\n      background: var(--bg);\n      color: var(--text);\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      min-height: 100vh;\n      padding: 1.5rem;\n    }\n    .container {\n      width: 100%;\n      max-width: 520px;\n      background: var(--card-bg);\n      border: 1px solid var(--border);\n      border-radius: 12px;\n      padding: 2rem;\n      box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.5);\n    }\n    .badge {\n      display: inline-block;\n      padding: 4px 10px;\n      border-radius: 6px;\n      font-size: 0.75rem;\n      font-weight: 700;\n      margin-bottom: 1.25rem;\n      background: #7f1d1d;\n      color: #fca5a5;\n      border: 1px solid #ef4444;\n      text-transform: uppercase;\n      letter-spacing: 0.05em;\n    }\n    h1 {\n      font-size: 1.5rem;\n      font-weight: 700;\n      margin-bottom: 0.5rem;\n    }\n    p.subtitle {\n      color: var(--muted);\n      font-size: 0.875rem;\n      margin-bottom: 1.5rem;\n    }\n    .form-group {\n      margin-bottom: 1.25rem;\n    }\n    label {\n      display: block;\n      font-size: 0.8125rem;\n      font-weight: 600;\n      margin-bottom: 0.5rem;\n      color: var(--muted);\n      text-transform: uppercase;\n      letter-spacing: 0.05em;\n    }\n    input {\n      width: 100%;\n      padding: 0.75rem 1rem;\n      background: #0f172a;\n      border: 1px solid var(--border);\n      border-radius: 8px;\n      color: var(--text);\n      font-size: 0.9375rem;\n      outline: none;\n      transition: border-color 0.2s;\n    }\n    input:focus {\n      border-color: var(--primary);\n    }\n    button {\n      width: 100%;\n      padding: 0.875rem;\n      background: var(--primary);\n      color: #fff;\n      border: none;\n      border-radius: 8px;\n      font-size: 0.9375rem;\n      font-weight: 600;\n      cursor: pointer;\n      transition: background 0.2s;\n      margin-top: 0.5rem;\n    }\n    button:hover {\n      background: #2563eb;\n    }\n    .crash-banner {\n      display: none;\n      background: var(--danger-bg);\n      border: 2px solid var(--danger);\n      border-radius: 8px;\n      padding: 1.25rem;\n      margin-top: 1.5rem;\n      animation: flash 0.3s ease-in-out;\n    }\n    .crash-title {\n      color: #f87171;\n      font-size: 1.125rem;\n      font-weight: 800;\n      display: flex;\n      align-items: center;\n      gap: 0.5rem;\n      margin-bottom: 0.5rem;\n    }\n    .crash-desc {\n      color: #fca5a5;\n      font-size: 0.875rem;\n      font-weight: 600;\n      margin-bottom: 0.75rem;\n    }\n    pre.stack-trace {\n      background: #000000;\n      color: #ef4444;\n      padding: 0.75rem;\n      border-radius: 6px;\n      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;\n      font-size: 0.75rem;\n      line-height: 1.4;\n      overflow-x: auto;\n      border: 1px solid #7f1d1d;\n    }\n    .hidden { display: none !important; }\n  </style>\n</head>\n<body>\n  <div class=\"container\">\n    <div class=\"badge\">🔥 Corrupted Build (Simulated Developer Bug)</div>\n    <h1>User Authentication</h1>\n    <p class=\"subtitle\">Enter credentials to sign in to the application.</p>\n    <div id=\"login-form\">\n      <div class=\"form-group\">\n        <label for=\"username\">Username</label>\n        <input type=\"text\" id=\"username\" name=\"username\" placeholder=\"admin\" autocomplete=\"off\" />\n      </div>\n      <div class=\"form-group\">\n        <label for=\"password\">Password</label>\n        <input type=\"password\" id=\"password\" name=\"password\" placeholder=\"••••••••\" autocomplete=\"off\" />\n      </div>\n      <button type=\"button\" id=\"login-btn\" onclick=\"triggerDeveloperCrash()\">Login</button>\n    </div>\n    <div id=\"crash-view\" class=\"crash-banner\">\n      <div class=\"crash-title\">\n        <span>🚨</span> FATAL 500: INTERNAL SERVER ERROR\n      </div>\n      <div class=\"crash-desc\">\n        Database connection pool exhausted: Failed to authenticate user session against postgres-primary-cluster:5432.\n      </div>\n      <pre class=\"stack-trace\">\nError: ConnectionTimeout [ETIMEDOUT] at Pool.connect (/app/src/db/pool.ts:84:19)\n    at AuthService.authenticateUser (/app/src/auth/service.ts:142:11)\n    at async handleLoginRequest (/app/src/controllers/auth.ts:29:7)\n    -- STACK DUMP (PID: 4092) --\n    FATAL: Server crashed while fulfilling client acceptance criteria!\n      </pre>\n    </div>\n    <div id=\"dashboard-section\" class=\"hidden\">\n      <h1 id=\"welcome-header\">Welcome, admin!</h1>\n    </div>\n  </div>\n  <script>\n    function triggerDeveloperCrash() {\n      document.getElementById(\"login-form\").style.opacity = \"0.3\";\n      document.getElementById(\"login-btn\").disabled = true;\n      document.getElementById(\"login-btn\").innerText = \"Crash in Progress...\";\n      const crashBox = document.getElementById(\"crash-view\");\n      crashBox.style.display = \"block\";\n      console.error(\"[DEV-ERROR] 500 Internal Server Crash during login dispatch!\");\n    }\n  </script>\n</body>\n</html>\n";

export function ensureDemoDir(): string {
  if (!fs.existsSync(env.demoDir)) {
    fs.mkdirSync(env.demoDir, { recursive: true });
  }
  const crouptPath = path.join(env.demoDir, "Croupt.html");
  if (!fs.existsSync(crouptPath)) {
    try {
      fs.writeFileSync(crouptPath, DEFAULT_CROUPT_HTML, "utf8");
    } catch {
      // ignore
    }
  }
  return env.demoDir;
}

/** Lists every bundled or uploaded demo page so the console can offer a per-ticket UI picker. */
export async function demoListRoutes(app: FastifyInstance) {
  app.get("/demo-pages", async () => {
    const dir = ensureDemoDir();
    const pages = fs
      .readdirSync(dir)
      .filter((file) => file.toLowerCase().endsWith(".html"))
      .sort();
    return { pages };
  });

  app.post("/demo/upload", async (request, reply) => {
    const body = (request.body || {}) as { filename?: string; content?: string };
    const { filename, content } = body;
    if (!filename || typeof filename !== "string" || !content || typeof content !== "string") {
      return reply.status(400).send({ error: { code: "bad_request", message: "Missing filename or content" } });
    }
    const dir = ensureDemoDir();
    const base = path.basename(filename).replace(/[^\w.-]/g, "_");
    const safeName = base.toLowerCase().endsWith(".html") ? base : `${base}.html`;
    const dest = path.join(dir, safeName);
    fs.writeFileSync(dest, content, "utf8");
    return { page: safeName };
  });
}

/** Serves the uploaded/demo pages over HTTP so the runner can target any uploaded page. */
export async function demoStaticRoutes(app: FastifyInstance) {
  app.get("/demo/*", async (request, reply) => {
    const wildcard = (request.params as { "*": string })["*"] ?? "";
    const dir = ensureDemoDir();
    const filePath = resolveInside(dir, wildcard);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      throw notFound("Demo page");
    }
    const extension = path.extname(filePath).toLowerCase();
    const contentType =
      extension === ".css"
        ? "text/css; charset=utf-8"
        : extension === ".js"
          ? "text/javascript; charset=utf-8"
          : "text/html; charset=utf-8";
    reply.header("Cache-Control", "no-cache");
    return reply.type(contentType).send(fs.createReadStream(filePath));
  });
}
