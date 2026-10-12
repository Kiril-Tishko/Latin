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
  check?: { verdict: "good" | "almost" | "wrong"; better?: string; note: string };
  /** Words outside the learner's words that slipped through (shown dotted). */
  newWords?: string[];
  /** How it came: an answer, written on their own, by the phone routine, the first words of a stranger. */
  src?: "reply" | "own" | "routine" | "first";
}

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
