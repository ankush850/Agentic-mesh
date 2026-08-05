import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Hero from "./Hero";

// Both effects need WebGL, window and document, so this tree is browser-only.
// This entry is a plain Vite SPA module — it is never evaluated on the server —
// and the guard below keeps that requirement explicit rather than incidental.
if (typeof document === "undefined") {
  throw new Error("Hero is client-only: it must not be evaluated during SSR");
}

const container = document.getElementById("hero-root");
if (!container) {
  throw new Error("Hero entry: #hero-root is missing from hero.html");
}

// StrictMode is kept on purpose: its mount -> cleanup -> mount cycle is exactly
// what would blank a canvas that called loseContext(), and neither component does.
createRoot(container).render(
  <StrictMode>
    <Hero />
  </StrictMode>,
);
