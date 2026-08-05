/**
 * Worker Bridge Interface (FR-2.7).
 * Provides off-thread execution with fallback to chunked async execution in environments
 * where Web Workers are unavailable or restricted.
 */

import type { WorkerParseRequest, WorkerParseResponse } from "./worker";
import { parseHtml, parseCss, parseJs } from "./parse";
import { extractHtmlSkeleton } from "./extract-html";
import { extractCssSkeleton } from "./extract-css";
import { extractJsSkeleton } from "./extract-js";
import { optimizeHtmlToSkeleton, optimizeCssToSkeleton, optimizeJsToSkeleton } from "./optimize-skeleton";
import { safeMinifyHtml, safeMinifyCss, safeMinifyJs } from "./optimize-minify";
import { verifyMinifyParity, verifyRangeReferences } from "./parity";
import { countTokens } from "./tokens";
import { TSO_CONFIG } from "./config";

export async function executeParseAndOptimize(request: WorkerParseRequest): Promise<WorkerParseResponse> {
  // If Worker constructor is supported in the browser
  if (typeof window !== "undefined" && typeof Worker !== "undefined") {
    try {
      return await new Promise<WorkerParseResponse>((resolve) => {
        const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
        const timer = setTimeout(() => {
          worker.terminate();
          resolve(fallbackExecute(request));
        }, TSO_CONFIG.WORKER_TIMEOUT_MS);

        worker.onmessage = (event: MessageEvent<WorkerParseResponse>) => {
          clearTimeout(timer);
          worker.terminate();
          resolve(event.data);
        };

        worker.onerror = () => {
          clearTimeout(timer);
          worker.terminate();
          // Fall back to main thread async execution
          resolve(fallbackExecute(request));
        };

        worker.postMessage(request);
      });
    } catch {
      // Worker creation blocked or unsupported
      return fallbackExecute(request);
    }
  }

  // Fallback for test environments (jsdom / Node) or restricted sandboxes
  return fallbackExecute(request);
}

/**
 * In-process asynchronous executor for testing and fallback environments.
 */
function fallbackExecute(request: WorkerParseRequest): Promise<WorkerParseResponse> {
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        const results = request.files.map((file) => {
          const tree =
            file.language === "html"
              ? parseHtml(file.content)
              : file.language === "css"
                ? parseCss(file.content)
                : parseJs(file.content);

          const astNodes = tree.rootNode.descendants();
          const errors = tree.errors;

          let optText = "";
          const rawTokens = countTokens(file.content, request.tokenizer);
          let optTokens = 0;
          let isVerified = true;
          let verificationReason = "Verified";

          if (request.mode === "minify") {
            const minRes =
              file.language === "html"
                ? safeMinifyHtml(file.content, tree, request.tokenizer)
                : file.language === "css"
                  ? safeMinifyCss(file.content, tree, request.tokenizer)
                  : safeMinifyJs(file.content, tree, request.tokenizer);

            optText = minRes.text;
            optTokens = minRes.optimizedTokens;

            const parity = verifyMinifyParity(tree, optText, file.language);
            isVerified = parity.isVerified;
            verificationReason = parity.reason;
          } else {
            // Skeleton mode
            if (file.language === "html") {
              const hRes = extractHtmlSkeleton(tree, file.fileName);
              const opt = optimizeHtmlToSkeleton(file.content, hRes, file.fileName, request.tokenizer);
              optText = opt.text;
              optTokens = opt.optimizedTokens;
            } else if (file.language === "css") {
              const cRes = extractCssSkeleton(tree, file.fileName);
              const opt = optimizeCssToSkeleton(file.content, cRes, file.fileName, request.tokenizer);
              optText = opt.text;
              optTokens = opt.optimizedTokens;
            } else {
              const jRes = extractJsSkeleton(tree, file.fileName);
              const opt = optimizeJsToSkeleton(file.content, jRes, file.fileName, request.tokenizer);
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

        resolve({ id: request.id, success: true, results });
      } catch (err: any) {
        resolve({ id: request.id, success: false, error: err?.message || String(err) });
      }
    }, 0);
  });
}
