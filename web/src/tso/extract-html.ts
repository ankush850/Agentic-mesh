/**
 * HTML Skeleton Extractor (FR-P2, FR-P6).
 * Extracts document outline, landmarks, headings, forms, links, scripts, meta tags,
 * and collapses repeated sibling elements.
 */

import { Tree, SyntaxNode } from "./parse";

export interface SkeletonEntry {
  file: string;
  startLine: number; // 1-based
  endLine: number; // 1-based
  kind: string;
  label: string;
  details?: Record<string, any>;
  depth: number;
}

export interface HtmlExtractionResult {
  entries: SkeletonEntry[];
  stylesheets: string[];
  scripts: string[];
  metaTags: Record<string, string>;
  droppedTextChars: number;
  landmarksCount: number;
  formsCount: number;
  headingsCount: number;
  inlineStyleSummary: number;
  inlineEventHandlers: string[];
}

const LANDMARKS = new Set(["header", "nav", "main", "section", "article", "aside", "footer"]);
const KEY_ATTRS = new Set(["href", "src", "rel", "type", "name", "role", "aria-label"]);

export function extractHtmlSkeleton(tree: Tree, fileName = "index.html"): HtmlExtractionResult {
  const entries: SkeletonEntry[] = [];
  const stylesheets: string[] = [];
  const scripts: string[] = [];
  const metaTags: Record<string, string> = {};
  let droppedTextChars = 0;
  let landmarksCount = 0;
  let formsCount = 0;
  let headingsCount = 0;
  let inlineStyleSummary = 0;
  const inlineEventHandlers: string[] = [];

  function parseAttributes(elText: string): Map<string, string> {
    const attrs = new Map<string, string>();
    const tagOpenMatch = elText.match(/^<[a-zA-Z0-9:-]+([^>]*)>/);
    if (!tagOpenMatch) return attrs;

    const attrRegex = /([a-zA-Z0-9:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let match: RegExpExecArray | null;
    while ((match = attrRegex.exec(tagOpenMatch[1])) !== null) {
      const name = match[1].toLowerCase();
      const val = match[2] ?? match[3] ?? match[4] ?? "";
      attrs.set(name, val);
    }
    return attrs;
  }

  function walkNode(node: SyntaxNode, depth = 0) {
    if (node.type === "element") {
      const startTag = node.children.find((c) => c.type === "start_tag");
      const tagNameNode = startTag?.children.find((c) => c.type === "tag_name");
      const tagName = tagNameNode ? tagNameNode.text.toLowerCase() : "";

      if (!tagName) return;

      const attrs = parseAttributes(node.text);
      const id = attrs.get("id");
      const className = attrs.get("class");

      if (attrs.has("style")) {
        inlineStyleSummary++;
      }
      for (const [key] of attrs) {
        if (key.startsWith("on")) {
          const sel = `${tagName}${id ? "#" + id : ""}${className ? "." + className.replace(/\s+/g, ".") : ""}[${key}]`;
          inlineEventHandlers.push(sel);
        }
      }

      if (tagName === "meta") {
        const charset = attrs.get("charset");
        const name = attrs.get("name")?.toLowerCase();
        const content = attrs.get("content");
        if (charset) metaTags["charset"] = charset;
        if (name && content) {
          if (name === "viewport" || name === "description") {
            metaTags[name] = content;
          }
        }
      }

      if (tagName === "link" && attrs.get("rel")?.toLowerCase() === "stylesheet") {
        const href = attrs.get("href");
        if (href) stylesheets.push(href);
      }
      if (tagName === "script") {
        const src = attrs.get("src");
        if (src) scripts.push(src);
      }

      const keyAttrParts: string[] = [];
      for (const [k, v] of attrs) {
        if (KEY_ATTRS.has(k) || k.startsWith("data-")) {
          keyAttrParts.push(`${k}="${v}"`);
        }
      }

      let kind = "element";
      let textSnippet = "";

      if (LANDMARKS.has(tagName) || attrs.get("role")) {
        kind = "landmark";
        landmarksCount++;
      }

      if (/^h[1-6]$/.test(tagName)) {
        kind = "heading";
        headingsCount++;
        const innerText = node.text.replace(/<[^>]+>/g, "").trim().replace(/\s+/g, " ");
        textSnippet = innerText.slice(0, 60);
      }

      if (tagName === "form") {
        kind = "form";
        formsCount++;
      }

      let label = `<${tagName}`;
      if (id) label += `#${id}`;
      if (className) label += `.${className.trim().split(/\s+/).join(".")}`;
      if (keyAttrParts.length > 0) label += ` ${keyAttrParts.join(" ")}`;
      label += ">";

      if (textSnippet) {
        label += ` "${textSnippet}"`;
      }

      entries.push({
        file: fileName,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        kind,
        label,
        details: {
          tagName,
          id,
          classes: className ? className.split(/\s+/) : [],
          attributes: Object.fromEntries(attrs),
        },
        depth,
      });

      for (const child of node.children) {
        if (child.type === "element") {
          walkNode(child, depth + 1);
        }
      }
    } else {
      for (const child of node.children) {
        walkNode(child, depth);
      }
    }
  }

  walkNode(tree.rootNode, 0);

  // Compute dropped text character counts across all text nodes (FR-P2)
  for (const n of tree.rootNode.descendants()) {
    if (n.type === "text") {
      const parent = n.parent;
      const parentTag = parent?.children.find((c) => c.type === "tag_name")?.text.toLowerCase() ?? "";
      if (!/^h[1-6]$/.test(parentTag) && parentTag !== "button" && parentTag !== "label" && parentTag !== "title") {
        const trimmed = n.text.trim();
        if (trimmed.length > 0) {
          droppedTextChars += trimmed.length;
        }
      }
    }
  }

  // Collapse repeated sibling element patterns (e.g. li.item x8) (FR-P2)
  const collapsedEntries: SkeletonEntry[] = [];
  for (let i = 0; i < entries.length; i++) {
    const current = entries[i];
    let repeatCount = 1;
    let lastEndLine = current.endLine;

    while (
      i + 1 < entries.length &&
      entries[i + 1].depth === current.depth &&
      entries[i + 1].label === current.label &&
      entries[i + 1].kind === current.kind
    ) {
      repeatCount++;
      lastEndLine = entries[i + 1].endLine;
      i++;
    }

    if (repeatCount > 1) {
      collapsedEntries.push({
        ...current,
        endLine: lastEndLine,
        label: `${current.label} x${repeatCount}`,
        details: { ...current.details, repeatCount },
      });
    } else {
      collapsedEntries.push(current);
    }
  }

  return {
    entries: collapsedEntries,
    stylesheets,
    scripts,
    metaTags,
    droppedTextChars,
    landmarksCount,
    formsCount,
    headingsCount,
    inlineStyleSummary,
    inlineEventHandlers,
  };
}
