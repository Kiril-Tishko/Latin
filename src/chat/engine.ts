// How the people write: an answer to the learner, messages on their own, a
// stranger met at random, and the coach's check of the learner's message.
// Claude writes; every message is then vetted against the learner's words and
// rules (one rewrite is asked for when something slips), long marks are put
// back, and each message gets the moment it arrives (reading, typing, pauses,
// sleep). The sampler is passed in, so tests can play Claude.
import { knownEmojiOnly, withoutEmoji } from "./emoji";
import { GROUP, PERSON_BY_ID } from "../content/people";
import { Lexicon } from "../latin/analyze";
import { checkAnswer, literalReading } from "../latin/facts";
import { PHOTO_BY_ID, photoSrc } from "../content/photos";
import { Life, LifeSpec, lifeNow, Rand, replyTiming, statusAt, typingTime } from "./life";
import { Meta, Msg, msgId, Thread, membersOf, Who } from "./model";
import { checkPrompt, ownPrompt, PromptCtx, repairPrompt, replyPrompt, strangerPrompt } from "./prompts";
import { rollStranger, Stranger } from "./strangers";
import { vetMessage, withMacrons } from "./vet";

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

/** Rolls on the lives of these people where it is time; true if anything changed. */
export function refreshLives(meta: Meta, ids: string[], now: number, r: Rand = Math.random): boolean {
  let changed = false;
  for (const id of ids) {
    const spec = specOf(id, meta);
    if (!spec) continue;
    const { life, changed: c } = lifeNow(spec, meta.life[id], now, r);
    if (c) {
      meta.life[id] = life;
      changed = true;
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
}

/** A voice message and a photo, as Claude marked them (a photo only if it exists; a caption may be empty). */
function extras(m: { voice?: unknown; photo?: unknown }): { voice?: true; photo?: string } {
  const photo = typeof m.photo === "string" && PHOTO_BY_ID.has(m.photo) && photoSrc(m.photo) ? m.photo : undefined;
  return { ...(m.voice === true && !photo ? { voice: true as const } : {}), ...(photo ? { photo } : {}) };
}

/** The message fields of a vetted draft: its Latin and English, a voice message or photo, the words that slipped. */
const fields = (d: Draft & { newWords?: string[] }) => ({ la: d.la, en: d.en, ...(d.voice ? { voice: true } : {}), ...(d.photo ? { photo: d.photo } : {}), ...(d.newWords ? { newWords: d.newWords } : {}) });

// (a Roman emoji code Claude made up is dropped)
const clean = (s: unknown) => knownEmojiOnly(String(s ?? "").replace(/\s+/g, " ").trim());

/**
 * Vets drafts; asks once for the ones that slipped to be written again; what
 * still slips is kept with its unknown words marked (better than a hole in the
 * conversation).
 */
export async function vetAll<T extends Draft>(drafts: T[], ctx: PromptCtx, deps: Deps): Promise<(T & { newWords?: string[] })[]> {
  const out: (T & { newWords?: string[] })[] = drafts.map((d) => ({ ...d, la: withMacrons(clean(d.la), deps.lex), en: clean(d.en) }));
  const bad = out.map((d, i) => ({ i, v: vetMessage(d.la, deps.lex, ctx.seen) })).filter((x) => !x.v.ok && out[x.i].la);
  if (!bad.length) return out;
  try {
    const fixed = await deps.ask<{ messages?: { la?: string; en?: string }[] }>(
      repairPrompt(bad.map((b) => ({ la: out[b.i].la, en: out[b.i].en, issues: b.v.issues })), ctx),
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
  for (const d of out) {
    const v = vetMessage(d.la, deps.lex, ctx.seen);
    if (v.unknown.length) d.newWords = v.unknown;
  }
  return out;
}

// --------------------------------------------------------------- replies

export interface Reply {
  messages: Msg[];
  remember: string[];
  /** When the learner's messages were read (one-to-one chats). */
  readAt: number;
}

export type Timing = ReturnType<typeof timingFor>;

/** When the people of a thread read what the learner wrote now: the first reader of the group, or the one person. */
export function timingFor(members: Who[], now: number, r: Rand = Math.random) {
  const all = members.map((w) => ({ w, t: replyTiming(w.day, w.tz, now, r) }));
  all.sort((a, b) => a.t.readAt - b.t.readAt);
  return { first: all[0], byId: new Map(all.map((x) => [x.w.id, x.t])) };
}

/** The people's answer to what the learner wrote (the last messages of the thread). */
export async function writeReply(thread: Thread, meta: Meta, ctx: PromptCtx, deps: Deps, timing?: Timing): Promise<Reply> {
  const r = deps.r ?? Math.random;
  const members = membersOf(thread.id, meta);
  if (!members.length) return { messages: [], remember: [], readAt: ctx.now };
  refreshLives(meta, members.map((w) => w.id), ctx.now, r);
  const { first, byId } = timing ?? timingFor(members, ctx.now, r);
  // the learner's last messages, read word by word: a mistake is taken literally
  const burst: string[] = [];
  for (const m of [...thread.messages].reverse()) {
    if (m.from !== "me") break;
    burst.unshift(m.la);
  }
  const literal = burst.length ? literalReading(withoutEmoji(burst.join(" ")), deps.lex) : "";
  const prompt = replyPrompt(thread, meta, ctx, { at: first.t.startAt, why: first.t.why }, literal);
  const raw = await deps.ask<{ messages?: { from?: string; la?: string; en?: string; gap?: number; voice?: unknown; photo?: unknown }[]; remember?: string[] }>(prompt, { ...deps.opts, cache: false });
  const ids = new Set(members.map((w) => w.id));
  const drafts = (raw?.messages ?? [])
    .map((m) => ({ from: ids.has(String(m.from)) ? String(m.from) : members.length === 1 ? members[0].id : "", la: clean(m.la), en: clean(m.en), gap: Number(m.gap) || 2, ...extras(m) }))
    .filter((m) => m.from && (m.la || m.photo))
    .slice(0, 5);
  const vetted = await vetAll(drafts, ctx, deps);
  // each message arrives after the one before it: a pause, then the typing; a sleeper answers when awake
  let t = first.t.startAt;
  const messages: Msg[] = vetted.map((d) => {
    const own = byId.get(d.from!);
    t = Math.max(t, own?.startAt ?? t) + Math.min(40, Math.max(0, d.gap)) * 1000 + typingTime(d.la);
    return { id: msgId(), from: d.from!, at: Math.round(t), src: "reply", ...fields(d) };
  });
  const remember = (raw?.remember ?? []).map(clean).filter(Boolean).slice(0, 2);
  return { messages, remember, readAt: first.t.readAt };
}

// -------------------------------------------------------- on their own

export interface Own {
  chat: string;
  msg: Msg;
}

/** What the people write on their own in the next hours (written now, each shown at its moment). */
export async function writeOwn(threads: Thread[], meta: Meta, ctx: PromptCtx, deps: Deps, hours = 3): Promise<Own[]> {
  const r = deps.r ?? Math.random;
  const live = threads.filter((t) => !t.gone);
  refreshLives(meta, [...new Set(live.flatMap((t) => membersOf(t.id, meta).map((w) => w.id)))], ctx.now, r);
  const raw = await deps.ask<{ messages?: { chat?: string; from?: string; la?: string; en?: string; in?: number; voice?: unknown; photo?: unknown }[] }>(ownPrompt(live, meta, ctx, hours), { ...deps.opts, cache: false });
  const byChat = new Map(live.map((t) => [t.id, t]));
  const drafts = (raw?.messages ?? [])
    .map((m) => ({ chat: String(m.chat ?? ""), from: String(m.from ?? ""), la: clean(m.la), en: clean(m.en), in: Math.max(0, Math.min(hours * 60, Number(m.in) || 0)), ...extras(m) }))
    .filter((m) => {
      const t = byChat.get(m.chat);
      if (!t || !(m.la || m.photo)) return false;
      // never into a chat with messages still on their way; only its own people; only someone awake then
      if (t.messages.some((x) => x.from !== "me" && x.at > ctx.now)) return false;
      const member = membersOf(t.id, meta).find((w) => w.id === m.from);
      if (!member) return false;
      return statusAt(member.day, member.tz, ctx.now + m.in * 60000).state !== "asleep";
    })
    .slice(0, 10);
  const vetted = await vetAll(drafts, ctx, deps);
  const last = new Map<string, number>();
  return vetted.map((d) => {
    // a burst stays in order: each message after the one before
    let at = ctx.now + d.in * 60000 + Math.round(r() * 20000);
    at = Math.max(at, (last.get(d.chat) ?? 0) + typingTime(d.la));
    last.set(d.chat, at);
    return { chat: d.chat, msg: { id: msgId(), from: d.from, at, src: "own" as const, ...fields(d) } };
  });
}

// ------------------------------------------------------------ strangers

/** Someone random: the dice roll who they are, Claude makes them real (and maybe they write first). */
export async function meetStranger(meta: Meta, ctx: PromptCtx, deps: Deps): Promise<{ stranger: Stranger; first: Msg[]; life: Life }> {
  const r = deps.r ?? Math.random;
  const used = Object.values(meta.strangers);
  const s = rollStranger(r, { names: used.map((x) => x.name), portraits: used.map((x) => x.portrait) }, ctx.now);
  // their mood and what is going on, before Claude meets them (common happenings until they have their own)
  const { life } = lifeNow({ moods: s.moods, swing: s.swing, happenings: [] }, undefined, ctx.now, r);
  const raw = await deps.ask<{ about?: string; secret?: string; happenings?: { en?: string; mood?: string; hours?: number[] }[]; first?: { la?: string; en?: string; gap?: number }[] }>(
    strangerPrompt(s, life, ctx),
    { ...deps.opts, cache: false },
  );
  s.about = clean(raw?.about) || undefined;
  s.secret = clean(raw?.secret) || undefined;
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
  const verdict = out?.verdict === "good" || out?.verdict === "almost" || out?.verdict === "wrong" ? out.verdict : "almost";
  const better = clean(out?.better);
  return { verdict, ...(better && verdict !== "good" ? { better: withMacrons(better, deps.lex) } : {}), note: clean(out?.note) };
}

export const isGroup = (id: string) => id === GROUP.id;
