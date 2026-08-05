import * as fs from "fs";
import * as path from "path";
import type { AppVersion } from "../../shared/contracts";
import { env } from "./env";

const settingsFile = path.join(env.runsDir, "_settings.json");

export interface ServerSettings {
  models: { groq: string; gemini: string };
  repeatDefault: number;
  theme: "dark" | "light";
  /** Runtime-only: which version of the bundled demo app is being served. */
  demoAppVersion: AppVersion;
}

const defaults: ServerSettings = {
  models: {
    groq: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
    gemini: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  },
  repeatDefault: 1,
  theme: "dark",
  demoAppVersion: "v1",
};

let cache: ServerSettings | null = null;

export function getSettings(): ServerSettings {
  if (cache) return cache;
  if (fs.existsSync(settingsFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(settingsFile, "utf-8")) as Partial<ServerSettings>;
      cache = { ...defaults, ...parsed, models: { ...defaults.models, ...parsed.models } };
      cache.demoAppVersion = parsed.demoAppVersion === "v2" ? "v2" : "v1";
      return cache;
    } catch {
      // fall through to defaults
    }
  }
  cache = { ...defaults };
  return cache;
}

export function updateSettings(patch: Partial<ServerSettings>): ServerSettings {
  const current = getSettings();
  cache = {
    ...current,
    ...patch,
    models: { ...current.models, ...patch.models },
  };
  fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
  fs.writeFileSync(settingsFile, JSON.stringify(cache, null, 2), "utf-8");
  return cache;
}

export function setDemoAppVersion(version: AppVersion): AppVersion {
  updateSettings({ demoAppVersion: version });
  return version;
}
