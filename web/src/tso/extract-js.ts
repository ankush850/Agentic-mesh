/**
 * JavaScript Skeleton Extractor (FR-P4, FR-P6).
 * Extracts functions, classes, imports/exports, variables, event listeners,
 * DOM queries, network calls (fetch/XHR), and flags eval/new Function warnings.
 */

import { Tree } from "./parse";
import type { SkeletonEntry } from "./extract-html";

export interface JsSymbolDetails {
  kind:
    | "function"
    | "class"
    | "method"
    | "import"
    | "export"
    | "variable"
    | "event_listener"
    | "dom_query"
    | "network_call"
    | "security_warning";
  name: string;
  signature: string;
  target?: string;
  event?: string;
  query?: string;
  url?: string;
  isWarning?: boolean;
  warningMessage?: string;
}

export interface JsExtractionResult {
  entries: SkeletonEntry[];
  functionsCount: number;
  classesCount: number;
  domQueries: Array<{ query: string; line: number }>;
  eventListeners: Array<{ target: string; event: string; line: number }>;
  networkCalls: Array<{ url: string; line: number }>;
  securityWarnings: Array<{ warning: string; line: number }>;
}

export function cleanSignature(rawText: string, maxLen = 160): string {
  const singleLine = rawText
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (singleLine.length <= maxLen) return singleLine;
  return singleLine.slice(0, maxLen - 3) + "...";
}

export function extractJsSkeleton(tree: Tree, fileName = "script.js"): JsExtractionResult {
  const entries: SkeletonEntry[] = [];
  const domQueries: Array<{ query: string; line: number }> = [];
  const eventListeners: Array<{ target: string; event: string; line: number }> = [];
  const networkCalls: Array<{ url: string; line: number }> = [];
  const securityWarnings: Array<{ warning: string; line: number }> = [];

  let functionsCount = 0;
  let classesCount = 0;

  for (const node of tree.rootNode.descendants()) {
    // Skip root container to avoid duplicate matches on the whole program
    if (node === tree.rootNode) continue;

    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;

    // Security warning check: eval or new Function (FR-P4, FR-2.6)
    if (/\beval\s*\(/.test(node.text) || /\bnew\s+Function\s*\(/.test(node.text)) {
      const warnMsg = `Security warning: dynamic code evaluation detected (${node.text.slice(0, 40).trim()})`;
      if (!securityWarnings.some((w) => w.line === startLine)) {
        securityWarnings.push({ warning: warnMsg, line: startLine });
        entries.push({
          file: fileName,
          startLine,
          endLine,
          kind: "security_warning",
          label: `⚠️ ${warnMsg}`,
          depth: 0,
          details: {
            kind: "security_warning",
            name: "eval/Function",
            signature: cleanSignature(node.text),
            isWarning: true,
            warningMessage: warnMsg,
          },
        });
      }
    }

    // Event listeners: addEventListener(event, handler)
    const eventListenerMatch = node.text.match(
      /([a-zA-Z0-9_$.]+)?\.addEventListener\s*\(\s*(['"`])([a-zA-Z0-9_-]+)\2\s*,\s*([a-zA-Z0-9_$]+|\([^)]*\)\s*=>|function)/,
    );
    if (eventListenerMatch) {
      const target = eventListenerMatch[1] ?? "window";
      const event = eventListenerMatch[3];
      const handler = eventListenerMatch[4];
      if (!eventListeners.some((l) => l.line === startLine && l.event === event)) {
        eventListeners.push({ target, event, line: startLine });
        entries.push({
          file: fileName,
          startLine,
          endLine,
          kind: "event_listener",
          label: `${target}.on('${event}', ${handler})`,
          depth: 0,
          details: { kind: "event_listener", name: event, target, event, signature: cleanSignature(node.text) },
        });
      }
    }

    // DOM queries: document.querySelector/getElementById etc. (FR-P4, FR-P5)
    const domQueryMatch = node.text.match(
      /(?:document|element|root|window|parent)\.(querySelector|querySelectorAll|getElementById|getElementsByClassName)\s*\(\s*(['"`])([^'"`]+)\2\s*\)/,
    );
    if (domQueryMatch) {
      const method = domQueryMatch[1];
      const rawSelector = domQueryMatch[3];
      const normalizedQuery =
        method === "getElementById"
          ? `#${rawSelector}`
          : method === "getElementsByClassName"
            ? `.${rawSelector.split(/\s+/).join(".")}`
            : rawSelector;

      if (!domQueries.some((q) => q.line === startLine && q.query === normalizedQuery)) {
        domQueries.push({ query: normalizedQuery, line: startLine });
        entries.push({
          file: fileName,
          startLine,
          endLine,
          kind: "dom_query",
          label: `${method}("${rawSelector}")`,
          depth: 0,
          details: { kind: "dom_query", name: method, query: normalizedQuery, signature: cleanSignature(node.text) },
        });
      }
    }

    // Network calls: fetch(...) or XMLHttpRequest
    const fetchMatch = node.text.match(/\bfetch\s*\(\s*(['"`])([^'"`]+)\1/);
    if (fetchMatch) {
      const url = fetchMatch[2];
      if (!networkCalls.some((n) => n.line === startLine && n.url === url)) {
        networkCalls.push({ url, line: startLine });
        entries.push({
          file: fileName,
          startLine,
          endLine,
          kind: "network_call",
          label: `fetch("${url}")`,
          depth: 0,
          details: { kind: "network_call", name: "fetch", url, signature: cleanSignature(node.text) },
        });
      }
    } else if (/\bnew\s+XMLHttpRequest\b/.test(node.text)) {
      if (!networkCalls.some((n) => n.line === startLine)) {
        networkCalls.push({ url: "XMLHttpRequest", line: startLine });
        entries.push({
          file: fileName,
          startLine,
          endLine,
          kind: "network_call",
          label: "new XMLHttpRequest()",
          depth: 0,
          details: { kind: "network_call", name: "XMLHttpRequest", url: "XMLHttpRequest", signature: "XMLHttpRequest" },
        });
      }
    }

    // Import statement
    if (node.type === "import_statement") {
      const sig = cleanSignature(node.text);
      entries.push({
        file: fileName,
        startLine,
        endLine,
        kind: "import",
        label: sig,
        depth: 0,
        details: { kind: "import", name: "import", signature: sig },
      });
      continue;
    }

    // Function declaration
    if (node.type === "function_declaration") {
      functionsCount++;
      const idNode = node.children.find((c) => c.type === "identifier");
      const name = idNode?.text ?? "anonymous";
      const braceIdx = node.text.indexOf("{");
      const sigRaw = braceIdx !== -1 ? node.text.slice(0, braceIdx) : node.text;
      const signature = cleanSignature(sigRaw);

      entries.push({
        file: fileName,
        startLine,
        endLine,
        kind: "function",
        label: `function ${name}(...)`,
        depth: 0,
        details: { kind: "function", name, signature },
      });
      continue;
    }

    // Class declaration with methods
    if (node.type === "class_declaration") {
      classesCount++;
      const idNode = node.children.find((c) => c.type === "identifier");
      const name = idNode?.text ?? "AnonymousClass";
      const signature = `class ${name}`;

      entries.push({
        file: fileName,
        startLine,
        endLine,
        kind: "class",
        label: signature,
        depth: 0,
        details: { kind: "class", name, signature },
      });

      const methodRegex = /(?:async\s+)?([a-zA-Z0-9_$]+)\s*\(([^)]*)\)\s*\{/g;
      let mMatch: RegExpExecArray | null;
      while ((mMatch = methodRegex.exec(node.text)) !== null) {
        const methodName = mMatch[1];
        if (methodName === "if" || methodName === "for" || methodName === "while") continue;
        const methodSig = `${methodName}(${mMatch[2]})`;
        const mLines = node.text.slice(0, mMatch.index).split("\n").length - 1;
        const mStartLine = startLine + mLines;

        entries.push({
          file: fileName,
          startLine: mStartLine,
          endLine: mStartLine,
          kind: "method",
          label: `  ${methodSig}`,
          depth: 1,
          details: { kind: "method", name: `${name}.${methodName}`, signature: methodSig },
        });
      }
      continue;
    }

    // Arrow function assigned to variable
    if (node.type === "arrow_function") {
      functionsCount++;
      const idNode = node.children.find((c) => c.type === "identifier");
      const name = idNode?.text ?? "anonymous";
      const arrowIdx = node.text.indexOf("=>");
      const sigRaw = arrowIdx !== -1 ? node.text.slice(0, arrowIdx + 2) : node.text;
      const signature = cleanSignature(sigRaw);

      entries.push({
        file: fileName,
        startLine,
        endLine,
        kind: "function",
        label: `const ${name} = (...) =>`,
        depth: 0,
        details: { kind: "function", name, signature },
      });
      continue;
    }

    // Top-level variable declaration (names only)
    if (node.type === "lexical_declaration" || node.type === "variable_declaration") {
      const idNode = node.children.find((c) => c.type === "identifier");
      const name = idNode?.text ?? "variable";
      const sig = cleanSignature(node.text.slice(0, 80));

      entries.push({
        file: fileName,
        startLine,
        endLine,
        kind: "variable",
        label: sig,
        depth: 0,
        details: { kind: "variable", name, signature: sig },
      });
      continue;
    }
  }

  return {
    entries,
    functionsCount,
    classesCount,
    domQueries,
    eventListeners,
    networkCalls,
    securityWarnings,
  };
}
