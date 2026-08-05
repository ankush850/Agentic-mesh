import * as fs from "fs";
import * as path from "path";
import { z } from "zod";

export const FrameworkTypeSchema = z.enum([
  "react",
  "vue",
  "svelte",
  "angular",
  "next",
  "none",
]);
export type FrameworkType = z.infer<typeof FrameworkTypeSchema>;

export const RepoTypeSchema = z.enum(["static", "npm", "prebuilt", "unknown"]);
export type RepoType = z.infer<typeof RepoTypeSchema>;

export const RunPlanSchema = z.object({
  mode: z.enum(["static", "npm"]),
  rootDir: z.string(),
  installCmd: z.string().nullable(),
  startCmd: z.string().nullable(),
  port: z.number().optional(),
  isExperimental: z.boolean(),
  description: z.string(),
});
export type RunPlan = z.infer<typeof RunPlanSchema>;

export const RepoClassificationSchema = z.object({
  type: RepoTypeSchema,
  framework: FrameworkTypeSchema,
  entryHtml: z.string().nullable(),
  hasPackageJson: z.boolean(),
  runPlan: RunPlanSchema,
});
export type RepoClassification = z.infer<typeof RepoClassificationSchema>;

/**
 * Classifies a repository into a deployment and parsing profile.
 */
export function classifyRepo(repoPath: string): RepoClassification {
  const pkgPath = path.join(repoPath, "package.json");
  const hasPkg = fs.existsSync(pkgPath);

  // Check for prebuilt outputs (dist/ or build/)
  const distIndex = path.join(repoPath, "dist", "index.html");
  const buildIndex = path.join(repoPath, "build", "index.html");

  if (!hasPkg) {
    if (fs.existsSync(distIndex)) {
      return {
        type: "prebuilt",
        framework: "none",
        entryHtml: "dist/index.html",
        hasPackageJson: false,
        runPlan: {
          mode: "static",
          rootDir: path.join(repoPath, "dist"),
          installCmd: null,
          startCmd: null,
          isExperimental: false,
          description: "Prebuilt distribution directory served statically.",
        },
      };
    }

    if (fs.existsSync(buildIndex)) {
      return {
        type: "prebuilt",
        framework: "none",
        entryHtml: "build/index.html",
        hasPackageJson: false,
        runPlan: {
          mode: "static",
          rootDir: path.join(repoPath, "build"),
          installCmd: null,
          startCmd: null,
          isExperimental: false,
          description: "Prebuilt build directory served statically.",
        },
      };
    }

    // Check for root HTML file (Static site)
    const rootIndex = path.join(repoPath, "index.html");
    if (fs.existsSync(rootIndex)) {
      return {
        type: "static",
        framework: "none",
        entryHtml: "index.html",
        hasPackageJson: false,
        runPlan: {
          mode: "static",
          rootDir: repoPath,
          installCmd: null,
          startCmd: null,
          isExperimental: false,
          description: "Static HTML/CSS/JS application served locally.",
        },
      };
    }

    // Look for any .html file in root
    try {
      const files = fs.readdirSync(repoPath);
      const htmlFile = files.find((f) => f.toLowerCase().endsWith(".html"));
      if (htmlFile) {
        return {
          type: "static",
          framework: "none",
          entryHtml: htmlFile,
          hasPackageJson: false,
          runPlan: {
            mode: "static",
            rootDir: repoPath,
            installCmd: null,
            startCmd: null,
            isExperimental: false,
            description: `Static HTML application (${htmlFile}) served locally.`,
          },
        };
      }
    } catch {
      // Fall through
    }

    // Unknown repository without package.json or html
    return {
      type: "unknown",
      framework: "none",
      entryHtml: null,
      hasPackageJson: false,
      runPlan: {
        mode: "static",
        rootDir: repoPath,
        installCmd: null,
        startCmd: null,
        isExperimental: true,
        description: "Unrecognized repository structure; treated as experimental static directory.",
      },
    };
  }

  // NPM Application
  let framework: FrameworkType = "none";
  let startCmd: string | null = null;
  const hasLock = fs.existsSync(path.join(repoPath, "package-lock.json"));
  const installCmd = hasLock ? "npm ci --ignore-scripts" : "npm install --ignore-scripts";

  try {
    const pkgContent = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(pkgContent);
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };

    if (allDeps["next"]) framework = "next";
    else if (allDeps["react"] || allDeps["react-dom"]) framework = "react";
    else if (allDeps["vue"]) framework = "vue";
    else if (allDeps["svelte"]) framework = "svelte";
    else if (allDeps["@angular/core"]) framework = "angular";

    const scripts = pkg.scripts || {};
    if (scripts["start"]) startCmd = "npm start";
    else if (scripts["dev"]) startCmd = "npm run dev";
    else if (scripts["preview"]) startCmd = "npm run preview";
    else if (scripts["serve"]) startCmd = "npm run serve";
  } catch {
    // Malformed package.json
    return {
      type: "unknown",
      framework: "none",
      entryHtml: null,
      hasPackageJson: true,
      runPlan: {
        mode: "npm",
        rootDir: repoPath,
        installCmd,
        startCmd: "npm start",
        isExperimental: true,
        description: "NPM application with unparseable package.json.",
      },
    };
  }

  const rootIndex = path.join(repoPath, "index.html");
  const entryHtml = fs.existsSync(rootIndex) ? "index.html" : null;

  return {
    type: "npm",
    framework,
    entryHtml,
    hasPackageJson: true,
    runPlan: {
      mode: "npm",
      rootDir: repoPath,
      installCmd,
      startCmd: startCmd || "npm start",
      isExperimental: framework === "none",
      description: `NPM application with detected framework: ${framework}.`,
    },
  };
}
