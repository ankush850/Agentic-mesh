import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
let parse5Lib: any = null;
async function getParse5(): Promise<any> {
  if (!parse5Lib) {
    parse5Lib = await (import("parse5") as Promise<any>);
  }
  return parse5Lib;
}
import * as babelParser from "@babel/parser";
import postcss from "postcss";
import { z } from "zod";
import { logger } from "../logger";

// ============================================================================
// Schemas and Types
// ============================================================================

export const InteractiveElementSchema = z.object({
  id: z.string().optional(),
  tag: z.string(),
  role: z.string().optional(),
  className: z.string().optional(),
  dataTestId: z.string().optional(),
  ariaLabel: z.string().optional(),
  name: z.string().optional(),
  type: z.string().optional(),
  placeholder: z.string().optional(),
  visibleText: z.string().optional(),
  text: z.string().optional(),
  href: z.string().optional(),
  formId: z.string().optional(),
  eventHandlers: z.array(z.string()).default([]),
  sourceFile: z.string(),
  startLine: z.number(),
  endLine: z.number().optional(),
  treePosition: z.string(),
  sourceFingerprint: z.string(),
});
export type InteractiveElement = z.infer<typeof InteractiveElementSchema>;

export const FormFieldSchema = z.object({
  name: z.string().optional(),
  id: z.string().optional(),
  tag: z.string(),
  type: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().default(false),
  label: z.string().optional(),
  line: z.number().optional(),
  sourceFingerprint: z.string().optional(),
});
export type FormField = z.infer<typeof FormFieldSchema>;

export const FormSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  action: z.string().optional(),
  method: z.string().optional(),
  sourceFile: z.string(),
  startLine: z.number(),
  endLine: z.number().optional(),
  fields: z.array(FormFieldSchema),
  submitButtonText: z.string().optional(),
  submitSelector: z.string().optional(),
});
export type Form = z.infer<typeof FormSchema>;

export const NavigationLinkSchema = z.object({
  text: z.string(),
  href: z.string(),
  sourceFile: z.string(),
  startLine: z.number(),
  line: z.number().optional(),
  targetPage: z.string().optional(),
});
export type NavigationLink = z.infer<typeof NavigationLinkSchema>;

export const ComponentPropSchema = z.object({
  name: z.string(),
  type: z.string().optional(),
});
export type ComponentProp = z.infer<typeof ComponentPropSchema>;

export const ComponentInfoSchema = z.object({
  name: z.string(),
  file: z.string(),
  props: z.array(ComponentPropSchema).default([]),
  startLine: z.number().optional(),
});
export type ComponentInfo = z.infer<typeof ComponentInfoSchema>;

export const PageInfoSchema = z.object({
  file: z.string(),
  route: z.string().default("/"),
  routeOrFile: z.string(),
  title: z.string().optional(),
  interactiveElements: z.array(InteractiveElementSchema),
  forms: z.array(FormSchema),
  links: z.array(NavigationLinkSchema),
  conditionalRenderHints: z.array(z.string()).default([]),
});
export type PageInfo = z.infer<typeof PageInfoSchema>;

export const ParseErrorSchema = z.object({
  file: z.string(),
  error: z.string(),
});
export type ParseError = z.infer<typeof ParseErrorSchema>;

export const AppStatsSchema = z.object({
  fileCount: z.number(),
  elementCount: z.number(),
  formCount: z.number(),
  componentCount: z.number(),
  routeCount: z.number(),
});
export type AppStats = z.infer<typeof AppStatsSchema>;

export const AppModelSchema = z.object({
  repoPath: z.string(),
  pages: z.array(PageInfoSchema),
  components: z.array(ComponentInfoSchema),
  interactiveElements: z.array(InteractiveElementSchema).default([]),
  forms: z.array(FormSchema).default([]),
  navigationLinks: z.array(NavigationLinkSchema).default([]),
  conditionalRenderHints: z.array(z.string()).default([]),
  totalFilesParsed: z.number(),
  parseErrors: z.array(ParseErrorSchema),
  stats: AppStatsSchema.optional(),
});
export type AppModel = z.infer<typeof AppModelSchema>;

// ============================================================================
// Stable Fingerprinting
// ============================================================================

export function computeSourceFingerprint(params: {
  tag: string;
  role?: string;
  text?: string;
  testid?: string;
  id?: string;
  treePosition: string | number;
}): string {
  const normalized = [
    params.tag.toLowerCase(),
    (params.role || "").toLowerCase(),
    (params.text || "").trim().toLowerCase().slice(0, 50),
    (params.testid || "").toLowerCase(),
    (params.id || "").toLowerCase(),
    String(params.treePosition ?? "").toLowerCase(),
  ].join("|");

  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

// ============================================================================
// HTML Parsing via parse5
// ============================================================================

interface HtmlParseContext {
  relativeFile: string;
  pageTitle?: string;
  elements: InteractiveElement[];
  forms: Form[];
  links: NavigationLink[];
  currentFormId?: string;
  currentFormFields: FormField[];
  treePath: string[];
}

function getAttr(node: any, name: string): string | undefined {
  if (!node.attrs) return undefined;
  const attr = node.attrs.find((a: any) => a.name.toLowerCase() === name.toLowerCase());
  return attr ? attr.value : undefined;
}

function getVisibleText(node: any): string {
  let text = "";
  if (node.nodeName === "#text" && node.value) {
    text += node.value.trim();
  }
  if (node.childNodes) {
    for (const child of node.childNodes) {
      const childText = getVisibleText(child);
      if (childText) text += (text ? " " : "") + childText;
    }
  }
  return text.trim();
}

function isInteractiveTag(tagName: string, attrs: any[] = []): boolean {
  const interactiveTags = new Set(["a", "button", "input", "select", "textarea"]);
  if (interactiveTags.has(tagName)) return true;

  const role = attrs.find((a) => a.name.toLowerCase() === "role")?.value?.toLowerCase();
  if (role && ["button", "link", "checkbox", "tab", "menuitem", "switch"].includes(role)) {
    return true;
  }

  const hasClick = attrs.some(
    (a) => a.name.toLowerCase().startsWith("on") || a.name.startsWith("@click")
  );
  return hasClick;
}

function walkHtmlNode(node: any, ctx: HtmlParseContext): void {
  if (node.nodeName === "title") {
    ctx.pageTitle = getVisibleText(node);
  }

  const isElement = node.nodeName && !node.nodeName.startsWith("#");
  if (!isElement) {
    if (node.childNodes) {
      for (const child of node.childNodes) walkHtmlNode(child, ctx);
    }
    return;
  }

  const tagName = node.nodeName.toLowerCase();
  const id = getAttr(node, "id");
  const className = getAttr(node, "class");
  const role = getAttr(node, "role");
  const dataTestId = getAttr(node, "data-testid") || getAttr(node, "data-test-id");
  const ariaLabel = getAttr(node, "aria-label");
  const name = getAttr(node, "name");
  const type = getAttr(node, "type");
  const placeholder = getAttr(node, "placeholder");
  const href = getAttr(node, "href");

  const startLine = node.sourceCodeLocation?.startLine ?? 1;
  const endLine = node.sourceCodeLocation?.endLine;

  // Build tree position indicator
  const posToken = `${tagName}${id ? `#${id}` : className ? `.${className.split(/\s+/)[0]}` : ""}`;
  ctx.treePath.push(posToken);
  const treePosition = ctx.treePath.join(" > ");

  // Form handling
  const isForm = tagName === "form";
  const prevFormId = ctx.currentFormId;
  const prevFormFields = ctx.currentFormFields;

  if (isForm) {
    ctx.currentFormId = id || name || `form_${ctx.forms.length + 1}`;
    ctx.currentFormFields = [];
  }

  // Interactive element extraction
  if (isInteractiveTag(tagName, node.attrs || [])) {
    const text = getVisibleText(node);
    const eventHandlers = (node.attrs || [])
      .filter((a: any) => a.name.toLowerCase().startsWith("on"))
      .map((a: any) => a.name);

    const fingerprint = computeSourceFingerprint({
      tag: tagName,
      role,
      text,
      testid: dataTestId,
      id,
      treePosition,
    });

    ctx.elements.push({
      tag: tagName,
      id,
      role,
      className,
      dataTestId,
      ariaLabel,
      name,
      type,
      placeholder,
      visibleText: text || undefined,
      text: text || undefined,
      href,
      formId: ctx.currentFormId,
      eventHandlers,
      sourceFile: ctx.relativeFile,
      startLine,
      endLine,
      treePosition,
      sourceFingerprint: fingerprint,
    });

    // Form fields
    if (["input", "select", "textarea"].includes(tagName)) {
      ctx.currentFormFields.push({
        tag: tagName,
        id,
        name,
        type,
        placeholder,
        required: getAttr(node, "required") !== undefined,
        label: ariaLabel || placeholder,
        sourceFingerprint: fingerprint,
      });
    }

    // Links
    if (tagName === "a" && href) {
      ctx.links.push({
        text: text || href,
        href,
        sourceFile: ctx.relativeFile,
        startLine,
        targetPage: href.endsWith(".html") ? path.basename(href) : href,
      });
    }
  }

  // Traverse children
  if (node.childNodes) {
    for (const child of node.childNodes) {
      walkHtmlNode(child, ctx);
    }
  }

  if (isForm) {
    const submitBtn = ctx.elements.find(
      (el) => el.formId === ctx.currentFormId && (el.type === "submit" || el.tag === "button")
    );

    ctx.forms.push({
      id: ctx.currentFormId,
      name,
      action: getAttr(node, "action"),
      method: getAttr(node, "method") || "GET",
      sourceFile: ctx.relativeFile,
      startLine,
      fields: [...ctx.currentFormFields],
      submitButtonText: submitBtn?.visibleText,
      submitSelector: submitBtn?.id
        ? `#${submitBtn.id}`
        : submitBtn?.dataTestId
        ? `[data-testid="${submitBtn.dataTestId}"]`
        : undefined,
    });

    ctx.currentFormId = prevFormId;
    ctx.currentFormFields = prevFormFields;
  }

  ctx.treePath.pop();
}

export function parseHtmlFile(filePath: string, relativePath: string, customParse5?: any): PageInfo {
  const content = fs.readFileSync(filePath, "utf-8");
  const parser = customParse5 || parse5Lib || require("parse5");
  const doc = parser.parse(content, { sourceCodeLocationInfo: true });

  const ctx: HtmlParseContext = {
    relativeFile: relativePath.replace(/\\/g, "/"),
    elements: [],
    forms: [],
    links: [],
    currentFormFields: [],
    treePath: [],
  };

  walkHtmlNode(doc, ctx);

  return {
    file: ctx.relativeFile,
    route: "/" + ctx.relativeFile.replace(/\\/g, "/"),
    routeOrFile: ctx.relativeFile,
    title: ctx.pageTitle,
    interactiveElements: ctx.elements,
    forms: ctx.forms,
    links: ctx.links,
    conditionalRenderHints: [],
  };
}

// ============================================================================
// JS/TS/JSX/TSX Parsing via @babel/parser
// ============================================================================

interface JsParseContext {
  relativeFile: string;
  components: ComponentInfo[];
  elements: InteractiveElement[];
  forms: Form[];
  links: NavigationLink[];
  conditionalHints: string[];
  treePath: string[];
}

function getJsxAttrValue(attr: any): string | undefined {
  if (!attr || !attr.value) return undefined;
  if (attr.value.type === "StringLiteral") return attr.value.value;
  if (attr.value.type === "JSXExpressionContainer") {
    if (attr.value.expression.type === "StringLiteral") return attr.value.expression.value;
    if (attr.value.expression.type === "NumericLiteral") return String(attr.value.expression.value);
    if (attr.value.expression.type === "Identifier") return `{${attr.value.expression.name}}`;
  }
  return undefined;
}

function getJsxText(element: any): string {
  let text = "";
  if (!element.children) return "";
  for (const child of element.children) {
    if (child.type === "JSXText") {
      text += child.value.trim();
    } else if (child.type === "JSXExpressionContainer" && child.expression.type === "StringLiteral") {
      text += child.expression.value;
    }
  }
  return text.trim();
}

function walkJsAst(node: any, ctx: JsParseContext): void {
  if (!node || typeof node !== "object") return;

  // Detect React/TS components
  if (
    (node.type === "FunctionDeclaration" && node.id?.name && /^[A-Z]/.test(node.id.name)) ||
    (node.type === "VariableDeclarator" && node.id?.name && /^[A-Z]/.test(node.id.name))
  ) {
    const compName = node.id.name;
    const props: Array<{ name: string; type?: string }> = [];
    const params = node.init ? node.init.params : node.params;
    if (params && params.length > 0) {
      const firstParam = params[0];
      if (firstParam.type === "ObjectPattern") {
        for (const prop of firstParam.properties) {
          if (prop.key?.name) props.push({ name: prop.key.name });
          else if (prop.argument?.name) props.push({ name: prop.argument.name });
        }
      } else if (firstParam.type === "Identifier") {
        props.push({ name: firstParam.name });
      }
    }
    ctx.components.push({
      name: compName,
      file: ctx.relativeFile,
      props,
      startLine: node.loc?.start?.line,
    });
  }

  // Detect conditional rendering hints (e.g. condition && <Component />)
  if (node.type === "LogicalExpression" && (node.operator === "&&" || node.operator === "||")) {
    if (node.right.type === "JSXElement" || node.right.type === "JSXFragment") {
      const leftName = node.left.name || node.left.property?.name || "condition";
      ctx.conditionalHints.push(`Conditional: ${leftName} ${node.operator} <${node.right.openingElement?.name?.name || "element"}>`);
    }
  } else if (node.type === "ConditionalExpression") {
    if (
      node.consequent.type === "JSXElement" ||
      node.alternate.type === "JSXElement"
    ) {
      const testName = node.test.name || node.test.property?.name || "condition";
      ctx.conditionalHints.push(`Ternary: ${testName} ? <...> : <...>`);
    }
  }

  // Detect JSX Elements
  if (node.type === "JSXElement") {
    const opening = node.openingElement;
    const tagName = opening?.name?.name;

    if (tagName) {
      const lowerTag = tagName.toLowerCase();
      const attributes = opening.attributes || [];

      const getAttr = (name: string) => {
        const found = attributes.find((a: any) => a.name?.name === name);
        return getJsxAttrValue(found);
      };

      const id = getAttr("id");
      const className = getAttr("className");
      const dataTestId = getAttr("data-testid") || getAttr("data-test-id");
      const role = getAttr("role");
      const ariaLabel = getAttr("aria-label");
      const name = getAttr("name");
      const type = getAttr("type");
      const placeholder = getAttr("placeholder");
      const href = getAttr("href") || getAttr("to");

      const eventHandlers = attributes
        .filter((a: any) => typeof a.name?.name === "string" && a.name.name.startsWith("on"))
        .map((a: any) => a.name.name);

      const isInteractive =
        ["button", "input", "select", "textarea", "a", "link"].includes(lowerTag) ||
        eventHandlers.length > 0 ||
        Boolean(role);

      const startLine = opening.loc?.start?.line ?? 1;
      const endLine = opening.loc?.end?.line;
      const text = getJsxText(node);

      ctx.treePath.push(`${tagName}${id ? `#${id}` : className ? `.${className.split(/\s+/)[0]}` : ""}`);
      const treePosition = ctx.treePath.join(" > ");

      if (isInteractive) {
        const fingerprint = computeSourceFingerprint({
          tag: tagName,
          role,
          text,
          testid: dataTestId,
          id,
          treePosition,
        });

        ctx.elements.push({
          tag: tagName,
          id,
          role,
          className,
          dataTestId,
          ariaLabel,
          name,
          type,
          placeholder,
          visibleText: text || undefined,
          text: text || undefined,
          href,
          eventHandlers,
          sourceFile: ctx.relativeFile,
          startLine,
          endLine,
          treePosition,
          sourceFingerprint: fingerprint,
        });

        if (lowerTag === "a" && href) {
          ctx.links.push({
            text: text || href,
            href,
            sourceFile: ctx.relativeFile,
            startLine,
            targetPage: href,
          });
        }
      }

      // Walk children
      if (node.children) {
        for (const child of node.children) walkJsAst(child, ctx);
      }
      ctx.treePath.pop();
      return;
    }
  }

  // Generic recursive AST descent
  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "loc") continue;
    const child = (node as any)[key];
    if (Array.isArray(child)) {
      for (const item of child) walkJsAst(item, ctx);
    } else if (child && typeof child === "object") {
      walkJsAst(child, ctx);
    }
  }
}

export function parseJsFile(filePath: string, relativePath: string): {
  pageInfo?: PageInfo;
  components: ComponentInfo[];
} {
  const code = fs.readFileSync(filePath, "utf-8");
  const isTs = filePath.endsWith(".ts") || filePath.endsWith(".tsx");
  const isJsx = filePath.endsWith(".jsx") || filePath.endsWith(".tsx");

  const plugins: babelParser.ParserPlugin[] = [];
  if (isTs) plugins.push("typescript");
  if (isJsx) plugins.push("jsx");
  plugins.push("classProperties", "decorators-legacy");

  const ast = babelParser.parse(code, {
    sourceType: "module",
    plugins,
    errorRecovery: true,
  });

  const ctx: JsParseContext = {
    relativeFile: relativePath.replace(/\\/g, "/"),
    components: [],
    elements: [],
    forms: [],
    links: [],
    conditionalHints: [],
    treePath: [],
  };

  walkJsAst(ast, ctx);

  let pageInfo: PageInfo | undefined;
  if (ctx.elements.length > 0 || ctx.forms.length > 0 || ctx.links.length > 0) {
    pageInfo = {
      file: ctx.relativeFile,
      route: "/" + ctx.relativeFile.replace(/\\/g, "/"),
      routeOrFile: ctx.relativeFile,
      interactiveElements: ctx.elements,
      forms: ctx.forms,
      links: ctx.links,
      conditionalRenderHints: ctx.conditionalHints,
    };
  }

  return { pageInfo, components: ctx.components };
}

// ============================================================================
// Repository Scanner and AppModel Generator
// ============================================================================

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  "coverage",
  ".cache",
  "test-results",
  "playwright-report",
]);

const IGNORED_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "tsconfig.json",
]);

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export interface ParseRepoOptions {
  maxFileSize?: number;
}

/**
 * Parses an entire repository into a unified, typed AppModel.
 */
export async function parseRepository(
  repoPath: string,
  options: ParseRepoOptions = {}
): Promise<AppModel> {
  const resolvedRoot = path.resolve(repoPath);
  const maxBytes = options.maxFileSize ?? MAX_FILE_SIZE;

  await getParse5().catch(() => {});

  const pages: PageInfo[] = [];
  const components: ComponentInfo[] = [];
  const parseErrors: ParseError[] = [];
  let totalFiles = 0;

  function scanDir(currentDir: string): void {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
          scanDir(path.join(currentDir, entry.name));
        }
        continue;
      }

      if (!entry.isFile()) continue;
      if (IGNORED_FILES.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);
      const relative = path.relative(resolvedRoot, fullPath);
      const ext = path.extname(entry.name).toLowerCase();

      // Check file size cap
      try {
        const stat = fs.statSync(fullPath);
        if (stat.size > maxBytes) {
          logger.warn({ file: relative, size: stat.size }, "Skipping file exceeding size cap.");
          continue;
        }
      } catch {
        continue;
      }

      // Handle HTML files
      if (ext === ".html" || ext === ".htm") {
        totalFiles++;
        try {
          const page = parseHtmlFile(fullPath, relative);
          pages.push(page);
        } catch (err: any) {
          logger.warn({ file: relative, err: err.message }, "HTML parse failed.");
          parseErrors.push({ file: relative, error: err.message });
        }
        continue;
      }

      // Handle JS / TS / JSX / TSX files
      if ([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(ext)) {
        if (entry.name.includes(".test.") || entry.name.includes(".spec.")) continue;
        totalFiles++;
        try {
          const result = parseJsFile(fullPath, relative);
          if (result.pageInfo) pages.push(result.pageInfo);
          if (result.components.length > 0) components.push(...result.components);
        } catch (err: any) {
          logger.warn({ file: relative, err: err.message }, "JS/TS parse failed.");
          parseErrors.push({ file: relative, error: err.message });
        }
        continue;
      }

      // Handle CSS files (validate syntax with postcss)
      if (ext === ".css") {
        totalFiles++;
        try {
          const cssContent = fs.readFileSync(fullPath, "utf-8");
          postcss.parse(cssContent);
        } catch (err: any) {
          parseErrors.push({ file: relative, error: err.message });
        }
        continue;
      }

      // Handle Vue / Svelte: log warning and skip
      if (ext === ".vue" || ext === ".svelte") {
        logger.info({ file: relative }, `Vue/Svelte SFC parsing skipped with warning for ${ext}.`);
      }
    }
  }

  scanDir(resolvedRoot);

  const allInteractive = pages.flatMap((p) => p.interactiveElements);
  const allForms = pages.flatMap((p) => p.forms);
  const allLinks = pages.flatMap((p) => p.links);

  return AppModelSchema.parse({
    repoPath: resolvedRoot,
    pages,
    components,
    interactiveElements: allInteractive,
    forms: allForms,
    navigationLinks: allLinks,
    conditionalRenderHints: pages.flatMap((p) => p.conditionalRenderHints || []),
    totalFilesParsed: totalFiles,
    parseErrors,
    stats: {
      fileCount: totalFiles,
      elementCount: allInteractive.length,
      formCount: allForms.length,
      componentCount: components.length,
      routeCount: pages.length,
    },
  });
}
