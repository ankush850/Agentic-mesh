import { describe, it, expect } from "vitest";
import { parseHtml, parseCss, parseJs } from "../parse";
import { extractHtmlSkeleton } from "../extract-html";
import { extractCssSkeleton, calculateSpecificity } from "../extract-css";
import { extractJsSkeleton } from "../extract-js";
import { SAMPLE_HTML, SAMPLE_CSS, SAMPLE_JS } from "../samples/sample-data";

describe("Tree-sitter Extractors", () => {
  describe("HTML Extractor (FR-P2)", () => {
    it("extracts document outline, landmarks, headings, and forms from sample HTML", () => {
      const tree = parseHtml(SAMPLE_HTML);
      const result = extractHtmlSkeleton(tree, "sample.html");

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.landmarksCount).toBeGreaterThan(0);
      expect(result.headingsCount).toBeGreaterThan(0);
      expect(result.formsCount).toBeGreaterThan(0);

      // Check key metadata
      expect(result.metaTags.charset).toBe("UTF-8");
      expect(result.metaTags.viewport).toContain("width=device-width");

      // Check external links
      expect(result.stylesheets).toContain("styles.css");
      expect(result.scripts).toContain("app.js");

      // Check repeated sibling collapsing (li.item.test-item x8)
      const collapsedItem = result.entries.find((e) => e.label.includes("x8") || e.details?.repeatCount);
      expect(collapsedItem).toBeDefined();
    });

    it("records dropped text character counts outside headings and labels", () => {
      const html = `<div><p>This is dropped text inside a paragraph.</p><h1>Heading Stored</h1></div>`;
      const tree = parseHtml(html);
      const result = extractHtmlSkeleton(tree, "test.html");
      expect(result.droppedTextChars).toBeGreaterThan(0);
    });
  });

  describe("CSS Extractor (FR-P3)", () => {
    it("extracts rules grouped by at-rules and calculates selector specificity", () => {
      const tree = parseCss(SAMPLE_CSS);
      const result = extractCssSkeleton(tree, "sample.css");

      expect(result.rulesCount).toBeGreaterThan(0);
      expect(result.atRulesCount).toBeGreaterThan(0);

      // Check custom properties declared and used
      expect(result.customPropertiesDeclared).toContain("--tso-primary");
      expect(result.customPropertiesUsed).toContain("--tso-primary");

      // Check duplicate selector detection
      expect(result.duplicateSelectors).toContain("button.btn-primary");

      // Check duplicate declaration detection
      expect(result.duplicateDeclarationsTotal).toBeGreaterThan(0);
    });

    it("correctly calculates standard CSS specificity [IDs, Classes, Elements]", () => {
      expect(calculateSpecificity("#submit-btn")).toEqual([1, 0, 0]);
      expect(calculateSpecificity(".btn-primary")).toEqual([0, 1, 0]);
      expect(calculateSpecificity("div")).toEqual([0, 0, 1]);
      expect(calculateSpecificity("button#login.btn[disabled]")).toEqual([1, 2, 1]);
      expect(calculateSpecificity("nav > ul > li.active a")).toEqual([0, 1, 4]);
    });
  });

  describe("JavaScript Extractor (FR-P4)", () => {
    it("extracts classes, functions, imports, event listeners, DOM queries, and network calls", () => {
      const tree = parseJs(SAMPLE_JS);
      const result = extractJsSkeleton(tree, "sample.js");

      expect(result.classesCount).toBeGreaterThanOrEqual(1);
      expect(result.functionsCount).toBeGreaterThanOrEqual(2);

      // Check DOM queries extracted
      const queries = result.domQueries.map((q) => q.query);
      expect(queries).toContain("#new-run-form");
      expect(queries).toContain("#login-btn");
      expect(queries).toContain(".item");

      // Check event listeners
      const listeners = result.eventListeners.map((l) => l.event);
      expect(listeners).toContain("DOMContentLoaded");
      expect(listeners).toContain("submit");

      // Check network call
      const urls = result.networkCalls.map((n) => n.url);
      expect(urls).toContain("https://staging.agentic-mesh.io/api/v1/runs/trigger");
    });

    it("flags eval and new Function as security warnings", () => {
      const maliciousJs = `
        const x = 10;
        eval("alert('unsafe')");
        const fn = new Function('a', 'return a * 2');
      `;
      const tree = parseJs(maliciousJs);
      const result = extractJsSkeleton(tree, "malicious.js");

      expect(result.securityWarnings.length).toBe(2);
      expect(result.securityWarnings[0].warning).toContain("Security warning");
    });
  });
});

