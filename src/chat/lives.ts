// What the people's lives add up to, beyond the chats (the learner asked for
// lives of their own, in real time, with goals and consequences): what each of
// them wants and how it goes (goals), what happened in their world and who
// knows it (the timeline), what a happening leaves behind (a memory, a new
// want, and after a heavy one, what comes next), and the big things kept rare
// (a calm week between two of them in the world, three weeks for one person).
// Claude moves goals on and may make things happen ("happen": a consequence of
// what went on, or life out of the blue); the code keeps them steady.
import { Happening, PEOPLE, PERSON_BY_ID } from "../content/people";
import { clip } from "./model";
import type { Meta, Who } from "./model";
import type { MemoryDraft } from "./mind";

/** Something someone wants from life, in their own words. */
export interface Goal {
  id: string;
  text: string;
  /** The latest step toward it, or away from it. */
  step?: string;
  status: "open" | "done" | "dropped";
  since: number;
  updatedAt: number;
}

/** Something that happened in their world: who it concerns, and who knows of it (everyone, if public). */
export interface WorldEvent {
  id: string;
  at: number;
  en: string;
  who: string[];
  public?: boolean;
  knows?: string[];
  heavy?: boolean;
}

/** Open goals per person, at most. */
export const MAX_GOALS = 4;
/** Events the world keeps (the newest). */
export const MAX_EVENTS = 60;
/** Days of calm in the world between two heavy happenings, and for one person. */
export const CALM_DAYS = 7;
export const OWN_CALM_DAYS = 21;

const DAY = 86400_000;
const HOUR = 3600_000;

function hash(s: string): string {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
}

export const goalId = (who: string, text: string) => `g${hash(`${who}:${text.toLowerCase()}`)}`;
const str = (x: unknown) => (typeof x === "string" ? x.trim() : "");
const nameOf = (id: string, meta: Meta) => PERSON_BY_ID.get(id)?.name ?? meta.strangers[id]?.name ?? id;

// ---------------------------------------------------------------- goals

/** Someone's goals: those kept, or what they want at first. */
export function goalsOf(id: string, meta: Meta): Goal[] {
  const kept = meta.goals?.[id];
  if (kept) return kept;
  return (PERSON_BY_ID.get(id)?.wants ?? []).map((text) => ({ id: goalId(id, text), text, status: "open" as const, since: 0, updatedAt: 0 }));
}

/** What someone wants, for a prompt: open goals with their ids and the latest step; what they got or gave up lately. */
export function goalsLine(who: Who, meta: Meta, now: number): string {
  const gs = goalsOf(who.id, meta);
  const open = gs.filter((g) => g.status === "open");
  const closed = gs.filter((g) => g.status !== "open" && now - g.updatedAt < 14 * DAY);
  return [
    open.length ? `What ${who.name} wants from life (it drives what they do and talk about, in their own time): ${open.map((g) => `[${g.id}] ${g.text}${g.step ? ` (lately: ${g.step})` : ""}`).join("; ")}.` : "",
    closed.length ? `Lately ${closed.map((g) => `${g.status === "done" ? "got" : "gave up on"} ${g.text}`).join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** What Claude said happened to someone's goals: a step, done or given up (by id), or a new want (by text). */
export interface GoalChange {
  who: string;
  id?: string;
  text?: string;
  step?: string;
  status?: Goal["status"];
}

export function goalChangesOf(raw: unknown, ids: Set<string>): GoalChange[] {
  const list = (Array.isArray(raw) ? raw : []) as Record<string, unknown>[];
  return list
    .map((o) => {
      const status = ["open", "done", "dropped"].includes(str(o?.status)) ? (str(o.status) as Goal["status"]) : undefined;
      return { who: str(o?.who), ...(str(o?.id) ? { id: str(o.id) } : {}), ...(str(o?.text) ? { text: clip(str(o.text), 160) } : {}), ...(str(o?.step) ? { step: clip(str(o.step), 200) } : {}), ...(status ? { status } : {}) };
    })
    .filter((g) => ids.has(g.who) && (g.id || g.text) && (g.text || g.step || g.status))
    .slice(0, 4);
}

/**
 * Keeps what moved: a step or a new status for a goal they have (by id), or a
 * new want (by text; a few open at most). A goal got or given up goes on the
 * timeline, known to its person. Changes meta in place.
 */
export function applyGoalChanges(meta: Meta, changes: GoalChange[], now: number) {
  for (const c of changes) {
    const gs = [...goalsOf(c.who, meta)];
    const i = c.id ? gs.findIndex((g) => g.id === c.id) : c.text ? gs.findIndex((g) => g.id === goalId(c.who, c.text!)) : -1;
    if (i >= 0) {
      const g = gs[i];
      gs[i] = { ...g, ...(c.step ? { step: c.step } : {}), ...(c.status ? { status: c.status } : {}), updatedAt: now };
      if (c.status && c.status !== "open" && g.status === "open")
        addEvent(meta, { at: now, en: `${nameOf(c.who, meta)} ${c.status === "done" ? "got what they wanted" : "gave up"}: ${g.text}${c.step ? ` (${c.step})` : ""}`, who: [c.who], knows: [c.who] });
    } else if (c.text && (c.status ?? "open") === "open" && gs.filter((g) => g.status === "open").length < MAX_GOALS) {
      gs.push({ id: goalId(c.who, c.text), text: c.text, ...(c.step ? { step: c.step } : {}), status: "open", since: now, updatedAt: now });
    } else continue;
    // the newest twelve, open ones first
    meta.goals = { ...(meta.goals ?? {}), [c.who]: gs.sort((a, b) => Number(b.status === "open") - Number(a.status === "open") || b.updatedAt - a.updatedAt).slice(0, 12) };
  }
}

/** Two copies of the goals together: for each person, each goal the newer. */
export function mergeGoals(a: Record<string, Goal[]> | undefined, b: Record<string, Goal[]> | undefined): Record<string, Goal[]> | undefined {
  if (!a || !b) return a ?? b;
  const out: Record<string, Goal[]> = { ...a };
  for (const [who, gs] of Object.entries(b)) {
    const byId = new Map((out[who] ?? []).map((g) => [g.id, g]));
    for (const g of gs) if (!byId.has(g.id) || g.updatedAt >= byId.get(g.id)!.updatedAt) byId.set(g.id, g);
    out[who] = [...byId.values()];
  }
  return out;
}

// ------------------------------------------------------------- timeline

/** Puts something on the world's timeline (once: the same id is not added twice). */
export function addEvent(meta: Meta, e: Omit<WorldEvent, "id"> & { id?: string }) {
  const id = e.id ?? `e${hash(`${e.at}:${e.en}`)}`;
  const timeline = meta.world?.timeline ?? [];
  if (timeline.some((x) => x.id === id)) return;
  meta.world = { ...(meta.world ?? { updatedAt: 0 }), timeline: [...timeline, { ...e, id }].sort((a, b) => a.at - b.at).slice(-MAX_EVENTS), updatedAt: Math.max(meta.world?.updatedAt ?? 0, e.at) };
}

/** Does someone know of an event: everyone knows a public one; else its people and whoever was told. */
export const knowsOf = (e: WorldEvent, id: string) => !!e.public || e.who.includes(id) || !!e.knows?.includes(id);

const dateOf = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/Rome" });

/**
 * What happened in their world lately, oldest first: with `viewers`, only
 * what one of them knows of (and who else does); without, everything, with
 * who knows it (for the prompt that decides for everyone).
 */
export function timelineBlock(meta: Meta, viewers: string[] | undefined, now: number, days = 21, max = 12): string {
  const evs = (meta.world?.timeline ?? []).filter((e) => e.at <= now && now - e.at < days * DAY && (!viewers || viewers.some((v) => knowsOf(e, v)))).slice(-max);
  if (!evs.length) return "";
  const known = (e: WorldEvent) => (e.public ? "everyone around knows" : `known to ${[...new Set([...e.who, ...(e.knows ?? [])])].map((id) => nameOf(id, meta)).join(", ")}`);
  return `WHAT HAPPENED IN THEIR WORLD LATELY (it stays true: what came of it shows in their lives now; only those who know of a thing can speak of it):\n${evs.map((e) => `- ${dateOf(e.at)}: ${e.en} (${known(e)})`).join("\n")}`;
}

/** Days since anything was put on the timeline (Infinity when nothing ever was). */
export const quietDays = (meta: Meta, now: number) => {
  const last = (meta.world?.timeline ?? []).filter((e) => e.at <= now).at(-1);
  return last ? (now - last.at) / DAY : Infinity;
};

// ------------------------------------------------------------ happenings

/** May a heavy happening start for someone now: a calm week in the world since the last one, three weeks for them. */
export function heavyOk(meta: Meta, id: string, now: number): boolean {
  return !(meta.world?.timeline ?? []).some((e) => e.heavy && (now - e.at < CALM_DAYS * DAY || (e.who.includes(id) && now - e.at < OWN_CALM_DAYS * DAY)));
}

/**
 * What a happening that has just begun leaves: on the timeline when it is
 * heavy or public and lasts a day or more; a want, if it brings one; and a
 * memory of theirs when it is more than a passing thing (returned, for the
 * minds). Changes meta in place.
 */
export function noteHappening(meta: Meta, who: string, h: Pick<Happening, "en" | "hours" | "public" | "heavy" | "wants">, now: number): MemoryDraft[] {
  const long = h.hours[0] >= 12;
  if (h.heavy || (h.public && h.hours[0] >= 24)) addEvent(meta, { at: now, en: `${nameOf(who, meta)}: ${h.en}`, who: [who], ...(h.public ? { public: true } : {}), ...(h.heavy ? { heavy: true } : {}) });
  if (h.wants) applyGoalChanges(meta, [{ who, text: h.wants }], now);
  return h.heavy || long || h.public ? [{ who, text: h.en, kind: "news", weight: h.heavy ? 4 : 2, about: [who] }] : [];
}

/** Claude makes something happen in someone's life: a consequence of what went on, or life out of the blue. */
export interface Happen {
  who: string;
  en: string;
  mood?: string;
  hours: number;
  public?: boolean;
}

/** The happenings Claude reported: to someone who exists, an hour to two weeks, one or two at most. */
export function happensOf(raw: unknown, everyone: Set<string>): Happen[] {
  const list = (Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : []) as Record<string, unknown>[];
  return list
    .map((o) => ({
      who: str(o?.who),
      en: clip(str(o?.what ?? o?.en), 200),
      ...(str(o?.mood) ? { mood: str(o.mood).split(/[,;]/)[0].split(/\s+/).slice(0, 3).join(" ").slice(0, 30) } : {}),
      hours: Math.max(1, Math.min(336, Math.round(Number(o?.hours) || 12))),
      ...(o?.public === true ? { public: true } : {}),
    }))
    .filter((h) => everyone.has(h.who) && h.en)
    .slice(0, 2);
}

/** Makes Claude's happenings real: their life now (it replaces what was going on), the timeline, a memory. Changes meta in place. */
export function applyHappen(meta: Meta, hs: Happen[], now: number): MemoryDraft[] {
  const out: MemoryDraft[] = [];
  for (const h of hs) {
    const life = meta.life[h.who];
    const heavy = h.hours >= 72;
    meta.life[h.who] = {
      mood: h.mood ?? life?.mood ?? "shaken",
      level: life?.level ?? "",
      moodUntil: now + Math.min(h.hours, 9) * HOUR,
      event: h.en,
      eventUntil: now + h.hours * HOUR,
      eventAt: now,
      ...(h.mood ? { eventMood: h.mood } : {}),
      ...(h.public ? { public: true } : {}),
      ...(heavy ? { heavy: true } : {}),
      recent: [h.en, ...(life?.recent ?? [])].slice(0, 4),
      rolled: now,
    };
    out.push(...noteHappening(meta, h.who, { en: h.en, hours: [h.hours, h.hours], public: h.public, heavy }, now));
  }
  return out;
}

/** What the neighbours know of the people's lives now: their public happenings (for the others, and the Ācta: `since`, only those begun after it). */
export function publicNow(meta: Meta, now: number, ids: string[] = PEOPLE.map((p) => p.id), since = 0): string[] {
  return ids.flatMap((id) => {
    const l = meta.life[id];
    return l?.event && l.public && (l.eventUntil ?? 0) > now && (!since || (l.eventAt ?? 0) > since) ? [`${nameOf(id, meta)}: ${l.event}`] : [];
  });
}
