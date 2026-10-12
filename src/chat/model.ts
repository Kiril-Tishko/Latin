// The messenger's data: threads of messages, the people's lives, strangers met.
// Stored in the learner's private space: data/users/<id>/messenger (meta) and
// data/users/<id>/messenger/threads/<thread> (one document per conversation).
import type { Day } from "../content/people";
import { GROUP, PEOPLE, PERSON_BY_ID } from "../content/people";
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
  /** A voice message: `la` is what they say (played with the device's voice). */
  voice?: boolean;
  /** A photo sent with the message (content/photos.ts); `la` is its caption. */
  photo?: string;
  /** The message this one answers, shown quoted above it (its id). */
  re?: string;
  /** Reactions, by who reacted ("me" or a person's id): the emoji and when it shows; an empty emoji is one taken back. */
  reactions?: Record<string, { e: string; at: number }>;
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
  /** A person's id, "amici" (the group) or a stranger's id. */
  id: string;
  kind: "dm" | "group" | "stranger";
  messages: Msg[];
  /** The learner has seen everything up to here (ms). */
  readAt: number;
  /** What they remember about the learner (English). */
  memory: string[];
  updatedAt: number;
  /** A stranger the learner said goodbye to: hidden from the list. */
  gone?: boolean;
}

export interface Meta {
  v: 1;
  /** When the learner last had the messenger open. */
  seenAt: number;
  /** When the people last decided on their own what to write. */
  plannedAt: number;
  life: Record<string, Life>;
  strangers: Record<string, Stranger>;
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
    link: s.link,
    stranger: true,
  };
}

/** Who is in a thread. */
export function membersOf(threadId: string, meta: Meta): Who[] {
  if (threadId === GROUP.id) return PEOPLE.map((p) => ({ ...p, stranger: false }));
  const w = whoOf(threadId, meta);
  return w ? [w] : [];
}

export const newThread = (id: string, kind: Thread["kind"]): Thread => ({ id, kind, messages: [], readAt: 0, memory: [], updatedAt: 0 });

export const msgId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Messages that have arrived by now. */
export const arrived = (t: Thread, now: number) => t.messages.filter((m) => m.at <= now);

/** Messages from the others the learner has not seen yet. */
export const unreadCount = (t: Thread, now: number) => t.messages.filter((m) => m.from !== "me" && m.at <= now && m.at > t.readAt).length;

/** A message in one line, for lists and notices: a voice message and a photo say what they are. */
export function preview(m: Msg): string {
  if (m.voice) return "🎤 Voice message";
  if (m.photo) return `📷 ${m.la || "Photo"}`;
  return m.la;
}

/** How someone sounds in a voice message: their pitch and pace (the device's voice, made theirs). */
export function voiceOf(who: Pick<Who, "g" | "age"> & { voice?: { pitch: number; rate: number } }): { g: "m" | "f"; pitch: number; rate: number } {
  if (who.voice) return { g: who.g, ...who.voice };
  const old = who.age >= 55;
  return { g: who.g, pitch: who.g === "m" ? (old ? 0.75 : 0.9) : old ? 1.0 : 1.15, rate: old ? 0.8 : 0.9 };
}
