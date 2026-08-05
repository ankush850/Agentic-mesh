/**
 * Tree-sitter Concrete Syntax Tree (CST) Parser Module.
 * Implements Tree-sitter compatible AST specifications for HTML, CSS, and JavaScript,
 * with injection parsing for inline `<style>` and `<script>` blocks.
 */

export interface Point {
  row: number; // 0-based line index
  column: number; // 0-based column index
}

export interface SyntaxNode {
  type: string;
  text: string;
  startPosition: Point;
  endPosition: Point;
  startIndex: number;
  endIndex: number;
  named: boolean;
  children: SyntaxNode[];
  parent: SyntaxNode | null;
  childCount: number;
  isNamed(): boolean;
  hasError(): boolean;
  isMissing(): boolean;
  child(index: number): SyntaxNode | null;
  descendants(): SyntaxNode[];
}

export interface Tree {
  rootNode: SyntaxNode;
  text: string;
  language: "html" | "css" | "js";
  errors: SyntaxNode[];
  walk(): TreeCursor;
  delete(): void; // Lifecycle cleanup
}

export interface TreeCursor {
  currentNode: SyntaxNode;
  gotoFirstChild(): boolean;
  gotoNextSibling(): boolean;
  gotoParent(): boolean;
}

export interface InlineBlock {
  language: "css" | "js";
  tag: string;
  text: string;
  startLine: number; // 1-based line in original HTML
  endLine: number; // 1-based line in original HTML
  startOffset: number;
  endOffset: number;
  tree: Tree;
}

export const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/**
 * Creates a concrete SyntaxNode implementation.
 */
export function createSyntaxNode(params: {
  type: string;
  text: string;
  startPosition: Point;
  endPosition: Point;
  startIndex: number;
  endIndex: number;
  named?: boolean;
  children?: SyntaxNode[];
  parent?: SyntaxNode | null;
}): SyntaxNode {
  const children = params.children ?? [];
  const node: SyntaxNode = {
    type: params.type,
    text: params.text,
    startPosition: params.startPosition,
    endPosition: params.endPosition,
    startIndex: params.startIndex,
    endIndex: params.endIndex,
    named: params.named ?? true,
    children,
    parent: params.parent ?? null,
    childCount: children.length,
    isNamed() {
      return this.named;
    },
    hasError() {
      if (this.type === "ERROR" || this.type === "MISSING") return true;
      return this.children.some((c) => c.hasError());
    },
    isMissing() {
      return this.type === "MISSING";
    },
    child(index: number) {
      return this.children[index] ?? null;
    },
    descendants() {
      const result: SyntaxNode[] = [];
      const traverse = (n: SyntaxNode) => {
        result.push(n);
        for (const c of n.children) traverse(c);
      };
      traverse(this);
      return result;
    },
  };

  for (const child of children) {
    child.parent = node;
  }

  return node;
}

/**
 * Computes 0-based Point { row, column } from character offset in text.
 */
export function computePoint(text: string, offset: number, baseRow = 0, baseCol = 0): Point {
  const slice = text.slice(0, Math.min(offset, text.length));
  const lines = slice.split("\n");
  const row = baseRow + lines.length - 1;
  const col = lines.length === 1 ? baseCol + lines[0].length : lines[lines.length - 1].length;
  return { row, column: col };
}

/**
 * Helper to build a Tree container.
 */
function createTree(rootNode: SyntaxNode, text: string, language: "html" | "css" | "js"): Tree {
  const errors = rootNode.descendants().filter((n) => n.type === "ERROR" || n.type === "MISSING");

  return {
    rootNode,
    text,
    language,
    errors,
    walk() {
      let current = rootNode;
      return {
        currentNode: current,
        gotoFirstChild() {
          if (current.children.length > 0) {
            current = current.children[0];
            return true;
          }
          return false;
        },
        gotoNextSibling() {
          if (!current.parent) return false;
          const siblings = current.parent.children;
          const idx = siblings.indexOf(current);
          if (idx !== -1 && idx + 1 < siblings.length) {
            current = siblings[idx + 1];
            return true;
          }
          return false;
        },
        gotoParent() {
          if (current.parent) {
            current = current.parent;
            return true;
          }
          return false;
        },
      };
    },
    delete() {
      rootNode.children = [];
    },
  };
}

// -------------------------------------------------------------
// HTML Grammar Implementation
// -------------------------------------------------------------
export function parseHtml(text: string, baseOffset = 0, baseRow = 0, baseCol = 0): Tree {
  const rootChildren: SyntaxNode[] = [];
  const len = text.length;
  let i = 0;

  const getPoint = (idx: number) => computePoint(text, idx, baseRow, baseCol);

  while (i < len) {
    if (text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i + 4);
      const close = end === -1 ? len : end + 3;
      const raw = text.slice(i, close);
      rootChildren.push(
        createSyntaxNode({
          type: "comment",
          text: raw,
          startPosition: getPoint(i),
          endPosition: getPoint(close),
          startIndex: baseOffset + i,
          endIndex: baseOffset + close,
        }),
      );
      i = close;
      continue;
    }

    if (text.startsWith("<!DOCTYPE", i) || text.startsWith("<!doctype", i)) {
      const end = text.indexOf(">", i);
      const close = end === -1 ? len : end + 1;
      rootChildren.push(
        createSyntaxNode({
          type: "doctype",
          text: text.slice(i, close),
          startPosition: getPoint(i),
          endPosition: getPoint(close),
          startIndex: baseOffset + i,
          endIndex: baseOffset + close,
        }),
      );
      i = close;
      continue;
    }

    if (text[i] === "<") {
      const isClosing = text[i + 1] === "/";
      const tagMatch = text.slice(i).match(/^<\/?([a-zA-Z0-9:-]+)/);

      if (!tagMatch) {
        const errorEnd = Math.min(len, i + 10);
        rootChildren.push(
          createSyntaxNode({
            type: "ERROR",
            text: text.slice(i, errorEnd),
            startPosition: getPoint(i),
            endPosition: getPoint(errorEnd),
            startIndex: baseOffset + i,
            endIndex: baseOffset + errorEnd,
          }),
        );
        i = errorEnd;
        continue;
      }

      const tagName = tagMatch[1].toLowerCase();
      const tagStartIndex = i;

      let tagEndIndex = -1;
      let inQuote: string | null = null;
      for (let j = i; j < len; j++) {
        const c = text[j];
        if (inQuote) {
          if (c === inQuote) inQuote = null;
        } else if (c === '"' || c === "'") {
          inQuote = c;
        } else if (c === ">") {
          tagEndIndex = j + 1;
          break;
        }
      }

      if (tagEndIndex === -1) {
        tagEndIndex = len;
      }

      const rawTag = text.slice(tagStartIndex, tagEndIndex);
      const isSelfClosing = rawTag.endsWith("/>");

      // Attributes parsing
      const tagAttributes: SyntaxNode[] = [];
      const attrRegex = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      const attrArea = rawTag.slice(tagMatch[0].length, isSelfClosing ? -2 : -1);
      const attrBase = tagStartIndex + tagMatch[0].length;

      let aMatch: RegExpExecArray | null;
      while ((aMatch = attrRegex.exec(attrArea)) !== null) {
        const aName = aMatch[1];
        if (!aName) continue;
        const aStart = attrBase + aMatch.index;
        const aEnd = aStart + aMatch[0].length;
        const aVal = aMatch[2] ?? aMatch[3] ?? aMatch[4] ?? "";

        const attrChildren: SyntaxNode[] = [
          createSyntaxNode({
            type: "attribute_name",
            text: aName,
            startPosition: getPoint(aStart),
            endPosition: getPoint(aStart + aName.length),
            startIndex: baseOffset + aStart,
            endIndex: baseOffset + aStart + aName.length,
          }),
        ];

        if (aMatch[0].includes("=")) {
          const valStart =
            aEnd - (aMatch[2] !== undefined || aMatch[3] !== undefined ? aVal.length + 2 : aVal.length);
          attrChildren.push(
            createSyntaxNode({
              type: "quoted_attribute_value",
              text: aVal,
              startPosition: getPoint(valStart),
              endPosition: getPoint(aEnd),
              startIndex: baseOffset + valStart,
              endIndex: baseOffset + aEnd,
            }),
          );
        }

        tagAttributes.push(
          createSyntaxNode({
            type: "attribute",
            text: aMatch[0],
            startPosition: getPoint(aStart),
            endPosition: getPoint(aEnd),
            startIndex: baseOffset + aStart,
            endIndex: baseOffset + aEnd,
            children: attrChildren,
          }),
        );
      }

      const tagNameNode = createSyntaxNode({
        type: "tag_name",
        text: tagName,
        startPosition: getPoint(tagStartIndex + (isClosing ? 2 : 1)),
        endPosition: getPoint(tagStartIndex + (isClosing ? 2 : 1) + tagName.length),
        startIndex: baseOffset + tagStartIndex + (isClosing ? 2 : 1),
        endIndex: baseOffset + tagStartIndex + (isClosing ? 2 : 1) + tagName.length,
      });

      if (isClosing) {
        rootChildren.push(
          createSyntaxNode({
            type: "end_tag",
            text: rawTag,
            startPosition: getPoint(tagStartIndex),
            endPosition: getPoint(tagEndIndex),
            startIndex: baseOffset + tagStartIndex,
            endIndex: baseOffset + tagEndIndex,
            children: [tagNameNode],
          }),
        );
        i = tagEndIndex;
        continue;
      }

      const startTagNode = createSyntaxNode({
        type: "start_tag",
        text: rawTag,
        startPosition: getPoint(tagStartIndex),
        endPosition: getPoint(tagEndIndex),
        startIndex: baseOffset + tagStartIndex,
        endIndex: baseOffset + tagEndIndex,
        children: [tagNameNode, ...tagAttributes],
      });

      // Raw-text elements: script, style
      if (tagName === "script" || tagName === "style") {
        const closeTag = `</${tagName}>`;
        const closeIdx = text.toLowerCase().indexOf(closeTag, tagEndIndex);
        const rawContentEnd = closeIdx === -1 ? len : closeIdx;
        const rawContent = text.slice(tagEndIndex, rawContentEnd);

        const elementChildren: SyntaxNode[] = [startTagNode];
        if (rawContent.length > 0) {
          elementChildren.push(
            createSyntaxNode({
              type: "raw_text",
              text: rawContent,
              startPosition: getPoint(tagEndIndex),
              endPosition: getPoint(rawContentEnd),
              startIndex: baseOffset + tagEndIndex,
              endIndex: baseOffset + rawContentEnd,
            }),
          );
        }

        if (closeIdx !== -1) {
          const endTagEnd = closeIdx + closeTag.length;
          elementChildren.push(
            createSyntaxNode({
              type: "end_tag",
              text: text.slice(closeIdx, endTagEnd),
              startPosition: getPoint(closeIdx),
              endPosition: getPoint(endTagEnd),
              startIndex: baseOffset + closeIdx,
              endIndex: baseOffset + endTagEnd,
              children: [
                createSyntaxNode({
                  type: "tag_name",
                  text: tagName,
                  startPosition: getPoint(closeIdx + 2),
                  endPosition: getPoint(closeIdx + 2 + tagName.length),
                  startIndex: baseOffset + closeIdx + 2,
                  endIndex: baseOffset + closeIdx + 2 + tagName.length,
                }),
              ],
            }),
          );
          i = endTagEnd;
        } else {
          i = rawContentEnd;
        }

        rootChildren.push(
          createSyntaxNode({
            type: "element",
            text: text.slice(tagStartIndex, i),
            startPosition: getPoint(tagStartIndex),
            endPosition: getPoint(i),
            startIndex: baseOffset + tagStartIndex,
            endIndex: baseOffset + i,
            children: elementChildren,
          }),
        );
        continue;
      }

      // Standard element or self-closing: advance by start tag so nested tags parse
      rootChildren.push(
        createSyntaxNode({
          type: "element",
          text: rawTag,
          startPosition: getPoint(tagStartIndex),
          endPosition: getPoint(tagEndIndex),
          startIndex: baseOffset + tagStartIndex,
          endIndex: baseOffset + tagEndIndex,
          children: [startTagNode],
        }),
      );
      i = tagEndIndex;
      continue;
    }

    // Text node
    const nextTag = text.indexOf("<", i);
    const textEnd = nextTag === -1 ? len : nextTag;
    const textVal = text.slice(i, textEnd);
    if (textVal.trim().length > 0) {
      rootChildren.push(
        createSyntaxNode({
          type: "text",
          text: textVal,
          startPosition: getPoint(i),
          endPosition: getPoint(textEnd),
          startIndex: baseOffset + i,
          endIndex: baseOffset + textEnd,
        }),
      );
    }
    i = textEnd;
  }

  const root = createSyntaxNode({
    type: "document",
    text,
    startPosition: computePoint(text, 0, baseRow, baseCol),
    endPosition: computePoint(text, len, baseRow, baseCol),
    startIndex: baseOffset,
    endIndex: baseOffset + len,
    children: rootChildren,
  });

  return createTree(root, text, "html");
}

// -------------------------------------------------------------
// CSS Grammar Implementation
// -------------------------------------------------------------
export function parseCss(text: string, baseOffset = 0, baseRow = 0, baseCol = 0): Tree {
  const rootChildren: SyntaxNode[] = [];
  const len = text.length;
  let i = 0;

  const getPoint = (idx: number) => computePoint(text, idx, baseRow, baseCol);

  while (i < len) {
    while (i < len && /\s/.test(text[i])) i++;
    if (i >= len) break;

    // Comments
    if (text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i + 2);
      const close = end === -1 ? len : end + 2;
      rootChildren.push(
        createSyntaxNode({
          type: "comment",
          text: text.slice(i, close),
          startPosition: getPoint(i),
          endPosition: getPoint(close),
          startIndex: baseOffset + i,
          endIndex: baseOffset + close,
        }),
      );
      i = close;
      continue;
    }

    // At-rules
    if (text[i] === "@") {
      const atStart = i;
      const atMatch = text.slice(i).match(/^@([a-zA-Z-]+)/);
      const atName = atMatch ? atMatch[1].toLowerCase() : "at-rule";

      if (atName === "import") {
        const semi = text.indexOf(";", i);
        const close = semi === -1 ? len : semi + 1;
        rootChildren.push(
          createSyntaxNode({
            type: "import_statement",
            text: text.slice(atStart, close),
            startPosition: getPoint(atStart),
            endPosition: getPoint(close),
            startIndex: baseOffset + atStart,
            endIndex: baseOffset + close,
          }),
        );
        i = close;
        continue;
      }

      const braceOpen = text.indexOf("{", i);
      if (braceOpen !== -1) {
        let depth = 1;
        let blockClose = -1;
        for (let j = braceOpen + 1; j < len; j++) {
          if (text[j] === "{") depth++;
          else if (text[j] === "}") {
            depth--;
            if (depth === 0) {
              blockClose = j + 1;
              break;
            }
          }
        }
        if (blockClose === -1) blockClose = len;

        const atStatementType =
          atName === "media"
            ? "media_statement"
            : atName === "supports"
              ? "supports_statement"
              : atName === "keyframes"
                ? "keyframes_statement"
                : atName === "font-face"
                  ? "font_face_statement"
                  : atName === "layer"
                    ? "layer_statement"
                    : "at_rule";

        const innerCss = text.slice(braceOpen + 1, blockClose - (blockClose === len ? 0 : 1));
        const innerTree = parseCss(
          innerCss,
          baseOffset + braceOpen + 1,
          getPoint(braceOpen + 1).row,
          getPoint(braceOpen + 1).column,
        );

        rootChildren.push(
          createSyntaxNode({
            type: atStatementType,
            text: text.slice(atStart, blockClose),
            startPosition: getPoint(atStart),
            endPosition: getPoint(blockClose),
            startIndex: baseOffset + atStart,
            endIndex: baseOffset + blockClose,
            children: innerTree.rootNode.children,
          }),
        );
        i = blockClose;
        continue;
      }
    }

    // Standard rule set: selector { declarations }
    const braceOpen = text.indexOf("{", i);
    if (braceOpen === -1) {
      const unclosedText = text.slice(i).trim();
      if (unclosedText) {
        rootChildren.push(
          createSyntaxNode({
            type: "ERROR",
            text: unclosedText,
            startPosition: getPoint(i),
            endPosition: getPoint(len),
            startIndex: baseOffset + i,
            endIndex: baseOffset + len,
          }),
        );
      }
      break;
    }

    const selectorText = text.slice(i, braceOpen).trim();
    const selectorStart = i;
    const selectorEnd = braceOpen;

    const braceClose = text.indexOf("}", braceOpen);
    const ruleClose = braceClose === -1 ? len : braceClose + 1;
    const bodyText = text.slice(braceOpen + 1, braceClose === -1 ? len : braceClose);

    // Parse selectors
    const selectorNodes: SyntaxNode[] = [];
    const rawSelectors = selectorText.split(",");
    let selOffset = selectorStart;
    for (const rawSel of rawSelectors) {
      const trimmed = rawSel.trim();
      const sStart = text.indexOf(trimmed, selOffset);
      const sEnd = sStart + trimmed.length;
      selOffset = sEnd;

      selectorNodes.push(
        createSyntaxNode({
          type: "selector",
          text: trimmed,
          startPosition: getPoint(sStart),
          endPosition: getPoint(sEnd),
          startIndex: baseOffset + sStart,
          endIndex: baseOffset + sEnd,
        }),
      );
    }

    const selectorsNode = createSyntaxNode({
      type: "selectors",
      text: selectorText,
      startPosition: getPoint(selectorStart),
      endPosition: getPoint(selectorEnd),
      startIndex: baseOffset + selectorStart,
      endIndex: baseOffset + selectorEnd,
      children: selectorNodes,
    });

    // Parse declarations
    const declarationNodes: SyntaxNode[] = [];
    const declItems = bodyText.split(";");
    let declOffset = braceOpen + 1;

    for (const rawDecl of declItems) {
      const trimmed = rawDecl.trim();
      if (!trimmed) continue;

      const cleanDecl = trimmed.replace(/\/\*[\s\S]*?\*\//g, "").trim();
      if (!cleanDecl) continue;

      const colon = cleanDecl.indexOf(":");
      const dStart = text.indexOf(trimmed, declOffset);
      const dEnd = dStart + trimmed.length;
      declOffset = dEnd;

      if (colon !== -1) {
        const prop = cleanDecl.slice(0, colon).trim();
        const val = cleanDecl.slice(colon + 1).trim();

        const pNode = createSyntaxNode({
          type: "property_name",
          text: prop,
          startPosition: getPoint(dStart),
          endPosition: getPoint(dStart + prop.length),
          startIndex: baseOffset + dStart,
          endIndex: baseOffset + dStart + prop.length,
        });

        const vNode = createSyntaxNode({
          type: "property_value",
          text: val,
          startPosition: getPoint(dEnd - val.length),
          endPosition: getPoint(dEnd),
          startIndex: baseOffset + dEnd - val.length,
          endIndex: baseOffset + dEnd,
        });

        declarationNodes.push(
          createSyntaxNode({
            type: "declaration",
            text: cleanDecl,
            startPosition: getPoint(dStart),
            endPosition: getPoint(dEnd),
            startIndex: baseOffset + dStart,
            endIndex: baseOffset + dEnd,
            children: [pNode, vNode],
          }),
        );
      } else {
        declarationNodes.push(
          createSyntaxNode({
            type: "ERROR",
            text: trimmed,
            startPosition: getPoint(dStart),
            endPosition: getPoint(dEnd),
            startIndex: baseOffset + dStart,
            endIndex: baseOffset + dEnd,
          }),
        );
      }
    }

    const ruleChildren = [selectorsNode, ...declarationNodes];
    if (braceClose === -1) {
      ruleChildren.push(
        createSyntaxNode({
          type: "MISSING",
          text: "}",
          startPosition: getPoint(len),
          endPosition: getPoint(len),
          startIndex: baseOffset + len,
          endIndex: baseOffset + len,
        }),
      );
    }

    rootChildren.push(
      createSyntaxNode({
        type: "rule_set",
        text: text.slice(i, ruleClose),
        startPosition: getPoint(i),
        endPosition: getPoint(ruleClose),
        startIndex: baseOffset + i,
        endIndex: baseOffset + ruleClose,
        children: ruleChildren,
      }),
    );
    i = ruleClose;
  }

  const root = createSyntaxNode({
    type: "stylesheet",
    text,
    startPosition: computePoint(text, 0, baseRow, baseCol),
    endPosition: computePoint(text, len, baseRow, baseCol),
    startIndex: baseOffset,
    endIndex: baseOffset + len,
    children: rootChildren,
  });

  return createTree(root, text, "css");
}

// -------------------------------------------------------------
// JavaScript Grammar Implementation
// -------------------------------------------------------------
export function parseJs(text: string, baseOffset = 0, baseRow = 0, baseCol = 0): Tree {
  const rootChildren: SyntaxNode[] = [];
  const len = text.length;
  let i = 0;

  const getPoint = (idx: number) => computePoint(text, idx, baseRow, baseCol);

  while (i < len) {
    while (i < len && /\s/.test(text[i])) i++;
    if (i >= len) break;

    // Single-line comment
    if (text.startsWith("//", i)) {
      const nextNl = text.indexOf("\n", i);
      const close = nextNl === -1 ? len : nextNl;
      rootChildren.push(
        createSyntaxNode({
          type: "comment",
          text: text.slice(i, close),
          startPosition: getPoint(i),
          endPosition: getPoint(close),
          startIndex: baseOffset + i,
          endIndex: baseOffset + close,
        }),
      );
      i = close;
      continue;
    }

    // Multi-line comment
    if (text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i + 2);
      const close = end === -1 ? len : end + 2;
      rootChildren.push(
        createSyntaxNode({
          type: "comment",
          text: text.slice(i, close),
          startPosition: getPoint(i),
          endPosition: getPoint(close),
          startIndex: baseOffset + i,
          endIndex: baseOffset + close,
        }),
      );
      i = close;
      continue;
    }

    // Import statement
    if (text.startsWith("import ", i) || text.startsWith("import{", i) || text.startsWith("import*", i)) {
      const semi = text.indexOf(";", i);
      const newline = text.indexOf("\n", i);
      let close = semi !== -1 ? semi + 1 : newline !== -1 ? newline : len;
      rootChildren.push(
        createSyntaxNode({
          type: "import_statement",
          text: text.slice(i, close),
          startPosition: getPoint(i),
          endPosition: getPoint(close),
          startIndex: baseOffset + i,
          endIndex: baseOffset + close,
        }),
      );
      i = close;
      continue;
    }

    // Export statement
    if (text.startsWith("export ", i)) {
      const stmtEnd = text.indexOf(";", i);
      const close = stmtEnd !== -1 ? stmtEnd + 1 : len;
      rootChildren.push(
        createSyntaxNode({
          type: "export_statement",
          text: text.slice(i, close),
          startPosition: getPoint(i),
          endPosition: getPoint(close),
          startIndex: baseOffset + i,
          endIndex: baseOffset + close,
        }),
      );
      i = close;
      continue;
    }

    // Function declaration
    const fnMatch = text.slice(i).match(/^(async\s+)?function(?:\s*\*|\s+)?([a-zA-Z0-9_$]*)\s*\(([^)]*)\)/);
    if (fnMatch) {
      const fnStart = i;
      const fnName = fnMatch[2] || "anonymous";
      const braceOpen = text.indexOf("{", i + fnMatch[0].length);

      if (braceOpen !== -1) {
        let depth = 1;
        let fnEnd = -1;
        for (let j = braceOpen + 1; j < len; j++) {
          if (text[j] === "{") depth++;
          else if (text[j] === "}") {
            depth--;
            if (depth === 0) {
              fnEnd = j + 1;
              break;
            }
          }
        }
        if (fnEnd === -1) fnEnd = len;

        const fnBody = text.slice(braceOpen + 1, fnEnd - 1);
        const fnChildren: SyntaxNode[] = [
          createSyntaxNode({
            type: "identifier",
            text: fnName,
            startPosition: getPoint(fnStart + fnMatch[0].indexOf(fnName)),
            endPosition: getPoint(fnStart + fnMatch[0].indexOf(fnName) + fnName.length),
            startIndex: baseOffset + fnStart + fnMatch[0].indexOf(fnName),
            endIndex: baseOffset + fnStart + fnMatch[0].indexOf(fnName) + fnName.length,
          }),
        ];

        // Flag syntax errors inside function body (e.g. `return x * ;`)
        if (/[+\-*\/%&|^=]\s*;|[!&|><+\-*\/=]\s*\}|return\s*[+\-*\/%]/.test(fnBody)) {
          fnChildren.push(
            createSyntaxNode({
              type: "ERROR",
              text: fnBody.trim(),
              startPosition: getPoint(braceOpen + 1),
              endPosition: getPoint(fnEnd - 1),
              startIndex: baseOffset + braceOpen + 1,
              endIndex: baseOffset + fnEnd - 1,
            }),
          );
        }

        rootChildren.push(
          createSyntaxNode({
            type: "function_declaration",
            text: text.slice(fnStart, fnEnd),
            startPosition: getPoint(fnStart),
            endPosition: getPoint(fnEnd),
            startIndex: baseOffset + fnStart,
            endIndex: baseOffset + fnEnd,
            children: fnChildren,
          }),
        );
        i = fnEnd;
        continue;
      }
    }

    // Class declaration
    const classMatch = text.slice(i).match(/^class\s+([a-zA-Z0-9_$]+)(?:\s+extends\s+([a-zA-Z0-9_$]+))?/);
    if (classMatch) {
      const classStart = i;
      const className = classMatch[1];
      const braceOpen = text.indexOf("{", i + classMatch[0].length);

      if (braceOpen !== -1) {
        let depth = 1;
        let classEnd = -1;
        for (let j = braceOpen + 1; j < len; j++) {
          if (text[j] === "{") depth++;
          else if (text[j] === "}") {
            depth--;
            if (depth === 0) {
              classEnd = j + 1;
              break;
            }
          }
        }
        if (classEnd === -1) classEnd = len;

        rootChildren.push(
          createSyntaxNode({
            type: "class_declaration",
            text: text.slice(classStart, classEnd),
            startPosition: getPoint(classStart),
            endPosition: getPoint(classEnd),
            startIndex: baseOffset + classStart,
            endIndex: baseOffset + classEnd,
            children: [
              createSyntaxNode({
                type: "identifier",
                text: className,
                startPosition: getPoint(classStart + 6),
                endPosition: getPoint(classStart + 6 + className.length),
                startIndex: baseOffset + classStart + 6,
                endIndex: baseOffset + classStart + 6 + className.length,
              }),
            ],
          }),
        );
        i = classEnd;
        continue;
      }
    }

    // Variable declaration (const, let, var)
    const varMatch = text.slice(i).match(/^(const|let|var)\s+([a-zA-Z0-9_$,\s]+?)\s*(=|;|\n)/);
    if (varMatch) {
      const varStart = i;
      const kind = varMatch[1];
      const varName = varMatch[2].trim().split(/\s*,\s*/)[0];

      let stmtEnd = -1;
      let depthParen = 0;
      let depthBrace = 0;
      let inStr: string | null = null;

      for (let j = i + varMatch[0].length; j < len; j++) {
        const c = text[j];
        if (inStr) {
          if (c === "\\" && j + 1 < len) j++;
          else if (c === inStr) inStr = null;
        } else if (c === '"' || c === "'" || c === "`") {
          inStr = c;
        } else if (c === "(") depthParen++;
        else if (c === ")") depthParen--;
        else if (c === "{") depthBrace++;
        else if (c === "}") {
          depthBrace--;
          if (depthBrace === 0 && depthParen === 0) {
            stmtEnd = j + 1;
            break;
          }
        } else if (c === ";" && depthParen === 0 && depthBrace === 0) {
          stmtEnd = j + 1;
          break;
        } else if (c === "\n" && depthParen === 0 && depthBrace === 0) {
          stmtEnd = j;
          break;
        }
      }
      if (stmtEnd === -1) stmtEnd = len;

      const rawStmt = text.slice(varStart, stmtEnd);
      const isArrow = rawStmt.includes("=>");

      rootChildren.push(
        createSyntaxNode({
          type: isArrow ? "arrow_function" : "lexical_declaration",
          text: rawStmt,
          startPosition: getPoint(varStart),
          endPosition: getPoint(stmtEnd),
          startIndex: baseOffset + varStart,
          endIndex: baseOffset + stmtEnd,
          children: [
            createSyntaxNode({
              type: "identifier",
              text: varName,
              startPosition: getPoint(varStart + kind.length + 1),
              endPosition: getPoint(varStart + kind.length + 1 + varName.length),
              startIndex: baseOffset + varStart + kind.length + 1,
              endIndex: baseOffset + varStart + kind.length + 1 + varName.length,
            }),
          ],
        }),
      );
      i = stmtEnd;
      continue;
    }

    // Check for syntax error check
    const semiOrNl = text.indexOf(";", i);
    const nl = text.indexOf("\n", i);
    let endOfStmt = semiOrNl !== -1 ? semiOrNl + 1 : nl !== -1 ? nl : len;
    const stmtSlice = text.slice(i, endOfStmt).trim();

    const isMalformed =
      /^(function\s*\(\s*\{|const\s*=|\)\s*\{|class\s*\{)/.test(stmtSlice) ||
      (stmtSlice.startsWith("function") && !stmtSlice.includes("{") && stmtSlice.endsWith(";"));

    if (isMalformed) {
      rootChildren.push(
        createSyntaxNode({
          type: "ERROR",
          text: stmtSlice,
          startPosition: getPoint(i),
          endPosition: getPoint(endOfStmt),
          startIndex: baseOffset + i,
          endIndex: baseOffset + endOfStmt,
        }),
      );
      i = endOfStmt;
      continue;
    }

    const isCall =
      /\b(addEventListener|querySelector|querySelectorAll|getElementById|getElementsByClassName|fetch|XMLHttpRequest|eval|Function)\b/.test(
        stmtSlice,
      );

    rootChildren.push(
      createSyntaxNode({
        type: isCall ? "call_expression" : "expression_statement",
        text: stmtSlice,
        startPosition: getPoint(i),
        endPosition: getPoint(endOfStmt),
        startIndex: baseOffset + i,
        endIndex: baseOffset + endOfStmt,
      }),
    );
    i = endOfStmt;
  }

  const root = createSyntaxNode({
    type: "program",
    text,
    startPosition: computePoint(text, 0, baseRow, baseCol),
    endPosition: computePoint(text, len, baseRow, baseCol),
    startIndex: baseOffset,
    endIndex: baseOffset + len,
    children: rootChildren,
  });

  return createTree(root, text, "js");
}

// -------------------------------------------------------------
// HTML Inline Script/Style Extraction & Injection (FR-I3)
// -------------------------------------------------------------
export function extractHtmlInjections(htmlTree: Tree): InlineBlock[] {
  const blocks: InlineBlock[] = [];

  for (const node of htmlTree.rootNode.descendants()) {
    if (node.type === "element") {
      const startTag = node.children.find((c) => c.type === "start_tag");
      const tagNameNode = startTag?.children.find((c) => c.type === "tag_name");
      const tagName = tagNameNode?.text.toLowerCase();

      if (tagName === "style" || tagName === "script") {
        const rawTextNode = node.children.find((c) => c.type === "raw_text");
        if (rawTextNode && rawTextNode.text.trim().length > 0) {
          const lang = tagName === "style" ? "css" : "js";
          const subTree =
            lang === "css"
              ? parseCss(
                  rawTextNode.text,
                  rawTextNode.startIndex,
                  rawTextNode.startPosition.row,
                  rawTextNode.startPosition.column,
                )
              : parseJs(
                  rawTextNode.text,
                  rawTextNode.startIndex,
                  rawTextNode.startPosition.row,
                  rawTextNode.startPosition.column,
                );

          blocks.push({
            language: lang,
            tag: tagName,
            text: rawTextNode.text,
            startLine: rawTextNode.startPosition.row + 1,
            endLine: rawTextNode.endPosition.row + 1,
            startOffset: rawTextNode.startIndex,
            endOffset: rawTextNode.endIndex,
            tree: subTree,
          });
        }
      }
    }
  }

  return blocks;
}
