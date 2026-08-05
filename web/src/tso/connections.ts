/**
 * Cross-File Connections & References Engine (FR-P5).
 * Resolves HTML links to CSS/JS files, matches CSS selectors to HTML elements,
 * matches JS DOM queries to HTML elements, and reports warnings for unused CSS,
 * unresolved JS selectors, and missing linked assets.
 */

import type { HtmlExtractionResult } from "./extract-html";
import type { CssExtractionResult } from "./extract-css";
import type { JsExtractionResult } from "./extract-js";

export interface FileLinkConnection {
  type: "stylesheet" | "script";
  sourceFile: string;
  targetRef: string;
  resolvedFile?: string;
  status: "linked" | "missing";
}

export interface SelectorMatchConnection {
  selector: string;
  cssFile: string;
  matchedCount: number;
  matchedElements: string[];
  status: "matched" | "unused" | "not_evaluated";
  note?: string;
}

export interface DomQueryConnection {
  query: string;
  jsFile: string;
  matchedCount: number;
  matchedElements: string[];
  status: "resolved" | "unresolved";
}

export interface CrossFileWarning {
  code: "UNUSED_CSS" | "UNRESOLVED_JS_QUERY" | "MISSING_LINKED_FILE" | "SECURITY_EVAL";
  message: string;
  file: string;
  target: string;
  line?: number;
}

export interface ConnectionGraphNode {
  id: string;
  label: string;
  type: "html" | "css" | "js";
  stats: string;
}

export interface ConnectionGraphEdge {
  from: string;
  to: string;
  label: string;
  count: number;
}

export interface ProjectConnections {
  fileLinks: FileLinkConnection[];
  cssMatches: SelectorMatchConnection[];
  jsMatches: DomQueryConnection[];
  warnings: CrossFileWarning[];
  graphNodes: ConnectionGraphNode[];
  graphEdges: ConnectionGraphEdge[];
  stats: {
    totalHtmlElements: number;
    totalCssRules: number;
    totalJsQueries: number;
    matchedCssRules: number;
    unusedCssRules: number;
    unresolvedJsQueries: number;
  };
}

interface ParsedHtmlElement {
  tag: string;
  id?: string;
  classes: Set<string>;
  attributes: Map<string, string>;
  fullSelector: string;
}

/**
 * Extracts a searchable list of elements from HTML skeleton entries.
 */
function extractHtmlElements(htmlResult: HtmlExtractionResult): ParsedHtmlElement[] {
  const elements: ParsedHtmlElement[] = [];

  for (const entry of htmlResult.entries) {
    if (entry.details && entry.details.tagName) {
      const tag = entry.details.tagName.toLowerCase();
      const id = entry.details.id;
      const classes = new Set<string>(entry.details.classes || []);
      const attributes = new Map<string, string>(Object.entries(entry.details.attributes || {}));

      let fullSel = tag;
      if (id) fullSel += `#${id}`;
      if (classes.size > 0) fullSel += `.${Array.from(classes).join(".")}`;

      elements.push({ tag, id, classes, attributes, fullSelector: fullSel });
    }
  }

  return elements;
}

/**
 * Evaluates whether a CSS selector matches a parsed HTML element (FR-P5b).
 * Returns { matches: boolean, notEvaluated: boolean, reason?: string }.
 */
function matchSelectorToElement(
  rawSelector: string,
  element: ParsedHtmlElement,
): { matches: boolean; notEvaluated: boolean; reason?: string } {
  const selector = rawSelector.trim();

  // Pseudo-classes / pseudo-elements check (FR-P5b: unsupported pseudo-classes reported as "not evaluated", never guessed)
  if (/:hover|:focus|:active|:visited|:target|:nth-|:first-|:last-|::before|::after/.test(selector)) {
    // Check if the base part matches
    const baseSelector = selector.split(/::?|\[/)[0].trim();
    if (baseSelector && matchSelectorToElement(baseSelector, element).matches) {
      return { matches: true, notEvaluated: true, reason: "Pseudo-class/element not evaluated in static analysis" };
    }
    return { matches: false, notEvaluated: true, reason: "Pseudo-class not evaluated" };
  }

  // Handle simple tag selector
  if (/^[a-zA-Z0-9-]+$/.test(selector)) {
    return { matches: selector.toLowerCase() === element.tag, notEvaluated: false };
  }

  // Handle simple ID selector #foo
  if (selector.startsWith("#") && !selector.includes(" ") && !selector.includes(".")) {
    const targetId = selector.slice(1);
    return { matches: element.id === targetId, notEvaluated: false };
  }

  // Handle simple class selector .foo
  if (selector.startsWith(".") && !selector.includes(" ") && !selector.includes("#")) {
    const targetClass = selector.slice(1);
    return { matches: element.classes.has(targetClass), notEvaluated: false };
  }

  // Handle compound selector e.g. button.btn#login or div[data-id]
  let matches = true;

  // Tag part
  const tagPartMatch = selector.match(/^([a-zA-Z0-9-]+)/);
  if (tagPartMatch) {
    if (element.tag !== tagPartMatch[1].toLowerCase()) {
      return { matches: false, notEvaluated: false };
    }
  }

  // ID parts
  const idMatch = selector.match(/#([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    if (element.id !== idMatch[1]) {
      return { matches: false, notEvaluated: false };
    }
  }

  // Class parts
  const classMatches = selector.matchAll(/\.([a-zA-Z0-9_-]+)/g);
  for (const cm of classMatches) {
    if (!element.classes.has(cm[1])) {
      return { matches: false, notEvaluated: false };
    }
  }

  // Attribute parts [attr=val] or [attr]
  const attrMatches = selector.matchAll(/\[([a-zA-Z0-9_-]+)(?:=([^\],]+))?\]/g);
  for (const am of attrMatches) {
    const attrName = am[1].toLowerCase();
    const attrVal = am[2] ? am[2].replace(/['"]/g, "") : null;
    if (!element.attributes.has(attrName)) {
      return { matches: false, notEvaluated: false };
    }
    if (attrVal !== null && element.attributes.get(attrName) !== attrVal) {
      return { matches: false, notEvaluated: false };
    }
  }

  return { matches, notEvaluated: false };
}

/**
 * Analyzes cross-file connections across HTML, CSS, and JS files.
 */
export function analyzeConnections(params: {
  htmlFiles: Array<{ fileName: string; result: HtmlExtractionResult }>;
  cssFiles: Array<{ fileName: string; result: CssExtractionResult }>;
  jsFiles: Array<{ fileName: string; result: JsExtractionResult }>;
}): ProjectConnections {
  const fileLinks: FileLinkConnection[] = [];
  const cssMatches: SelectorMatchConnection[] = [];
  const jsMatches: DomQueryConnection[] = [];
  const warnings: CrossFileWarning[] = [];

  const availableFiles = new Set<string>();
  const allHtmlElements: Array<{ file: string; element: ParsedHtmlElement }> = [];

  // Register all available files
  for (const h of params.htmlFiles) {
    availableFiles.add(h.fileName);
    const parsed = extractHtmlElements(h.result);
    for (const el of parsed) {
      allHtmlElements.push({ file: h.fileName, element: el });
    }
  }
  for (const c of params.cssFiles) availableFiles.add(c.fileName);
  for (const j of params.jsFiles) availableFiles.add(j.fileName);

  // 1. Resolve HTML file links (FR-P5a)
  for (const h of params.htmlFiles) {
    // Stylesheets
    for (const linkHref of h.result.stylesheets) {
      const cleanRef = linkHref.replace(/^\.\//, "");
      const matched = Array.from(availableFiles).find(
        (f) => f === cleanRef || f.endsWith("/" + cleanRef) || cleanRef.endsWith("/" + f),
      );
      if (matched) {
        fileLinks.push({
          type: "stylesheet",
          sourceFile: h.fileName,
          targetRef: linkHref,
          resolvedFile: matched,
          status: "linked",
        });
      } else {
        fileLinks.push({
          type: "stylesheet",
          sourceFile: h.fileName,
          targetRef: linkHref,
          status: "missing",
        });
        warnings.push({
          code: "MISSING_LINKED_FILE",
          message: `Linked stylesheet '${linkHref}' was not loaded into the optimizer`,
          file: h.fileName,
          target: linkHref,
        });
      }
    }

    // Scripts
    for (const scriptSrc of h.result.scripts) {
      const cleanRef = scriptSrc.replace(/^\.\//, "");
      const matched = Array.from(availableFiles).find(
        (f) => f === cleanRef || f.endsWith("/" + cleanRef) || cleanRef.endsWith("/" + f),
      );
      if (matched) {
        fileLinks.push({
          type: "script",
          sourceFile: h.fileName,
          targetRef: scriptSrc,
          resolvedFile: matched,
          status: "linked",
        });
      } else {
        fileLinks.push({
          type: "script",
          sourceFile: h.fileName,
          targetRef: scriptSrc,
          status: "missing",
        });
        warnings.push({
          code: "MISSING_LINKED_FILE",
          message: `Linked script '${scriptSrc}' was not loaded into the optimizer`,
          file: h.fileName,
          target: scriptSrc,
        });
      }
    }
  }

  // 2. Match CSS selectors against HTML elements (FR-P5b)
  let matchedCssRules = 0;
  let unusedCssRules = 0;

  for (const c of params.cssFiles) {
    for (const entry of c.result.entries) {
      if (entry.kind === "css_rule" && entry.details?.selectors) {
        for (const selObj of entry.details.selectors) {
          const selText: string = selObj.text;
          const matchedElNames: string[] = [];
          let isPartiallyEvaluated = false;
          let evalNote: string | undefined;

          for (const item of allHtmlElements) {
            const evalResult = matchSelectorToElement(selText, item.element);
            if (evalResult.matches) {
              matchedElNames.push(item.element.fullSelector);
              if (evalResult.notEvaluated) {
                isPartiallyEvaluated = true;
                evalNote = evalResult.reason;
              }
            }
          }

          if (matchedElNames.length > 0) {
            matchedCssRules++;
            cssMatches.push({
              selector: selText,
              cssFile: c.fileName,
              matchedCount: matchedElNames.length,
              matchedElements: matchedElNames.slice(0, 5),
              status: isPartiallyEvaluated ? "not_evaluated" : "matched",
              note: evalNote,
            });
          } else {
            unusedCssRules++;
            cssMatches.push({
              selector: selText,
              cssFile: c.fileName,
              matchedCount: 0,
              matchedElements: [],
              status: "unused",
            });
            // Warn for unused classes or IDs
            if (selText.startsWith(".") || selText.startsWith("#")) {
              warnings.push({
                code: "UNUSED_CSS",
                message: `CSS selector '${selText}' does not match any element in loaded HTML`,
                file: c.fileName,
                target: selText,
                line: entry.startLine,
              });
            }
          }
        }
      }
    }
  }

  // 3. Match JS DOM queries against HTML elements (FR-P5c)
  let unresolvedJsQueries = 0;

  for (const j of params.jsFiles) {
    for (const q of j.result.domQueries) {
      const query = q.query;
      const matchedElNames: string[] = [];

      for (const item of allHtmlElements) {
        const evalResult = matchSelectorToElement(query, item.element);
        if (evalResult.matches) {
          matchedElNames.push(item.element.fullSelector);
        }
      }

      if (matchedElNames.length > 0) {
        jsMatches.push({
          query,
          jsFile: j.fileName,
          matchedCount: matchedElNames.length,
          matchedElements: matchedElNames.slice(0, 5),
          status: "resolved",
        });
      } else {
        unresolvedJsQueries++;
        jsMatches.push({
          query,
          jsFile: j.fileName,
          matchedCount: 0,
          matchedElements: [],
          status: "unresolved",
        });
        warnings.push({
          code: "UNRESOLVED_JS_QUERY",
          message: `JavaScript DOM query '${query}' matches no element in loaded HTML`,
          file: j.fileName,
          target: query,
          line: q.line,
        });
      }
    }

    // Include any security warnings (FR-P4, FR-2.6)
    for (const w of j.result.securityWarnings) {
      warnings.push({
        code: "SECURITY_EVAL",
        message: w.warning,
        file: j.fileName,
        target: "eval/Function",
        line: w.line,
      });
    }
  }

  // 4. Construct Connection Graph (FR-P5)
  const graphNodes: ConnectionGraphNode[] = [];
  const graphEdges: ConnectionGraphEdge[] = [];

  for (const h of params.htmlFiles) {
    graphNodes.push({
      id: h.fileName,
      label: h.fileName,
      type: "html",
      stats: `${h.result.entries.length} elements, ${h.result.landmarksCount} landmarks`,
    });
  }
  for (const c of params.cssFiles) {
    graphNodes.push({
      id: c.fileName,
      label: c.fileName,
      type: "css",
      stats: `${c.result.rulesCount} rules, ${c.result.customPropertiesDeclared.length} vars`,
    });
  }
  for (const j of params.jsFiles) {
    graphNodes.push({
      id: j.fileName,
      label: j.fileName,
      type: "js",
      stats: `${j.result.functionsCount} fns, ${j.result.domQueries.length} queries`,
    });
  }

  // Edges: HTML -> CSS
  for (const h of params.htmlFiles) {
    for (const c of params.cssFiles) {
      const matchCount = cssMatches.filter((m) => m.cssFile === c.fileName && m.matchedCount > 0).length;
      if (matchCount > 0) {
        graphEdges.push({
          from: h.fileName,
          to: c.fileName,
          label: "styles",
          count: matchCount,
        });
      }
    }

    // Edges: JS -> HTML
    for (const j of params.jsFiles) {
      const queryCount = jsMatches.filter((m) => m.jsFile === j.fileName && m.matchedCount > 0).length;
      if (queryCount > 0) {
        graphEdges.push({
          from: j.fileName,
          to: h.fileName,
          label: "queries",
          count: queryCount,
        });
      }
    }
  }

  return {
    fileLinks,
    cssMatches,
    jsMatches,
    warnings,
    graphNodes,
    graphEdges,
    stats: {
      totalHtmlElements: allHtmlElements.length,
      totalCssRules: matchedCssRules + unusedCssRules,
      totalJsQueries: jsMatches.length,
      matchedCssRules,
      unusedCssRules,
      unresolvedJsQueries,
    },
  };
}

