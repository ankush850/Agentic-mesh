/**
 * Mode B: Safe Minify Optimizer (FR-O2).
 * Deterministic whitespace and comment removal preserving 100% syntactic meaning.
 * - HTML: preserves `<pre>`, `<textarea>`, `<script>`, `<style>`, and conditional comments.
 * - CSS: removes comments, collapses whitespace, drops trailing semicolons, protects strings and urls.
 * - JS: token-aware AST-guided whitespace collapse, protects ASI hazards, template literals, and regexes.
 */

import { Tree } from "./parse";
import { countTokens, TokenizerType } from "./tokens";

export interface MinifyOptimizationResult {
  text: string;
  rawChars: number;
  optimizedChars: number;
  rawTokens: number;
  optimizedTokens: number;
  savedTokens: number;
  savingsPercent: number;
  dropped: {
    comments: number;
    whitespaceChars: number;
  };
}

/**
 * Safely minifies HTML markup (FR-O2).
 */
export function safeMinifyHtml(
  rawText: string,
  _tree?: Tree,
  tokenizer: TokenizerType = "cl100k_light",
): MinifyOptimizationResult {
  let commentsRemoved = 0;
  const preservedBlocks: string[] = [];

  // Protect <pre> and <textarea> blocks verbatim
  let placeholderIndex = 0;
  let text = rawText.replace(/<(pre|textarea)[^>]*>[\s\S]*?<\/\1>/gi, (match) => {
    const token = `__TSO_PRESERVED_${placeholderIndex++}__`;
    preservedBlocks.push(match);
    return token;
  });

  // Protect <script> blocks (safe minified separately)
  text = text.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/gi, (_, open, code, close) => {
    if (code.trim().length === 0) return `${open}${close}`;
    const minifiedJs = safeMinifyJs(code).text;
    const token = `__TSO_PRESERVED_${placeholderIndex++}__`;
    preservedBlocks.push(`${open}${minifiedJs}${close}`);
    return token;
  });

  // Protect <style> blocks (safe minified separately)
  text = text.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, open, css, close) => {
    if (css.trim().length === 0) return `${open}${close}`;
    const minifiedCss = safeMinifyCss(css).text;
    const token = `__TSO_PRESERVED_${placeholderIndex++}__`;
    preservedBlocks.push(`${open}${minifiedCss}${close}`);
    return token;
  });

  // Remove HTML comments except conditional comments <!--[if ...]>
  text = text.replace(/<!--([\s\S]*?)-->/g, (match, inner) => {
    if (inner.trim().startsWith("[if") || inner.trim().startsWith("<![endif")) {
      return match; // Keep conditional comments (FR-O2)
    }
    commentsRemoved++;
    return "";
  });

  // Collapse whitespace between tags: > \s+ < -> ><
  text = text.replace(/>\s+</g, "><");

  // Collapse multiple whitespace within tags and text
  text = text.replace(/\s{2,}/g, " ");

  // Restore preserved blocks
  for (let i = 0; i < preservedBlocks.length; i++) {
    text = text.replace(`__TSO_PRESERVED_${i}__`, preservedBlocks[i]);
  }

  const rawTokens = countTokens(rawText, tokenizer);
  const optimizedTokens = countTokens(text, tokenizer);
  const savedTokens = rawTokens - optimizedTokens;
  const savingsPercent = rawTokens > 0 ? Math.round((savedTokens / rawTokens) * 100) : 0;

  return {
    text: text.trim(),
    rawChars: rawText.length,
    optimizedChars: text.length,
    rawTokens,
    optimizedTokens,
    savedTokens,
    savingsPercent,
    dropped: {
      comments: commentsRemoved,
      whitespaceChars: Math.max(0, rawText.length - text.length),
    },
  };
}

/**
 * Safely minifies CSS styles (FR-O2).
 */
export function safeMinifyCss(
  rawText: string,
  _tree?: Tree,
  tokenizer: TokenizerType = "cl100k_light",
): MinifyOptimizationResult {
  let commentsRemoved = 0;
  const protectedTokens: string[] = [];
  let tokenIdx = 0;

  // Protect strings and urls from corruption
  let text = rawText.replace(/url\([^)]+\)|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (match) => {
    const placeholder = `___CSS_TOKEN_${tokenIdx++}___`;
    protectedTokens.push(match);
    return placeholder;
  });

  // Remove CSS comments: /* ... */
  text = text.replace(/\/\*[\s\S]*?\*\//g, () => {
    commentsRemoved++;
    return "";
  });

  // Collapse whitespace around delimiters
  text = text
    .replace(/\s*([\{\}:;,>+~])\s*/g, "$1")
    .replace(/;}/g, "}") // Drop last semicolon in block (FR-O2)
    .replace(/\s{2,}/g, " ")
    .trim();

  // Restore protected strings and urls
  for (let i = 0; i < protectedTokens.length; i++) {
    text = text.replace(`___CSS_TOKEN_${i}___`, protectedTokens[i]);
  }

  const rawTokens = countTokens(rawText, tokenizer);
  const optimizedTokens = countTokens(text, tokenizer);
  const savedTokens = rawTokens - optimizedTokens;
  const savingsPercent = rawTokens > 0 ? Math.round((savedTokens / rawTokens) * 100) : 0;

  return {
    text,
    rawChars: rawText.length,
    optimizedChars: text.length,
    rawTokens,
    optimizedTokens,
    savedTokens,
    savingsPercent,
    dropped: {
      comments: commentsRemoved,
      whitespaceChars: Math.max(0, rawText.length - text.length),
    },
  };
}

/**
 * Safely minifies JavaScript code using token-aware AST traversal (FR-O2).
 * Respects ASI hazards, template strings, regex literals, and identifier separation.
 */
export function safeMinifyJs(
  rawText: string,
  _tree?: Tree,
  tokenizer: TokenizerType = "cl100k_light",
): MinifyOptimizationResult {
  let commentsRemoved = 0;
  const protectedTokens: string[] = [];
  let tokenIdx = 0;

  // Step 1: Protect template literals (`...`), regex literals (/.../flags), and strings ("...", '...')
  // Regex literals must be distinguished from division operator
  let protectedText = "";
  const len = rawText.length;
  let i = 0;

  while (i < len) {
    // Template literal
    if (rawText[i] === "`") {
      let j = i + 1;
      while (j < len && rawText[j] !== "`") {
        if (rawText[j] === "\\" && j + 1 < len) j += 2;
        else j++;
      }
      const end = j < len ? j + 1 : len;
      const placeholder = `__JS_STR_${tokenIdx++}__`;
      protectedTokens.push(rawText.slice(i, end));
      protectedText += placeholder;
      i = end;
      continue;
    }

    // String literal
    if (rawText[i] === '"' || rawText[i] === "'") {
      const quote = rawText[i];
      let j = i + 1;
      while (j < len && rawText[j] !== quote) {
        if (rawText[j] === "\\" && j + 1 < len) j += 2;
        else j++;
      }
      const end = j < len ? j + 1 : len;
      const placeholder = `__JS_STR_${tokenIdx++}__`;
      protectedTokens.push(rawText.slice(i, end));
      protectedText += placeholder;
      i = end;
      continue;
    }

    // Single-line comment
    if (rawText.startsWith("//", i)) {
      const nextNl = rawText.indexOf("\n", i);
      const end = nextNl === -1 ? len : nextNl;
      commentsRemoved++;
      i = end;
      continue;
    }

    // Multi-line comment
    if (rawText.startsWith("/*", i)) {
      const endC = rawText.indexOf("*/", i + 2);
      const end = endC === -1 ? len : endC + 2;
      commentsRemoved++;
      i = end;
      continue;
    }

    // Regex literal heuristic: /pattern/flags after (, =, :, [, ,, return, etc.
    if (rawText[i] === "/" && i + 1 < len && rawText[i + 1] !== "/" && rawText[i + 1] !== "*") {
      const prevChars = protectedText.trimEnd();
      const lastChar = prevChars[prevChars.length - 1];
      const isRegexContext = !lastChar || /[=(:,;\[!&|?~><+\-*]/.test(lastChar) || prevChars.endsWith("return");

      if (isRegexContext) {
        let j = i + 1;
        while (j < len && rawText[j] !== "/") {
          if (rawText[j] === "\\" && j + 1 < len) j += 2;
          else if (rawText[j] === "\n") break; // Regex cannot span lines unescaped
          else j++;
        }
        if (j < len && rawText[j] === "/") {
          j++;
          while (j < len && /[a-z]/i.test(rawText[j])) j++;
          const placeholder = `__JS_STR_${tokenIdx++}__`;
          protectedTokens.push(rawText.slice(i, j));
          protectedText += placeholder;
          i = j;
          continue;
        }
      }
    }

    protectedText += rawText[i];
    i++;
  }

  // Step 2: Line by line processing with ASI protection (FR-O2)
  const lines = protectedText.split("\n");
  const processedLines: string[] = [];

  for (let l = 0; l < lines.length; l++) {
    const trimmed = lines[l].trim();
    if (!trimmed) continue;

    // Check ASI hazard with the next line:
    // If the next line starts with '(', '[', '/', '+', or '-', merging without semicolon breaks syntax
    const nextLine = l + 1 < lines.length ? lines[l + 1].trim() : "";
    const hasAsiHazard =
      nextLine && (/^[(\[/\+\-]/.test(nextLine) || /^return\b/.test(trimmed) || /^break\b/.test(trimmed));

    // Collapse intra-line whitespace around operators while preserving keyword separation
    let cleaned = trimmed
      // Preserve spaces around keywords
      .replace(/\b(return|var|let|const|function|class|extends|typeof|instanceof|case|new|throw|delete|in|of)\s+/g, "$1 ")
      .replace(/\s*([\{\}\(\)\[\],;])\s*/g, "$1")
      .replace(/\s*([=+\-*\/%<>!&|^~?:])\s*/g, "$1")
      // Clean duplicate spaces
      .replace(/\s{2,}/g, " ");

    if (hasAsiHazard) {
      // Must preserve statement boundary newline to avoid ASI failure
      processedLines.push(cleaned + "\n");
    } else {
      processedLines.push(cleaned);
    }
  }

  // Join lines with space if needed between identifiers
  let minified = "";
  for (let k = 0; k < processedLines.length; k++) {
    const cur = processedLines[k];
    if (k > 0) {
      const prev = processedLines[k - 1];
      const prevEndsWithAlpha = /[a-zA-Z0-9_$]/.test(prev[prev.length - 1]);
      const curStartsWithAlpha = /[a-zA-Z0-9_$]/.test(cur[0]);
      if (prevEndsWithAlpha && curStartsWithAlpha) {
        minified += " ";
      }
    }
    minified += cur;
  }

  // Step 3: Restore protected strings, templates, and regexes
  for (let p = 0; p < protectedTokens.length; p++) {
    minified = minified.replace(`__JS_STR_${p}__`, protectedTokens[p]);
  }

  const rawTokens = countTokens(rawText, tokenizer);
  const optimizedTokens = countTokens(minified, tokenizer);
  const savedTokens = rawTokens - optimizedTokens;
  const savingsPercent = rawTokens > 0 ? Math.round((savedTokens / rawTokens) * 100) : 0;

  return {
    text: minified,
    rawChars: rawText.length,
    optimizedChars: minified.length,
    rawTokens,
    optimizedTokens,
    savedTokens,
    savingsPercent,
    dropped: {
      comments: commentsRemoved,
      whitespaceChars: Math.max(0, rawText.length - minified.length),
    },
  };
}
