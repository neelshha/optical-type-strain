"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
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
  /** Continuously sweep a virtual pointer (homepage preview). */
  autoPlay?: boolean;
  /** One full sweep duration in ms when autoPlay is on. */
  autoPlayDuration?: number;
};

type Glyph = {
  char: string;
  line: number;
  index: number;
};

type Segment =
  | { type: "word"; glyphs: Glyph[] }
  | { type: "space"; glyph: Glyph };

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

/** Keep mid-word breaks from happening when each letter is inline-block. */
function segmentLine(line: Glyph[]): Segment[] {
  const segments: Segment[] = [];
  let word: Glyph[] = [];

  const flushWord = () => {
    if (!word.length) return;
    segments.push({ type: "word", glyphs: word });
    word = [];
  };

  for (const g of line) {
    if (g.char === " ") {
      flushWord();
      segments.push({ type: "space", glyph: g });
    } else {
      word.push(g);
    }
  }
  flushWord();
  return segments;
}

export function OpticalTypeStrain({
  text = DEFAULT_TEXT,
  className,
  radius = 120,
  push = 14,
  skew = 12,
  autoPlay = false,
  autoPlayDuration = 3200,
}: OpticalTypeStrainProps) {
  const rootRef = useRef<HTMLParagraphElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const centersRef = useRef<{ x: number; y: number }[]>([]);
  const reducedMotion = useRef(false);

  const glyphs = useMemo(() => splitText(text), [text]);

  const lines = useMemo(() => {
    const grouped: Glyph[][] = [];
    for (const g of glyphs) {
      if (!grouped[g.line]) grouped[g.line] = [];
      grouped[g.line]!.push(g);
    }
    return grouped.map(segmentLine);
  }, [glyphs]);

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

  const setCursor = useCallback((visible: boolean, x = 0, y = 0) => {
    const root = rootRef.current;
    const cursor = cursorRef.current;
    if (!root || !cursor) return;
    root.dataset.cursor = visible ? "true" : "false";
    if (visible) {
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  }, []);

  const reset = useCallback(() => {
    const root = rootRef.current;
    if (root) root.dataset.active = "false";
    setCursor(false);
    charRefs.current.forEach((el) => {
      if (!el) return;
      el.style.setProperty("--ots-x", "0px");
      el.style.setProperty("--ots-y", "0px");
      el.style.setProperty("--ots-skew-x", "0deg");
      el.style.setProperty("--ots-scale-y", "1");
    });
  }, [setCursor]);

  const strainAt = useCallback(
    (px: number, py: number) => {
      const root = rootRef.current;
      if (!root || reducedMotion.current) return;

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

        const t = 1 - dist / radius;
        const force = t * t * (3 - 2 * t);
        const nx = dx / dist;
        const ny = dy / dist;

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

    if (autoPlay) {
      if (reducedMotion.current) return () => ro.disconnect();

      let frame = 0;
      let start = performance.now();
      const holdMs = 700;

      const tick = (now: number) => {
        const cycle = autoPlayDuration + holdMs;
        const elapsed = (now - start) % cycle;

        if (elapsed >= autoPlayDuration) {
          reset();
        } else {
          measure();
          const centers = centersRef.current.filter(
            (c, i) => charRefs.current[i] && (c.x !== 0 || c.y !== 0),
          );
          if (centers.length) {
            const minX = Math.min(...centers.map((c) => c.x)) - 8;
            const maxX = Math.max(...centers.map((c) => c.x)) + 8;
            const minY = Math.min(...centers.map((c) => c.y));
            const maxY = Math.max(...centers.map((c) => c.y));
            const midY = (minY + maxY) / 2;
            const amp = Math.max(10, (maxY - minY) * 0.35 + 8);
            const p = elapsed / autoPlayDuration;
            const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
            const x = minX + (maxX - minX) * eased;
            const y = midY + Math.sin(p * Math.PI * 2) * amp;
            setCursor(true, x, y);
            strainAt(x, y);
          }
        }

        frame = requestAnimationFrame(tick);
      };

      frame = requestAnimationFrame(tick);
      return () => {
        ro.disconnect();
        cancelAnimationFrame(frame);
        reset();
      };
    }

    const onMove = (e: PointerEvent) => {
      const rootBox = root.getBoundingClientRect();
      strainAt(e.clientX - rootBox.left, e.clientY - rootBox.top);
    };
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
  }, [
    autoPlay,
    autoPlayDuration,
    measure,
    reset,
    setCursor,
    strainAt,
    glyphs.length,
  ]);

  const renderSegments = (segments: Segment[]): ReactNode =>
    segments.map((segment) => {
      if (segment.type === "space") {
        return (
          <span key={`s-${segment.glyph.index}`} className="ots-space" aria-hidden />
        );
      }

      return (
        <span key={`w-${segment.glyphs[0]!.index}`} className="ots-word">
          {segment.glyphs.map((g) => (
            <span
              key={g.index}
              className="ots-char"
              aria-hidden
              ref={(el) => {
                charRefs.current[g.index] = el;
              }}
            >
              {g.char}
            </span>
          ))}
        </span>
      );
    });

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
      data-autoplay={autoPlay ? "true" : "false"}
      data-cursor="false"
      aria-label={text.replace(/\n/g, " ")}
    >
      {autoPlay ? (
        <span ref={cursorRef} className="ots-cursor" aria-hidden="true">
          <svg viewBox="0 0 24 32" fill="none">
            <path
              d="M1 1v26.5l6.2-6.1 3.7 8.9 3.6-1.5-3.7-8.8H22L1 1Z"
              fill="#fff"
              stroke="#111"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      ) : null}
      {lines.map((segments, li) => (
        <span key={li} className="ots-line">
          {renderSegments(segments)}
        </span>
      ))}
    </p>
  );
}
