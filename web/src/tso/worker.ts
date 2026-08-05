/**
 * Web Worker for off-thread Tree-sitter parsing and optimization (FR-2.7, FR-T3).
 */

import { parseHtml, parseCss, parseJs } from "./parse";
import { extractHtmlSkeleton } from "./extract-html";
import { extractCssSkeleton } from "./extract-css";
import { extractJsSkeleton } from "./extract-js";
import { optimizeHtmlToSkeleton, optimizeCssToSkeleton, optimizeJsToSkeleton } from "./optimize-skeleton";
import { safeMinifyHtml, safeMinifyCss, safeMinifyJs } from "./optimize-minify";
import { verifyMinifyParity, verifyRangeReferences } from "./parity";
import { countTokens, TokenizerType } from "./tokens";

export interface WorkerParseRequest {
  id: string;
  action: "parse_and_optimize";
  files: Array<{
    fileName: string;
    language: "html" | "css" | "js";
    content: string;
  }>;
  tokenizer: TokenizerType;
  mode: "skeleton" | "minify" | "slice" | "combined";
}

export interface WorkerParseResponse {
  id: string;
  success: boolean;
  error?: string;
  results?: Array<{
    fileName: string;
    language: "html" | "css" | "js";
    astNodeCount: number;
    errorsCount: number;
    rawTokens: number;
    optimizedTokens: number;
    savedTokens: number;
    savingsPercent: number;
    optimizedText: string;
    isVerified: boolean;
    verificationReason: string;
  }>;
}

if (typeof self !== "undefined" && typeof (self as any).postMessage === "function") {
  self.addEventListener("message", (event: MessageEvent<WorkerParseRequest>) => {
    const { id, files, tokenizer, mode } = event.data;

    try {
      const results = files.map((file) => {
        let tree =
          file.language === "html"
            ? parseHtml(file.content)
            : file.language === "css"
              ? parseCss(file.content)
              : parseJs(file.content);

        const astNodes = tree.rootNode.descendants();
        const errors = tree.errors;

        let optText = "";
        let rawTokens = countTokens(file.content, tokenizer);
        let optTokens = 0;
        let isVerified = true;
        let verificationReason = "Verified";

        if (mode === "minify") {
          const minRes =
            file.language === "html"
              ? safeMinifyHtml(file.content, tree, tokenizer)
              : file.language === "css"
                ? safeMinifyCss(file.content, tree, tokenizer)
                : safeMinifyJs(file.content, tree, tokenizer);

          optText = minRes.text;
          optTokens = minRes.optimizedTokens;

          const parity = verifyMinifyParity(tree, optText, file.language);
          isVerified = parity.isVerified;
          verificationReason = parity.reason;
        } else {
          // Default to skeleton mode
          if (file.language === "html") {
            const hRes = extractHtmlSkeleton(tree, file.fileName);
            const opt = optimizeHtmlToSkeleton(file.content, hRes, file.fileName, tokenizer);
            optText = opt.text;
            optTokens = opt.optimizedTokens;
          } else if (file.language === "css") {
            const cRes = extractCssSkeleton(tree, file.fileName);
            const opt = optimizeCssToSkeleton(file.content, cRes, file.fileName, tokenizer);
            optText = opt.text;
            optTokens = opt.optimizedTokens;
          } else {
            const jRes = extractJsSkeleton(tree, file.fileName);
            const opt = optimizeJsToSkeleton(file.content, jRes, file.fileName, tokenizer);
            optText = opt.text;
            optTokens = opt.optimizedTokens;
          }

          const lineCount = file.content.split("\n").length;
          const parity = verifyRangeReferences(optText, { [file.fileName]: lineCount });
          isVerified = parity.isVerified;
          verificationReason = parity.reason;
        }

        const savedTokens = rawTokens - optTokens;
        const savingsPercent = rawTokens > 0 ? Math.round((savedTokens / rawTokens) * 100) : 0;

        return {
          fileName: file.fileName,
          language: file.language,
          astNodeCount: astNodes.length,
          errorsCount: errors.length,
          rawTokens,
          optimizedTokens: optTokens,
          savedTokens,
          savingsPercent,
          optimizedText: optText,
          isVerified,
          verificationReason,
        };
      });

      self.postMessage({ id, success: true, results });
    } catch (err: any) {
      self.postMessage({ id, success: false, error: err?.message || String(err) });
    }
  });
}

