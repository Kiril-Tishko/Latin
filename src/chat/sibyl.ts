// The Sibyl's leaves (Folia Sibyllae). The Sibyl of Cumae wrote what the god
// told her on leaves and let the wind scatter them (Aeneid III, 443-451). Now
// and then a leaf blows across the page; caught, it holds a prophecy in the
// learner's own Latin, and a day or so later it comes true in a friend's life:
// a fate (`World.fates`) becomes their life at its hour, as a happening does
// (chat/lives.ts), so they live it, tell of it, and the phone routine's brief
// carries it ahead. The message where its person tells of it (a word of the
// prophecy in it: `signs`) gets the leaf's mark. The leaves are kept in the
// Liber Sibyllīnus, the thread «sibylla»: a book, not a chat (kept `gone`, so
// no list, count or routine takes it for a conversation).
import { PEOPLE } from "../content/people";
import { clean, Deps, vetAll } from "./engine";
import { moodText } from "./life";
import { Fate, timelineBlock } from "./lives";
import { Meta, Msg, Thread } from "./model";
import { plainWords } from "./pace";
import { languageBlock, learnerBlock, PromptCtx } from "./prompts";
import { actaKey } from "./acta";

export const SIBYL_ID = "sibylla";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export type { Fate };

/** A leaf ready to fly: its lines, and its fate in hours from the moment it is caught. */
export interface Leaf {
  lines: { la: string; en: string }[];
  who: string;
  en: string;
  mood?: string;
  after: number;
  hours: number;
  public?: boolean;
  signs: string[];
}

/** The leaves kept in the book, oldest first. */
export const leavesOf = (t: Thread): Msg[] => t.messages.filter((m) => m.id.startsWith("folium-")).sort((a, b) => a.at - b.at);

/** Fates still to come, or come and not yet made real by the page. */
export const pendingFates = (meta: Meta) => (meta.world?.fates ?? []).filter((f) => !f.done);

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/**
 * Does a leaf blow on this Roman day: the first one ever soon, then on about
 * two days in five; never twice a day, nor while two fates still wait.
 */
export function leafDay(now: number, leaves: Msg[], meta: Meta): boolean {
  const key = actaKey(now);
  if (leaves.some((m) => m.id === `folium-${key}`)) return false;
  if ((meta.world?.fates ?? []).filter((f) => !f.done || f.at > now).length >= 2) return false;
  return !leaves.length || hash(`folium:${key}`) % 100 < 40;
}

// ------------------------------------------------------------- the leaf

/** What Claude reads to write a leaf: the Sibyl, the friends' lives, what came before, the learner's words. */
export function sibylPrompt(meta: Meta, ctx: PromptCtx, earlier: Fate[]): string {
  const friends = PEOPLE.map((p) => {
    const l = meta.life[p.id];
    const now = l ? `now ${moodText(l)}${l.event && (l.eventUntil ?? 0) > ctx.now ? `; going on: ${l.event}` : ""}` : "";
    return `- ${p.name} (id "${p.id}", ${p.age}, ${p.job}, ${p.city})${now ? `: ${now}` : ""}. ${p.about}`;
  }).join("\n");
  const last = earlier.slice(-5);
  return [
    `You are the Sibyl of Cumae. The god speaks through you, and you write what is to come on a leaf and let the wind carry it (Aeneid III). One leaf has blown to a learner of Latin far away: what it says will come true for one of their five Roman friends below, and the learner will see it happen in their messages. The friends never learn of the leaf.`,
    learnerBlock(ctx),
    ctx.calendar ?? "",
    `THE FIVE FRIENDS:\n${friends}`,
    timelineBlock(meta, undefined, ctx.now),
    last.length ? `EARLIER LEAVES (do not foretell the same again; choose someone else than the last one):\n${last.map((f) => `- for ${PEOPLE.find((p) => p.id === f.who)?.name ?? f.who}: ${f.en}`).join("\n")}` : "",
    `FORETELL ONE THING that will happen to ONE of the five, between 8 and 30 hours from now: concrete and vivid, surprising but possible in their life (it may grow out of what is going on for them, or come out of the blue): a lost thing found, an animal's mischief, an unexpected visitor, letter or gift, a small triumph or a small disaster, a strange coincidence, a rumour, a fall, a quarrel made up. Something they would tell their friends about at once. Never grief, illness, death, cruelty or anything sexual.
THE LEAF: 2 or 3 short lines (3 to 7 words each), in the Sibyl's way: solemn, cryptic, an image of wonder, a riddle that is plain once it has happened. Name the thing (the animal, the object, the place), never the person: point to them by what they are or do (the poet, the farmer, the teacher, the girl who writes…). Only the words and forms of the language rules below; no names of the friends.
"signs": the Latin words of the leaf that name what will happen (one to three nouns, as written in the leaf): the friend will most likely use one of them when they tell of it.`,
    languageBlock(ctx, false),
    `Reply with only JSON:
{"who": "<the friend's id>", "lines": [{"la": "<Latin>", "en": "<English>"}], "fate": "<what will happen to them, in English, one or two plain sentences, as it will be in their life>", "mood": "<their mood when it happens: one or two words>", "after": <hours from now until it happens, 8-30>, "hours": <how many hours it goes on, 6-48>, "public": <true if the neighbours would know of it>, "signs": ["<Latin word>"]}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

interface RawLeaf {
  who?: unknown;
  lines?: { la?: unknown; en?: unknown }[];
  fate?: unknown;
  mood?: unknown;
  after?: unknown;
  hours?: unknown;
  public?: unknown;
  signs?: unknown;
}

const num = (x: unknown, lo: number, hi: number, dflt: number) => Math.max(lo, Math.min(hi, Math.round(Number(x) || dflt)));

/** Claude's leaf, read: a friend, one to three lines, a fate in plain words; nothing when any of it is missing. */
export function leafOf(raw: RawLeaf | null | undefined): Omit<Leaf, "signs"> & { signWords: string[] } | null {
  const who = clean(raw?.who);
  const lines = (Array.isArray(raw?.lines) ? raw!.lines : [])
    .map((l) => ({ la: clean(l?.la), en: clean(l?.en) }))
    .filter((l) => l.la)
    .slice(0, 3);
  const en = clean(raw?.fate).slice(0, 240);
  if (!PEOPLE.some((p) => p.id === who) || !lines.length || !en) return null;
  const mood = clean(raw?.mood).split(/[,;]/)[0].split(/\s+/).slice(0, 3).join(" ").slice(0, 30);
  return {
    who,
    lines,
    en,
    ...(mood ? { mood } : {}),
    after: num(raw?.after, 6, 36, 18),
    hours: num(raw?.hours, 4, 48, 12),
    ...(raw?.public === true ? { public: true } : {}),
    signWords: (Array.isArray(raw?.signs) ? raw!.signs : []).map(clean).filter(Boolean).slice(0, 3),
  };
}

/** The entry ids a text's words can be (any form, any long marks). */
const idsIn = (text: string, lex: Deps["lex"]) => new Set(plainWords(text).flatMap((w) => lex.analyzeLoose(w).map((a) => a.entry.id)));

/**
 * A leaf, written and vetted like the Ācta's lines (one rewrite asked for what
 * slips). Its signs are the words that name what happens; without them, the
 * nouns of its lines.
 */
export async function writeLeaf(meta: Meta, ctx: PromptCtx, deps: Deps): Promise<Leaf | null> {
  const raw = await deps.ask<RawLeaf>(sibylPrompt(meta, ctx, meta.world?.fates ?? []), { ...deps.opts, cache: false });
  const leaf = leafOf(raw);
  if (!leaf) return null;
  const vetted = await vetAll(leaf.lines, ctx, deps, false);
  const lines = vetted.map((d) => ({ la: d.la, en: d.en })).filter((l) => l.la);
  if (!lines.length) return null;
  // the words Claude named, even if a rewrite took one out of the lines; else the nouns of the lines
  let signs = [...idsIn(leaf.signWords.join(" "), deps.lex)];
  if (!signs.length) signs = [...idsIn(lines.map((l) => l.la).join(" "), deps.lex)].filter((id) => deps.lex.byId.get(id)?.kind === "noun");
  const { signWords: _, ...rest } = leaf;
  return { ...rest, lines, signs };
}

/** The leaf as kept in the book, and its fate, once caught at `now`. */
export function keepLeaf(leaf: Leaf, now: number): { msg: Msg; fate: Fate } {
  const id = `folium-${actaKey(now)}`;
  return {
    msg: { id, from: SIBYL_ID, la: leaf.lines.map((l) => l.la).join("\n"), en: leaf.lines.map((l) => l.en).join("\n"), at: now, src: "own" },
    fate: { id, who: leaf.who, en: leaf.en, ...(leaf.mood ? { mood: leaf.mood } : {}), at: now + leaf.after * HOUR, hours: leaf.hours, ...(leaf.public ? { public: true } : {}), signs: leaf.signs },
  };
}

/**
 * Where a fate shows: the first message from its person, once it has come
 * (within two days of it), that has one of its signs in any form.
 */
export function toldIn(f: Fate, threads: Thread[], lex: Deps["lex"]): { chat: string; msg: Msg } | null {
  if (!f.signs.length) return null;
  const end = f.at + Math.max(f.hours * HOUR, DAY) + DAY;
  let best: { chat: string; msg: Msg } | null = null;
  for (const t of threads)
    for (const m of t.messages) {
      if (m.from !== f.who || m.at < f.at || m.at > end || m.deletedAt || (best && best.msg.at <= m.at)) continue;
      const ids = idsIn(m.la, lex);
      if (f.signs.some((s) => ids.has(s))) best = { chat: t.id, msg: m };
    }
  return best;
}

/** Where a leaf stands: its fate still to come, come (and maybe told of), or over with nobody telling (the neighbours do). */
export type LeafState = { state: "waits" } | { state: "told"; chat: string; msg: Msg } | { state: "coming" } | { state: "known"; en: string; who: string };

export function leafState(f: Fate | undefined, threads: Thread[], lex: Deps["lex"], now: number, caught: number): LeafState {
  // a fate long gone from the world (only the newest are kept) came true long ago
  if (!f) return now - caught > 3 * DAY ? { state: "known", en: "", who: "" } : { state: "waits" };
  if (f.at > now) return { state: "waits" };
  const told = toldIn(f, threads, lex);
  if (told && told.msg.at <= now) return { state: "told", ...told };
  // nobody has told of it after a day and a half: the neighbours have heard
  return now - f.at > 36 * HOUR ? { state: "known", en: f.en, who: f.who } : { state: "coming" };
}
