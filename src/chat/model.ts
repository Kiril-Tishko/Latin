// The messenger's data: threads of messages, the people's lives, strangers met.
// Stored in the learner's private space: data/users/<id>/messenger (meta) and
// data/users/<id>/messenger/threads/<thread> (one document per conversation).
import type { Day } from "../content/people";
import { GROUP, PEOPLE, PERSON_BY_ID } from "../content/people";
import type { Gain, Levels, Tie } from "./bond";
import type { Goal, WorldEvent } from "./lives";
import type { Life } from "./life";
import type { Stranger } from "./strangers";

export interface Msg {
  id: string;
  /** A person's id, or "me" for the learner. */
  from: string;
  /** The Latin as written. */
  la: string;
  /** The English (people's messages). */
  en?: string;
  /** When it shows (ms); later than now = still on its way. */
  at: number;
  /** The learner's message: when it was read (in a chat with one person). */
  readAt?: number;
  /** The learner's message: the coach's check, when asked. */
  /** The coach on this message: its Latin judged, or ("say") English the learner wanted in Latin, with the Latin. */
  check?: { verdict: "good" | "almost" | "wrong" | "say"; better?: string; note: string };
  /** Words outside the learner's words that slipped through (shown dotted). */
  newWords?: string[];
  /** How it came: an answer, written on their own, by the phone routine, the first words of a stranger. */
  src?: "reply" | "own" | "routine" | "first";
  /** A voice message: `la` is what they say (played with the device's voice until its recording comes). */
  voice?: boolean;
  /** A voice message's recording, in the sender's own voice: its id in messenger/pics (see Pic, chat/voices.ts). */
  rec?: string;
  /** A photo sent with the message (content/photos.ts); `la` is its caption. */
  photo?: string;
  /** A picture made for this message, or one the learner sent: its id in messenger/pics (see Pic); `la` is its caption. */
  pic?: string;
  /** What that picture shows (English): what the sender asked for, or what the people saw in the learner's photo. */
  picEn?: string;
  /** The message this one answers, shown quoted above it (its id). */
  re?: string;
  /** Reactions, by who reacted ("me" or a person's id): the emoji and when it shows; an empty emoji is one taken back. */
  reactions?: Record<string, { e: string; at: number }>;
  /** A post of the Ācta Diurna: its title, and its kind (the day, the city, the friends, a notice, a wonder); `la` and `en` hold its lines, one per line. */
  title?: { la: string; en: string };
  tag?: string;
  /** A line of the messenger itself ("Lūcius left the group"), from "sys": `en` is its text, `by` who did it. */
  by?: string;
  /** Deleted by its writer at that moment: afterwards it shows as a deleted message. */
  deletedAt?: number;
  /** New words a person used in a strong moment, with their meanings (tap one to see it). */
  gloss?: Record<string, string>;
}

/** The writer of the messenger's own lines ("Lūcius left the group"). */
export const SYS = "sys";

/** A storyline among the people (a romance, a feud, a secret, a debt), with who is in it; who knows what is in its text. */
export interface Drama {
  id: string;
  en: string;
  who: string[];
  /** Who knows of it (those in it, unless told otherwise); only they can speak of it. */
  knows?: string[];
  since: number;
  updatedAt: number;
}

/**
 * What the people have done that changes the messenger itself, as real people
 * do: the group's name and who is in it, who has blocked the learner, who is
 * away and where, the status lines they set, and the storylines among them.
 */
export interface World {
  /** The friends' group («Amīcī»). */
  group?: { name?: string; members?: string[] };
  /** Other groups: the learner's own and any the people start, by chat id ("g-…"). */
  groups?: Record<string, GroupInfo>;
  blocked?: Record<string, number>;
  away?: Record<string, { until: number; where: string }>;
  status?: Record<string, { text: string; at: number }>;
  dramas?: Drama[];
  /** What happened in their world, and who knows it (chat/lives.ts). */
  timeline?: WorldEvent[];
  updatedAt: number;
}

/** A group besides the friends' own: its name, who is in it, who started it ("me" for the learner), and when. */
export interface GroupInfo {
  name: string;
  members: string[];
  by: string;
  at: number;
  /** The learner left it, or deleted it: it leaves the list. */
  gone?: boolean;
  updatedAt: number;
}

/** Is this chat a group: the friends' group, or another one? */
export const isGroupId = (id: string, meta: Meta) => id === GROUP.id || !!meta.world?.groups?.[id];
/** The groups the learner is in now. */
export const groupIds = (meta: Meta): string[] => [GROUP.id, ...Object.entries(meta.world?.groups ?? {}).filter(([, g]) => !g.gone).map(([id]) => id)];
/** A group's members now (the friends' group: the five friends to begin with; people leave and join). */
export const groupMembers = (meta: Meta, id: string = GROUP.id): string[] =>
  id === GROUP.id ? meta.world?.group?.members ?? PEOPLE.map((p) => p.id) : meta.world?.groups?.[id]?.members ?? [];
/** A group's name now (Amīcī, until someone renames it). */
export const groupName = (meta: Meta, id: string = GROUP.id): string => (id === GROUP.id ? meta.world?.group?.name || GROUP.name : meta.world?.groups?.[id]?.name || "Group");
/** The groups someone is in now, by name. */
export const groupsOf = (meta: Meta, who: string): string[] => groupIds(meta).filter((g) => groupMembers(meta, g).includes(who));
/** Has this person blocked the learner? */
export const isBlocked = (meta: Meta, id: string) => !!meta.world?.blocked?.[id];
/** Where someone is away, if they are, now. */
export const awayNow = (meta: Meta, id: string, now: number) => {
  const a = meta.world?.away?.[id];
  return a && a.until > now ? a : undefined;
};

/** Two copies of the world together: the newer one, with the storylines of both by id (the newer of each). */
export function mergeWorld(a: World | undefined, b: World | undefined): World | undefined {
  if (!a || !b) return a ?? b;
  const [older, newer] = a.updatedAt > b.updatedAt ? [b, a] : [a, b];
  const dramas = new Map((older.dramas ?? []).map((d) => [d.id, d]));
  for (const d of newer.dramas ?? []) if (!dramas.has(d.id) || d.updatedAt >= dramas.get(d.id)!.updatedAt) dramas.set(d.id, d);
  // groups: each the newer copy, from either side
  const groups = { ...(older.groups ?? {}) };
  for (const [id, g] of Object.entries(newer.groups ?? {})) if (!groups[id] || g.updatedAt >= groups[id].updatedAt) groups[id] = g;
  // the timeline: every event from either side, once
  const timeline = new Map([...(older.timeline ?? []), ...(newer.timeline ?? [])].map((e) => [e.id, e]));
  return { ...newer, dramas: [...dramas.values()], groups, ...(timeline.size ? { timeline: [...timeline.values()].sort((a, b) => a.at - b.at).slice(-60) } : {}) };
}

/** The emoji anyone may react with: the learner's bar, and what the people may choose. */
export const REACTIONS = ["❤️", "😂", "👍", "😮", "😢", "🙏", "😡", "🔥"];

/** The reactions on a message to show now: emoji with who gave them, in the order they came. */
export function reactionsOf(m: Msg, now: number): { e: string; who: string[] }[] {
  const out: { e: string; who: string[] }[] = [];
  const given = Object.entries(m.reactions ?? {})
    .filter(([, r]) => r.e && r.at <= now)
    .sort((a, b) => a[1].at - b[1].at);
  for (const [who, r] of given) {
    const same = out.find((x) => x.e === r.e);
    if (same) same.who.push(who);
    else out.push({ e: r.e, who: [who] });
  }
  return out;
}

/** Two copies of a message's reactions together: for each person, the newer one (taking one back included). */
export function mergeReactions(a: Msg["reactions"], b: Msg["reactions"]): Msg["reactions"] {
  if (!a) return b;
  if (!b) return a;
  const out = { ...a };
  for (const [who, r] of Object.entries(b)) if (!out[who] || r.at >= out[who].at) out[who] = r;
  return out;
}

/** The coach's check of a message the learner wrote. */
export type Check = NonNullable<Msg["check"]>;

/** The coach's window beside a chat: checks of the learner's messages, and questions about them with the answers. */
export type CoachTurn =
  | { kind: "check"; draft: string; res: Check; at: number }
  | { kind: "q"; text: string; at: number }
  | { kind: "a"; text: string; at: number };

export interface Thread {
  /** A person's id, "amici" (the group), a stranger's id, or "acta" (the Ācta Diurna). */
  id: string;
  kind: "dm" | "group" | "stranger" | "channel";
  messages: Msg[];
  /** The learner has seen everything up to here (ms). */
  readAt: number;
  /** What they remember about the learner (English). */
  memory: string[];
  updatedAt: number;
  /** A stranger the learner said goodbye to: hidden from the list. */
  gone?: boolean;
  /** The learner cleared the chat then: earlier messages no longer show (the people still remember). */
  clearedAt?: number;
}

/**
 * How someone feels about the learner: private (never shown; it shows only in
 * how they write), grown from everything that happened between them.
 */
export interface Bond {
  /** In their own words, first person ("He laughed at my poem. I am not talking to him today."). */
  feel: string;
  /** What happened between them worth remembering, oldest first ("12 Oct: mocked my poem"). */
  moments: string[];
  /** Ignoring the learner until then (ms): the silent treatment. */
  silentUntil?: number;
  /** Where they stand with the learner, 0-10, as it was at `lvAt` (chat/bond.ts); unset until first measured. */
  lv?: Levels;
  lvAt?: number;
  /** How much each level grew on one day (growth has a daily limit). */
  gain?: Gain;
  updatedAt: number;
}

/** How many moments a bond keeps. */
export const MOMENTS = 14;

/** Two copies of the bonds together: for each person, the newer one. */
export function mergeBonds(a: Record<string, Bond> | undefined, b: Record<string, Bond> | undefined): Record<string, Bond> {
  const out = { ...(a ?? {}) };
  for (const [id, x] of Object.entries(b ?? {})) if (!out[id] || x.updatedAt >= out[id].updatedAt) out[id] = x;
  return out;
}

/** Is someone ignoring the learner now? */
export const silentNow = (bond: Bond | undefined, now: number) => !!bond?.silentUntil && bond.silentUntil > now;

export interface Meta {
  v: 1;
  /** When the learner last had the messenger open. */
  seenAt: number;
  /** When the people last decided on their own what to write. */
  plannedAt: number;
  /** When the day's Ācta Diurna was last asked for (so two devices do not both write it). */
  actaAt?: number;
  life: Record<string, Life>;
  strangers: Record<string, Stranger>;
  /** How each person feels about the learner (see Bond). */
  bonds?: Record<string, Bond>;
  /** How they see each other, where something has changed (chat/bond.ts; "from>to"). */
  ties?: Record<string, Tie>;
  /** What each of them wants from life, as it goes (chat/lives.ts); a friend without any here has their first wants. */
  goals?: Record<string, Goal[]>;
  /** What the people did to the messenger itself (see World). */
  world?: World;
  /** What the learner chose: people they blocked, chats they muted. */
  mine?: Mine;
}

/** The learner's own choices: whom they blocked, which chats they muted (no notices, no count, no phone notification). */
export interface Mine {
  blocked: string[];
  muted: string[];
  updatedAt: number;
}

/** Has the learner blocked this person? */
export const iBlocked = (meta: Meta, id: string) => !!meta.mine?.blocked.includes(id);
/** Has the learner muted this chat? */
export const isMuted = (meta: Meta, chat: string) => !!meta.mine?.muted.includes(chat);
/** Two copies of the learner's choices: the newer one. */
export const mergeMine = (a: Mine | undefined, b: Mine | undefined) => (!a || !b ? a ?? b : a.updatedAt > b.updatedAt ? a : b);

/**
 * A picture in a chat: one the people sent, made by an image generator from
 * what Claude said it shows (`prompt`; it waits as "wanted" until made), or a
 * photo the learner sent. Kept in its own document (messenger/pics/<id>), as a
 * small WebP or JPEG in base64; `en` says what it shows, for the people and
 * for the learner.
 */
export interface Pic {
  id: string;
  by: string;
  en: string;
  prompt?: string;
  status: "wanted" | "done" | "failed";
  type?: string;
  b64?: string;
  at: number;
  /** A voice message's recording (an MP3) instead of a picture: `prompt` is what the voice reads, `voice` whose voice. */
  kind?: "voice";
  voice?: string;
  /** How long a recording lasts (seconds). */
  secs?: number;
}

export const newMeta = (): Meta => ({ v: 1, seenAt: 0, plannedAt: 0, life: {}, strangers: {} });

/** Anyone who can write: one of the five friends or a stranger. */
export interface Who {
  id: string;
  name: string;
  voc: string;
  g: "m" | "f";
  age: number;
  portrait: string;
  flip?: boolean;
  city: string;
  tz: string;
  job: string;
  about: string;
  style: string;
  day: Day;
  /** Friends: how they stand with the others. Strangers: their temper, quirk and reason to write. */
  ties?: Record<string, string>;
  traits?: string[];
  quirk?: string;
  why?: string;
  secret?: string;
  /** A stranger: how they know one of the friends. */
  link?: { to: string; how: string };
  /** A friend's voice in voice messages. */
  voice?: { pitch: number; rate: number };
  /** How they are with people they care about (friends; strangers have their temper). */
  heart?: string;
  /** How they feel about the learner before anything has happened. */
  first?: string;
  stranger: boolean;
}

export function whoOf(id: string, meta: Meta): Who | null {
  const p = PERSON_BY_ID.get(id);
  if (p) return { ...p, stranger: false };
  const s = meta.strangers[id];
  if (!s) return null;
  return {
    id: s.id,
    name: s.name,
    voc: s.voc,
    g: s.g,
    age: s.age,
    portrait: s.portrait,
    flip: s.flip,
    city: s.city,
    tz: s.tz,
    job: s.job,
    about: s.about ?? `A ${s.age}-year-old ${s.job} from ${s.city}.`,
    style: s.style,
    day: s.day,
    traits: s.traits,
    quirk: s.quirk,
    why: s.why,
    secret: s.secret,
    first: s.first,
    link: s.link,
    stranger: true,
  };
}

/** Who is in a thread. */
export function membersOf(threadId: string, meta: Meta): Who[] {
  if (isGroupId(threadId, meta)) return groupMembers(meta, threadId).map((id) => whoOf(id, meta)).filter((w): w is Who => !!w);
  const w = whoOf(threadId, meta);
  return w ? [w] : [];
}

export const newThread = (id: string, kind: Thread["kind"]): Thread => ({ id, kind, messages: [], readAt: 0, memory: [], updatedAt: 0 });

/** A text cut to at most `n` characters, at the end of a sentence or a word, with "…" when cut mid-sentence. */
export function clip(s: string, n: number): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (end > n * 0.6) return cut.slice(0, end + 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > n * 0.5 ? cut.slice(0, space) : cut).replace(/[\s,;:–-]+$/, "")}…`;
}

export const msgId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** A message arriving `ms` later: one taken back seconds after it is sent is taken back that much later too. */
export const delayed = (m: Msg, ms: number): Msg => (ms ? { ...m, at: m.at + ms, ...(m.deletedAt ? { deletedAt: m.deletedAt + ms } : {}) } : m);

/** Messages that have arrived by now. */
export const arrived = (t: Thread, now: number) => t.messages.filter((m) => m.at <= now);

/** Messages from the others the learner has not seen yet. */
export const unreadCount = (t: Thread, now: number) => t.messages.filter((m) => m.from !== "me" && m.from !== SYS && m.at <= now && m.at > t.readAt).length;

/** Is a message deleted by now? */
export const deletedNow = (m: Msg, now: number) => !!m.deletedAt && m.deletedAt <= now;

/** A message in one line, for lists and notices: a voice message and a photo say what they are. */
export function preview(m: Msg, now = Infinity): string {
  if (m.from === SYS) return m.en ?? "";
  if (deletedNow(m, now)) return "🚫 Message deleted";
  if (m.title) return m.title.la;
  if (m.voice) return "🎤 Voice message";
  if (m.photo || m.pic) return `📷 ${m.la || "Photo"}`;
  return m.la;
}

/** How someone sounds in a voice message: their pitch and pace (the device's voice, made theirs). */
export function voiceOf(who: Pick<Who, "g" | "age"> & { voice?: { pitch: number; rate: number } }): { g: "m" | "f"; pitch: number; rate: number } {
  if (who.voice) return { g: who.g, ...who.voice };
  const old = who.age >= 55;
  return { g: who.g, pitch: who.g === "m" ? (old ? 0.75 : 0.9) : old ? 1.0 : 1.15, rate: old ? 0.8 : 0.9 };
}
