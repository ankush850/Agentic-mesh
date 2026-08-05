import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const API_TARGET = process.env.UI_API_URL ?? "http://127.0.0.1:8787";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        // SSE requires an unbuffered, long-lived connection.
        ws: false,
      },
    },
    fs: {
      // `shared/contracts.ts` lives one level above the web root.
      allow: ["..", "../shared"],
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    // Two independent entries: the console (index.html) and the CloudSky +
    // VectorWordmark hero (hero.html). The hero mounts its own root, so it never
    // picks up the router, the app shell or the console stylesheet.
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        hero: fileURLToPath(new URL("./hero.html", import.meta.url)),
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
  },
});
