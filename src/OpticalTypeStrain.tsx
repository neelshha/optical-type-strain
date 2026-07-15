"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";

const DEFAULT_TEXT =
  "Typography is not decoration sitting on a surface. It is material under force. Move through this paragraph and feel each glyph push back — shear, slip, then settle into reading order again.";

export type OpticalTypeStrainProps = {
  text?: string;
  className?: string;
  /** Influence radius in px. */
  radius?: number;
  /** Max horizontal/vertical displacement in px. */
  push?: number;
  /** Max skew in degrees. */
  skew?: number;
};

type Glyph = {
  char: string;
  line: number;
  index: number;
};

function splitText(text: string): Glyph[] {
  const glyphs: Glyph[] = [];
  let line = 0;
  let index = 0;
  for (const char of text) {
    if (char === "\n") {
      line += 1;
      continue;
    }
    glyphs.push({ char, line, index });
    index += 1;
  }
  return glyphs;
}

export function OpticalTypeStrain({
  text = DEFAULT_TEXT,
  className,
  radius = 120,
  push = 14,
  skew = 12,
}: OpticalTypeStrainProps) {
  const rootRef = useRef<HTMLParagraphElement>(null);
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const centersRef = useRef<{ x: number; y: number }[]>([]);
  const reducedMotion = useRef(false);

  const glyphs = useMemo(() => splitText(text), [text]);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const rootBox = root.getBoundingClientRect();
    centersRef.current = charRefs.current.map((el) => {
      if (!el) return { x: 0, y: 0 };
      const box = el.getBoundingClientRect();
      return {
        x: box.left - rootBox.left + box.width / 2,
        y: box.top - rootBox.top + box.height / 2,
      };
    });
  }, []);

  const reset = useCallback(() => {
    const root = rootRef.current;
    if (root) root.dataset.active = "false";
    charRefs.current.forEach((el) => {
      if (!el) return;
      el.style.setProperty("--ots-x", "0px");
      el.style.setProperty("--ots-y", "0px");
      el.style.setProperty("--ots-skew-x", "0deg");
      el.style.setProperty("--ots-scale-y", "1");
    });
  }, []);

  const strain = useCallback(
    (clientX: number, clientY: number) => {
      const root = rootRef.current;
      if (!root || reducedMotion.current) return;

      const rootBox = root.getBoundingClientRect();
      const px = clientX - rootBox.left;
      const py = clientY - rootBox.top;
      root.dataset.active = "true";

      charRefs.current.forEach((el, i) => {
        if (!el) return;
        const c = centersRef.current[i];
        if (!c) return;

        const dx = c.x - px;
        const dy = c.y - py;
        const dist = Math.hypot(dx, dy);
        if (dist > radius || dist < 0.001) {
          el.style.setProperty("--ots-x", "0px");
          el.style.setProperty("--ots-y", "0px");
          el.style.setProperty("--ots-skew-x", "0deg");
          el.style.setProperty("--ots-scale-y", "1");
          return;
        }

        // Stronger near the pointer, falls off smoothly.
        const t = 1 - dist / radius;
        const force = t * t * (3 - 2 * t);
        const nx = dx / dist;
        const ny = dy / dist;

        // Push glyphs away from the pointer + shear along the force vector.
        el.style.setProperty("--ots-x", `${nx * push * force}px`);
        el.style.setProperty("--ots-y", `${ny * push * force * 0.65}px`);
        el.style.setProperty("--ots-skew-x", `${-nx * skew * force}deg`);
        el.style.setProperty("--ots-scale-y", `${1 + force * 0.18}`);
      });
    },
    [push, radius, skew],
  );

  useEffect(() => {
    reducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    measure();
    const root = rootRef.current;
    if (!root) return;

    const ro = new ResizeObserver(measure);
    ro.observe(root);

    const onMove = (e: PointerEvent) => strain(e.clientX, e.clientY);
    const onLeave = () => reset();

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("pointercancel", onLeave);

    return () => {
      ro.disconnect();
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointercancel", onLeave);
    };
  }, [measure, reset, strain, glyphs.length]);

  // Group by line for block layout
  const lines: Glyph[][] = [];
  for (const g of glyphs) {
    if (!lines[g.line]) lines[g.line] = [];
    lines[g.line]!.push(g);
  }

  let refIndex = 0;

  return (
    <p
      ref={rootRef}
      className={["ots-root", className].filter(Boolean).join(" ")}
      style={
        {
          "--ots-radius": `${radius}px`,
          "--ots-push": `${push}px`,
          "--ots-skew": `${skew}deg`,
        } as CSSProperties
      }
      data-active="false"
      aria-label={text.replace(/\n/g, " ")}
    >
      {lines.map((line, li) => (
        <span key={li} className="ots-line">
          {line.map((g) => {
            const i = refIndex++;
            if (g.char === " ") {
              return <span key={i} className="ots-space" aria-hidden />;
            }
            return (
              <span
                key={i}
                className="ots-char"
                aria-hidden
                ref={(el) => {
                  charRefs.current[i] = el;
                }}
              >
                {g.char}
              </span>
            );
          })}
        </span>
      ))}
    </p>
  );
}
