import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  parseRepository,
  parseHtmlFile,
  parseJsFile,
  computeSourceFingerprint,
  AppModelSchema,
} from "../repo/astParser";

describe("astParser", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sqa-ast-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("computeSourceFingerprint", () => {
    it("produces deterministic fingerprints for the same structural inputs", () => {
      const fp1 = computeSourceFingerprint({
        tag: "button",
        role: "button",
        text: "Submit",
        testid: "submit-btn",
        id: "btn-1",
        treePosition: "body > form#login > button#btn-1",
      });

      const fp2 = computeSourceFingerprint({
        tag: "button",
        role: "button",
        text: "Submit",
        testid: "submit-btn",
        id: "btn-1",
        treePosition: "body > form#login > button#btn-1",
      });

      expect(fp1).toBe(fp2);
      expect(fp1.length).toBe(16);
    });

    it("produces different fingerprints when structural properties change", () => {
      const fp1 = computeSourceFingerprint({
        tag: "button",
        text: "Submit",
        treePosition: "body > form > button",
      });

      const fp2 = computeSourceFingerprint({
        tag: "input",
        text: "Submit",
        treePosition: "body > form > input",
      });

      expect(fp1).not.toBe(fp2);
    });
  });

  describe("parseHtmlFile", () => {
    it("extracts forms, fields, buttons, links, and page title from HTML", () => {
      const htmlContent = `
<!DOCTYPE html>
<html>
  <head>
    <title>Customer Login</title>
  </head>
  <body>
    <header>
      <a href="/home.html" id="logo-link">Home</a>
    </header>
    <main>
      <form id="login-form" action="/login" method="POST">
        <label for="username">Username</label>
        <input type="text" id="username" name="username" placeholder="Enter username" required />
        <label for="password">Password</label>
        <input type="password" id="password" name="password" placeholder="Enter password" required />
        <button type="submit" id="login-btn" data-testid="login-submit">Sign In</button>
      </form>
    </main>
  </body>
</html>
      `;

      const htmlPath = path.join(tempDir, "login.html");
      fs.writeFileSync(htmlPath, htmlContent);

      const page = parseHtmlFile(htmlPath, "login.html");

      expect(page.title).toBe("Customer Login");
      expect(page.routeOrFile).toBe("login.html");

      // Links
      expect(page.links.length).toBe(1);
      expect(page.links[0].href).toBe("/home.html");
      expect(page.links[0].text).toBe("Home");

      // Interactive elements
      expect(page.interactiveElements.length).toBe(4); // <a>, 2 <input>, <button>
      const btn = page.interactiveElements.find((el) => el.id === "login-btn");
      expect(btn).toBeDefined();
      expect(btn?.tag).toBe("button");
      expect(btn?.visibleText).toBe("Sign In");
      expect(btn?.dataTestId).toBe("login-submit");
      expect(btn?.sourceFingerprint).toBeDefined();

      // Form
      expect(page.forms.length).toBe(1);
      const form = page.forms[0];
      expect(form.id).toBe("login-form");
      expect(form.method).toBe("POST");
      expect(form.fields.length).toBe(2);
      expect(form.fields[0].name).toBe("username");
      expect(form.fields[1].name).toBe("password");
      expect(form.submitSelector).toBe("#login-btn");
      expect(form.submitButtonText).toBe("Sign In");
    });
  });

  describe("parseJsFile", () => {
    it("extracts React components, props, interactive JSX elements, and conditional rendering hints", () => {
      const tsxContent = `
import React, { useState } from 'react';

interface LoginFormProps {
  onSuccess: (user: string) => void;
  isLoading: boolean;
}

export function LoginForm({ onSuccess, isLoading }: LoginFormProps) {
  const [user, setUser] = useState('');
  const hasError = false;

  return (
    <div className="login-container">
      <h2>Welcome Back</h2>
      {hasError && <div className="error-alert">Invalid credentials</div>}
      <form id="auth-form" onSubmit={() => onSuccess(user)}>
        <input
          id="email-input"
          type="email"
          placeholder="your@email.com"
          data-testid="email-field"
          onChange={(e) => setUser(e.target.value)}
        />
        <button
          id="submit-auth"
          type="submit"
          disabled={isLoading}
          onClick={() => {}}
        >
          {isLoading ? "Signing in..." : "Submit"}
        </button>
      </form>
    </div>
  );
}
      `;

      const tsxPath = path.join(tempDir, "LoginForm.tsx");
      fs.writeFileSync(tsxPath, tsxContent);

      const result = parseJsFile(tsxPath, "LoginForm.tsx");

      // Components
      expect(result.components.length).toBe(1);
      expect(result.components[0].name).toBe("LoginForm");
      expect(result.components[0].props.some((p) => p.name === "onSuccess")).toBe(true);
      expect(result.components[0].props.some((p) => p.name === "isLoading")).toBe(true);

      // PageInfo / interactive elements
      expect(result.pageInfo).toBeDefined();
      const elements = result.pageInfo!.interactiveElements;
      expect(elements.length).toBeGreaterThanOrEqual(2);

      const input = elements.find((el) => el.id === "email-input");
      expect(input?.tag).toBe("input");
      expect(input?.dataTestId).toBe("email-field");
      expect(input?.placeholder).toBe("your@email.com");

      const btn = elements.find((el) => el.id === "submit-auth");
      expect(btn?.tag).toBe("button");
      expect(btn?.eventHandlers).toContain("onClick");

      // Conditional render hints
      expect(result.pageInfo!.conditionalRenderHints.length).toBeGreaterThan(0);
      expect(result.pageInfo!.conditionalRenderHints[0]).toContain("hasError");
    });
  });

  describe("parseRepository", () => {
    it("scans entire folder, ignoring node_modules, and creates validated AppModel", async () => {
      // Create a mock repo structure
      const html = `<!DOCTYPE html><html><body><button id="main-btn">Click Me</button></body></html>`;
      fs.writeFileSync(path.join(tempDir, "index.html"), html);

      const css = `body { background: #fff; } #main-btn { color: blue; }`;
      fs.writeFileSync(path.join(tempDir, "style.css"), css);

      const nm = path.join(tempDir, "node_modules");
      fs.mkdirSync(nm);
      fs.writeFileSync(path.join(nm, "ignored.html"), "<html><button>Ignore</button></html>");

      const appModel = await parseRepository(tempDir);
      const validated = AppModelSchema.parse(appModel);

      expect(validated.pages.length).toBe(1);
      expect(validated.pages[0].routeOrFile).toBe("index.html");
      expect(validated.pages[0].interactiveElements.length).toBe(1);
      expect(validated.pages[0].interactiveElements[0].id).toBe("main-btn");
      expect(validated.totalFilesParsed).toBe(2); // index.html and style.css
    });

    it("parses UI_Test directory cleanly if available", async () => {
      const uiTestPath = path.resolve(process.cwd(), "UI_Test");
      if (fs.existsSync(uiTestPath)) {
        const appModel = await parseRepository(uiTestPath);
        expect(appModel.pages.length).toBeGreaterThanOrEqual(1);

        const pageNames = appModel.pages.map((p) => p.routeOrFile);
        expect(pageNames.some((n) => n.includes("home") || n.includes("dashboard") || n.includes("index"))).toBe(true);

        const allElements = appModel.pages.flatMap((p) => p.interactiveElements);
        expect(allElements.length).toBeGreaterThan(0);
        for (const el of allElements) {
          expect(el.sourceFingerprint).toBeDefined();
        }
      }
    });

    it("records per-file parse errors without crashing the whole scan", async () => {
      const brokenJs = `function { invalid syntax `;
      fs.writeFileSync(path.join(tempDir, "broken.js"), brokenJs);

      const goodHtml = `<!DOCTYPE html><html><body><a href="/about">About</a></body></html>`;
      fs.writeFileSync(path.join(tempDir, "good.html"), goodHtml);

      const appModel = await parseRepository(tempDir);
      expect(appModel.pages.length).toBe(1);
      expect(appModel.parseErrors.length).toBe(1);
      expect(appModel.parseErrors[0].file).toBe("broken.js");
    });
  });
});
