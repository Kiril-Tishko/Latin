// The messenger on the page: conversations kept in this browser and in the
// learner's private account space (followed live, so every device and the
// phone routine see the same chats), the clock that lets planned messages
// arrive, and the actions: send, read, find someone, check a message.
//
// Claude is asked only on the learner's own actions: sending a message (one
// call per burst of messages), opening the messenger (at most every three
// hours, for what the people write on their own), finding someone, and Check.
import { useEffect, useState } from "preact/hooks";
import { GROUP, PEOPLE } from "../content/people";
import { makeBrief } from "../chat/brief";
import { ACTA_ID, actaKey, boardOf, earlierBoards, writeActa } from "../chat/acta";
import { applyFeelings, checkDraft, Deps, meetStranger, refreshLives, timingFor, writeOwn, writeReply } from "../chat/engine";
import { deviceZone, hashRand } from "../chat/life";
import { CoachTurn, membersOf, mergeBonds, mergeReactions, Meta, Msg, msgId, newMeta, newThread, Thread, unreadCount } from "../chat/model";
import { coachPrompt, PromptCtx } from "../chat/prompts";
import { allowedWords, calendarEntry, chatEntries, chatLexicon, nameEntry } from "../chat/words";
import { calendarBlock, calendarWords, romeDay } from "../chat/calendar";
import { PHOTO_BY_ID } from "../content/photos";
import { relativesFact } from "../content/english";
import { withoutEmoji } from "../chat/emoji";
import { Lexicon } from "../latin/analyze";
import { engineFacts } from "../latin/facts";
import { Entry } from "../latin/types";
import { chatOpts, coachOpts } from "./models";
import { DocCollection, DocRef, DocSnap, LiveDoc, messengerStore, sampleErrorText, sampler, storage } from "./platform";
import { derived, getProgress } from "./store";

const LOCAL_KEY = "tabula-latina-messenger-v1";
const MAX_MESSAGES = 300;
const PLAN_EVERY = 3 * 3600_000;

interface Local {
  meta: Meta;
  threads: Record<string, Thread & { dropped?: string[] }>;
}

type T = Thread & { dropped?: string[] };

let meta: Meta = newMeta();
let threads: Record<string, T> = {};
let store: { meta: LiveDoc; brief: DocRef; threads: DocCollection; inbox: DocCollection } | null = null;
const listeners = new Set<() => void>();
/** Threads whose people are writing an answer right now (Claude is working), with any error. */
const writing = new Map<string, { ctl: AbortController; error?: string }>();
const errors = new Map<string, string>();

load();

function load() {
  try {
    const raw = JSON.parse(storage.get(LOCAL_KEY) ?? "null") as Local | null;
    if (raw?.meta) meta = { ...newMeta(), ...raw.meta };
    if (raw?.threads) threads = raw.threads;
  } catch {
    /* a fresh start */
  }
}

function saveLocal() {
  const keep: Local = { meta, threads: Object.fromEntries(Object.entries(threads).map(([id, t]) => [id, { ...t, messages: t.messages.slice(-150) }])) };
  storage.set(LOCAL_KEY, JSON.stringify(keep));
}

function emit() {
  lexCache = null;
  listeners.forEach((l) => l());
}

// -------------------------------------------------------------- reading

export const getMeta = () => meta;
export const getThread = (id: string): T => threads[id] ?? newThread(id, kindOf(id));
const kindOf = (id: string): Thread["kind"] => (id === GROUP.id ? "group" : id === ACTA_ID ? "channel" : PEOPLE.some((p) => p.id === id) ? "dm" : "stranger");

/** Every conversation: the five friends and the group always, strangers until the learner says goodbye. */
export function allThreads(): T[] {
  const ids = [...PEOPLE.map((p) => p.id), GROUP.id, ...Object.keys(meta.strangers)];
  return ids.map(getThread).filter((t) => !t.gone);
}

export const errorOf = (id: string) => errors.get(id);

export function unreadTotal(now = Date.now()): number {
  // a new board of the Ācta Diurna counts as one
  return allThreads().reduce((n, t) => n + unreadCount(t, now), 0) + (actaUnread(now) ? 1 : 0);
}

/** Re-renders on every change and whenever a planned message arrives or someone starts typing. */
export function useMessenger(): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const l = () => setNow(Date.now());
    listeners.add(l);
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      // wake up at the next arrival or typing start, at least every 20 s (for "last seen" and clocks)
      const next = nextEvent(t);
      timer = setTimeout(tick, Math.max(250, Math.min(20_000, next - t + 30)));
    };
    tick();
    return () => {
      listeners.delete(l);
      clearTimeout(timer);
    };
  }, []);
  return now;
}

/** The next moment something changes on screen: a message arrives or its typing starts. */
function nextEvent(now: number): number {
  let next = now + 20_000;
  for (const t of Object.values(threads))
    for (const m of t.messages) {
      if (m.at > now) next = Math.min(next, m.at);
      const typing = m.at - typingMs(m) - (m.src === "reply" ? 15_000 : 0);
      if (typing > now) next = Math.min(next, typing);
      if (m.readAt && m.readAt > now) next = Math.min(next, m.readAt);
      for (const r of Object.values(m.reactions ?? {})) if (r.at > now) next = Math.min(next, r.at);
    }
  return next;
}

export const typingMs = (m: Msg) => Math.min(14_000, 1200 + m.la.length * 95);

/**
 * Who is typing in a thread now: the sender of the next message on its way,
 * while they type it (an answer: from a little before, as they think it over).
 */
export function typingIn(t: Thread, now: number): string | null {
  const next = t.messages.filter((m) => m.from !== "me" && m.at > now).sort((a, b) => a.at - b.at)[0];
  if (!next) return null;
  const lead = typingMs(next) + (next.src === "reply" ? 15_000 : 0);
  // never before they have read what the learner wrote
  const read = t.messages.filter((m) => m.from === "me").at(-1)?.readAt ?? 0;
  return next.at - lead <= now && (next.src !== "reply" || t.kind === "group" || read <= now) ? next.from : null;
}

// --------------------------------------------------------------- the store

/** Merges two copies of a conversation: every message from both, minus the ones taken back. */
function merge(a: T | undefined, b: T): T {
  if (!a) return b;
  const dropped = [...new Set([...(a.dropped ?? []), ...(b.dropped ?? [])])].slice(-200);
  const byId = new Map<string, Msg>();
  for (const m of [...a.messages, ...b.messages]) {
    const had = byId.get(m.id);
    // the copy with more news wins (a read time, a check)
    byId.set(m.id, had ? { ...had, ...m, readAt: m.readAt ?? had.readAt, check: m.check ?? had.check, reactions: mergeReactions(had.reactions, m.reactions) } : m);
  }
  const messages = [...byId.values()].filter((m) => !dropped.includes(m.id)).sort((x, y) => x.at - y.at).slice(-MAX_MESSAGES);
  return {
    ...a,
    ...b,
    messages,
    dropped,
    readAt: Math.max(a.readAt, b.readAt),
    memory: [...new Set([...a.memory, ...b.memory])].slice(-24),
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    gone: a.gone || b.gone,
  };
}

const toBody = (x: unknown) => JSON.parse(JSON.stringify(x)) as Record<string, unknown>;

const queues = new Map<string, { busy: boolean; next: (() => Promise<void>) | null }>();
/** One write at a time per document; a newer write replaces one still waiting. */
function queueWrite(key: string, write: () => Promise<void>) {
  const q = queues.get(key) ?? { busy: false, next: null };
  queues.set(key, q);
  if (q.busy) {
    q.next = write;
    return;
  }
  q.busy = true;
  void (async () => {
    let cur: (() => Promise<void>) | null = write;
    while (cur) {
      await cur().catch(() => undefined);
      cur = q.next;
      q.next = null;
    }
    q.busy = false;
  })();
}

function saveThread(t: T) {
  t.updatedAt = Date.now();
  threads[t.id] = t;
  saveLocal();
  emit();
  if (store) {
    const s = store;
    queueWrite(`t:${t.id}`, () => s.threads.doc(t.id).set(toBody({ ...threads[t.id], messages: threads[t.id].messages.slice(-MAX_MESSAGES) })));
  }
}

function saveMeta() {
  saveLocal();
  emit();
  if (store) {
    const s = store;
    queueWrite("meta", () => s.meta.set(toBody(meta)));
  }
}

let connected = false;
let gotThreads: () => void = () => undefined;
/** Resolves once the account's chats have come in (or there is no account to wait for). */
const threadsReady = new Promise<void>((resolve) => (gotThreads = resolve));

/** Connects to the account store (once per page load) and follows the messenger live. */
export async function connectMessenger() {
  if (connected) return;
  connected = true;
  const s = await messengerStore();
  if (!s) return gotThreads();
  store = s;
  try {
    follow(s);
  } catch {
    // a store that cannot follow live: this browser's copy still works
  }
  // the phone routine's brief, once the account is reachable
  void writeBrief();
}

function follow(s: NonNullable<typeof store>) {
  s.meta.onSnapshot(
    (snap) => {
      const remote = snap.exists ? (snap.data() as Partial<Meta>) : null;
      if (!remote) {
        if (meta.seenAt || Object.keys(meta.strangers).length) saveMeta();
        return;
      }
      meta = {
        ...newMeta(),
        ...remote,
        seenAt: Math.max(meta.seenAt, Number(remote.seenAt) || 0),
        plannedAt: Math.max(meta.plannedAt, Number(remote.plannedAt) || 0),
        life: { ...meta.life, ...(remote.life ?? {}) },
        strangers: { ...meta.strangers, ...(remote.strangers ?? {}) },
        // feelings: for each person the newer, from either copy
        bonds: mergeBonds(meta.bonds, remote.bonds),
      };
      saveLocal();
      emit();
    },
    () => undefined,
  );
  let first = true;
  s.threads.onSnapshot(
    (snap) => {
      gotThreads();
      const seen = new Set<string>();
      for (const d of snap.docs) {
        const body = d.data() as T | undefined;
        if (!body || !Array.isArray(body.messages)) continue;
        seen.add(d.id);
        const merged = merge(threads[d.id], { ...newThread(d.id, kindOf(d.id)), ...body, id: d.id });
        const before = threads[d.id];
        threads[d.id] = merged;
        // this browser had messages the account lacks (written while offline): send them up
        if (first && before && before.messages.some((m) => !body.messages.some((x) => x.id === m.id))) saveThread(merged);
      }
      if (first) for (const t of Object.values(threads)) if (!seen.has(t.id) && t.messages.length) saveThread(t);
      first = false;
      saveLocal();
      emit();
    },
    () => undefined,
  );
  // messages the phone routine wrote while the page was closed
  s.inbox.onSnapshot(
    (snap) => {
      for (const d of snap.docs) takeFromInbox(d);
    },
    () => undefined,
  );
}

function takeFromInbox(d: DocSnap) {
  const x = d.data() as { chat?: string; from?: string; la?: string; en?: string; at?: number; voice?: unknown; photo?: unknown } | undefined;
  const chat = String(x?.chat ?? "");
  // a photo needs no caption; a photo the page does not have is dropped
  const photo = typeof x?.photo === "string" && PHOTO_BY_ID.has(x.photo) ? x.photo : undefined;
  if (!x || !(x.la || photo) || !chat || !(chat === GROUP.id || PEOPLE.some((p) => p.id === chat) || meta.strangers[chat])) {
    void store?.inbox.doc(d.id).delete().catch(() => undefined);
    return;
  }
  const t = getThread(chat);
  if (!t.messages.some((m) => m.id === d.id)) {
    const msg: Msg = {
      id: d.id,
      from: String(x.from ?? chat),
      la: String(x.la ?? ""),
      en: x.en ? String(x.en) : undefined,
      at: Number(x.at) || Date.now(),
      src: "routine",
      ...(x.voice === true && !photo ? { voice: true } : {}),
      ...(photo ? { photo } : {}),
    };
    saveThread(merge(t, { ...t, messages: [...t.messages, msg] }));
  }
  void store?.inbox.doc(d.id).delete().catch(() => undefined);
}

// -------------------------------------------------------------- the words

let lexCache: { key: string; lex: Lexicon; entries: Entry[] } | null = null;

/** The messenger's words: the learner's, the chat words, and every name in play. */
export function chatWords(): { lex: Lexicon; entries: Entry[] } {
  const p = getProgress();
  const now = Date.now();
  const day = romeDay(now);
  const key = `${p.updatedAt}|${Object.keys(meta.strangers).join(",")}|${p.settings.me?.name ?? ""}|${day.y}-${day.m}-${day.d}`;
  if (lexCache?.key === key) return lexCache;
  const names: Entry[] = Object.values(meta.strangers).map((s) => nameEntry(s.name, `${s.name} (a name)`, s.g));
  if (p.settings.me?.name) names.push(nameEntry(p.settings.me.name, `${p.settings.me.name} (your name)`, p.settings.me.g));
  // the festivals near today and the news bring their names
  for (const w of calendarWords(now)) names.push(calendarEntry(w));
  const entries = chatEntries(derived().words, names);
  lexCache = { key, lex: chatLexicon(entries), entries };
  return lexCache;
}

export function promptCtx(now = Date.now()): PromptCtx | null {
  const p = getProgress();
  if (!p.settings.me) return null;
  const seen = derived().seenKnowledge.skills;
  // what each chat remembers about the learner: friends talk to each other
  const memories = Object.fromEntries(Object.values(threads).filter((t) => t.memory.length && !t.gone).map((t) => [t.id, t.memory]));
  return { now, me: p.settings.me, tz: p.settings.tz ?? deviceZone(), words: allowedWords(chatWords().entries, seen), seen, calendar: calendarBlock(now), group: getThread(GROUP.id), memories };
}

async function deps(): Promise<Deps | { error: string }> {
  const sample = await sampler();
  if (!sample) return { error: "Messages travel when this page is open on claude.ai." };
  return { ask: (prompt, opts) => sample.json(prompt, opts), opts: chatOpts(), coach: coachOpts(), lex: chatWords().lex };
}

const errorText = (e: unknown) => sampleErrorText((e as { code?: string })?.code) || "Stopped.";

// --------------------------------------------------------------- actions

/** The learner has seen a conversation up to now. */
export function markRead(id: string, now = Date.now()) {
  const t = getThread(id);
  const last = t.messages.filter((m) => m.at <= now).at(-1)?.at ?? 0;
  if (last > t.readAt) saveThread({ ...t, readAt: now });
}

const pending = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Sends the learner's message (maybe answering an earlier one, quoted above
 * it); the people answer after a short pause, so a burst gets one answer.
 */
export function send(id: string, text: string, re?: string) {
  const la = text.trim();
  if (!la) return;
  const now = Date.now();
  const t = getThread(id);
  // answers still on their way are taken back: they will answer everything at once
  const waiting = t.messages.filter((m) => m.from !== "me" && m.at > now).map((m) => m.id);
  writing.get(id)?.ctl.abort();
  writing.delete(id);
  errors.delete(id);
  saveThread({
    ...t,
    messages: [...t.messages.filter((m) => !waiting.includes(m.id)), { id: msgId(), from: "me", la, at: now, ...(re ? { re } : {}) }],
    dropped: [...(t.dropped ?? []), ...waiting].slice(-200),
    readAt: now,
  });
  clearTimeout(pending.get(id));
  pending.set(id, setTimeout(() => void answer(id), 2500));
  // the phone routine leaves the learner alone while they are chatting
  if (now - meta.seenAt > 120_000) {
    meta = { ...meta, seenAt: now };
    saveMeta();
  }
}

/** The learner reacts to a message with an emoji; the same emoji again takes it back. The people see it next time they write. */
export function reactTo(id: string, msg: string, e: string) {
  const t = getThread(id);
  const now = Date.now();
  saveThread({
    ...t,
    messages: t.messages.map((m) => (m.id === msg ? { ...m, reactions: { ...m.reactions, me: { e: m.reactions?.me?.e === e ? "" : e, at: now } } } : m)),
  });
}

/** The people answer what the learner wrote. */
export async function answer(id: string) {
  pending.delete(id);
  const ctx = promptCtx();
  const d = await deps();
  if (!ctx) return;
  if ("error" in d) {
    errors.set(id, d.error);
    emit();
    return;
  }
  const ctl = new AbortController();
  writing.set(id, { ctl });
  errors.delete(id);
  const started = getThread(id);
  const lastMine = started.messages.filter((m) => m.from === "me").at(-1)?.id;
  // when they read it is known at once: the ticks turn as soon as they have read it, while the answer is being written
  const timing = timingFor(membersOf(id, meta), Date.now());
  if (started.kind !== "group") {
    saveThread({ ...started, messages: started.messages.map((m) => (m.from === "me" && !m.readAt ? { ...m, readAt: Math.max(timing.first.t.readAt, m.at + 1000) } : m)) });
  }
  readingAt.set(id, { at: timing.first.t.readAt, who: timing.first.w.id });
  emit();
  try {
    const reply = await writeReply(getThread(id), meta, ctx, { ...d, ask: (p, o) => d.ask(p, { ...o, signal: ctl.signal }) }, timing);
    if (ctl.signal.aborted) return;
    const now = Date.now();
    const t = getThread(id);
    // the learner wrote again meanwhile: that newer message gets the answer
    if (t.messages.filter((m) => m.from === "me").at(-1)?.id !== lastMine) return;
    // Claude took a while: nothing arrives before it is written, and the first one is typed in front of the learner
    const first = reply.messages[0];
    const shift = first ? Math.max(0, now + 400 - (first.at - typingMs(first))) : 0;
    const messages = reply.messages.map((m) => ({ ...m, at: m.at + shift }));
    // their reactions to the learner's last message, each a moment after they read it
    const reacted = t.messages.map((m) => {
      const mine = reply.reactions.filter((x) => x.msg === m.id);
      return mine.length ? { ...m, reactions: { ...m.reactions, ...Object.fromEntries(mine.map((x) => [x.from, { e: x.e, at: Math.max(x.at, now + 600) }])) } } : m;
    });
    saveThread({ ...t, messages: [...reacted, ...messages], memory: [...new Set([...t.memory, ...reply.remember])].slice(-24) });
    // what the conversation did to them: feelings about the learner, a moment, a mood, the silent treatment
    applyFeelings(meta, reply, now);
    meta = { ...meta };
    saveMeta();
    void writeBrief();
  } catch (e) {
    if ((e as { code?: string })?.code !== "cancelled") errors.set(id, errorText(e));
  } finally {
    if (writing.get(id)?.ctl === ctl) {
      writing.delete(id);
      readingAt.delete(id);
    }
    emit();
  }
}

/** While an answer is being written: who reads the learner's message first, and when (after that they are typing). */
const readingAt = new Map<string, { at: number; who: string }>();
export const composing = (id: string) => (writing.has(id) ? readingAt.get(id) ?? null : null);

/** Opening the messenger: notes the visit, and lets the people write on their own (at most every three hours). */
export async function opened() {
  const now = Date.now();
  if (now - meta.seenAt > 120_000) {
    meta = { ...meta, seenAt: now };
    saveMeta();
  }
  void writeBrief();
  void ensureActa();
  if (now - meta.plannedAt < PLAN_EVERY) return;
  const ctx = promptCtx(now);
  if (!ctx) return;
  const d = await deps();
  if ("error" in d) return;
  meta = { ...meta, plannedAt: now };
  saveMeta();
  try {
    const own = await writeOwn(allThreads(), meta, ctx, d, 3);
    for (const o of own) {
      const t = getThread(o.chat);
      saveThread({ ...t, messages: [...t.messages, o.msg] });
    }
    saveMeta();
  } catch {
    /* nobody writes this time */
  }
}

/** Someone random: rolled, made real, and maybe writing first. Returns their chat id. */
export async function findSomeone(signal?: AbortSignal): Promise<{ id: string } | { error: string }> {
  const ctx = promptCtx();
  if (!ctx) return { error: "Tell the people your name first." };
  const d = await deps();
  if ("error" in d) return d;
  try {
    const { stranger, first, life } = await meetStranger(meta, ctx, { ...d, ask: (p, o) => d.ask(p, { ...o, signal }) });
    meta = { ...meta, strangers: { ...meta.strangers, [stranger.id]: stranger }, life: { ...meta.life, [stranger.id]: life } };
    saveMeta();
    saveThread({ ...newThread(stranger.id, "stranger"), messages: first });
    void writeBrief();
    return { id: stranger.id };
  } catch (e) {
    return { error: errorText(e) };
  }
}

/** Says goodbye to a stranger: their chat leaves the list. */
export function forget(id: string) {
  const t = getThread(id);
  saveThread({ ...t, gone: true });
}

/** The coach checks a message (a draft in the box, or one already sent). */
export async function check(id: string, draft: string, msg?: string): Promise<Msg["check"] | { error: string }> {
  const ctx = promptCtx();
  if (!ctx) return { error: "Tell the people your name first." };
  const d = await deps();
  if ("error" in d) return d;
  try {
    const res = await checkDraft(draft, getThread(id), meta, ctx, d);
    if (msg) {
      const t = getThread(id);
      saveThread({ ...t, messages: t.messages.map((m) => (m.id === msg ? { ...m, check: res } : m)) });
    }
    return res;
  } catch (e) {
    return { error: errorText(e) };
  }
}

/**
 * A question to the coach in the window beside a chat, about the learner's
 * messages or anything Latin. The answer comes as it is written (onText).
 */
export async function askCoach(id: string, question: string, turns: CoachTurn[], draft: string, onText?: (text: string) => void, signal?: AbortSignal): Promise<{ text: string } | { error: string }> {
  const ctx = promptCtx();
  if (!ctx) return { error: "Tell the people your name first." };
  const sample = await sampler();
  if (!sample) return { error: "Asking the coach works when this page is open on claude.ai." };
  const t = getThread(id);
  const lex = chatWords().lex;
  const shown = t.messages.filter((m) => m.at <= Date.now()).slice(-4);
  const facts = engineFacts(
    // (the Roman emoji's codes are not words)
    [question, draft, ...turns.slice(-4).map((x) => (x.kind === "check" ? x.draft : x.text)), ...shown.map((m) => m.la)].map((text) => ({ text: withoutEmoji(text), mixed: true })),
    lex,
    ctx.seen,
    10,
    relativesFact,
  );
  try {
    const res = await sample(coachPrompt(question, turns, draft, t, meta, ctx, facts), { ...coachOpts(), cache: false, signal, onText: ({ text }: { text: string }) => onText?.(text) });
    return { text: res.text.trim() };
  } catch (e) {
    const err = (e ?? {}) as { code?: string; text?: string };
    if (err.text?.trim()) return { text: `${err.text.trim()}\n\n*(The answer was cut off.)*` };
    return { error: errorText(e) };
  }
}

// ------------------------------------------------------------ Ācta Diurna

let actaWriting = false;
let actaError = "";

/** Whether today's board is being written, or why it could not be. */
export const actaState = () => ({ writing: actaWriting, error: actaError });

/** Today's board, when it is out. */
export const todaysBoard = (now = Date.now()) => boardOf(getThread(ACTA_ID), actaKey(now)).filter((m) => m.at <= now);

/** Today's board is out and not read yet (Continue brings it, once something is done that day). */
export function actaUnread(now = Date.now()): boolean {
  const t = getThread(ACTA_ID);
  return todaysBoard(now).some((m) => m.at > t.readAt);
}

/**
 * Writes today's Ācta Diurna once a Roman day: when the page opens, the
 * messenger opens, or the learner asks again after a failure (`force`). The
 * account's chats come in first, so a board another device wrote is not
 * written twice; a board asked for in the last quarter of an hour is waited for.
 */
export async function ensureActa(force = false): Promise<void> {
  if (actaWriting) return;
  await Promise.race([threadsReady, new Promise((r) => setTimeout(r, 6000))]);
  const now = Date.now();
  if (actaWriting || boardOf(getThread(ACTA_ID), actaKey(now)).length) return;
  if (!force && meta.actaAt && now - meta.actaAt < 15 * 60_000) return;
  const ctx = promptCtx(now);
  if (!ctx) return;
  const d = await deps();
  if ("error" in d) {
    actaError = d.error;
    emit();
    return;
  }
  actaWriting = true;
  actaError = "";
  meta = { ...meta, actaAt: now };
  refreshLives(meta, PEOPLE.map((p) => p.id), now);
  saveMeta();
  try {
    const posts = await writeActa(meta, ctx, d, earlierBoards(getThread(ACTA_ID), now));
    if (!posts.length) throw new Error("empty");
    const t = getThread(ACTA_ID);
    saveThread(merge(t, { ...t, messages: [...t.messages, ...posts] }));
  } catch (e) {
    actaError = (e as Error)?.message === "empty" ? "The scribe wrote nothing today." : errorText(e);
  } finally {
    actaWriting = false;
    emit();
  }
}

/** Rolls the people's moods where it is time (for their profiles), and saves what changed. */
export function touchLives(ids: string[]) {
  if (refreshLives(meta, ids, Date.now())) saveMeta();
}

let briefKey = "";
/** Writes the brief for the phone routine when what it says has changed. */
async function writeBrief() {
  const ctx = promptCtx();
  if (!ctx || !store) return;
  const strangers = allThreads().filter((t) => t.kind === "stranger" && t.messages.length).map((t) => t.id);
  const brief = makeBrief(meta, ctx, strangers);
  const key = JSON.stringify([brief.me, brief.language, brief.people.map((p) => p.sheet)]);
  // the moods rolled ahead age too: write again at least twice a day
  if (key === briefKey && Date.now() - lastBrief < 12 * 3600_000) return;
  briefKey = key;
  lastBrief = Date.now();
  const s = store;
  queueWrite("brief", () => s.brief.set(toBody(brief)));
}
let lastBrief = 0;

/** "online", "typing…", "last seen 14:20": how present someone looks. */
export function presence(who: { id: string; day: import("../content/people").Day; tz: string }, t: Thread, now: number, status: { state: string }): string {
  if (typingIn(t, now) === who.id) return "typing…";
  const lastOwn = t.messages.filter((m) => m.from === who.id && m.at <= now).at(-1)?.at ?? 0;
  if (now - lastOwn < 90_000) return "online";
  if (status.state === "asleep") return "asleep";
  // free people look in now and then: a steady random "last seen" within the last 40 minutes
  const slot = Math.floor(now / 600_000);
  const back = hashRand(`${who.id}:${slot}`) * (status.state === "busy" ? 40 : 15) * 60_000;
  if (back < 60_000 && status.state === "free") return "online";
  const seen = Math.max(lastOwn, now - back);
  const d = new Date(seen);
  return `last seen ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
