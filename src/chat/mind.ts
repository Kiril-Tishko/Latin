// Each person's mind: what they remember, in their own words, and how they
// know it (they were there, someone told them, a rumour). It replaces the old
// per-chat facts and the "friends talk, so they may know" blocks, which let
// everyone know everything: now a person knows what happened in chats they are
// in, what they lived themselves, and what someone told them (`Tell`), which
// may be garbled or a lie. Memories are weighted, recalled when they matter to
// the conversation at hand, settled when a promise is kept or a fight is over,
// marked outdated when something newer replaces them, and pruned by weight and
// age, so a small fact does not push out what matters.
// Kept in messenger/minds/<person id>, one document per person.
import { clip } from "./model";
import type { Meta, Thread } from "./model";

export const MEMORY_KINDS = ["moment", "fact", "promise", "plan", "secret", "joke", "conflict", "news"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export interface Memory {
  id: string;
  /** When it happened, or when they learned it (ms). */
  at: number;
  /** What they remember, in their own words (English). */
  text: string;
  /** Whom it concerns: "me" for the learner, person ids. */
  about: string[];
  kind: MemoryKind;
  /** How much it matters to them: 1 (a small thing) to 5 (never forgotten). */
  weight: number;
  /** How they know it: "saw" (they were there, or it is their own life), a person's id (told by them), or "rumour". */
  from: string;
  /** The chat it happened in. */
  chat?: string;
  /** They keep it to themselves (their own secret, or one they were asked to keep). */
  secret?: boolean;
  /** Not true, though they believe it: a lie they were told, or a rumour gone wrong. */
  untrue?: boolean;
  /** A promise kept, a plan done or dropped, a fight made up. */
  done?: boolean;
  /** Something newer replaced it (kept a while, never recalled). */
  outdated?: boolean;
  /** A promise's or a plan's day (ms). */
  until?: number;
  updatedAt: number;
}

export interface Mind {
  id: string;
  memories: Memory[];
  /** 1: the old per-chat facts and moments have been moved in. */
  v?: number;
  updatedAt: number;
}

export const MAX_MEMORIES = 80;
export const newMind = (id: string): Mind => ({ id, memories: [], updatedAt: 0 });

const DAY = 86400_000;

/** A promise, a plan or a fight still going on. */
export const isOpen = (m: Memory) => !m.done && !m.outdated && (m.kind === "promise" || m.kind === "plan" || m.kind === "conflict");

/** How much a memory counts now: what matters, what is recent, what is still open. */
export function salience(m: Memory, now: number): number {
  const days = (now - m.at) / DAY;
  return m.weight * 2 + (days < 2 ? 3 : days < 7 ? 2 : days < 30 ? 1 : 0) + (isOpen(m) ? 2 : 0) - (m.outdated ? 6 : 0) - (m.done ? 1 : 0);
}

/** At most `max` memories: the ones that count most stay, in time order. */
export function prune(ms: Memory[], now: number, max = MAX_MEMORIES): Memory[] {
  const kept = ms.length <= max ? ms : [...ms].sort((x, y) => salience(y, now) - salience(x, now)).slice(0, max);
  return [...kept].sort((x, y) => x.at - y.at);
}

/** Two copies of a mind (two devices): every memory of both, the newer copy of each. */
export function mergeMinds(a: Mind | undefined, b: Mind | undefined, now = Date.now()): Mind | undefined {
  if (!a || !b) return a ?? b;
  const byId = new Map<string, Memory>();
  for (const m of [...a.memories, ...b.memories]) {
    const had = byId.get(m.id);
    if (!had || m.updatedAt >= had.updatedAt) byId.set(m.id, m);
  }
  return { ...a, ...b, memories: prune([...byId.values()], now), v: Math.max(a.v ?? 0, b.v ?? 0) || undefined, updatedAt: Math.max(a.updatedAt, b.updatedAt) };
}

/** A memory's id: steady for the same person and text (two devices moving in the same old fact make one memory). */
export function memoryId(who: string, text: string, at: number): string {
  let h = 2166136261;
  for (const c of `${who}|${text}|${Math.floor(at / 60000)}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return `k${(h >>> 0).toString(36)}`;
}

// ------------------------------------------------------------------ recall

const STOP = new Set(
  "that this with have from they them their there were what when where which while will would about after again also because been before being both could does doing during each just more most much must only other same should some such than then these those through under very your yours into over well said says told tells like make made know knew".split(" "),
);

/** The content words of a text, plain (no long marks), four letters or more. */
export function keywords(text: string): Set<string> {
  const ws = text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().match(/\p{L}{4,}/gu) ?? [];
  return new Set(ws.filter((w) => !STOP.has(w)));
}

export interface RecallCtx {
  now: number;
  /** Who is in the conversation ("me" for the learner). */
  with: string[];
  chat?: string;
  /** The conversation now (its English and Latin), to find what it touches. */
  text: string;
  /** How many memories. */
  k: number;
}

/**
 * The memories that matter now: weighty, recent or still open, and the ones
 * this conversation touches (its people, its chat, its words).
 */
export function recall(mind: Mind | undefined, c: RecallCtx): Memory[] {
  if (!mind) return [];
  const kw = keywords(c.text);
  const scored = mind.memories
    .filter((m) => !m.outdated)
    .map((m) => {
      let s = salience(m, c.now);
      if (m.about.some((a) => c.with.includes(a))) s += 2;
      if (c.chat && m.chat === c.chat) s += 1;
      let hits = 0;
      for (const w of keywords(m.text)) if (kw.has(w)) hits++;
      return { m, s: s + Math.min(3, hits) };
    })
    .sort((a, b) => b.s - a.s);
  const top = scored.slice(0, c.k).map((x) => x.m);
  // side by side: what they were told lately, with what they know themselves of the same people (two that do not fit
  // may catch someone out: he called Lūcius a bad poet to me, and a great one to his face); a couple more at most
  const told = top.filter((m) => m.from !== "saw" && c.now - m.at < 3 * DAY);
  const others = (m: Memory) => m.about.filter((a) => a !== "me");
  const beside = scored
    .map((x) => x.m)
    .filter((m) => !top.includes(m) && told.some((t) => t.id !== m.id && others(t).some((a) => others(m).includes(a) || m.about.includes(a))))
    .slice(0, 2);
  return [...top, ...beside].sort((a, b) => a.at - b.at);
}

const dayStamp = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/Rome" });

/** How they know it, in words. */
function howKnown(m: Memory, nameOf: (id: string) => string): string {
  if (m.from === "saw") return m.chat ? "was there" : "lived it";
  if (m.from === "rumour") return "a rumour going round";
  return `${nameOf(m.from)} told them`;
}

const WEIGHT = ["", "a small thing", "", "", "important", "never forgotten"];

/** Memories as the prompt shows them: id (to settle or outdate one), day, how they know it, the memory. */
export function memoryLines(ms: Memory[], nameOf: (id: string) => string): string[] {
  return ms.map((m) => {
    const notes = [
      howKnown(m, nameOf),
      WEIGHT[m.weight] ?? "",
      m.secret ? "a secret they keep" : "",
      m.untrue ? "untrue, though they believe it" : "",
      isOpen(m) ? `still open${m.until ? `, by ${dayStamp(m.until)}` : ""}` : "",
      m.done ? "settled" : "",
    ].filter(Boolean);
    return `- [${m.id}] ${dayStamp(m.at)}: ${m.text} (${notes.join("; ")})`;
  });
}

// ------------------------------------------------------------ forming them

/** A memory as Claude reports it, for one person. */
export interface MemoryDraft {
  who: string;
  text: string;
  kind: MemoryKind;
  weight: number;
  about: string[];
  secret?: boolean;
  until?: number;
}

const str = (x: unknown) => String(x ?? "").replace(/\s+/g, " ").trim();

/** A day written as 2026-10-21 (or a time), as ms; undefined when it is no day. */
function dayOf(x: unknown): number | undefined {
  const t = Date.parse(str(x));
  return Number.isFinite(t) ? t : undefined;
}

/**
 * The memories Claude reported, checked: only people of this conversation
 * remember (`who`; a bare fact in a private chat is the one person's), about
 * people who exist, at most a few. The old fields still work: "remember" as
 * plain facts, "moment" per person.
 */
export function memoriesOf(raw: { remember?: unknown; moment?: unknown }, rememberers: string[], everyone: Set<string>): MemoryDraft[] {
  const out: MemoryDraft[] = [];
  const one = rememberers.length === 1 ? rememberers[0] : undefined;
  const list = Array.isArray(raw.remember) ? raw.remember : [];
  for (const x of list.slice(0, 8)) {
    const o = (typeof x === "string" ? { text: x } : x ?? {}) as Record<string, unknown>;
    // someone named who is not here does not remember it; unnamed, in a private chat it is the one person's
    const who = rememberers.includes(str(o.who)) ? str(o.who) : str(o.who) ? undefined : one;
    const text = clip(str(o.text), 300);
    if (!who || !text) continue;
    const kind = (MEMORY_KINDS as readonly string[]).includes(str(o.kind)) ? (str(o.kind) as MemoryKind) : "fact";
    const about = (Array.isArray(o.about) ? o.about : ["me"]).map(str).filter((a) => a === "me" || everyone.has(a));
    const until = dayOf(o.until);
    out.push({ who, text, kind, weight: Math.max(1, Math.min(5, Math.round(Number(o.weight) || 2))), about: about.length ? about : ["me"], ...(o.secret === true ? { secret: true } : {}), ...(until ? { until } : {}) });
  }
  // the old "moment": what happened between someone and the learner
  const moments = raw.moment && typeof raw.moment === "object" && !Array.isArray(raw.moment) ? (raw.moment as Record<string, unknown>) : {};
  for (const [who, v] of Object.entries(moments)) if (rememberers.includes(who) && str(v)) out.push({ who, text: clip(str(v), 300), kind: "moment", weight: 3, about: ["me"] });
  return out.slice(0, 8);
}

/** Someone tells someone else something, away from the learner's eyes: it may be garbled, or a lie. */
export interface Tell {
  from: string;
  to: string;
  what: string;
  about: string[];
  weight: number;
  /** A lie, or a rumour gone wrong (the one told believes it). */
  untrue?: boolean;
  /** Told as a secret ("only you"). */
  secret?: boolean;
}

/** The telling Claude reported, checked: people who exist, not to themselves, a few at most. */
export function tellsOf(raw: unknown, tellers: Set<string>, everyone: Set<string>): Tell[] {
  const list = (Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : []) as Record<string, unknown>[];
  return list
    .slice(0, 4)
    .map((o) => ({
      from: str(o?.from),
      to: str(o?.to),
      what: clip(str(o?.what), 300),
      about: (Array.isArray(o?.about) ? o.about : []).map(str).filter((a) => a === "me" || everyone.has(a)),
      weight: Math.max(1, Math.min(5, Math.round(Number(o?.weight) || 3))),
      ...(o?.untrue === true ? { untrue: true } : {}),
      ...(o?.secret === true ? { secret: true } : {}),
    }))
    .filter((t) => tellers.has(t.from) && everyone.has(t.to) && t.from !== t.to && t.what);
}

/** A fresh memory of someone's. */
export function memoryFrom(d: MemoryDraft, at: number, how: Pick<Memory, "from" | "chat" | "untrue"> = { from: "saw" }): Memory {
  return { id: memoryId(d.who, d.text, at), at, text: d.text, about: d.about, kind: d.kind, weight: d.weight, ...how, ...(d.secret ? { secret: true } : {}), ...(d.until ? { until: d.until } : {}), updatedAt: at };
}

/**
 * Keeps what a conversation or a stretch of life did to the people's minds:
 * new memories, memories settled or outdated (by id, only the person's own),
 * and what someone told someone (the one told learns it as told; the teller
 * remembers telling it). Returns the minds that changed.
 */
export function applyMinds(
  minds: Record<string, Mind>,
  change: { memories?: MemoryDraft[]; chat?: string; settled?: string[]; outdated?: string[]; tells?: Tell[] },
  now: number,
  nameOf: (id: string) => string,
): Mind[] {
  const touched = new Map<string, Mind>();
  const mind = (id: string) => touched.get(id) ?? { ...(minds[id] ?? newMind(id)), memories: [...(minds[id]?.memories ?? [])] };
  const add = (id: string, m: Memory) => {
    const x = mind(id);
    if (!x.memories.some((y) => y.id === m.id)) x.memories.push(m);
    touched.set(id, x);
  };
  for (const d of change.memories ?? []) add(d.who, memoryFrom(d, now, { from: "saw", ...(change.chat ? { chat: change.chat } : {}) }));
  for (const t of change.tells ?? []) {
    add(t.to, memoryFrom({ who: t.to, text: t.what, kind: "news", weight: t.weight, about: t.about.length ? t.about : [t.from], ...(t.secret ? { secret: true } : {}) }, now, { from: t.from, ...(t.untrue ? { untrue: true } : {}) }));
    add(t.from, memoryFrom({ who: t.from, text: `I told ${nameOf(t.to)}: ${t.what}`, kind: "news", weight: Math.max(1, t.weight - 1), about: [t.to, ...t.about] }, now));
  }
  // settled / outdated: only memories that exist, in whoever's mind they are
  const mark = (ids: string[] | undefined, patch: Partial<Memory>) => {
    for (const id of ids ?? [])
      for (const who of Object.keys(minds)) {
        const x = mind(who);
        const i = x.memories.findIndex((y) => y.id === id);
        if (i < 0) continue;
        x.memories[i] = { ...x.memories[i], ...patch, updatedAt: now };
        touched.set(who, x);
      }
  };
  mark(change.settled, { done: true });
  mark(change.outdated, { outdated: true });
  return [...touched.values()].map((x) => ({ ...x, memories: prune(x.memories, now), updatedAt: now }));
}

// ---------------------------------------------------------------- moving in

/** The old facts ("Cyrillus slept a lot", "Cyrillus said he misses Iūlia") and moments ("13 Oct: …"), moved into the minds once. */
export function migrateMinds(meta: Meta, threads: Thread[], minds: Record<string, Mind>, membersOf: (chat: string) => string[], now: number): Mind[] {
  const out: Mind[] = [];
  const people = new Set([...threads.flatMap((t) => membersOf(t.id)), ...Object.keys(meta.bonds ?? {})]);
  for (const who of people) {
    if ((minds[who]?.v ?? 0) >= 1) continue;
    const memories: Memory[] = [...(minds[who]?.memories ?? [])];
    for (const t of threads) {
      if (!membersOf(t.id).includes(who)) continue;
      const at = t.updatedAt || now;
      for (const fact of t.memory ?? [])
        memories.push({ id: memoryId(who, fact, 0), at, text: fact, about: ["me"], kind: "fact", weight: 2, from: "saw", chat: t.id, updatedAt: now });
    }
    for (const line of meta.bonds?.[who]?.moments ?? []) {
      // "13 Oct: …"
      const m = /^(\d{1,2} \w{3}):\s*(.*)$/.exec(line);
      const at = m ? Date.parse(`${m[1]} ${new Date(now).getUTCFullYear()} 12:00 UTC`) || now : now;
      const text = m ? m[2] : line;
      // a moment between them happened in their private chat
      memories.push({ id: memoryId(who, text, 0), at, text, about: ["me"], kind: "moment", weight: 3, from: "saw", chat: who, updatedAt: now });
    }
    out.push({ id: who, memories: prune(memories, now), v: 1, updatedAt: now });
  }
  return out;
}
