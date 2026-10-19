// How each person stands with the learner, and with each other, in a few
// levels the code can use (the learner asked for relationships that grow, sour
// and heal like real ones, each in the person's own way): warmth, trust,
// respect, desire, hurt and interest, 0-10. Claude says how a conversation
// moved them, by small steps; the code keeps them believable: growth has a
// daily limit (trust is built slowly, a crush takes days, at each one's own
// pace), a fall can be sudden, and real time does the rest (hurt heals at each
// one's pace, interest returns to their usual after a while apart, warmth and
// desire fade slowly after a long silence). The private inner voice ("feel")
// stays beside them: the numbers keep the story steady, the words keep it
// alive. Nothing here is ever shown on the page.
import { PERSON_BY_ID, PEOPLE } from "../content/people";
import { romeDay } from "./calendar";
import { clip } from "./model";
import type { Bond, Meta, Who } from "./model";
import { natureOf } from "./nature";
import type { Pace } from "./pace";

export const DIMS = ["warmth", "trust", "respect", "desire", "hurt", "interest"] as const;
export type Dim = (typeof DIMS)[number];
export type Levels = Record<Dim, number>;

/** Levels before anything has happened: someone they have no feelings about either way. */
export const NEUTRAL: Levels = { warmth: 5, trust: 5, respect: 5, desire: 0, hurt: 0, interest: 5 };

/** How much a level may grow in one Rome day, at most (desire: the person's own `fall`). Falling is never limited. */
const DAILY: Record<Exclude<Dim, "desire" | "hurt">, number> = { warmth: 3, trust: 2, respect: 2, interest: 3 };
/** One change at most: ±1 most things, ±2 what matters, ±3 a shock. */
export const STEP = 3;
/** The most ties among the people kept (the newest). */
export const MAX_TIES = 80;

const DAY = 86400_000;
const dayKey = (t: number) => {
  const d = romeDay(t);
  return `${d.y}-${d.m}-${d.d}`;
};
const clamp = (x: number) => Math.round(Math.max(0, Math.min(10, x)) * 10) / 10;

/** How much each level grew on one day (growth has a daily limit). */
export interface Gain {
  day: string;
  up: Partial<Levels>;
}

/** How one of them sees another: their own feelings, private. */
export interface Tie {
  /** How `from` sees `to` now, in their own words. */
  note?: string;
  /** The levels as they were at `at`. */
  lv: Levels;
  at: number;
  gain?: Gain;
  updatedAt: number;
}

export const tieKey = (from: string, to: string) => `${from}>${to}`;

/**
 * Levels as they are now: hurt heals at the person's own pace; interest goes
 * back to their usual after two days apart; warmth and desire drift back
 * slowly after a week.
 */
export function levelsNow(lv: Levels, at: number, now: number, base: Levels, forgive: number): Levels {
  const days = Math.max(0, (now - at) / DAY);
  const toward = (v: number, b: number, rate: number, after: number) => {
    const d = Math.max(0, days - after) * rate;
    return v > b ? Math.max(b, v - d) : Math.min(b, v + d);
  };
  return {
    warmth: clamp(toward(lv.warmth, base.warmth, 0.05, 7)),
    trust: clamp(lv.trust),
    respect: clamp(lv.respect),
    desire: clamp(toward(lv.desire, base.desire, 0.05, 7)),
    hurt: clamp(lv.hurt - days * forgive),
    interest: clamp(toward(lv.interest, base.interest, 0.3, 2)),
  };
}

/** Someone's way with feelings: where they start with the learner, how fast hurt heals, how fast they may fall for someone. */
function heartOf(id: string, meta: Meta): { start: Levels; forgive: number; fall: number } {
  const n = natureOf(id, meta);
  return { start: n?.start ?? NEUTRAL, forgive: n?.forgive ?? 1, fall: n?.fall ?? 1 };
}

/** Where someone stands with the learner now, and whether it has ever been measured (else their starting point). */
export function standing(id: string, meta: Meta, now: number): { lv: Levels; set: boolean } {
  const b = meta.bonds?.[id];
  const h = heartOf(id, meta);
  if (!b?.lv) return { lv: h.start, set: false };
  return { lv: levelsNow(b.lv, b.lvAt ?? b.updatedAt, now, h.start, h.forgive), set: true };
}

/** Moves levels by Claude's changes: each within ±STEP, growth within what is left of the day's limit. */
export function stepLevels(cur: Levels, gain: Gain | undefined, delta: Partial<Levels>, now: number, fall: number): { lv: Levels; gain: Gain } {
  const day = dayKey(now);
  const up: Partial<Levels> = gain?.day === day ? { ...gain.up } : {};
  const lv = { ...cur };
  for (const d of DIMS) {
    let x = Number(delta[d]);
    if (!Number.isFinite(x) || !x) continue;
    x = Math.max(-STEP, Math.min(STEP, x));
    if (x > 0 && d !== "hurt") {
      const cap = d === "desire" ? fall : DAILY[d];
      x = Math.min(x, Math.max(0, cap - (up[d] ?? 0)));
      if (!x) continue;
      up[d] = (up[d] ?? 0) + x;
    }
    lv[d] = clamp(lv[d] + x);
  }
  return { lv, gain: { day, up } };
}

/** What Claude said a conversation did to someone's standing with the learner. */
export interface BondChange {
  who: string;
  /** Changes, by small steps. */
  delta?: Partial<Levels>;
  /** Where they stand, for someone not measured yet (0-10). */
  levels?: Partial<Levels>;
}

const obj = (x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {});
const levelsIn = (x: unknown): Partial<Levels> => {
  const o = obj(x);
  const out: Partial<Levels> = {};
  for (const d of DIMS) {
    const v = Number(o[d]);
    if (o[d] !== undefined && o[d] !== null && o[d] !== "" && Number.isFinite(v)) out[d] = v;
  }
  return out;
};

/** The changes Claude reported ("bond": changes, "levels": first measures), for the people who may have them. */
export function bondChangesOf(raw: { bond?: unknown; levels?: unknown }, ids: Set<string>): BondChange[] {
  const out = new Map<string, BondChange>();
  for (const [who, v] of Object.entries(obj(raw.bond))) {
    const delta = levelsIn(v);
    if (ids.has(who) && Object.keys(delta).length) out.set(who, { who, delta });
  }
  for (const [who, v] of Object.entries(obj(raw.levels))) {
    const levels = levelsIn(v);
    if (ids.has(who) && Object.keys(levels).length) out.set(who, { ...(out.get(who) ?? { who }), levels });
  }
  return [...out.values()];
}

/**
 * Keeps how a conversation moved the people's standing with the learner: a
 * first measure for someone never measured (their present levels, read from
 * how they feel), then changes within the limits. Changes meta in place.
 */
export function applyBondChanges(meta: Meta, changes: BondChange[], now: number) {
  if (!changes.length) return;
  const bonds = { ...(meta.bonds ?? {}) };
  for (const c of changes) {
    const old: Bond = bonds[c.who] ?? { feel: "", moments: [], updatedAt: 0 };
    const now0 = standing(c.who, { ...meta, bonds }, now);
    let lv = now0.lv;
    // a first measure sets them where they are (a week of history may lie behind it); later "levels" are ignored: only steps move them
    if (!now0.set && c.levels) for (const d of DIMS) if (c.levels[d] !== undefined) lv = { ...lv, [d]: clamp(c.levels[d]!) };
    let gain = old.gain;
    if (c.delta) ({ lv, gain } = stepLevels(lv, now0.set ? old.gain : undefined, c.delta, now, heartOf(c.who, meta).fall));
    bonds[c.who] = { ...old, lv, lvAt: now, ...(gain ? { gain } : {}), updatedAt: now };
  }
  meta.bonds = bonds;
}

// ------------------------------------------------------- among themselves

/** Where one of them stands with another at first: a friend's own (content/people.ts), else neutral. */
function tieStart(from: string, to: string): Levels {
  return { ...NEUTRAL, ...(PERSON_BY_ID.get(from)?.feels?.[to] ?? {}) };
}

/** How `from` sees `to` now. */
export function tieNow(from: string, to: string, meta: Meta, now: number): { lv: Levels; note?: string; set: boolean } {
  const t = meta.ties?.[tieKey(from, to)];
  const start = tieStart(from, to);
  if (!t) return { lv: start, set: false };
  return { lv: levelsNow(t.lv, t.at, now, start, heartOf(from, meta).forgive), note: t.note, set: true };
}

/** What Claude said changed between two of them. */
export interface TieChange {
  from: string;
  to: string;
  note?: string;
  delta: Partial<Levels>;
}

/** The ties Claude reported: from someone who may feel it, to someone who exists, not themselves, a few at most. */
export function tieChangesOf(raw: unknown, froms: Set<string>, everyone: Set<string>): TieChange[] {
  const list = (Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : []) as unknown[];
  return list
    .map((x) => {
      const o = obj(x);
      const note = typeof o.note === "string" ? clip(o.note.trim(), 240) : "";
      return { from: String(o.from ?? ""), to: String(o.to ?? ""), ...(note ? { note } : {}), delta: levelsIn(o) };
    })
    .filter((t) => froms.has(t.from) && everyone.has(t.to) && t.from !== t.to && (t.note || Object.keys(t.delta).length))
    .slice(0, 6);
}

/** Keeps what changed among them (changes meta in place); the oldest ties go past MAX_TIES. */
export function applyTieChanges(meta: Meta, changes: TieChange[], now: number) {
  if (!changes.length) return;
  const ties = { ...(meta.ties ?? {}) };
  for (const c of changes) {
    const key = tieKey(c.from, c.to);
    const cur = tieNow(c.from, c.to, { ...meta, ties }, now);
    const { lv, gain } = stepLevels(cur.lv, ties[key]?.gain, c.delta, now, heartOf(c.from, meta).fall);
    const note = c.note ?? cur.note;
    ties[key] = { ...(note ? { note } : {}), lv, at: now, gain, updatedAt: now };
  }
  meta.ties = Object.fromEntries(Object.entries(ties).sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, MAX_TIES));
}

/** Two copies of the ties together: for each pair, the newer. */
export function mergeTies(a: Record<string, Tie> | undefined, b: Record<string, Tie> | undefined): Record<string, Tie> | undefined {
  if (!a || !b) return a ?? b;
  const out = { ...a };
  for (const [k, t] of Object.entries(b)) if (!out[k] || t.updatedAt >= out[k].updatedAt) out[k] = t;
  return out;
}

// ------------------------------------------------------------- in words

const WORDS: Record<Dim, [number, string][]> = {
  warmth: [[1.5, "hostile"], [3.5, "cold"], [4.5, "cool"], [6.5, "friendly"], [8.5, "fond"], [11, "devoted"]],
  trust: [[2.5, "suspicious"], [4.5, "wary"], [6.5, "trusts"], [8.5, "trusts a lot"], [11, "would trust with anything"]],
  respect: [[2.5, "does not take seriously"], [4.5, "unsure of"], [6.5, "respects"], [8.5, "looks up to"], [11, "admires"]],
  desire: [[0.5, "none"], [2.5, "a flicker of attraction"], [4.5, "a crush"], [6.5, "falling for"], [8.5, "in love"], [11, "consumed by it"]],
  hurt: [[0.5, "none"], [2.5, "a little sore"], [5.5, "hurt"], [8.5, "deeply hurt, angry"], [11, "wounded, furious"]],
  interest: [[2.5, "bored"], [4.5, "mildly curious"], [6.5, "interested"], [8.5, "very interested"], [11, "fascinated"]],
};

/** A level in a word or two. */
export const levelWord = (d: Dim, v: number) => WORDS[d].find(([lim]) => v < lim)?.[1] ?? "";

/** Levels as a line: "warmth 7 (fond) · trust 5 (trusts) · …". */
export const levelsLine = (lv: Levels, dims: readonly Dim[] = DIMS) => dims.map((d) => `${d} ${Math.round(lv[d])} (${levelWord(d, lv[d])})`).join(" · ");

/** Only what stands out about a tie (neutral is left out). */
const notable = (lv: Levels) => DIMS.filter((d) => (d === "desire" || d === "hurt" ? lv[d] >= 1 : Math.abs(lv[d] - NEUTRAL[d]) >= 2));

/** Where someone stands with the learner, for a prompt (private: it shows only in how they write); `ask`: Claude may set it now. */
export function standingLine(who: Who, meta: Meta, now: number, ask = true): string {
  const { lv, set } = standing(who.id, meta, now);
  if (set) return `Where ${who.name} stands with the learner now (0-10, private): ${levelsLine(lv)}.`;
  return ask
    ? `Where ${who.name} stands with the learner: NOT SET YET (their nature would start at ${levelsLine(lv)}). With this answer give "levels" for ${who.name}: where they stood before this moment, 0-10 each, read from how they feel and what has happened.`
    : `Where ${who.name} stands with the learner, by their nature (0-10, private; how they feel above says more): ${levelsLine(lv)}.`;
}

/** How someone sees the others: the old ties, what changed since, and how they feel now (their own feelings, private). */
export function tiesLine(who: Who, meta: Meta, now: number): string {
  const base = Object.entries(who.ties ?? {});
  const others = new Set([...base.map(([id]) => id), ...Object.keys(meta.ties ?? {}).filter((k) => k.startsWith(`${who.id}>`)).map((k) => k.split(">")[1])]);
  const parts = [...others].map((id) => {
    const t = tieNow(who.id, id, meta, now);
    const name = PEOPLE.find((p) => p.id === id)?.name ?? meta.strangers[id]?.name ?? id;
    const was = who.ties?.[id];
    const show = notable(t.lv);
    return `${name}: ${[was, t.note ? `now: "${t.note}"` : ""].filter(Boolean).join("; ") || "someone they know"}${show.length ? ` [${show.map((d) => `${d} ${Math.round(t.lv[d])}`).join(", ")}]` : ""}`;
  });
  return parts.length ? `With the others (their own feelings, private; the others see only what they show): ${parts.join("; ")}.` : "";
}

// --------------------------------------------------------------- pacing

/**
 * How their feelings change the way they write first (chat/pace.ts): someone
 * deeply hurt waits for the learner to come to them; someone hurt chases less;
 * someone in love or devoted tries once more and waits less; someone bored
 * does not chase at all.
 */
export function bondPace(pace: Pace, lv: Levels): Pace {
  let { patience, wait, nudges } = pace;
  if (lv.hurt >= 7) return { patience: 0, wait, nudges: 0 };
  if (lv.hurt >= 4) patience = Math.max(1, patience - 1);
  if (lv.desire >= 6 || lv.warmth >= 9) nudges += 1;
  if (lv.interest <= 2) nudges = 0;
  if (lv.interest >= 8 || lv.desire >= 6) wait = Math.round(wait * 0.75);
  else if (lv.interest <= 3) wait = Math.round(wait * 1.5);
  return { patience, wait, nudges };
}
