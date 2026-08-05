/**
 * Tree-sitter & Token Optimizer Configuration Constants
 * Central configuration module defining size caps, ignore patterns,
 * language mappings, and runtime limits.
 */

export const TSO_CONFIG = {
  // Size caps (FR-I2)
  MAX_FILE_SIZE_BYTES: 1 * 1024 * 1024, // 1 MB per file
  MAX_TOTAL_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB total
  MAX_LINE_LENGTH_CHARS: 5000, // Lines exceeding this are treated as minified

  // AST view virtualization caps (FR-P1, FR-2.6)
  MAX_INITIAL_AST_NODES: 300,
  AST_PAGE_SIZE: 150,

  // Processing timeouts (FR-2.6, FR-2.7)
  WORKER_TIMEOUT_MS: 15000,

  // Supported file extensions (FR-I1)
  SUPPORTED_EXTENSIONS: {
    html: [".html", ".htm"],
    css: [".css"],
    js: [".js", ".mjs", ".cjs"],
  } as const,

  // Ignored directory names (FR-I1)
  IGNORED_DIRECTORIES: [
    "node_modules",
    "dist",
    "build",
    ".git",
    ".vscode",
    ".idea",
    "coverage",
    ".next",
    ".turbo",
  ],

  // Ignored file extensions and patterns (FR-I1)
  IGNORED_EXTENSIONS: [
    ".map",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".webp",
    ".ico",
    ".wasm",
    ".bin",
    ".exe",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".mp4",
    ".webm",
    ".mp3",
    ".wav",
  ],

  // Minified file naming heuristics
  MINIFIED_SUFFIXES: [".min.js", ".min.css", ".bundle.js", ".bundle.css"],

  // Target token savings threshold for validation
  SAVINGS_THRESHOLDS: {
    skeletonMinPercent: 70, // >= 70% reduction on sample
    minifyMinPercent: 15, // >= 15% reduction on sample
  },
} as const;

export type SupportedLanguage = "html" | "css" | "js";

/**
 * Checks whether a relative path or file name should be ignored based on FR-I1 rules.
 */
export function shouldIgnoreFile(fileName: string, relativePath = ""): { ignore: boolean; reason?: string } {
  const lowerPath = relativePath.toLowerCase().replace(/\\/g, "/");
  const lowerName = fileName.toLowerCase();

  // Check directories
  for (const dir of TSO_CONFIG.IGNORED_DIRECTORIES) {
    if (lowerPath.includes(`/${dir}/`) || lowerPath.startsWith(`${dir}/`)) {
      return { ignore: true, reason: `Matches ignored directory '${dir}'` };
    }
  }

  // Check minified bundles
  for (const suffix of TSO_CONFIG.MINIFIED_SUFFIXES) {
    if (lowerName.endsWith(suffix)) {
      return { ignore: true, reason: `Minified bundle '${suffix}' ignored` };
    }
  }

  // Check ignored extensions
  for (const ext of TSO_CONFIG.IGNORED_EXTENSIONS) {
    if (lowerName.endsWith(ext)) {
      return { ignore: true, reason: `Ignored binary/asset extension '${ext}'` };
    }
  }

  return { ignore: false };
}

/**
 * Detects the language from the file name or content sniffing.
 */
export function detectLanguage(fileName: string, content = ""): SupportedLanguage | null {
  const lowerName = fileName.toLowerCase();

  if (TSO_CONFIG.SUPPORTED_EXTENSIONS.html.some((ext) => lowerName.endsWith(ext))) {
    return "html";
  }
  if (TSO_CONFIG.SUPPORTED_EXTENSIONS.css.some((ext) => lowerName.endsWith(ext))) {
    return "css";
  }
  if (TSO_CONFIG.SUPPORTED_EXTENSIONS.js.some((ext) => lowerName.endsWith(ext))) {
    return "js";
  }

  // Content sniffing fallback if extension is unknown or missing
  const trimmed = content.trim();
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html") || /<[a-z][\s\S]*>/i.test(trimmed.slice(0, 200))) {
    return "html";
  }
  if (/[.#][\w-]+\s*\{|@media|@keyframes/i.test(trimmed)) {
    return "css";
  }
  if (/^(import\s|export\s|function\s|const\s|let\s|var\s|\/\/|\/\*)/.test(trimmed)) {
    return "js";
  }

  return null;
}

