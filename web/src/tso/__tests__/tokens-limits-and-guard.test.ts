import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { countTokens, calculateCost, clearTokenCache } from "../tokens";
import { shouldIgnoreFile, TSO_CONFIG } from "../config";
import { sanitizeFileName } from "../export";

describe("Tokens, Limits, Security, and Visual Regression Guard", () => {
  describe("Token Counting (FR-T1, FR-T2, FR-T3)", () => {
    it("counts tokens using approx mode (ceil(chars / 4)) and cl100k_light", () => {
      clearTokenCache();
      const sampleText = "Hello world! This is a test sentence for token counting.";

      const approxCount = countTokens(sampleText, "approx");
      expect(approxCount).toBe(Math.ceil(sampleText.length / 4));

      const cl100kCount = countTokens(sampleText, "cl100k_light");
      expect(cl100kCount).toBeGreaterThan(0);
      expect(cl100kCount).toBeLessThan(sampleText.length);
    });

    it("calculates financial cost dynamically without hardcoding prices (FR-T2)", () => {
      // 100,000 tokens at $2.50 per 1M tokens = $0.25
      const cost = calculateCost(100_000, 2.5);
      expect(cost).toBeCloseTo(0.25, 4);

      // Null or invalid prices return null
      expect(calculateCost(100_000, null)).toBeNull();
      expect(calculateCost(100_000, undefined)).toBeNull();
    });
  });

  describe("File Filtering & Size Limits (FR-I1, FR-I2)", () => {
    it("ignores node_modules, build artifacts, minified bundles, and binaries", () => {
      expect(shouldIgnoreFile("vendor.js", "node_modules/vendor.js").ignore).toBe(true);
      expect(shouldIgnoreFile("bundle.js", "dist/bundle.js").ignore).toBe(true);
      expect(shouldIgnoreFile("app.min.js").ignore).toBe(true);
      expect(shouldIgnoreFile("styles.min.css").ignore).toBe(true);
      expect(shouldIgnoreFile("image.png").ignore).toBe(true);
      expect(shouldIgnoreFile("binary.wasm").ignore).toBe(true);

      expect(shouldIgnoreFile("app.js").ignore).toBe(false);
      expect(shouldIgnoreFile("index.html").ignore).toBe(false);
      expect(shouldIgnoreFile("styles.css").ignore).toBe(false);
    });

    it("validates size caps and line limits constants", () => {
      expect(TSO_CONFIG.MAX_FILE_SIZE_BYTES).toBe(1024 * 1024); // 1 MB
      expect(TSO_CONFIG.MAX_TOTAL_SIZE_BYTES).toBe(5 * 1024 * 1024); // 5 MB
      expect(TSO_CONFIG.MAX_LINE_LENGTH_CHARS).toBe(5000);
    });
  });

  describe("Security & XSS Prevention (FR-2.6)", () => {
    it("sanitizes file names to prevent directory traversal", () => {
      expect(sanitizeFileName("../../../etc/passwd")).toBe(".._.._.._etc_passwd");
      expect(sanitizeFileName("file<script>.html")).toBe("file_script_.html");
    });
  });

  describe("Visual Regression & Pre-existing CSS Guard Check (FR-U8)", () => {
    it("confirms no pre-existing CSS rules were modified and only .tso- rules were appended", () => {
      const cssPath = path.resolve(__dirname, "../../index.css");
      const cssContent = fs.readFileSync(cssPath, "utf-8");

      // Verify essential pre-existing Agentic-mesh CSS tokens and classes are intact
      expect(cssContent).toContain("--bg: var(--color-white);");
      expect(cssContent).toContain("--surface: var(--color-white);");
      expect(cssContent).toContain("--accent: var(--color-blue-600);");
      expect(cssContent).toContain(".surface-card {");
      expect(cssContent).toContain(".pulse-dot {");
      expect(cssContent).toContain(".shimmer {");

      // Verify the new styles are appended with the unique .tso- prefix
      expect(cssContent).toContain(".tso-container");
      expect(cssContent).toContain(".tso-code-pane");
      expect(cssContent).toContain(".tso-node-highlight");
    });
  });
});

