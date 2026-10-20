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
import { ACTA_ID, actaKey, actaPicture, boardDue, boardMemories, boardOf, firstEditions, pastBoards, writeActa } from "../chat/acta";
import { applyFeelings, checkDraft, Deps, glossOf, meetFromStory, meetStranger, picId, refreshLives, routineMinds, timingFor, vetAll, writeOwn, writeReply } from "../chat/engine";
import { applyDeeds, Deeds, welcome } from "../chat/world";
import { typingTime } from "../chat/life";
import { allowOwn, overPace, paceOf } from "../chat/pace";
import { applyMinds, forgetWith, MemoryDraft, mergeMinds, migrateMinds, Mind } from "../chat/mind";
import { natureOf } from "../chat/nature";
import { mergeTies } from "../chat/bond";
import { mergeGoals } from "../chat/lives";
import { deviceZone, hashRand } from "../chat/life";
import { CoachTurn, delayed, groupIds, groupMembers, groupName, iBlocked, isBlocked, isGroupId, isMuted, membersOf, mergeBonds, mergeMine, mergeReactions, mergeWorld, Meta, Mine, Msg, msgId, newMeta, newThread, Pic, SYS, Thread, unreadCount, whoOf } from "../chat/model";
import { coachPrompt, PromptCtx } from "../chat/prompts";
import { allowedWords, calendarEntry, chatEntries, chatLexicon, nameEntry } from "../chat/words";
import { calendarBlock, calendarWords, romeDay } from "../chat/calendar";
import { PHOTO_BY_ID } from "../content/photos";
import { relativesFact } from "../content/english";
import { withoutEmoji } from "../chat/emoji";
import { withRecordings } from "../chat/voices";
import { keepLeaf, Leaf, leafDay, leafState, LeafState, leavesOf, SIBYL_ID, writeLeaf } from "../chat/sibyl";
import { Lexicon } from "../latin/analyze";
import { engineFacts } from "../latin/facts";
import { Entry } from "../latin/types";
import { chatOpts, coachOpts } from "./models";
import { callConnector, DocCollection, DocRef, DocSnap, imageLimits, LiveDoc, messengerStore, sampleErrorText, sampler, storage } from "./platform";
import { sysLine } from "../chat/world";
import { derived, getProgress } from "./store";

const LOCAL_KEY = "tabula-latina-messenger-v1";
const MAX_MESSAGES = 300;
/** How often opening the messenger lets them do things on their own (the learner asked for much more). */
const PLAN_EVERY = 3600_000;

interface Local {
  meta: Meta;
  threads: Record<string, Thread & { dropped?: string[] }>;
  minds?: Record<string, Mind>;
}

type T = Thread & { dropped?: string[] };

let meta: Meta = newMeta();
let threads: Record<string, T> = {};
/** Each person's mind: what they remember and how they know it (chat/mind.ts). */
let minds: Record<string, Mind> = {};
let store: { meta: LiveDoc; brief: DocRef; threads: DocCollection; inbox: DocCollection; pics: DocCollection; minds: DocCollection } | null = null;
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
    if (raw?.minds) minds = raw.minds;
  } catch {
    /* a fresh start */
  }
}

function saveLocal() {
  const keep: Local = { meta, threads: Object.fromEntries(Object.entries(threads).map(([id, t]) => [id, { ...t, messages: t.messages.slice(-150) }])), minds };
  storage.set(LOCAL_KEY, JSON.stringify(keep));
}

function emit() {
  lexCache = null;
  listeners.forEach((l) => l());
}

// -------------------------------------------------------------- reading

export const getMeta = () => meta;
export const getThread = (id: string): T => threads[id] ?? newThread(id, kindOf(id));
const kindOf = (id: string): Thread["kind"] =>
  id === GROUP.id || id.startsWith("g-") ? "group" : id === ACTA_ID || id === SIBYL_ID ? "channel" : PEOPLE.some((p) => p.id === id) ? "dm" : "stranger";

/**
 * Every conversation: the five friends and the groups the learner is in
 * always, strangers until the learner says goodbye; someone the friends
 * brought into the story shows once they write or the learner seeks them out
 * (`hidden`: them too, for Claude).
 */
export function allThreads(hidden = false): T[] {
  const ids = [...PEOPLE.map((p) => p.id), ...groupIds(meta), ...Object.keys(meta.strangers)];
  return ids.map(getThread).filter((t) => !t.gone && (hidden || t.messages.length || !meta.strangers[t.id]?.invented || meta.strangers[t.id]?.story));
}

/** Is this chat one the learner can open: a friend, a group they are in, a stranger met? */
export const chatExists = (id: string) => PEOPLE.some((p) => p.id === id) || groupIds(meta).includes(id) || !!meta.strangers[id];

export const errorOf = (id: string) => errors.get(id);

export function unreadTotal(now = Date.now()): number {
  // a new board of the Ācta Diurna counts as one; a muted chat does not count
  // and a leaf of the Sibyl come true, once (chat/sibyl.ts)
  return allThreads().reduce((n, t) => n + (isMuted(meta, t.id) ? 0 : unreadCount(t, now)), 0) + (actaUnread(now) ? 1 : 0) + (bookNews(now) ? 1 : 0);
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
      if (m.deletedAt && m.deletedAt > now) next = Math.min(next, m.deletedAt);
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
  const next = t.messages.filter((m) => m.from !== "me" && m.from !== SYS && m.at > now).sort((a, b) => a.at - b.at)[0];
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
  // (one day's board written twice, on two devices at once: the edition that came out first stays, whole)
  for (const m of b.id === ACTA_ID ? firstEditions([...a.messages, ...b.messages]) : [...a.messages, ...b.messages]) {
    const had = byId.get(m.id);
    // the copy with more news wins (a read time, a check)
    // deleted: the earlier moment of the two (none when neither copy was deleted)
    const gone = Math.min(m.deletedAt ?? Infinity, had?.deletedAt ?? Infinity);
    byId.set(m.id, had ? { ...had, ...m, readAt: m.readAt ?? had.readAt, check: m.check ?? had.check, reactions: mergeReactions(had.reactions, m.reactions), deletedAt: Number.isFinite(gone) ? gone : undefined } : m);
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

/**
 * Writes made before the account's copy has come in (this browser's copy may
 * be days old, and a write replaces the whole document): they wait, and go up
 * merged with the account's once it is in ("t:<chat>", "k:<mind>", "meta").
 */
const held = new Set<string>();

function saveThread(t: T) {
  t.updatedAt = Date.now();
  threads[t.id] = t;
  saveLocal();
  emit();
  if (!store) return;
  if (!gotChats) return void held.add(`t:${t.id}`);
  const s = store;
  queueWrite(`t:${t.id}`, () => s.threads.doc(t.id).set(toBody({ ...threads[t.id], messages: threads[t.id].messages.slice(-MAX_MESSAGES) })));
}

function saveMind(m: Mind) {
  minds[m.id] = m;
  saveLocal();
  if (!store) return;
  if (!gotMinds) return void held.add(`k:${m.id}`);
  const s = store;
  queueWrite(`k:${m.id}`, () => s.minds.doc(m.id).set(toBody(minds[m.id])));
}

/** Messages that never reached the learner: what came with them is forgotten, and their pictures and recordings not made yet are not made. */
function unsaid(msgs: Msg[], now = Date.now()) {
  if (!msgs.length) return;
  for (const m of forgetWith(minds, msgs.map((x) => x.id), now)) saveMind(m);
  for (const id of msgs.flatMap((m) => (m.from === "me" ? [] : [m.pic, m.rec]))) if (id) void unwant(id);
}

/** Keeps what a conversation or a stretch of their lives did to the people's minds. */
function remember(change: Parameters<typeof applyMinds>[1], now: number) {
  for (const m of applyMinds(minds, change, now, (id) => whoOf(id, meta)?.name ?? (id === "me" ? getProgress().settings.me?.name ?? "the learner" : id))) saveMind(m);
}

function saveMeta() {
  saveLocal();
  emit();
  if (!store) return;
  if (!gotMetaIn) return void held.add("meta");
  const s = store;
  queueWrite("meta", () => s.meta.set(toBody(meta)));
}

/** The writes that waited for the account's copy, now that it is in (merged with it). */
function flushHeld() {
  for (const key of [...held]) {
    const id = key.slice(2);
    if (key === "meta" ? !gotMetaIn : key.startsWith("t:") ? !gotChats : !gotMinds) continue;
    held.delete(key);
    if (key === "meta") saveMeta();
    else if (key.startsWith("t:") && threads[id]) saveThread(threads[id]);
    else if (key.startsWith("k:") && minds[id]) saveMind(minds[id]);
  }
}

let connected = false;
let gotChats = false;
let gotMetaIn = false;
let gotMinds = false;
let movedIn = false;
/** Once the account's chats and minds are in: the old facts and moments move into the minds (once; ids are steady, so two devices make one memory). */
function moveIn() {
  if (movedIn || !gotChats || !gotMinds) return;
  movedIn = true;
  const all = allThreads(true).filter((t) => t.kind !== "channel");
  for (const m of migrateMinds(meta, all, minds, (chat) => membersOf(chat, meta).map((w) => w.id), Date.now())) saveMind(mergeMinds(minds[m.id], m)!);
}
/** Chats tidied of what was written beyond the people's pace, this page load. */
const tidied = new Set<string>();
let gotThreads: () => void = () => undefined;
let gotMetaDoc: () => void = () => undefined;
/** Resolves once the account's chats and its meta have come in (or there is no account to wait for). */
const accountReady = Promise.all([new Promise<void>((resolve) => (gotThreads = resolve)), new Promise<void>((resolve) => (gotMetaDoc = resolve))]);

/** Connects to the account store (once per page load) and follows the messenger live. */
export async function connectMessenger() {
  if (connected) return;
  connected = true;
  const s = await messengerStore();
  if (!s) return void (gotThreads(), gotMetaDoc());
  store = s;
  try {
    follow(s);
  } catch {
    // a store that cannot follow live: this browser's copy still works (and is written as it is)
    gotChats = gotMetaIn = gotMinds = true;
    gotThreads();
    gotMetaDoc();
    flushHeld();
  }
  // the phone routine's brief, once the account is reachable
  void writeBrief();
}

function follow(s: NonNullable<typeof store>) {
  s.meta.onSnapshot(
    (snap) => {
      gotMetaDoc();
      const remote = snap.exists ? (snap.data() as Partial<Meta>) : null;
      gotMetaIn = true;
      if (!remote) {
        held.delete("meta");
        if (meta.seenAt || Object.keys(meta.strangers).length) saveMeta();
        tidy();
        return;
      }
      meta = {
        ...newMeta(),
        ...remote,
        seenAt: Math.max(meta.seenAt, Number(remote.seenAt) || 0),
        plannedAt: Math.max(meta.plannedAt, Number(remote.plannedAt) || 0),
        life: { ...meta.life, ...(remote.life ?? {}) },
        strangers: { ...meta.strangers, ...(remote.strangers ?? {}) },
        world: mergeWorld(meta.world, remote.world),
        mine: mergeMine(meta.mine, remote.mine),
        // feelings: for each person the newer, from either copy; how they see each other, for each pair
        bonds: mergeBonds(meta.bonds, remote.bonds),
        ties: mergeTies(meta.ties, remote.ties),
        // what they want from life: each goal the newer
        goals: mergeGoals(meta.goals, remote.goals),
      };
      // what changed here before it came in goes up now, merged
      flushHeld();
      tidy();
      saveLocal();
      emit();
    },
    () => ((gotMetaIn = true), gotMetaDoc(), flushHeld(), tidy()),
  );
  let first = true;
  s.threads.onSnapshot(
    (snap) => {
      gotThreads();
      gotChats = true;
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
      flushHeld();
      moveIn();
      tidy();
      saveLocal();
      emit();
    },
    () => ((gotChats = true), gotThreads(), flushHeld()),
  );
  // each person's mind, followed live (every device and the phone routine's brief see the same memories)
  s.minds.onSnapshot(
    (snap) => {
      for (const d of snap.docs) {
        const body = d.data() as unknown as Mind | undefined;
        if (!body || !Array.isArray(body.memories)) continue;
        minds[d.id] = mergeMinds(minds[d.id], { ...body, id: d.id })!;
      }
      gotMinds = true;
      flushHeld();
      saveLocal();
      emit();
      moveIn();
    },
    () => {
      gotMinds = true;
      flushHeld();
      moveIn();
    },
  );
  // pictures that were waiting to be made
  for (const t of Object.values(threads)) for (const m of t.messages) if (m.pic && m.from !== "me" && Date.now() - m.at < 3 * 86400_000) void loadPic(m.pic);
  // messages the phone routine wrote while the page was closed
  s.inbox.onSnapshot(
    (snap) => {
      // in the order they were written, so that each one is judged with the ones before it in its chat
      const at = (d: DocSnap) => Number((d.data() as { at?: unknown } | undefined)?.at) || 0;
      for (const d of [...snap.docs].sort((a, b) => at(a) - at(b))) takeFromInbox(d);
    },
    () => undefined,
  );
}

/**
 * Once per page, for each chat: what the people wrote beyond their pace, not
 * seen yet, goes (like real people, they would have waited). Only once the
 * account's chats and meta are both in: with this browser's old copy of the
 * meta (a stranger not met here yet, a group not known, feelings that make
 * someone write more), their pace would be judged wrong.
 */
function tidy() {
  if (!gotChats || !gotMetaIn) return;
  for (const t of Object.values(threads)) {
    if (tidied.has(t.id) || t.kind === "channel") continue;
    tidied.add(t.id);
    const drop = overPace(t, meta, isGroupId(t.id, meta), (id) => natureOf(id, meta)?.burst ?? 4);
    if (drop.length) saveThread({ ...t, messages: t.messages.filter((m) => !drop.includes(m.id)), dropped: [...(t.dropped ?? []), ...drop].slice(-400) });
    unsaid(t.messages.filter((m) => drop.includes(m.id)));
  }
}

function takeFromInbox(d: DocSnap) {
  const x = d.data() as { chat?: string; from?: string; la?: string; en?: string; at?: number; voice?: unknown; photo?: unknown; pic?: unknown; picEn?: unknown; gloss?: unknown; remember?: unknown; tell?: unknown } | undefined;
  const chat = String(x?.chat ?? "");
  // a photo needs no caption; a photo the page does not have is dropped; a picture the routine made is in messenger/pics
  const photo = typeof x?.photo === "string" && PHOTO_BY_ID.has(x.photo) ? x.photo : undefined;
  const pic = !photo && typeof x?.pic === "string" && /^[\w-]{3,40}$/.test(x.pic) ? x.pic : undefined;
  const blocked = !isGroupId(chat, meta) && iBlocked(meta, String(x?.from ?? chat));
  if (!x || !(x.la || photo || pic) || !chat || !chatExists(chat) || blocked) {
    void store?.inbox.doc(d.id).delete().catch(() => undefined);
    return;
  }
  const t = getThread(chat);
  const at = Number(x.at) || Date.now();
  const from = String(x.from ?? chat);
  // like real people: what the routine wrote beyond someone's pace, a repeat, or a photo sent there lately never arrives
  const member = membersOf(chat, meta).find((w) => w.id === from);
  if (!t.messages.some((m) => m.id === d.id) && (!member || !allowOwn(t, from, { la: String(x.la ?? ""), photo }, at, paceOf(from, meta, at), isGroupId(chat, meta), natureOf(from, meta)?.burst).ok)) {
    void store?.inbox.doc(d.id).delete().catch(() => undefined);
    return;
  }
  if (pic) void loadPic(pic);
  if (!t.messages.some((m) => m.id === d.id)) {
    const [msg] = recorded([{
      id: d.id,
      from,
      la: String(x.la ?? ""),
      en: x.en ? String(x.en) : undefined,
      at,
      src: "routine",
      ...(x.voice === true && !photo && !pic ? { voice: true } : {}),
      ...(photo ? { photo } : {}),
      ...(pic ? { pic, ...(x.picEn ? { picEn: String(x.picEn).slice(0, 300) } : {}) } : {}),
      ...(glossOf(x.gloss) ? { gloss: glossOf(x.gloss) } : {}),
    }]);
    saveThread(merge(t, { ...t, messages: [...t.messages, msg] }));
    // what they will remember of it, and what was told behind the scenes (the routine says so with the message)
    const { memories, tells } = routineMinds(x, chat, meta);
    if (memories.length || tells.length) remember({ memories: memories.map((m) => ({ ...m, msg: d.id })), chat, tells }, at);
    // writing to the learner in private again: whoever blocked them has unblocked them
    if (t.kind !== "group" && isBlocked(meta, msg.from)) {
      const { [msg.from]: _, ...rest } = meta.world?.blocked ?? {};
      meta = { ...meta, world: { ...meta.world!, blocked: rest, updatedAt: Date.now() } };
      saveMeta();
    }
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
  return { now, me: p.settings.me, tz: p.settings.tz ?? deviceZone(), words: allowedWords(chatWords().entries, seen), seen, calendar: calendarBlock(now), group: getThread(GROUP.id), minds, canMake: madeToday(now) < MAKE_PER_DAY };
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
export function send(id: string, text: string, re?: string, extra: Partial<Pick<Msg, "voice" | "pic">> = {}) {
  const la = text.trim();
  if (!la && !extra.pic) return;
  if (!isGroupId(id, meta) && iBlocked(meta, id)) return;
  const now = Date.now();
  const t = getThread(id);
  // answers still on their way are taken back: they will answer everything at once
  const waiting = t.messages.filter((m) => m.from !== "me" && m.at > now).map((m) => m.id);
  writing.get(id)?.ctl.abort();
  writing.delete(id);
  errors.delete(id);
  saveThread({
    ...t,
    messages: [...t.messages.filter((m) => !waiting.includes(m.id)), { id: msgId(), from: "me", la, at: now, ...(re ? { re } : {}), ...extra }],
    dropped: [...(t.dropped ?? []), ...waiting].slice(-200),
    readAt: now,
  });
  unsaid(t.messages.filter((m) => waiting.includes(m.id)), now);
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
  // blocked: the message never reaches them (one tick stays one tick)
  if (getThread(id).kind !== "group" && isBlocked(meta, id)) return;
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
  const timing = timingFor(membersOf(id, meta), Date.now(), Math.random, meta);
  if (started.kind !== "group") {
    saveThread({ ...started, messages: started.messages.map((m) => (m.from === "me" && !m.readAt ? { ...m, readAt: Math.max(timing.first.t.readAt, m.at + 1000) } : m)) });
  }
  readingAt.set(id, { at: timing.first.t.readAt, who: timing.first.w.id });
  emit();
  try {
    // the learner's photos the people have not seen yet go along, for Claude to look at
    const photos = await unseenPhotos(getThread(id));
    const reply = await writeReply(getThread(id), meta, ctx, { ...d, ask: (p, o) => d.ask(p, { ...o, signal: ctl.signal }) }, timing, photos.map((x) => x.blob));
    if (ctl.signal.aborted) return;
    const now = Date.now();
    const t = getThread(id);
    // the learner wrote again meanwhile: that newer message gets the answer
    if (t.messages.filter((m) => m.from === "me").at(-1)?.id !== lastMine) return;
    // Claude took a while: nothing arrives before it is written, and the first one is typed in front of the learner
    const first = reply.messages[0];
    const shift = first ? Math.max(0, now + 400 - (first.at - typingMs(first))) : 0;
    // (one they take back is taken back as long after it arrives as they meant)
    const messages = recorded(reply.messages.map((m) => delayed(m, shift)));
    // their reactions to the learner's last message, each a moment after they read it
    const reacted = t.messages.map((m) => {
      const mine = reply.reactions.filter((x) => x.msg === m.id);
      return mine.length ? { ...m, reactions: { ...m.reactions, ...Object.fromEntries(mine.map((x) => [x.from, { e: x.e, at: Math.max(x.at, now + 600) }])) } } : m;
    });
    // what they saw in the learner's photos, so they remember it
    const seen = new Set(photos.map((x) => x.msg));
    const described = reply.saw ? reacted.map((m) => (seen.has(m.id) ? { ...m, picEn: reply.saw } : m)) : reacted;
    saveThread({ ...t, messages: [...described, ...messages] });
    // what the conversation did to them: feelings about the learner, how they see each other, a mood, the silent treatment, their goals, what happens to them
    const happened = applyFeelings(meta, reply, now);
    // what each will remember (and what happened to them), what is settled or no longer true, and what someone told someone
    remember({ memories: [...reply.memories, ...happened], chat: id, settled: reply.settled, outdated: reply.outdated, tells: reply.deeds.tells }, now);
    for (const x of photos) if (reply.saw) void updatePic(x.pic, { en: reply.saw });
    // fresh pictures their messages carry
    makePictures(reply.made);
    await enact(reply.deeds, ctx, d, Math.max(now, (messages.at(-1)?.at ?? now) + 1000), isGroupId(id, meta) ? id : GROUP.id);
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

/**
 * Makes real what they did besides writing: new people welcomed (their first
 * words vetted like any message, in private or in the group they join), and
 * the world changed, with the lines a messenger shows (left, joined, added,
 * renamed) and the messages they deleted.
 */
async function enact(deeds: Deeds, ctx: PromptCtx, d: Deps, at: number, groupId: string = GROUP.id) {
  if (!deeds.acts.length && !deeds.dramas.length && !deeds.newPeople.length) return;
  const born = welcome(meta, deeds.newPeople, Math.random, at);
  rollLives(born.map((s) => s.id), at);
  const specOf = (name: string) => deeds.newPeople.find((p) => p.name === name)!;
  const joining = born.filter((s) => specOf(s.name).joinGroup);
  // the first words of a group they start are vetted like any message
  for (const a of deeds.acts)
    if (a.do === "newGroup" && a.messages?.length) a.messages = (await vetAll(a.messages, ctx, d).catch(() => [])).map((m) => ({ from: m.from, la: m.la, en: m.en }));
  const all: Record<string, T> = Object.fromEntries(allThreads(true).map((t) => [t.id, t]));
  for (const t of applyDeeds(meta, all, deeds, at, groupId, joining)) saveThread(t);
  // their first words: in private, or in the group they have just joined
  for (const s of born) {
    const first = specOf(s.name).firstMessages ?? [];
    if (!first.length) continue;
    const vetted = await vetAll(first.map((m) => ({ ...m, from: s.id })), ctx, d).catch(() => []);
    const where = joining.includes(s) ? GROUP.id : s.id;
    const t = getThread(where);
    let when = at + 20_000;
    const msgs: Msg[] = vetted.map((m) => ({ id: msgId(), from: s.id, la: m.la, en: m.en, at: (when += 8000 + typingTime(m.la)), src: "first", ...(m.newWords ? { newWords: m.newWords } : {}) }));
    if (msgs.length) saveThread({ ...t, messages: [...t.messages, ...msgs] });
  }
}

/** Opening the messenger: notes the visit, and lets the people write on their own (at most every three hours). */
export async function opened() {
  const now = Date.now();
  if (now - meta.seenAt > 120_000) {
    meta = { ...meta, seenAt: now };
    saveMeta();
  }
  void writeBrief();
  void ensureActa();
  // the account's chats and meta first (another device may have let them write a moment ago)
  await accountReady;
  if (now - meta.plannedAt < PLAN_EVERY) return;
  const ctx = promptCtx(now);
  if (!ctx) return;
  const d = await deps();
  if ("error" in d) return;
  meta = { ...meta, plannedAt: now };
  saveMeta();
  try {
    const own = await writeOwn(allThreads(true), meta, ctx, d, 1);
    for (const o of own.messages) {
      const t = getThread(o.chat);
      saveThread({ ...t, messages: [...t.messages, ...recorded([o.msg])] });
    }
    makePictures(own.made);
    remember({ memories: own.memories, settled: own.settled, outdated: own.outdated, tells: own.deeds.tells }, now);
    await enact(own.deeds, ctx, d, now + 60_000);
    meta = { ...meta };
    saveMeta();
    void writeBrief();
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
    saveThread({ ...newThread(stranger.id, "stranger"), messages: recorded(first) });
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
/** The board being written by this page now (a second call waits for it instead of writing another). */
let actaRun: Promise<void> | null = null;

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
export function ensureActa(force = false): Promise<void> {
  // one board at a time: a second call (the page and the messenger opening together) waits for the first
  if (actaRun) return actaRun;
  actaRun = writeTodaysBoard(force).finally(() => {
    actaRun = null;
  });
  return actaRun;
}

async function writeTodaysBoard(force: boolean): Promise<void> {
  // the account's chats and meta first: a board another device wrote, or is writing, is not written again
  await accountReady;
  const now = Date.now();
  const today = actaKey(now);
  // one a day, and not soon after the last one (a board late in the evening is not followed by the next day's at once)
  if (!boardDue(getThread(ACTA_ID), now)) return;
  // asked for a moment ago (another device, or before a reload): wait for it, but let the learner ask again
  if (!force && meta.actaAt && now - meta.actaAt < 15 * 60_000) {
    actaError = "The scribe started on today's board a moment ago.";
    emit();
    return;
  }
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
  rollLives(PEOPLE.map((p) => p.id), now);
  saveMeta();
  emit();
  try {
    const written = await writeActa(meta, ctx, d, pastBoards(getThread(ACTA_ID), now));
    if (!written.length) throw new Error("empty");
    // another device's board came in meanwhile: the first one stays
    if (boardOf(getThread(ACTA_ID), today).length) return;
    // stamped when it comes out, so a look at the list while the scribe wrote does not mark it read
    const at = Date.now();
    const posts = written.map((m, i) => ({ ...m, at: at + i }));
    const t = getThread(ACTA_ID);
    saveThread(merge(t, { ...t, messages: [...t.messages, ...posts] }));
    // the picture of the day, made like the people's pictures
    makePictures(posts.map((m) => actaPicture(m, at, meta)).filter((p): p is Pic => !!p));
    // what it told of the friends, they hear in the neighbourhood
    remember({ memories: boardMemories(posts, meta) }, at);
  } catch (e) {
    actaError = (e as Error)?.message === "empty" ? "The scribe wrote nothing today." : errorText(e);
  } finally {
    actaWriting = false;
    emit();
  }
}

// ------------------------------------------------------ the Sibyl's leaves

/** The leaves the learner caught, oldest first: the Liber Sibyllīnus (chat/sibyl.ts). */
export const leaves = () => leavesOf(getThread(SIBYL_ID));

/** What a leaf foretold. */
export const fateOf = (id: string) => meta.world?.fates?.find((f) => f.id === id);

/** May a leaf blow now: the learner's chats are in, and it is a leaf's day (chat/sibyl.ts, leafDay). */
export const leafToday = (now = Date.now()) => gotChats && leafDay(now, leaves(), meta);

/** Writes a leaf for the wind (Claude, the chat model): kept only once it is caught. */
export async function prepareLeaf(): Promise<Leaf | { error: string }> {
  const now = Date.now();
  const ctx = promptCtx(now);
  if (!ctx) return { error: "No one to foretell for yet." };
  const d = await deps();
  if ("error" in d) return d;
  // their lives as they are now, so that the leaf fits them
  if (rollLives(PEOPLE.map((p) => p.id), now)) saveMeta();
  try {
    return (await writeLeaf(meta, ctx, d)) ?? { error: "The Sibyl was silent." };
  } catch (e) {
    return { error: errorText(e) };
  }
}

/** A leaf caught: kept in the book, and its fate in their world (the brief carries it to the phone routine at once). */
export function catchLeaf(leaf: Leaf, now = Date.now()): Msg {
  const { msg, fate } = keepLeaf(leaf, now);
  const t = getThread(SIBYL_ID);
  // a book, not a chat: kept gone, and read, so nothing counts it as a conversation
  saveThread(merge(t, { ...t, gone: true, readAt: now, messages: [...t.messages, msg] }));
  meta = { ...meta, world: { ...(meta.world ?? { updatedAt: 0 }), fates: [...(meta.world?.fates ?? []).filter((f) => f.id !== fate.id), fate], updatedAt: now } };
  saveMeta();
  void writeBrief(true);
  return msg;
}

/** The book opened: what came true is seen. */
export function readBook(now = Date.now()) {
  const t = getThread(SIBYL_ID);
  if (t.messages.length && now - t.readAt > 5000) saveThread({ ...t, readAt: now });
}

/** Something in the book the learner has not seen: a leaf come true since they last opened it. */
export function bookNews(now = Date.now()): boolean {
  const t = getThread(SIBYL_ID);
  return [...leafStates(now).states.entries()].some(([id, st]) => {
    const f = fateOf(id);
    const at = st.state === "told" ? st.msg.at : st.state === "known" && f ? f.at + 36 * 3600_000 : 0;
    return at > t.readAt && at <= now;
  });
}

/** A message to bring into view when its chat opens (from the book), and the leaf to bring into view when the book opens. */
let jump: { chat: string; msg: string } | null = null;
let leafFocus: string | null = null;
export function showMessage(chat: string, msg: string) {
  jump = { chat, msg };
}
export function takeJump(chat: string): string | null {
  const j = jump?.chat === chat ? jump.msg : null;
  if (j) jump = null;
  return j;
}
export const focusLeaf = (id: string) => void (leafFocus = id);
export function takeLeafFocus(): string | null {
  const f = leafFocus;
  leafFocus = null;
  return f;
}

let leafCache: { key: string; states: Map<string, LeafState>; marks: Map<string, string> } | null = null;
/** Where each leaf stands (chat/sibyl.ts, leafState), and the messages that tell of a fate (their leaf's id), for the marks in the chats. */
export function leafStates(now = Date.now()): { states: Map<string, LeafState>; marks: Map<string, string> } {
  const all = leaves();
  const chats = allThreads(true);
  const key = `${all.length}:${chats.reduce((n, t) => n + t.messages.length, 0)}:${(meta.world?.fates ?? []).map((f) => f.done ?? 0).join(",")}:${Math.floor(now / 60_000)}`;
  if (leafCache?.key === key) return leafCache;
  const states = new Map<string, LeafState>();
  const marks = new Map<string, string>();
  const lex = chatWords().lex;
  for (const m of all) {
    const st = leafState(fateOf(m.id), chats, lex, now, m.at);
    states.set(m.id, st);
    if (st.state === "told") marks.set(st.msg.id, m.id);
  }
  leafCache = { key, states, marks };
  return leafCache;
}

/** Rolls on their lives where it is time; what begins in them is remembered (chat/lives.ts). True if anything changed. */
function rollLives(ids: string[], now: number): boolean {
  const lived: MemoryDraft[] = [];
  const changed = refreshLives(meta, ids, now, Math.random, lived);
  if (lived.length) remember({ memories: lived }, now);
  return changed;
}

/** Rolls the people's moods where it is time (for their profiles), and saves what changed. */
export function touchLives(ids: string[]) {
  if (rollLives(ids, Date.now())) saveMeta();
}

let briefKey = "";
/** Writes the brief for the phone routine when what it says has changed (`force`: the learner changed something it carries). */
async function writeBrief(force = false) {
  if (force) briefKey = "";
  const ctx = promptCtx();
  if (!ctx || !store) return;
  const strangers = allThreads().filter((t) => t.kind === "stranger" && (t.messages.length || meta.strangers[t.id]?.story)).map((t) => t.id);
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
  // blocked (either way): nothing of them shows any more
  if (t.kind !== "group" && (isBlocked(meta, who.id) || iBlocked(meta, who.id))) return "last seen a long time ago";
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

// -------------------------------------------------------------- pictures

/** How many fresh pictures the people may have made in a day (each one is a little work for a volunteer's machine). */
const MAKE_PER_DAY = 8;
/** The routine that makes wanted pictures at once ("Nūntiī: pictures", fired through the Claude Code Remote connector). */
export const PICTURE_TRIGGER = "trig_01UuDAZrviveDMPR1sjce698";
const CONNECTOR = "Claude Code Remote";

/** Fresh pictures the people asked for in the last day. */
function madeToday(now: number): number {
  let n = 0;
  for (const t of Object.values(threads)) for (const m of t.messages) if (m.pic && m.from !== "me" && now - m.at < 86400_000) n++;
  return n;
}

const picCache = new Map<string, Pic>();
const picFollow = new Map<string, () => void>();
const picLoading = new Set<string>();
/** Pictures whose document could not be read, and when (tried again a minute later, not on every redraw). */
const picFailed = new Map<string, number>();
/** A picture still wanted after a day is given up on: the routine that should have made it never did. */
const GIVE_UP = 86400_000;
export const picGivenUp = (p: Pic | undefined, now = Date.now()) => p?.status === "wanted" && now - p.at > GIVE_UP;
/** The learner's photos sent from this browser, as files (for Claude to look at). */
const blobs = new Map<string, Blob>();

/** A picture, when it has come in (it loads the first time it is asked for). */
export function picOf(id: string): Pic | undefined {
  if (!picCache.has(id)) void loadPic(id);
  return picCache.get(id);
}

/** Loads a picture's document; one still being made is followed until it is done. */
async function loadPic(id: string) {
  if (picCache.get(id)?.status === "done" || picLoading.has(id) || picFollow.has(id) || !store || Date.now() - (picFailed.get(id) ?? 0) < 60_000) return;
  picLoading.add(id);
  const ref = store.pics.doc(id);
  try {
    const snap = await ref.get?.();
    const p = snap?.exists ? (snap.data() as unknown as Pic) : undefined;
    if (p) picCache.set(id, { ...p, id });
    // still waiting after a quarter of an hour: the run that should have made it did not; ask again (not for one given up on)
    if (p?.status === "wanted" && Date.now() - p.at > 15 * 60_000 && !picGivenUp(p)) void firePictures([id]);
    if (!p && !ref.onSnapshot) picFailed.set(id, Date.now());
    if ((!p || p.status === "wanted") && ref.onSnapshot) {
      picFollow.set(
        id,
        ref.onSnapshot(
          (x) => {
            const q = x.exists ? (x.data() as unknown as Pic) : undefined;
            if (!q) return;
            picCache.set(id, { ...q, id });
            if (q.status !== "wanted") {
              picFollow.get(id)?.();
              picFollow.delete(id);
            }
            emit();
          },
          () => undefined,
        ),
      );
    }
  } catch {
    // it shows as a picture that did not load (for a minute: then it is tried again)
    picFailed.set(id, Date.now());
  } finally {
    picLoading.delete(id);
    emit();
  }
}

/** A picture as an image source: its data, once made. */
export const picSrc = (p: Pic | undefined) => (p?.status === "done" && p.b64 ? `data:${p.type ?? "image/jpeg"};base64,${p.b64}` : undefined);

function savePic(p: Pic) {
  picCache.set(p.id, p);
  emit();
  if (store) {
    const s = store;
    queueWrite(`p:${p.id}`, () => s.pics.doc(p.id).set(toBody(p)));
  }
}

function updatePic(id: string, patch: Partial<Pic>) {
  const p = picCache.get(id);
  if (p) savePic({ ...p, ...patch });
}

/** A picture or recording no longer wanted (its message never arrives): if it is not made yet, it is not made. */
async function unwant(id: string) {
  const got = async () => {
    const snap = await store?.pics.doc(id).get?.();
    return snap?.exists ? { ...(snap.data() as unknown as Pic), id } : undefined;
  };
  const p = picCache.get(id) ?? (await got().catch(() => undefined));
  if (p?.status === "wanted") savePic({ ...p, status: "failed" });
}

/**
 * Fresh pictures the people want to send: each waits in messenger/pics until
 * it is made, by the pictures routine (fired at once through the Claude Code
 * Remote connector, when the page may use it) or by the hourly phone routine.
 */
function makePictures(made: Pic[]) {
  if (!made.length) return;
  for (const p of made) {
    savePic(p);
    void loadPic(p.id);
  }
  void firePictures(made.map((p) => p.id));
}

/** The people's voice messages get their recordings wanted (chat/voices.ts), made with the pictures. */
function recorded(msgs: Msg[], now = Date.now()): Msg[] {
  const { messages, wanted } = withRecordings(msgs, (id) => whoOf(id, meta), now);
  makePictures(wanted);
  return messages;
}

let lastFire = 0;
let refire: ReturnType<typeof setTimeout> | undefined;
async function firePictures(ids: string[]) {
  const now = Date.now();
  // one run makes every picture that waits; a picture asked for meanwhile gets a run of its own a little later
  if (now - lastFire < 90_000) {
    clearTimeout(refire);
    refire = setTimeout(() => void firePictures(ids), 90_000 - (now - lastFire) + 1000);
    return;
  }
  lastFire = now;
  try {
    await callConnector(CONNECTOR, "fire_trigger", { trigger_id: PICTURE_TRIGGER, text: `Pictures waiting: ${ids.join(", ")}` });
  } catch {
    /* the hourly routine makes them */
  }
}

/** Shrinks a photo the learner picked to a small JPEG (its longest side 1024 pixels at most, under the store's limit). */
async function shrink(file: Blob): Promise<{ blob: Blob; b64: string }> {
  const img = await createImageBitmap(file);
  for (const [side, q] of [[1024, 0.8], [800, 0.72], [640, 0.62], [480, 0.55]] as const) {
    const k = Math.min(1, side / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", q));
    if (!blob) continue;
    const b64 = await new Promise<string>((r) => {
      const fr = new FileReader();
      fr.onload = () => r(String(fr.result).split(",")[1] ?? "");
      fr.readAsDataURL(blob);
    });
    if (b64.length < 200_000) return { blob, b64 };
  }
  throw new Error("too big");
}

let photoCaps: Promise<{ maxCount: number } | null> | null = null;
/** Whether the people can see the learner's photos here (Claude can be shown pictures from this page). */
export const canSendPhotos = () => (photoCaps ??= imageLimits());

/** The learner sends a photo, with a caption if they wrote one; the people see it and answer. */
export async function sendPhoto(id: string, file: Blob, caption: string, re?: string): Promise<{ error: string } | null> {
  try {
    const { blob, b64 } = await shrink(file);
    const pic = picId();
    blobs.set(pic, blob);
    savePic({ id: pic, by: "me", en: "", status: "done", type: "image/jpeg", b64, at: Date.now() });
    send(id, caption, re, { pic });
    return null;
  } catch {
    return { error: "That picture could not be read. Try another one." };
  }
}

/** A picture's data as a file again (no fetch: the page's network is closed). */
function blobOf(p: Pic | undefined): Blob | undefined {
  if (!p?.b64) return undefined;
  try {
    const bin = atob(p.b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: p.type ?? "image/jpeg" });
  } catch {
    return undefined;
  }
}

/** The learner's photos in the newest messages that the people have not looked at yet (with their files). */
async function unseenPhotos(t: Thread): Promise<{ msg: string; pic: string; blob: Blob }[]> {
  const caps = await canSendPhotos();
  if (!caps) return [];
  const out: { msg: string; pic: string; blob: Blob }[] = [];
  for (const m of [...t.messages].reverse()) {
    if (m.from !== "me") break;
    if (!m.pic || m.picEn) continue;
    let blob = blobs.get(m.pic);
    if (!blob) {
      await loadPic(m.pic);
      blob = blobOf(picCache.get(m.pic));
    }
    if (blob) out.unshift({ msg: m.id, pic: m.pic, blob });
  }
  return out.slice(-Math.max(1, caps.maxCount));
}

// ------------------------------------------------------ the learner's own

/** The learner's message, typed, sent as a voice message (their words read by the device's voice). */
export const sendVoice = (id: string, text: string, re?: string) => send(id, text, re, { voice: true });

/** The learner deletes a message of theirs for everyone (the people may have read it already). */
export function deleteMine(id: string, msg: string) {
  const t = getThread(id);
  const now = Date.now();
  saveThread({ ...t, messages: t.messages.map((m) => (m.id === msg && m.from === "me" ? { ...m, deletedAt: now } : m)) });
}

/** Clears a chat on this side: its messages no longer show (the people still remember them). */
export function clearChat(id: string) {
  saveThread({ ...getThread(id), clearedAt: Date.now() });
}

function setMine(change: (m: Mine) => Mine) {
  meta = { ...meta, mine: { ...change(meta.mine ?? { blocked: [], muted: [], updatedAt: 0 }), updatedAt: Date.now() } };
  saveMeta();
  void writeBrief(true);
}

/** Blocks someone (nothing they send in private reaches the learner), or unblocks them. */
export const setBlocked = (who: string, on: boolean) => setMine((m) => ({ ...m, blocked: on ? [...new Set([...m.blocked, who])] : m.blocked.filter((x) => x !== who) }));

/** Mutes a chat (no notice, no count, no phone notification), or unmutes it. */
export const setMuted = (chat: string, on: boolean) => setMine((m) => ({ ...m, muted: on ? [...new Set([...m.muted, chat])] : m.muted.filter((x) => x !== chat) }));

/** Changes the world on the learner's side: a group made, renamed, people added or removed; the chat gets the messenger's lines. */
function changeGroups(id: string, change: (g: { name: string; members: string[] }) => { name: string; members: string[] } | null, lines: string[]) {
  const now = Date.now();
  const world = { ...(meta.world ?? { updatedAt: 0 }) };
  const cur = { name: groupName(meta, id), members: groupMembers(meta, id) };
  const next = change(cur);
  if (id === GROUP.id) world.group = next ? { ...world.group, name: next.name, members: next.members } : world.group;
  else {
    const old = world.groups?.[id];
    world.groups = { ...world.groups, [id]: next ? { by: old?.by ?? "me", at: old?.at ?? now, ...next, updatedAt: now } : { ...old!, gone: true, updatedAt: now } };
  }
  world.updatedAt = now;
  meta = { ...meta, world };
  saveMeta();
  const t = getThread(id);
  let at = now;
  saveThread({ ...t, messages: [...t.messages, ...lines.map((en) => sysLine(en, "me", at++))] });
  void writeBrief(true);
}

const namesOf = (ids: string[]) => ids.map((x) => whoOf(x, meta)?.name ?? x).join(", ");

/** The learner makes a group of their own with whom they like; the people find themselves in it and react. Returns its chat id. */
export function createGroup(name: string, members: string[]): string {
  const id = `g-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const n = name.trim() || "Nova turba";
  changeGroups(id, () => ({ name: n, members }), [`You created the group «${n}».`, `You added ${namesOf(members)}.`]);
  // they find themselves in it, and say something (or not)
  answerSoon(id);
  return id;
}

export const renameGroup = (id: string, name: string) => name.trim() && changeGroups(id, (g) => ({ ...g, name: name.trim() }), [`You renamed the group «${name.trim()}».`]);

export function addToGroup(id: string, who: string[]) {
  const fresh = who.filter((x) => !groupMembers(meta, id).includes(x));
  if (!fresh.length) return;
  changeGroups(id, (g) => ({ ...g, members: [...g.members, ...fresh] }), [`You added ${namesOf(fresh)}.`]);
  answerSoon(id);
}

/** The learner takes someone out of a group: they notice, and it stays with them. */
export function removeFromGroup(id: string, who: string) {
  changeGroups(id, (g) => ({ ...g, members: g.members.filter((x) => x !== who) }), [`You removed ${namesOf([who])}.`]);
  remember({ memories: [{ who, text: `${getProgress().settings.me?.name ?? "The learner"} removed me from the group «${groupName(meta, id)}»`, kind: "conflict", weight: 3, about: ["me"] }], chat: id }, Date.now());
  answerSoon(id);
}

/** The people of a chat answer what just happened there, after a moment (one answer, however many changes). */
function answerSoon(id: string) {
  clearTimeout(pending.get(id));
  pending.set(id, setTimeout(() => void answer(id), 1500));
}

/** The learner leaves (and so deletes) a group of their own or one the people started. */
export const leaveGroup = (id: string) => id !== GROUP.id && changeGroups(id, () => null, ["You left the group."]);

/** The learner wants to write to someone from the story: Claude makes them real. Returns their chat id. */
export async function storyPerson(text: string, signal?: AbortSignal): Promise<{ id: string } | { error: string }> {
  const ctx = promptCtx();
  if (!ctx) return { error: "Tell the people your name first." };
  const d = await deps();
  if ("error" in d) return d;
  try {
    const res = await meetFromStory(text, meta, ctx, { ...d, ask: (p, o) => d.ask(p, { ...o, signal }) });
    if ("existing" in res) {
      const t = getThread(res.existing);
      if (t.gone) saveThread({ ...t, gone: false });
      if (meta.strangers[res.existing] && !meta.strangers[res.existing].story) meta = { ...meta, strangers: { ...meta.strangers, [res.existing]: { ...meta.strangers[res.existing], story: true } } };
      saveMeta();
      return { id: res.existing };
    }
    meta = { ...meta, strangers: { ...meta.strangers, [res.stranger.id]: res.stranger }, life: { ...meta.life, [res.stranger.id]: res.life } };
    saveMeta();
    saveThread(newThread(res.stranger.id, "stranger"));
    void writeBrief(true);
    return { id: res.stranger.id };
  } catch (e) {
    return { error: (e as { code?: string })?.code === "no_person" ? "Claude could not tell who that is. Say a little more about them." : errorText(e) };
  }
}
