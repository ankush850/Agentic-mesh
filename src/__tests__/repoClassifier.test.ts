import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { classifyRepo } from "../repo/repoClassifier";

describe("repoClassifier", () => {
  const tmpBase = path.join(os.tmpdir(), "agentic-mesh-classifier-test-" + Date.now());

  beforeEach(() => {
    fs.mkdirSync(tmpBase, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tmpBase)) {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  it("classifies static HTML site", () => {
    fs.writeFileSync(path.join(tmpBase, "index.html"), "<html><body>Static</body></html>");
    fs.writeFileSync(path.join(tmpBase, "style.css"), "body { margin: 0; }");

    const result = classifyRepo(tmpBase);
    expect(result.type).toBe("static");
    expect(result.framework).toBe("none");
    expect(result.hasPackageJson).toBe(false);
    expect(result.runPlan.mode).toBe("static");
    expect(result.runPlan.installCmd).toBeNull();
  });

  it("classifies prebuilt dist directory", () => {
    const distDir = path.join(tmpBase, "dist");
    fs.mkdirSync(distDir);
    fs.writeFileSync(path.join(distDir, "index.html"), "<html>Prebuilt</html>");

    const result = classifyRepo(tmpBase);
    expect(result.type).toBe("prebuilt");
    expect(result.runPlan.mode).toBe("static");
    expect(result.runPlan.rootDir).toBe(distDir);
  });

  it("classifies React NPM app with package-lock", () => {
    const pkg = {
      name: "my-react-app",
      scripts: { dev: "vite" },
      dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" },
    };
    fs.writeFileSync(path.join(tmpBase, "package.json"), JSON.stringify(pkg));
    fs.writeFileSync(path.join(tmpBase, "package-lock.json"), "{}");

    const result = classifyRepo(tmpBase);
    expect(result.type).toBe("npm");
    expect(result.framework).toBe("react");
    expect(result.hasPackageJson).toBe(true);
    expect(result.runPlan.mode).toBe("npm");
    expect(result.runPlan.installCmd).toBe("npm ci --ignore-scripts");
    expect(result.runPlan.startCmd).toBe("npm run dev");
    expect(result.runPlan.isExperimental).toBe(false);
  });

  it("classifies Next.js app", () => {
    const pkg = {
      name: "my-next-app",
      scripts: { start: "next start" },
      dependencies: { next: "15.0.0", react: "19.0.0" },
    };
    fs.writeFileSync(path.join(tmpBase, "package.json"), JSON.stringify(pkg));

    const result = classifyRepo(tmpBase);
    expect(result.type).toBe("npm");
    expect(result.framework).toBe("next");
    expect(result.runPlan.installCmd).toBe("npm install --ignore-scripts");
    expect(result.runPlan.startCmd).toBe("npm start");
  });

  it("classifies Vue and Svelte apps", () => {
    const vueDir = path.join(tmpBase, "vue-app");
    fs.mkdirSync(vueDir);
    fs.writeFileSync(
      path.join(vueDir, "package.json"),
      JSON.stringify({ dependencies: { vue: "^3.0.0" } })
    );
    expect(classifyRepo(vueDir).framework).toBe("vue");

    const svelteDir = path.join(tmpBase, "svelte-app");
    fs.mkdirSync(svelteDir);
    fs.writeFileSync(
      path.join(svelteDir, "package.json"),
      JSON.stringify({ devDependencies: { svelte: "^5.0.0" } })
    );
    expect(classifyRepo(svelteDir).framework).toBe("svelte");
  });

  it("flags unknown repositories as experimental", () => {
    // empty dir with no package.json or html
    const result = classifyRepo(tmpBase);
    expect(result.type).toBe("unknown");
    expect(result.runPlan.isExperimental).toBe(true);
  });
});
