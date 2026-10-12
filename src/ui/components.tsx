// Small shared pieces: icons, mosaic progress, case chips, dialogs, toast.
import { ComponentChildren } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { Case, CASE_NAMES } from "../latin/types";
import { roman } from "../latin/text";
import { useScreen } from "./screen";
import { touchScreen } from "./keyboard";

const P = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

export const Icon = {
  home: () => P("M3 10 12 4l9 6M5 10v9m14-9v9M9 19v-6m6 6v-6M3 20h18M4 10h16"),
  scroll: () => P("M7 4h11a2 2 0 0 1 0 4h-1v10a2 2 0 0 1-2 2H6a2 2 0 0 1 0-4h1V4Zm0 12h8M10 8h4m-4 4h4"),
  stylus: () => P("M4 20l3.5-1 11-11a1.8 1.8 0 0 0-2.5-2.5l-11 11L4 20Zm10-13 2.5 2.5"),
  book: () => P("M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Zm0 15A2.5 2.5 0 0 0 6.5 23H20v-5"),
  card: () => P("M6 3h12v18H6zM12 9.5a1.6 1.6 0 1 1 1.6 1.6c-.9 0-1.6.7-1.6 1.6v.8m0 2.6v.3"),
  column: () => P("M5 4h14M6 7h12M8 7v11m4-11v11m4-11v11M6 18h12M4 21h16M7 4l1-1h8l1 1"),
  quill: () => P("M20 4C12 5 7 10 5 19l1 1c2-3 5-5 9-6l-3-1 4-2-2-1c3-1 5-3 6-6ZM5 19l-1 2"),
  close: () => P("M6 6l12 12M18 6 6 18"),
  check: () => P("M5 12.5 10 17l9-10"),
  arrow: () => P("M5 12h14m-5-5 5 5-5 5"),
  sparkle: () => P("M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"),
  play: () => P("M8 5v14l11-7L8 5Z"),
  speaker: () => P("M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5Zm11.5-.5a4.5 4.5 0 0 1 0 6m2.5-8.5a8 8 0 0 1 0 11"),
  stop: () => P("M7 7h10v10H7z"),
  eye: () => P("M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"),
  eyeOff: () => P("M3 3l18 18M10.6 5.6c.5-.1 .9-.1 1.4-.1 6.4 0 10 6.5 10 6.5a17 17 0 0 1-2.8 3.7M6.5 6.6C3.8 8.4 2 12 2 12s3.6 6.5 10 6.5c1.9 0 3.5-.5 4.9-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2"),
  repeat: () => P("M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5"),
  // a finger pressing: tap to choose
  tap: () => P("M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1-6 6h-.6a6 6 0 0 1-4.6-2.2L4.3 15a1.5 1.5 0 0 1 2.3-1.9L9 15.5"),
  // a box with a text cursor: type it in the gap
  gap: () => P("M3 7h18v10H3zM9 9.5v5M7.5 9.5h3M7.5 14.5h3"),
  // a wax tablet with lines of writing
  tablet: () => P("M4 5h16v14H4zM7 9h10M7 12h10M7 15h6"),
  // a sealed letter: the messenger
  letter: () => P("M3.5 6.5h17v11h-17zM3.5 6.5l8.5 6.5 8.5-6.5M3.5 17.5l6.3-5.3m10.7 5.3-6.3-5.3"),
  search: () => P("M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm4.7-1.8L20 20"),
  plus: () => P("M12 5v14M5 12h14"),
  // a paper plane: send
  send: () => P("M21 3 3 10.5l7 2.5 2.5 7L21 3Zm-11 10 5.5-5.5"),
  chevron: () => P("M9.5 6l6 6-6 6"),
  more: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5.5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="18.5" r="1.7" />
    </svg>
  ),
  gear: () => P("M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.7 1.7 1l.4 2.5h4l.4-2.5c.6-.3 1.2-.6 1.7-1l2.4 1 2-3.4-2-1.6Z"),
};

/** Progress as a row of mosaic tiles (tesserae). */
export function Mosaic({ value, tiles = 10, thin, label }: { value: number; tiles?: number; thin?: boolean; label?: string }) {
  const on = Math.round(Math.max(0, Math.min(1, value)) * tiles);
  return (
    <div class={`mosaic${thin ? " thin" : ""}`} role="img" aria-label={label ?? `${Math.round(value * 100)}%`}>
      {Array.from({ length: tiles }, (_, i) => (
        <i key={i} class={i < on ? "on" : ""} style={i < on ? { "--tile": tileTint(i) } : undefined} />
      ))}
    </div>
  );
}

// gold tesserae with a slight, fixed variation in tone, as in a real mosaic
function tileTint(i: number): string {
  const shades = ["var(--gold)", "color-mix(in srgb, var(--gold) 86%, var(--ink))", "color-mix(in srgb, var(--gold) 80%, var(--panel))", "color-mix(in srgb, var(--gold) 92%, var(--c-abl))"];
  return shades[(i * 7 + 3) % shades.length];
}

export function CaseChip({ c, label }: { c: Case | "verb"; label?: string }) {
  return <span class={`chip case c-${c}`}>{label ?? (c === "verb" ? "verb ending" : CASE_NAMES[c])}</span>;
}

/** A dialog. `screen` names it for Ask Claude (default: the label), which also reads its text. */
export function Modal({ onClose, children, label, wide, className = "", screen }: { onClose: () => void; children: ComponentChildren; label: string; wide?: boolean; className?: string; screen?: string }) {
  useScreen("dialog", screen ?? label);
  // registered before the dialog is painted, so an Escape pressed at once still closes it
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div class="scrim" onClick={onClose} />
      <div class={`modal${wide ? " wide" : ""} ${className}`} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div class="panel frame" data-ask={screen ?? label}>
          {children}
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------ card back

/** A laurel wreath: two branches of leaves, open at the top. */
export function Laurel({ cls = "laurel" }: { cls?: string }) {
  const R = 33;
  const C = 50;
  const at = (deg: number, r: number): [number, number] => [C + r * Math.cos((deg * Math.PI) / 180), C + r * Math.sin((deg * Math.PI) / 180)];
  const leaves: [number, number, number][] = [];
  const N = 7;
  for (let i = 0; i < N; i++) {
    // from the bottom (100°) round the left side towards the top (238°); y points down
    const deg = 100 + (i / (N - 1)) * 138;
    for (const side of [-1, 1]) {
      const d = deg + (side > 0 ? 9 : 0);
      if (d > 242) continue;
      const [x, y] = at(d, R + side * 4.6);
      leaves.push([x, y, d + 90 - side * 32]);
    }
  }
  const [x1, y1] = at(98, R);
  const [x2, y2] = at(240, R);
  const branch = (mirror: boolean) => (
    <g transform={mirror ? "translate(100 0) scale(-1 1)" : undefined}>
      <path d={`M${x1.toFixed(1)} ${y1.toFixed(1)} A${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`} fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
      {leaves.map(([x, y, rot], i) => (
        <ellipse key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} rx="6.4" ry="2.5" transform={`rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})`} fill="currentColor" />
      ))}
    </g>
  );
  return (
    <svg class={cls} viewBox="0 0 100 100" aria-hidden="true">
      {branch(false)}
      {branch(true)}
      <path d="M44 88.5 Q50 84 56 88.5 M47 85 L44.5 92 M53 85 L55.5 92" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
    </svg>
  );
}

/**
 * A hedera: the ivy leaf Roman stone-cutters carved between words and at the
 * end of an inscription. Used as a quiet ornament (the footer, end marks).
 */
export function Hedera({ flip }: { flip?: boolean }) {
  return (
    <svg class="hedera" viewBox="0 0 24 24" aria-hidden="true" style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <g transform="rotate(-90 12 12)">
        <path d="M12 21C5.5 15.5 2.6 11.6 4.7 7.6 6.6 4.6 10.3 4.9 12 8.2 13.7 4.9 17.4 4.6 19.3 7.6 21.4 11.6 18.5 15.5 12 21Z" fill="currentColor" />
        <path d="M12 8.2C12 5.2 10.4 3.2 8 3.3 6.4 3.4 5.8 4.9 6.9 5.6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
      </g>
    </svg>
  );
}

/** The back of a mystery card: dark, framed in gold, a wreath round a question mark. */
export function CardBack({ n }: { n?: number }) {
  return (
    <span class="card-back" aria-hidden="true">
      <Laurel />
      <span class="q">?</span>
      {n !== undefined && <span class="num">{roman(n)}</span>}
    </span>
  );
}

/**
 * A notice that can be swiped away like a phone notification: sideways or
 * down, it follows the finger and goes; a plain tap stays a tap.
 */
export function useSwipeAway(onGone: () => void, onTap?: () => void) {
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const moved = useRef(false);
  const [drag, setDrag] = useState<{ dx: number; dy: number; leaving?: boolean }>({ dx: 0, dy: 0 });
  const end = (dx: number, dy: number) => {
    start.current = null;
    if (Math.abs(dx) > 70 || dy > 50) {
      // off it goes, the way it was swiped
      setDrag({ dx: Math.abs(dx) > 70 ? Math.sign(dx) * 480 : dx, dy: dy > 50 ? 240 : 0, leaving: true });
      setTimeout(() => {
        onGone();
        setDrag({ dx: 0, dy: 0 });
      }, 180);
    } else setDrag({ dx: 0, dy: 0 });
  };
  return {
    style: {
      transform: drag.dx || drag.dy ? `translate(${drag.dx}px, ${drag.dy}px)` : undefined,
      opacity: drag.leaving ? 0 : 1 - Math.min(0.6, Math.max(Math.abs(drag.dx) / 300, drag.dy / 200)),
      transition: start.current ? "none" : "transform 0.18s ease-out, opacity 0.18s ease-out",
      touchAction: "none",
    },
    onPointerDown: (e: PointerEvent) => {
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      moved.current = false;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: PointerEvent) => {
      if (!start.current || e.pointerId !== start.current.id) return;
      const dx = e.clientX - start.current.x;
      const dy = Math.max(0, e.clientY - start.current.y);
      if (Math.abs(dx) > 6 || dy > 6) moved.current = true;
      setDrag({ dx, dy });
    },
    onPointerUp: (e: PointerEvent) => {
      if (!start.current) return;
      const dx = e.clientX - start.current.x;
      const dy = Math.max(0, e.clientY - start.current.y);
      end(dx, dy);
    },
    onPointerCancel: () => end(0, 0),
    onClick: () => {
      // a swipe is not a tap
      if (!moved.current) onTap?.();
      moved.current = false;
    },
  };
}

/** On a phone (a touch screen, no hover) Enter makes a new line and the button sends; with a keyboard, Enter sends. */
export const enterSends = () => !touchScreen();

let showToastFn: ((t: string) => void) | null = null;
export const toast = (t: string) => showToastFn?.(t);

export function Toaster() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    showToastFn = (t) => {
      setText(t);
      clearTimeout(timer);
      timer = setTimeout(() => setText(null), 2600);
    };
    return () => {
      showToastFn = null;
    };
  }, []);
  const swipe = useSwipeAway(() => setText(null), () => setText(null));
  return text ? <div key={text} class="toast ansata" role="status" {...swipe}>{text}</div> : null;
}

export function Section({ eyebrow, title, children, actions }: { eyebrow?: string; title?: string; children: ComponentChildren; actions?: ComponentChildren }) {
  return (
    <section class="stack">
      {(eyebrow || title || actions) && (
        <div class="spread">
          <div class="stack" style={{ gap: "4px" }}>
            {eyebrow && <span class="eyebrow">{eyebrow}</span>}
            {title && <h2>{title}</h2>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
