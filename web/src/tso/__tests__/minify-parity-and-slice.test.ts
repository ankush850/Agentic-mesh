import { describe, it, expect } from "vitest";
import { parseHtml, parseCss, parseJs } from "../parse";
import { safeMinifyHtml, safeMinifyCss, safeMinifyJs } from "../optimize-minify";
import { verifyMinifyParity, verifyRangeReferences } from "../parity";
import { sliceHtml, sliceCss, sliceJs } from "../optimize-slice";
import { SAMPLE_HTML, SAMPLE_CSS, SAMPLE_JS } from "../samples/sample-data";

describe("Minify, Parity, and Slice Optimizers", () => {
  describe("Safe Minify Parity (FR-O2, FR-O5)", () => {
    it("preserves <pre> and <textarea> content and conditional comments in HTML", () => {
      const html = `
        <!-- Normal comment to drop -->
        <!--[if IE 9]> <div class="ie-banner">IE 9 Warning</div> <![endif]-->
        <div>
          <pre>  line 1\n    line 2 with spaces  </pre>
          <textarea>  preserve   indentation  </textarea>
        </div>
      `;
      const tree = parseHtml(html);
      const min = safeMinifyHtml(html, tree);

      // Verify <pre> content was preserved verbatim
      expect(min.text).toContain("  line 1\n    line 2 with spaces  ");
      expect(min.text).toContain("  preserve   indentation  ");

      // Verify conditional comment preserved
      expect(min.text).toContain("<!--[if IE 9]>");

      // Verify normal comment removed
      expect(min.text).not.toContain("Normal comment to drop");

      // Verify parity check passes
      const parity = verifyMinifyParity(tree, min.text, "html");
      expect(parity.isVerified).toBe(true);
    });

    it("minifies CSS without corrupting string literals or url() paths", () => {
      const css = `
        /* Main comment */
        .card {
          background-image: url("https://example.com/asset with spaces.png");
          content: "Hello /* not a comment */ world";
          color: red;
        }
      `;
      const tree = parseCss(css);
      const min = safeMinifyCss(css, tree);

      expect(min.text).toContain('url("https://example.com/asset with spaces.png")');
      expect(min.text).toContain('content:"Hello /* not a comment */ world"');
      expect(min.text).toContain("color:red}"); // last semicolon dropped

      const parity = verifyMinifyParity(tree, min.text, "css");
      expect(parity.isVerified).toBe(true);
    });

    it("minifies JS preserving regex literals, template literals, and ASI hazards", () => {
      const js = `
        // Comment
        const pattern = /foo\\/bar/gi;
        const greeting = \`Template with \${1 + 2} spaces\`;
        
        let a = 1;
        let b = 2
        (a + b).toString(); // ASI hazard: must not merge with previous statement
      `;
      const tree = parseJs(js);
      const min = safeMinifyJs(js, tree);

      expect(min.text).toContain("/foo\\/bar/gi");
      expect(min.text).toContain("`Template with ${1 + 2} spaces`");
      expect(min.text).not.toContain("// Comment");

      // Parity check verification
      const parity = verifyMinifyParity(tree, min.text, "js");
      expect(parity.isVerified).toBe(true);
    });

    it("detects and flags parity failure when minified text is corrupted", () => {
      const js = `function validCode(x) { return x * 2; }`;
      const tree = parseJs(js);
      // Intentionally corrupted minified text with syntax error
      const corruptedText = `function validCode(x) { return x * ; }`;

      const parity = verifyMinifyParity(tree, corruptedText, "js");
      expect(parity.isVerified).toBe(false);
      expect(parity.errorCount).toBeGreaterThan(0);
      expect(parity.reason).toContain("syntax ERROR/MISSING");
    });
  });

  describe("Range Validation (FR-O5)", () => {
    it("validates line range references correctly within file boundaries", () => {
      const validText = `Outline: item [test.js:10-25] and another [test.js:30-40]`;
      const result = verifyRangeReferences(validText, { "test.js": 50 });
      expect(result.isVerified).toBe(true);

      const invalidText = `Outline: item [test.js:10-100] (out of bounds)`;
      const invalidResult = verifyRangeReferences(invalidText, { "test.js": 50 });
      expect(invalidResult.isVerified).toBe(false);
      expect(invalidResult.differences?.length).toBe(1);
    });
  });

  describe("Focused Slices (FR-O3)", () => {
    it("extracts HTML focused slice with ancestor breadcrumb and collapsed placeholders", () => {
      const tree = parseHtml(SAMPLE_HTML);
      const slice = sliceHtml(SAMPLE_HTML, tree, "#login-btn", "sample.html");

      expect(slice).not.toBeNull();
      expect(slice!.text).toContain("Trigger Execution");
      expect(slice!.text).toContain("collapsed");
      expect(slice!.startLine).toBeGreaterThan(1);
    });

    it("extracts CSS focused slice with enclosing @media context", () => {
      const tree = parseCss(SAMPLE_CSS);
      const slice = sliceCss(SAMPLE_CSS, tree, "stats-grid", "styles.css");

      expect(slice).not.toBeNull();
      expect(slice!.text).toContain("stats-grid");
      expect(slice!.text).toContain("collapsed");
    });

    it("extracts JS focused slice with module imports and surrounding context", () => {
      const tree = parseJs(SAMPLE_JS);
      const slice = sliceJs(SAMPLE_JS, tree, "triggerAutomatedRun", "sample.js");

      expect(slice).not.toBeNull();
      expect(slice!.text).toContain("async function triggerAutomatedRun");
      expect(slice!.text).toContain("collapsed");
    });
  });
});

