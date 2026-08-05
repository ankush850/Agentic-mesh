import { useEffect, useRef } from "react";
import CloudSky from "./CloudSky";
import VectorWordmark from "./VectorWordmark";

/**
 * CloudSky + VectorWordmark, stacked. Both component files are used exactly as
 * shipped — no shader, constant or preset was touched.
 *
 * Only the three documented overrides are applied:
 *   1. `background="transparent"` on VectorWordmark — its root defaults to
 *      #000000 and would hide the sky. Its shader already outputs premultiplied
 *      alpha, so the clouds show through the text fade.
 *   2. `minWidth: 0, minHeight: 0` on both — each root hardcodes 1200 x 800
 *      BEFORE the `...style` spread, so style wins and the hero fits any screen.
 *   3. `width/height: 100%` so each canvas fills the section.
 */
export default function Hero() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const skyRef = useRef<HTMLDivElement | null>(null);

  // VectorWordmark sits on top, so it owns the real pointer. CloudSky listens for
  // pointermove / pointerenter / pointerleave on its own <canvas>, which is buried
  // under the wordmark and never receives a native event — its parallax and wind
  // would freeze. Listening on the section and re-dispatching the same three events
  // onto that canvas feeds both effects from one mouse, without editing either file.
  useEffect(() => {
    const section = sectionRef.current;
    const canvas = skyRef.current?.querySelector("canvas");
    if (!section || !canvas) return;

    const forward = (event: PointerEvent) => {
      canvas.dispatchEvent(
        new PointerEvent(event.type, {
          // Not bubbling: the canvas sits inside this section, so a bubbling copy
          // would arrive back on the section listener and re-dispatch forever.
          bubbles: false,
          cancelable: false,
          pointerId: event.pointerId,
          pointerType: event.pointerType,
          isPrimary: event.isPrimary,
          clientX: event.clientX,
          clientY: event.clientY,
        }),
      );
    };

    section.addEventListener("pointermove", forward);
    section.addEventListener("pointerenter", forward);
    section.addEventListener("pointerleave", forward);

    return () => {
      section.removeEventListener("pointermove", forward);
      section.removeEventListener("pointerenter", forward);
      section.removeEventListener("pointerleave", forward);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}
    >
      <div ref={skyRef} style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <CloudSky style={{ minWidth: 0, minHeight: 0, width: "100%", height: "100%" }} />
      </div>
      <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        <VectorWordmark
          text="Sentinel-QA"
          // The whole font object replaces the default, so every key the component
          // ships is restated here: passing only a family would silently drop
          // weight 800 and the -0.02em tracking. The extra entries in the family
          // chain are the offline fallback, so the wordmark degrades to a bold
          // sans instead of the UA serif.
          // 185px, not 200px: the drawn size scales with the host box
          // (size * boxW / 1200), so "Sentinel-QA" at 200px would measure ~96% of
          // the viewport and sit on both edges. 185px restores the ~89% footprint
          // "Agentic-mesh" had at 200px.
          font={{
            fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
            fontWeight: 800,
            fontSize: "185px",
            lineHeight: "1em",
            letterSpacing: "-0.02em",
            textAlign: "left",
          }}
          background="transparent"
          style={{ minWidth: 0, minHeight: 0, width: "100%", height: "100%" }}
        />
      </div>
    </section>
  );
}
