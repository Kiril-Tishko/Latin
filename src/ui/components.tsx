// Small shared pieces: icons, mosaic progress, case chips, dialogs, toast.
import { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { Case, CASE_NAMES } from "../latin/types";

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

export function Modal({ onClose, children, label }: { onClose: () => void; children: ComponentChildren; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div class="scrim" onClick={onClose} />
      <div class="modal" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div class="panel frame">{children}</div>
      </div>
    </>
  );
}

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
  return text ? <div class="toast" role="status">{text}</div> : null;
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
