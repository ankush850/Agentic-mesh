import { describe, it, expect } from "vitest";
import { parseHtml, parseCss, parseJs, extractHtmlInjections } from "../parse";
import { extractHtmlSkeleton } from "../extract-html";
import { extractCssSkeleton } from "../extract-css";
import { extractJsSkeleton } from "../extract-js";
import { analyzeConnections } from "../connections";
import { SAMPLE_HTML, SAMPLE_CSS, SAMPLE_JS } from "../samples/sample-data";

describe("Injection and Cross-File Connections", () => {
  describe("HTML Injection Parsing (FR-I3)", () => {
    it("extracts inline <style> and <script> blocks with line numbers relative to the parent HTML", () => {
      const tree = parseHtml(SAMPLE_HTML);
      const injections = extractHtmlInjections(tree);

      expect(injections.length).toBeGreaterThanOrEqual(2);

      const styleBlock = injections.find((inj) => inj.tag === "style");
      const scriptBlock = injections.find((inj) => inj.tag === "script");

      expect(styleBlock).toBeDefined();
      expect(scriptBlock).toBeDefined();

      // Check line numbers relative to original HTML
      expect(styleBlock!.startLine).toBeGreaterThan(1);
      expect(styleBlock!.endLine).toBeGreaterThan(styleBlock!.startLine);
      expect(styleBlock!.tree.language).toBe("css");

      expect(scriptBlock!.startLine).toBeGreaterThan(styleBlock!.endLine);
      expect(scriptBlock!.tree.language).toBe("js");
    });
  });

  describe("Cross-File Connections & References (FR-P5)", () => {
    it("resolves file links, matches CSS selectors, resolves JS DOM queries, and flags warnings", () => {
      const htmlTree = parseHtml(SAMPLE_HTML);
      const cssTree = parseCss(SAMPLE_CSS);
      const jsTree = parseJs(SAMPLE_JS);

      const htmlResult = extractHtmlSkeleton(htmlTree, "sample.html");
      const cssResult = extractCssSkeleton(cssTree, "styles.css");
      const jsResult = extractJsSkeleton(jsTree, "app.js");

      const connections = analyzeConnections({
        htmlFiles: [{ fileName: "sample.html", result: htmlResult }],
        cssFiles: [{ fileName: "styles.css", result: cssResult }],
        jsFiles: [{ fileName: "app.js", result: jsResult }],
      });

      // 1. File links check
      const cssLink = connections.fileLinks.find((l) => l.type === "stylesheet");
      const jsLink = connections.fileLinks.find((l) => l.type === "script");
      expect(cssLink?.status).toBe("linked");
      expect(jsLink?.status).toBe("linked");

      // 2. CSS selector matching check
      const matchedBtn = connections.cssMatches.find((m) => m.selector === "button.btn-primary");
      expect(matchedBtn).toBeDefined();
      expect(matchedBtn?.matchedCount).toBeGreaterThan(0);

      // 3. Unused CSS class warning check (FR-P5d)
      const unusedWarn = connections.warnings.find((w) => w.code === "UNUSED_CSS" && w.target === ".unused-legacy-widget");
      expect(unusedWarn).toBeDefined();

      // 4. Unresolved JS query warning check (FR-P5d)
      const unresolvedWarn = connections.warnings.find(
        (w) => w.code === "UNRESOLVED_JS_QUERY" && w.target === "#non-existent-modal",
      );
      expect(unresolvedWarn).toBeDefined();

      // 5. Connection graph generation check
      expect(connections.graphNodes.length).toBe(3);
      expect(connections.graphEdges.length).toBeGreaterThan(0);
    });

    it("flags missing linked files when stylesheets or scripts are not present in project", () => {
      const isolatedHtml = `<html><head><link rel="stylesheet" href="missing.css"><script src="missing.js"></script></head><body><h1>Isolated</h1></body></html>`;
      const htmlTree = parseHtml(isolatedHtml);
      const htmlResult = extractHtmlSkeleton(htmlTree, "isolated.html");

      const connections = analyzeConnections({
        htmlFiles: [{ fileName: "isolated.html", result: htmlResult }],
        cssFiles: [],
        jsFiles: [],
      });

      const missingCss = connections.warnings.find((w) => w.code === "MISSING_LINKED_FILE" && w.target === "missing.css");
      const missingJs = connections.warnings.find((w) => w.code === "MISSING_LINKED_FILE" && w.target === "missing.js");

      expect(missingCss).toBeDefined();
      expect(missingJs).toBeDefined();
    });
  });
});
