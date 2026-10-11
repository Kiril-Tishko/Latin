// What the learner is looking at, for Ask Claude: "here", "this sentence" or
// "this exercise" in a question should point at the right thing.
//
// Pages and dialogs register a label and a description while they are shown;
// the topmost wins (a dialog over a page over the app's route). Parts of a page
// or dialog marked with data-ask are described by their text while they are
// scrolled into view, and the last line or Latin word tapped is noted. All of
// it is read at the moment a question is sent.
import { useEffect, useRef, useState } from "preact/hooks";

export interface Screen {
  /** Short, for the drawer and the conversation: "Exercise 3 of 12 · Choose the right word". */
  label: string;
  /** Everything Claude should know about it. */
  detail: string;
}

type Level = "app" | "page" | "dialog";
const RANK: Record<Level, number> = { app: 0, page: 1, dialog: 2 };

interface Layer {
  rank: number;
  label: string;
  detail: () => string;
  seq: number;
}

let layers: Layer[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const topLayer = () => layers.reduce<Layer | undefined>((a, b) => (!a || b.rank > a.rank || (b.rank === a.rank && b.seq > a.seq) ? b : a), undefined);

/**
 * Registers what a page or dialog shows while it is mounted. `detail` is read
 * when a question is sent, so it can describe the latest state (what is typed,
 * whether the answer was checked).
 */
export function useScreen(level: Level, label: string, detail: () => string = () => "") {
  const read = useRef(detail);
  read.current = detail;
  useEffect(() => {
    const layer: Layer = { rank: RANK[level], label, detail: () => read.current(), seq: ++seq };
    layers.push(layer);
    emit();
    return () => {
      layers = layers.filter((l) => l !== layer);
      emit();
    };
  }, [level, label]);
}

// ------------------------------------------------------------ in view

/** An element's text as the learner sees it: one line per line, table cells split by "|". */
export function textOf(el: HTMLElement, max: number): string {
  const text = (el.innerText ?? el.textContent ?? "")
    .split("\n")
    .map((l) => l.replace(/\t+/g, " | ").replace(/[  ]+/g, " ").trim())
    .filter((l) => l && l !== "|")
    .join("\n");
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

/** The part of the window not covered by the top bar or (on phones) the bottom bar. */
function band(): [number, number] {
  const top = document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0;
  const nav = document.querySelector(".bottomnav")?.getBoundingClientRect();
  return [Math.max(0, top), nav && nav.height ? nav.top : window.innerHeight];
}

interface Part {
  label: string;
  el: HTMLElement;
  /** Pixels of it in view. */
  seen: number;
  top: number;
}

const rootOf = (dialog: boolean) => (dialog ? [...document.querySelectorAll<HTMLElement>(".modal")].pop() : document.getElementById("main"));

/** Elements matching `selector` inside `root` that are not inside another match. */
function outermost(root: HTMLElement, selector: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(selector)].filter((el) => {
    const outer = el.parentElement?.closest<HTMLElement>(selector);
    return !outer || !root.contains(outer) || outer === root;
  });
}

/** Marked parts (data-ask) of the page, or of the open dialog, that are in view now. */
function partsInView(dialog: boolean): Part[] {
  const root = rootOf(dialog);
  if (!root) return [];
  const [top, bottom] = dialog ? [0, window.innerHeight] : band();
  const out: Part[] = [];
  // (a part inside another part is already in its text)
  for (const el of outermost(root, "[data-ask]")) {
    const r = el.getBoundingClientRect();
    const seen = Math.min(r.bottom, bottom) - Math.max(r.top, top);
    if (seen > 12) out.push({ label: el.dataset.ask ?? "", el, seen, top: r.top });
  }
  return out;
}

// the lines of a long part: a sentence with its English, a table row, a word, a paragraph
const LINE = ".ex-line, tr, .panel.tight, .saying, .rule-mini, h1, h2, h3, h4, dt, dd, p, li, .eyebrow";

/** A part's text: all of it when it is wholly in view, otherwise only its lines in view. */
function partText(part: Part, dialog: boolean, max: number): string {
  const [top, bottom] = dialog ? [-Infinity, Infinity] : band();
  const r = part.el.getBoundingClientRect();
  if (r.top >= top - 4 && r.bottom <= bottom + 4) return textOf(part.el, max);
  const lines = outermost(part.el, LINE).filter((el) => {
    const b = el.getBoundingClientRect();
    return b.height > 0 && b.bottom > top + 4 && b.top < bottom - 4;
  });
  if (!lines.length) return textOf(part.el, max);
  const text = lines.map((el) => textOf(el, 400)).filter(Boolean).join("\n");
  return `(partly in view; the lines on screen:)\n${text.length > max ? `${text.slice(0, max).trimEnd()}…` : text}`;
}

/** The parts' text, the most visible first while it fits, then in reading order. */
function describeParts(parts: Part[], dialog: boolean, budget: number): string {
  const kept: { part: Part; text: string }[] = [];
  let left = budget;
  for (const part of [...parts].sort((a, b) => b.seen - a.seen)) {
    if (left < 200) break;
    const text = partText(part, dialog, Math.min(1800, left));
    left -= text.length;
    kept.push({ part, text });
  }
  return kept
    .sort((a, b) => a.part.top - b.part.top)
    .map(({ part, text }) => `[${part.label}]\n${text}`)
    .join("\n\n");
}

const mostVisible = (parts: Part[]) => parts.reduce<Part | undefined>((a, b) => (!a || b.seen > a.seen ? b : a), undefined);

// ------------------------------------------------------------ last tap

// a line of Latin with its English, a saying, an exercise's prompt, a card or word tile
const ITEM = "[data-ask-item], .ex-line, .saying, .prompt, .hero-art, .rule-mini, .word-tile, .deck-tile, .lesson-card, .panel.tight";

let tapped: { item: HTMLElement | null; word: HTMLElement | null; at: number } | null = null;

if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (e) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest || t.closest(".drawer, .topbar, .bottomnav")) return;
      const word = t.closest<HTMLElement>(".latin .w");
      const item = t.closest<HTMLElement>(ITEM);
      if (word || item) tapped = { item, word, at: Date.now() };
    },
    true,
  );
}

function ago(t: number): string {
  const s = Math.round((Date.now() - t) / 1000);
  return s < 45 ? "just now" : s < 90 ? "a minute ago" : `${Math.round(s / 60)} minutes ago`;
}

/** The line or word tapped last, if it is still on screen (in the open dialog, when there is one). */
function lastTap(dialog: boolean): string {
  if (!tapped || Date.now() - tapped.at > 10 * 60_000) return "";
  const { item, word } = tapped;
  const alive = (el: HTMLElement | null) => !!el && el.isConnected && (!dialog || !!el.closest(".modal"));
  const out: string[] = [];
  if (alive(item)) {
    const part = item!.closest<HTMLElement>("[data-ask]")?.dataset.ask;
    out.push(`Last tapped (${ago(tapped.at)})${part ? `, in [${part}]` : ""}:\n${textOf(item!, 400)}`);
  }
  if (alive(word)) {
    const what = word!.title ? ` (${word!.title})` : "";
    out.push(`${out.length ? "The word tapped" : `Last tapped (${ago(tapped.at)}), the word`}: ${textOf(word!, 40)}${what}`);
  }
  return out.join("\n");
}

// ------------------------------------------------------------ reading it

/** A short name for what is on screen now: the page, with the part of it most in view on a long page. */
function labelNow(): string {
  const top = topLayer();
  if (!top) return "";
  const main = rootOf(false);
  if (top.rank === RANK.dialog || !main || outermost(main, "[data-ask]").length < 2) return top.label;
  const part = mostVisible(partsInView(false));
  return part ? `${top.label} · ${part.label}` : top.label;
}

/** Everything Claude should know about the screen at this moment. */
export function currentScreen(): Screen | null {
  const top = topLayer();
  if (!top) return null;
  const dialog = top.rank === RANK.dialog;
  let detail = "";
  try {
    detail = top.detail().trim();
  } catch {
    // a description must never stop a question
  }
  const parts = partsInView(dialog);
  const lines = [detail];
  if (parts.length) lines.push(`${dialog ? "Text of the open dialog" : "In view on the screen"}:\n${describeParts(parts, dialog, 2600)}`);
  lines.push(lastTap(dialog));
  return { label: labelNow(), detail: lines.filter(Boolean).join("\n\n") };
}

/** The label of what is on screen, kept up to date while `on` (the drawer is open). */
export function useScreenLabel(on: boolean): string {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!on) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setTick((t) => t + 1));
    };
    listeners.add(update);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      listeners.delete(update);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [on]);
  // read at render time, so the drawer shows it from its first frame
  return on ? labelNow() : "";
}
