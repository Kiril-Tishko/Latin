// How the people write: an answer to the learner, messages on their own, a
// stranger met at random, and the coach's check of the learner's message.
// Claude writes; every message is then vetted against the learner's words and
// rules (one rewrite is asked for when something slips), long marks are put
// back, and each message gets the moment it arrives (reading, typing, pauses,
// sleep). The sampler is passed in, so tests can play Claude.
import { knownEmojiOnly, withoutEmoji } from "./emoji";
import { PERSON_BY_ID } from "../content/people";
import { Lexicon } from "../latin/analyze";
import { checkAnswer, literalReading } from "../latin/facts";
import { PHOTO_BY_ID, photoSrc } from "../content/photos";
import { Life, LifeSpec, lifeNow, Rand, replyTiming, statusAt, typingTime } from "./life";
import { awayNow, groupIds, iBlocked, isBlocked, isGroupId, Meta, MOMENTS, Msg, msgId, Pic, REACTIONS, Thread, membersOf, silentNow, Who } from "./model";
import { allowOwn, paceOf } from "./pace";
import { natureOf } from "./nature";
import { MemoryDraft, memoriesOf, Tell, tellsOf } from "./mind";
import { applyBondChanges, applyTieChanges, BondChange, bondChangesOf, TieChange, tieChangesOf } from "./bond";
import { applyGoalChanges, applyHappen, GoalChange, goalChangesOf, Happen, happensOf, heavyOk, noteHappening } from "./lives";
import { groupCaps, sceneBlock, sceneOf } from "./group";
import { photoHabits, withLooks } from "./pictures";
import { allPeople, Deeds, deedsOf, noDeeds } from "./world";
import { checkPrompt, ownPrompt, PromptCtx, repairPrompt, replyPrompt, shownMessages, storyPersonPrompt, strangerPrompt } from "./prompts";
import { inventStranger, NewPerson, rollStranger, Stranger } from "./strangers";
import { vetMessage, withMacrons } from "./vet";

const plainWord = (w: string) => w.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Asks Claude for JSON (the page's sample.json, or a test's stand-in). */
export type AskJson = <T>(prompt: string, opts: Record<string, unknown>) => Promise<T>;

export interface Deps {
  ask: AskJson;
  /** The chat model's options (tier and effort). */
  opts: Record<string, unknown>;
  /** The coach's options, for checks. */
  coach?: Record<string, unknown>;
  lex: Lexicon;
  r?: Rand;
}

// ------------------------------------------------------------- lives

export function specOf(id: string, meta: Meta): LifeSpec | null {
  const p = PERSON_BY_ID.get(id);
  if (p) return p;
  const s = meta.strangers[id];
  return s ? { moods: s.moods, swing: s.swing, happenings: s.happenings } : null;
}

/**
 * Rolls on the lives of these people where it is time (a heavy happening only
 * after a calm week: chat/lives.ts); a happening that begins goes on the
 * timeline when it matters, may bring a want, and is remembered (into `out`,
 * for the minds). True if anything changed.
 */
export function refreshLives(meta: Meta, ids: string[], now: number, r: Rand = Math.random, out?: MemoryDraft[]): boolean {
  let changed = false;
  for (const id of ids) {
    const spec = specOf(id, meta);
    if (!spec) continue;
    const { life, changed: c, started } = lifeNow(spec, meta.life[id], now, r, heavyOk(meta, id, now));
    if (c) {
      meta.life[id] = life;
      changed = true;
      if (started) out?.push(...noteHappening(meta, id, started, now));
    }
  }
  return changed;
}

// ------------------------------------------------------------- vetting

interface Draft {
  from?: string;
  la: string;
  en: string;
  voice?: boolean;
  photo?: string;
  /** A fresh picture to make: what it shows (English). */
  picture?: string;
  re?: string;
  /** New words in a strong moment, with their meanings. */
  gloss?: Record<string, string>;
  /** Taken back this many seconds after sending. */
  unsend?: number;
}

/** A message's new words and their meanings, as Claude gave them (a few, short). */
export function glossOf(x: unknown): Record<string, string> | undefined {
  if (!x || typeof x !== "object" || Array.isArray(x)) return undefined;
  const out = Object.fromEntries(
    Object.entries(x as Record<string, unknown>)
      .map(([w, m]) => [clean(w).slice(0, 30), clean(m).slice(0, 80)])
      .filter(([w, m]) => /^\p{L}+$/u.test(w) && m)
      .slice(0, 3),
  );
  return Object.keys(out).length ? out : undefined;
}

/** What the phone routine says the people of a chat remember of a message of theirs, and what someone told someone: checked like a reply's. */
export function routineMinds(x: { remember?: unknown; tell?: unknown }, chat: string, meta: Meta): { memories: MemoryDraft[]; tells: Tell[] } {
  const everyone = allPeople(meta);
  return { memories: memoriesOf({ remember: x.remember }, membersOf(chat, meta).map((w) => w.id), everyone), tells: tellsOf(x.tell, everyone, everyone) };
}

/** A message taken back after this many seconds (a slip, regret), within reason. */
const unsendOf = (x: unknown) => {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? Math.max(2, Math.min(600, n)) : undefined;
};

/**
 * A voice message, a photo or a fresh picture, as Claude marked them (a photo
 * only if it exists; a picture only when pictures may be made now; a caption
 * may be empty).
 */
function extras(m: { voice?: unknown; photo?: unknown; picture?: unknown }, canMake = false): { voice?: true; photo?: string; picture?: string } {
  const photo = typeof m.photo === "string" && PHOTO_BY_ID.has(m.photo) && photoSrc(m.photo) ? m.photo : undefined;
  const picture = !photo && canMake ? clean(m.picture).slice(0, 400) || undefined : undefined;
  return { ...(m.voice === true && !photo && !picture ? { voice: true as const } : {}), ...(photo ? { photo } : {}), ...(picture ? { picture } : {}) };
}

/** A picture to be made for a message: its id goes on the message, the rest waits in messenger/pics until it is made. */
export const picId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
/** A fresh picture to make: what it shows, as Claude said, and the prompt with the looks of the people in it (chat/pictures.ts). */
const wanted = (d: { from?: string; picture?: string }, at: number, id: string, meta: Meta): Pic => ({ id, by: d.from ?? "", en: d.picture!, prompt: withLooks(d.picture!, d.from ?? "", meta), status: "wanted", at });

/** The message fields of a vetted draft: its Latin and English, a voice message, photo or picture, the words that slipped. */
const fields = (d: Draft & { newWords?: string[] }, pic?: string) => ({ la: d.la, en: d.en, ...(d.voice ? { voice: true } : {}), ...(d.photo ? { photo: d.photo } : {}), ...(pic ? { pic, picEn: d.picture } : {}), ...(d.re ? { re: d.re } : {}), ...(d.newWords ? { newWords: d.newWords } : {}), ...(d.gloss ? { gloss: d.gloss } : {}) });

/** When a message sent at `at` is taken back, if it is. */
const deletedAtOf = (d: Draft, at: number) => (d.unsend ? { deletedAt: at + d.unsend * 1000 } : {});

/** A reaction as Claude wrote it, made one of REACTIONS ("❤" is "❤️"), or null. */
export function reactionEmoji(x: unknown): string | null {
  const bare = (e: string) => e.replace(/\uFE0F/g, "");
  const e = bare(String(x ?? "").trim());
  return REACTIONS.find((r) => bare(r) === e) ?? null;
}

// (a Roman emoji code Claude made up is dropped)
export const clean = (s: unknown) => knownEmojiOnly(String(s ?? "").replace(/\s+/g, " ").trim());

/**
 * Vets drafts; asks once for the ones that slipped to be written again; what
 * still slips is kept with its unknown words marked (better than a hole in the
 * conversation).
 */
export async function vetAll<T extends Draft>(drafts: T[], ctx: PromptCtx, deps: Deps, texting = true): Promise<(T & { newWords?: string[] })[]> {
  const out: (T & { newWords?: string[] })[] = drafts.map((d) => ({ ...d, la: withMacrons(clean(d.la), deps.lex), en: clean(d.en) }));
  // one or two new words a person used in a strong moment, each with its meaning, are theirs to use
  const glossed = (d: T, v: ReturnType<typeof vetMessage>) =>
    !!d.gloss && v.unknown.length <= 2 && v.issues.length === 1 && v.unknown.every((w) => Object.keys(d.gloss!).some((g) => plainWord(g) === plainWord(w)));
  const bad = out.map((d, i) => ({ i, v: vetMessage(d.la, deps.lex, ctx.seen) })).filter((x) => !x.v.ok && out[x.i].la && !glossed(out[x.i], x.v));
  if (bad.length) {
    try {
      const fixed = await deps.ask<{ messages?: { la?: string; en?: string }[] }>(
        repairPrompt(bad.map((b) => ({ la: out[b.i].la, en: out[b.i].en, issues: b.v.issues })), ctx, texting),
        { ...deps.opts, effort: "low", cache: false },
      );
      bad.forEach((b, k) => {
        const f = fixed?.messages?.[k];
        if (!f?.la) return;
        const la = withMacrons(clean(f.la), deps.lex);
        const v = vetMessage(la, deps.lex, ctx.seen);
        // take the rewrite when it is better than the first try
        if (v.ok || v.issues.length < b.v.issues.length) out[b.i] = { ...out[b.i], la, en: clean(f.en) || out[b.i].en };
      });
    } catch {
      /* no rewrite: keep what there is */
    }
  }
  for (const d of out) {
    const v = vetMessage(d.la, deps.lex, ctx.seen);
    if (v.unknown.length) d.newWords = v.unknown;
  }
  return out;
}

// --------------------------------------------------------------- replies

/** What a conversation did to someone: their feelings about the learner, a moment to remember, the silent treatment (hours; 0 ends it). */
export interface Feeling {
  feel?: string;
  moment?: string;
  silent?: number;
}

export interface Reply {
  messages: Msg[];
  /** What each will remember of it (chat/mind.ts), and memories now done or no longer true. */
  memories: MemoryDraft[];
  settled: string[];
  outdated: string[];
  /** How the conversation moved each person: feelings about the learner, and moods. */
  feelings: Record<string, Feeling>;
  moods: Record<string, string>;
  /** Where they stand with the learner, and how they see each other, as it moved (chat/bond.ts). */
  bonds: BondChange[];
  ties: TieChange[];
  /** What moved in their lives: goals, and things that happen (chat/lives.ts). */
  goals: GoalChange[];
  happen: Happen[];
  /** What they did besides writing (see world.ts). */
  deeds: Deeds;
  /** When the learner's messages were read (one-to-one chats). */
  readAt: number;
  /** Reactions to the learner's last message, each shown a moment after its person reads it. */
  reactions: { msg: string; from: string; e: string; at: number }[];
  /** Fresh pictures the messages carry, to be made. */
  made: Pic[];
  /** What the learner's newest photo shows, as they saw it. */
  saw?: string;
}

export type Timing = ReturnType<typeof timingFor>;

/** When the people of a thread read what the learner wrote now: the first reader of the group, or the one person. */
export function timingFor(members: Who[], now: number, r: Rand = Math.random, meta?: Meta) {
  const all = members.map((w) => {
    const t = replyTiming(w.day, w.tz, now, r);
    // away (travelling, vanished): they read it much later, at the latest when they are back
    const away = meta ? awayNow(meta, w.id, now) : undefined;
    if (!away) return { w, t };
    const readAt = Math.max(t.readAt, Math.min(away.until + 30 * 60_000, now + (2 + r() * 10) * 3600_000));
    return { w, t: { readAt, startAt: readAt + 20_000 + r() * 120_000, why: `they are away (${away.where}) and read it much later` } };
  });
  all.sort((a, b) => a.t.readAt - b.t.readAt);
  return { first: all[0], byId: new Map(all.map((x) => [x.w.id, x.t])) };
}

/** The people's answer to what the learner wrote (the last messages of the thread). */
export async function writeReply(thread: Thread, meta: Meta, ctx: PromptCtx, deps: Deps, timing?: Timing, images?: unknown[]): Promise<Reply> {
  const r = deps.r ?? Math.random;
  const members = membersOf(thread.id, meta);
  if (!members.length) return { messages: [], memories: [], settled: [], outdated: [], readAt: ctx.now, reactions: [], feelings: {}, moods: {}, bonds: [], ties: [], goals: [], happen: [], deeds: noDeeds(), made: [] };
  const lived: MemoryDraft[] = [];
  refreshLives(meta, members.map((w) => w.id), ctx.now, r, lived);
  const { first, byId } = timing ?? timingFor(members, ctx.now, r, meta);
  // the learner's last messages, read word by word: a mistake is taken literally
  const burst: string[] = [];
  for (const m of [...thread.messages].reverse()) {
    if (m.from !== "me") break;
    burst.unshift(m.la);
  }
  const literal = burst.length ? literalReading(withoutEmoji(burst.join(" ")), deps.lex) : "";
  // a group: who is around now, who reads it later, whom the learner named, who is likely to answer (chat/group.ts)
  const scene = isGroupId(thread.id, meta) && members.length > 1 ? sceneOf(members, meta, ctx.now, byId, burst.join(" "), r) : undefined;
  const prompt = replyPrompt(thread, meta, ctx, { at: first.t.startAt, why: first.t.why }, literal, scene ? sceneBlock(scene, members, byId, meta) : "");
  const raw = await deps.ask<{
    messages?: { from?: string; la?: string; en?: string; gap?: number; re?: unknown; voice?: unknown; photo?: unknown; picture?: unknown; gloss?: unknown; unsend?: unknown }[];
    react?: { from?: string; emoji?: string }[];
    remember?: unknown;
    settled?: unknown;
    outdated?: unknown;
    tell?: unknown;
    saw?: unknown;
    feel?: Record<string, unknown>;
    moment?: Record<string, unknown>;
    mood?: Record<string, unknown>;
    silent?: Record<string, unknown>;
    bond?: unknown;
    levels?: unknown;
    ties?: unknown;
    goals?: unknown;
    happen?: unknown;
    acts?: unknown;
    drama?: unknown;
    newPerson?: unknown;
  }>(prompt, { ...deps.opts, cache: false, ...(images?.length ? { images } : {}) });
  const ids = new Set(members.map((w) => w.id));
  const fromOf = (x: unknown) => (ids.has(String(x)) ? String(x) : members.length === 1 ? members[0].id : "");
  // "re": the number of a message in the conversation the prompt showed (a quote of the very last one says nothing)
  const shown = shownMessages(thread, ctx.now);
  const reOf = (n: unknown) => {
    const i = Number(n);
    return Number.isInteger(i) && i >= 1 && i < shown.length ? shown[i - 1].id : undefined;
  };
  // each says as much as is theirs to say (Gāius two messages at most, Marcus four); a group's answer, a few people's
  const said = new Map<string, number>();
  const drafts = (raw?.messages ?? [])
    .map((m) => ({ from: fromOf(m.from), la: clean(m.la), en: clean(m.en), gap: Number(m.gap) || 2, re: reOf(m.re), gloss: glossOf(m.gloss), unsend: unsendOf(m.unsend), ...extras(m, ctx.canMake) }))
    .filter((m) => {
      if (!m.from || !(m.la || m.photo || m.picture)) return false;
      const n = (said.get(m.from) ?? 0) + 1;
      said.set(m.from, n);
      return n <= (natureOf(m.from, meta)?.burst ?? 4);
    });
  // a few messages for the live talk; someone catching up later has their own limit (groupCaps), not counted here
  let live = 0;
  const capped = drafts.filter((m) => scene?.later.includes(m.from) || ++live <= (members.length > 1 ? 8 : 5));
  // photos by each sender's habit (what they sent here and in the group counts)
  const kept = photoHabits(scene ? groupCaps(capped, scene, meta) : capped, meta, [thread, ...(ctx.group && ctx.group.id !== thread.id ? [ctx.group] : [])], ctx.now);
  const vetted = await vetAll(kept, ctx, deps);
  // each message arrives after the one before it: a pause, then the typing; a sleeper answers when awake.
  // In a group, someone not around catches up on their own time, without holding up the others.
  let t = first.t.startAt;
  const own = new Map<string, number>();
  const made: Pic[] = [];
  const messages: Msg[] = vetted.map((d) => {
    const when = byId.get(d.from!);
    const step = Math.min(40, Math.max(0, d.gap)) * 1000 + typingTime(d.la);
    if (scene?.later.includes(d.from!)) {
      const at = Math.max(own.get(d.from!) ?? 0, when?.startAt ?? t) + step;
      own.set(d.from!, at);
      const pic = d.picture && !made.length ? picId() : undefined;
      if (pic) made.push(wanted(d, ctx.now, pic, meta));
      return { id: msgId(), from: d.from!, at: Math.round(at), src: "reply", ...fields(d, pic), ...deletedAtOf(d, Math.round(at)) };
    }
    t = Math.max(t, when?.startAt ?? t) + step;
    // a fresh picture: one a reply at most
    const pic = d.picture && !made.length ? picId() : undefined;
    if (pic) made.push(wanted(d, ctx.now, pic, meta));
    return { id: msgId(), from: d.from!, at: Math.round(t), src: "reply", ...fields(d, pic), ...deletedAtOf(d, Math.round(t)) };
  });
  // what each will remember (only the people of this chat), and memories now done or no longer true
  const memories = [...lived, ...memoriesOf(raw ?? {}, members.map((w) => w.id), allPeople(meta))];
  // reactions to the learner's last message: one per person, a moment after they read it
  const target = [...thread.messages].reverse().find((m) => m.from === "me");
  const reactions: Reply["reactions"] = [];
  for (const x of Array.isArray(raw?.react) ? raw.react : []) {
    const from = fromOf(x?.from);
    const e = reactionEmoji(x?.emoji);
    if (!target || !from || !e || reactions.some((y) => y.from === from)) continue;
    reactions.push({ msg: target.id, from, e, at: Math.round((byId.get(from)?.readAt ?? first.t.readAt) + 1500 + r() * 4000) });
  }
  // what they did besides writing: blocking, leaving, renaming, travelling, new people, storylines
  const deeds = deedsOf(raw ?? {}, ids, allPeople(meta), shown, new Set(groupIds(meta)));
  const saw = images?.length ? clean(raw?.saw).slice(0, 200) || undefined : undefined;
  return { messages: messages.filter((m) => m.la || m.photo || m.pic), memories, settled: idsOf(raw?.settled), outdated: idsOf(raw?.outdated), readAt: first.t.readAt, reactions, ...feelingsOf(raw ?? {}, ids), bonds: bondChangesOf(raw ?? {}, ids), ties: tieChangesOf(raw?.ties, ids, allPeople(meta)), goals: goalChangesOf(raw?.goals, ids), happen: happensOf(raw?.happen, allPeople(meta)), deeds, made, ...(saw ? { saw } : {}) };
}

/** Memory ids Claude gave (to settle or outdate), checked. */
export const idsOf = (x: unknown): string[] => (Array.isArray(x) ? x : []).map((v) => String(v ?? "")).filter((v) => /^k[0-9a-z]{2,12}$/.test(v)).slice(0, 8);

/** The feelings, moods and silences Claude reported, for the people of the thread only (moments are memories now: chat/mind.ts). */
export function feelingsOf(
  raw: { feel?: Record<string, unknown>; moment?: Record<string, unknown>; mood?: Record<string, unknown>; silent?: Record<string, unknown> },
  ids: Set<string>,
): Pick<Reply, "feelings" | "moods"> {
  const feelings: Record<string, Feeling> = {};
  const moods: Record<string, string> = {};
  const obj = (x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {});
  const of = (id: string) => (feelings[id] ??= {});
  for (const [id, v] of Object.entries(obj(raw.feel))) if (ids.has(id) && clean(v)) of(id).feel = clean(v).slice(0, 400);
  for (const [id, v] of Object.entries(obj(raw.silent))) {
    const h = Number(v);
    if (ids.has(id) && Number.isFinite(h) && h >= 0) of(id).silent = Math.min(24, h);
  }
  for (const [id, v] of Object.entries(obj(raw.mood))) if (ids.has(id) && clean(v)) moods[id] = clean(v).slice(0, 40);
  return { feelings, moods };
}

/** A day as the people say it in their memories: "12 Oct". */
const dayStamp = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/Rome" });

/**
 * Keeps what a conversation did to the people: their feelings about the
 * learner (in their own words, and as levels: chat/bond.ts), how they see each
 * other, the silent treatment, a mood that lasts a few hours, their goals, and
 * what happens to them because of it (chat/lives.ts). Changes meta in place;
 * returns the memories the happenings leave.
 */
export function applyFeelings(meta: Meta, r: Pick<Reply, "feelings" | "moods"> & Partial<Pick<Reply, "bonds" | "ties" | "goals" | "happen">>, now: number): MemoryDraft[] {
  applyBondChanges(meta, r.bonds ?? [], now);
  applyTieChanges(meta, r.ties ?? [], now);
  applyGoalChanges(meta, r.goals ?? [], now);
  const bonds = { ...(meta.bonds ?? {}) };
  for (const [id, f] of Object.entries(r.feelings)) {
    const old = bonds[id] ?? { feel: "", moments: [], updatedAt: 0 };
    const silentUntil = f.silent === undefined ? old.silentUntil : f.silent > 0 ? now + f.silent * 3600_000 : undefined;
    const { silentUntil: _, ...rest } = old;
    bonds[id] = {
      ...rest,
      feel: f.feel || old.feel,
      moments: f.moment ? [...old.moments, `${dayStamp(now)}: ${f.moment}`].slice(-MOMENTS) : old.moments,
      ...(silentUntil ? { silentUntil } : {}),
      updatedAt: now,
    };
  }
  meta.bonds = bonds;
  for (const [id, mood] of Object.entries(r.moods)) {
    const life = meta.life[id];
    if (life) meta.life[id] = { ...life, mood, level: "", moodUntil: now + 4 * 3600_000 };
  }
  // what happens because of it (after the moods: a happening brings its own)
  return applyHappen(meta, r.happen ?? [], now);
}

// -------------------------------------------------------- on their own

export interface Own {
  chat: string;
  msg: Msg;
}

/** What the people write on their own in the next hours (written now, each shown at its moment). */
export async function writeOwn(threads: Thread[], meta: Meta, ctx: PromptCtx, deps: Deps, hours = 3): Promise<{ messages: Own[]; deeds: Deeds; made: Pic[]; memories: MemoryDraft[]; settled: string[]; outdated: string[] }> {
  const r = deps.r ?? Math.random;
  const live = threads.filter((t) => !t.gone);
  const lived: MemoryDraft[] = [];
  refreshLives(meta, [...new Set(live.flatMap((t) => membersOf(t.id, meta).map((w) => w.id)))], ctx.now, r, lived);
  const raw = await deps.ask<{
    messages?: { chat?: string; from?: string; la?: string; en?: string; in?: number; voice?: unknown; photo?: unknown; picture?: unknown; gloss?: unknown; unsend?: unknown }[];
    feel?: Record<string, unknown>;
    moment?: Record<string, unknown>;
    remember?: unknown;
    settled?: unknown;
    outdated?: unknown;
    bond?: unknown;
    levels?: unknown;
    ties?: unknown;
    goals?: unknown;
    happen?: unknown;
    acts?: unknown;
    drama?: unknown;
    newPerson?: unknown;
    tell?: unknown;
  }>(
    ownPrompt(live, meta, ctx, hours),
    { ...deps.opts, cache: false },
  );
  // feelings move while the learner is away too (missing them, cooling off)
  const everyone = new Set(live.flatMap((t) => membersOf(t.id, meta).map((w) => w.id)));
  const happened = applyFeelings(
    meta,
    { ...feelingsOf({ feel: raw?.feel }, everyone), bonds: bondChangesOf(raw ?? {}, everyone), ties: tieChangesOf(raw?.ties, everyone, allPeople(meta)), goals: goalChangesOf(raw?.goals, everyone), happen: happensOf(raw?.happen, allPeople(meta)) },
    ctx.now,
  );
  const memories = [...lived, ...happened, ...memoriesOf({ remember: raw?.remember, moment: raw?.moment }, [...everyone], allPeople(meta))];
  // what they do besides writing; someone unblocking the learner now may write to them again
  const deeds = deedsOf(raw ?? {}, allPeople(meta), allPeople(meta), [], new Set(groupIds(meta)));
  const unblocking = new Set(deeds.acts.filter((a) => a.do === "unblock").map((a) => a.who));
  const byChat = new Map(live.map((t) => [t.id, t]));
  // each chat as it will be, message by message: a new burst must be allowed by the person's pace or the group's rhythm
  const sim = new Map<string, Thread>();
  const drafts = (raw?.messages ?? [])
    .map((m) => ({ chat: String(m.chat ?? ""), from: String(m.from ?? ""), la: clean(m.la), en: clean(m.en), in: Math.max(0, Math.min(hours * 60, Number(m.in) || 0)), gloss: glossOf(m.gloss), unsend: unsendOf(m.unsend), ...extras(m, ctx.canMake) }))
    .sort((a, b) => a.in - b.in)
    .filter((m) => {
      const orig = byChat.get(m.chat);
      const t = sim.get(m.chat) ?? orig;
      if (!t || !orig || !(m.la || m.photo || m.picture)) return false;
      // never into a chat with messages still on their way; only its own people; only someone awake then
      if (orig.messages.some((x) => x.from !== "me" && x.at > ctx.now)) return false;
      const member = membersOf(t.id, meta).find((w) => w.id === m.from);
      if (!member) return false;
      const at = ctx.now + m.in * 60000;
      const group = isGroupId(t.id, meta);
      // the silent treatment: not a word to the learner in private (in the group they may still talk)
      if (!group && silentNow(meta.bonds?.[member.id], at)) return false;
      // blocked: nothing reaches the learner in private, unless they unblock them now
      if (!group && isBlocked(meta, member.id) && !unblocking.has(member.id)) return false;
      // blocked by the learner: what they send in private never arrives
      if (!group && iBlocked(meta, member.id)) return false;
      if (statusAt(member.day, member.tz, at).state === "asleep") return false;
      // like real people: when the learner does not answer, they wait; nobody repeats themselves
      if (!allowOwn(t, member.id, m, at, paceOf(member.id, meta, at), group, natureOf(member.id, meta)?.burst).ok) return false;
      sim.set(t.id, { ...t, messages: [...t.messages, { id: "planned", from: member.id, la: m.la, at, src: "own", ...(m.photo ? { photo: m.photo } : {}) }] });
      return true;
    })
    .slice(0, 10);
  // photos by each sender's habit, across all their chats
  const vetted = await vetAll(photoHabits(drafts, meta, live, ctx.now), ctx, deps);
  const last = new Map<string, number>();
  const made: Pic[] = [];
  const messages = vetted.map((d) => {
    // a burst stays in order: each message after the one before
    let at = ctx.now + d.in * 60000 + Math.round(r() * 20000);
    at = Math.max(at, (last.get(d.chat) ?? 0) + typingTime(d.la));
    last.set(d.chat, at);
    // fresh pictures: two at most in a turn
    const pic = d.picture && made.length < 2 ? picId() : undefined;
    if (pic) made.push(wanted(d, ctx.now, pic, meta));
    return { chat: d.chat, msg: { id: msgId(), from: d.from, at, src: "own" as const, ...fields(d, pic), ...deletedAtOf(d, at) } };
  });
  return { messages: messages.filter((x) => x.msg.la || x.msg.photo || x.msg.pic), deeds, made, memories, settled: idsOf(raw?.settled), outdated: idsOf(raw?.outdated) };
}

// ------------------------------------------------------------ strangers

/** What Claude said of someone's look, love and interests (chat/nature.ts), checked. */
export function naturePartsOf(raw: { look?: unknown; romance?: unknown; interests?: unknown } | undefined): Pick<Stranger, "look" | "romance" | "interests"> {
  const look = clean(raw?.look).slice(0, 300);
  const romance = clean(raw?.romance).slice(0, 300);
  const interests = (Array.isArray(raw?.interests) ? raw!.interests : []).map(clean).filter(Boolean).map((x) => x.slice(0, 80)).slice(0, 6);
  return { ...(look ? { look } : {}), ...(romance ? { romance } : {}), ...(interests.length ? { interests } : {}) };
}

/** Someone random: the dice roll who they are, Claude makes them real (and maybe they write first). */
export async function meetStranger(meta: Meta, ctx: PromptCtx, deps: Deps): Promise<{ stranger: Stranger; first: Msg[]; life: Life }> {
  const r = deps.r ?? Math.random;
  const used = Object.values(meta.strangers);
  const s = rollStranger(r, { names: used.map((x) => x.name), portraits: used.map((x) => x.portrait) }, ctx.now);
  // their mood and what is going on, before Claude meets them (common happenings until they have their own)
  const { life } = lifeNow({ moods: s.moods, swing: s.swing, happenings: [] }, undefined, ctx.now, r);
  const raw = await deps.ask<{ about?: string; secret?: string; feel?: string; look?: unknown; romance?: unknown; interests?: unknown; happenings?: { en?: string; mood?: string; hours?: number[] }[]; first?: { la?: string; en?: string; gap?: number }[] }>(
    strangerPrompt(s, life, ctx),
    { ...deps.opts, cache: false },
  );
  s.about = clean(raw?.about) || undefined;
  s.secret = clean(raw?.secret) || undefined;
  s.first = clean(raw?.feel) || undefined;
  Object.assign(s, naturePartsOf(raw));
  s.happenings = (raw?.happenings ?? [])
    .map((h) => ({ en: clean(h.en), mood: clean(h.mood) || undefined, hours: [Number(h.hours?.[0]) || 4, Number(h.hours?.[1]) || 24] as [number, number] }))
    .filter((h) => h.en)
    .slice(0, 6);
  const drafts = s.writesFirst ? (raw?.first ?? []).map((m) => ({ from: s.id, la: clean(m.la), en: clean(m.en), gap: Number(m.gap) || 2 })).filter((m) => m.la).slice(0, 3) : [];
  const vetted = await vetAll(drafts, ctx, deps);
  let t = ctx.now + 1500;
  const first: Msg[] = vetted.map((d) => {
    t += Math.min(20, d.gap) * 1000 + typingTime(d.la);
    return { id: msgId(), from: s.id, la: d.la, en: d.en, at: t, src: "first", ...(d.newWords ? { newWords: d.newWords } : {}) };
  });
  return { stranger: s, first, life };
}

/**
 * Someone from the story the learner wants to write to (Tertia, Iūlia's
 * sister; Marcus's landlord; "the man who stole Gāius's pig"): Claude makes
 * them real from everything the story holds, and they wait for the learner's
 * first message. Their face, day and time zone come from the dice.
 */
export async function meetFromStory(text: string, meta: Meta, ctx: PromptCtx, deps: Deps): Promise<{ existing: string } | { stranger: Stranger; life: Life }> {
  const r = deps.r ?? Math.random;
  const raw = await deps.ask<Record<string, unknown>>(storyPersonPrompt(text, meta, ctx), { ...deps.opts, cache: false });
  // someone the learner already has a chat with
  const existing = String(raw?.existing ?? "");
  if (existing && (PERSON_BY_ID.has(existing) || meta.strangers[existing])) return { existing };
  const link = raw?.link as { to?: unknown; how?: unknown } | undefined;
  const to = String(link?.to ?? "");
  const spec: NewPerson = {
    name: clean(raw?.name).slice(0, 30),
    g: raw?.g === "f" ? "f" : "m",
    age: Math.max(5, Math.min(99, Number(raw?.age) || 30)),
    job: clean(raw?.job).slice(0, 80) || "lives in Rome",
    city: clean(raw?.city).slice(0, 60) || "Rome",
    about: clean(raw?.about).slice(0, 500),
    ...(PERSON_BY_ID.has(to) ? { link: { to, how: clean(link?.how).slice(0, 160) } } : {}),
    ...(clean(raw?.first) ? { first: clean(raw?.first).slice(0, 300) } : {}),
  };
  if (!/^\p{Lu}\p{L}+$/u.test(spec.name)) throw Object.assign(new Error("no one"), { code: "no_person" });
  const used = Object.values(meta.strangers);
  const same = used.find((x) => x.name === spec.name) ?? [...PERSON_BY_ID.values()].find((p) => p.name === spec.name);
  if (same) return { existing: same.id };
  const taken = [...used.map((s) => s.name), ...[...PERSON_BY_ID.values()].map((p) => p.name)];
  const s = inventStranger(spec, r, { names: taken, portraits: used.map((x) => x.portrait) }, ctx.now);
  s.secret = clean(raw?.secret) || undefined;
  Object.assign(s, naturePartsOf(raw));
  s.happenings = (Array.isArray(raw?.happenings) ? (raw.happenings as { en?: unknown; mood?: unknown; hours?: unknown[] }[]) : [])
    .map((h) => ({ en: clean(h?.en), mood: clean(h?.mood) || undefined, hours: [Number(h?.hours?.[0]) || 4, Number(h?.hours?.[1]) || 24] as [number, number] }))
    .filter((h) => h.en)
    .slice(0, 6);
  const { life } = lifeNow({ moods: s.moods, swing: s.swing, happenings: s.happenings }, undefined, ctx.now, r);
  return { stranger: { ...s, invented: true, story: true }, life };
}

// ---------------------------------------------------------------- checks

/** What the engine itself sees in the learner's message: unknown words and grammar slips. */
/** What the grammar engine finds wrong in a draft (words the learner has not learned are fine: the coach judges Latin, not vocabulary). */
export function engineNotes(draft: string, lex: Lexicon): string[] {
  return checkAnswer(`«${withoutEmoji(draft)}»`, lex)
    .filter((f) => f.kind !== "spelling")
    .map((f) => f.message.replace(/«|»/g, ""));
}

export async function checkDraft(draft: string, thread: Thread, meta: Meta, ctx: PromptCtx, deps: Deps): Promise<NonNullable<Msg["check"]>> {
  const out = await deps.ask<{ verdict?: string; better?: string; note?: string }>(checkPrompt(draft, thread, meta, ctx, engineNotes(draft, deps.lex)), { ...(deps.coach ?? deps.opts), cache: false });
  const verdict = out?.verdict === "good" || out?.verdict === "almost" || out?.verdict === "wrong" || out?.verdict === "say" ? out.verdict : "almost";
  const better = clean(out?.better);
  return { verdict, ...(better && verdict !== "good" ? { better: withMacrons(better, deps.lex) } : {}), note: clean(out?.note) };
}
