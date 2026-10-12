// The lives of the people in the messenger: what time it is where they are,
// whether they are asleep, busy or free, and what mood they are in and what is
// going on for them. Moods and happenings are rolled at random (the learner
// asked for randomness: normal days, strong moods, extreme ones, odd ones,
// something going on or nothing at all), and they change as time goes by.
import type { Day, Happening } from "../content/people";

// ------------------------------------------------------------------ time

export interface LocalTime {
  /** Hours since local midnight, with minutes as a fraction (21.5 = 21:30). */
  h: number;
  /** "21:30" */
  hm: string;
  /** "Monday" */
  weekday: string;
  /** "12 October" */
  date: string;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "long", day: "numeric", month: "long" });
    } catch {
      f = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "long", day: "numeric", month: "long" });
    }
    fmtCache.set(tz, f);
  }
  return f;
}

/** The time of day somewhere (an IANA time zone such as "Europe/Rome"). */
export function localTime(now: number, tz: string): LocalTime {
  const parts = Object.fromEntries(fmt(tz).formatToParts(new Date(now)).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  return { h: hour + minute / 60, hm: `${String(hour).padStart(2, "0")}:${parts.minute}`, weekday: parts.weekday, date: `${parts.day} ${parts.month}` };
}

/** The device's time zone, or Kyiv's. */
export function deviceZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Kyiv";
  } catch {
    return "Europe/Kyiv";
  }
}

/** A part of the day in words, for the people's sense of time. */
export function partOfDay(h: number): string {
  if (h < 5) return "the middle of the night";
  if (h < 8) return "early morning";
  if (h < 12) return "morning";
  if (h < 14) return "midday";
  if (h < 18) return "afternoon";
  if (h < 22) return "evening";
  return "late evening";
}

// ------------------------------------------------------------ the day

export interface Status {
  state: "asleep" | "busy" | "free";
  /** What they are busy with ("at work in the office"). */
  what?: string;
  /** When this state ends (ms). */
  until: number;
}

/** Is local hour h inside [from, to), where to may be past midnight (26 = 2 a.m.)? */
function within(h: number, from: number, to: number): boolean {
  const f = ((from % 24) + 24) % 24;
  const t = ((to % 24) + 24) % 24;
  return f <= t ? h >= f && h < t : h >= f || h < t;
}

const HOUR = 3600_000;

/** Asleep, busy or free right now, and until when. */
export function statusAt(day: Day, tz: string, now: number): Status {
  const { h } = localTime(now, tz);
  const boundaries = [day.wake, day.sleep, ...day.busy.flatMap(([a, b]) => [a, b])].map((b) => ((b % 24) + 24) % 24);
  const ahead = Math.min(...boundaries.map((b) => (((b - h) % 24) + 24) % 24 || 24));
  const until = now + ahead * HOUR;
  if (!within(h, day.wake, day.sleep)) return { state: "asleep", until };
  const busy = day.busy.find(([a, b]) => within(h, a, b));
  return busy ? { state: "busy", what: busy[2], until } : { state: "free", until };
}

/** When they next wake up (ms), if asleep now. */
export function nextWake(day: Day, tz: string, now: number): number {
  const { h } = localTime(now, tz);
  const ahead = (((day.wake - h) % 24) + 24) % 24 || 24;
  return now + ahead * HOUR;
}

// --------------------------------------------------------------- moods

export type Rand = () => number;

export interface Life {
  mood: string;
  /** "slightly", "" (plainly) or "extremely". */
  level: "slightly" | "" | "extremely";
  moodUntil: number;
  /** What is going on, if anything (English). */
  event?: string;
  eventUntil?: number;
  /** The last happenings, so they do not repeat at once. */
  recent: string[];
  rolled: number;
}

export interface LifeSpec {
  moods: [string, number][];
  /** How strongly moods swing, 0-1: more extremes. */
  swing: number;
  happenings: Happening[];
}

/** Things that can happen to anyone. */
export const COMMON_HAPPENINGS: Happening[] = [
  { en: "slept badly last night", mood: "tired", hours: [6, 14] },
  { en: "had a wonderful dinner with friends", mood: "content", hours: [4, 12] },
  { en: "had a loud fight with a neighbour", mood: "angry", hours: [3, 10] },
  { en: "has a toothache", mood: "miserable", hours: [8, 30] },
  { en: "got bad news in a letter from far away", mood: "sad", hours: [12, 48] },
  { en: "it is a public holiday with games in the arena", mood: "festive", hours: [8, 20] },
  { en: "it is terribly hot today", mood: "lazy", hours: [6, 12] },
  { en: "lost something important and cannot find it", mood: "anxious", hours: [3, 16] },
  { en: "someone gave them an unexpected gift", mood: "happy", hours: [4, 16] },
  { en: "had a very strange dream", mood: "puzzled", hours: [3, 10] },
  { en: "is bored out of their mind", mood: "bored", hours: [2, 8] },
  { en: "is in a hurry all day", mood: "stressed", hours: [4, 10] },
];

/** Odd things, now and then, even for the most normal people. */
export const ODD_HAPPENINGS: Happening[] = [
  { en: "is convinced their neighbour is a werewolf", mood: "suspicious", hours: [12, 48] },
  { en: "a goat has been following them around all day", mood: "baffled", hours: [4, 12] },
  { en: "saw an omen in the clouds and thinks something big is coming", mood: "superstitious", hours: [6, 24] },
  { en: "found a mysterious old key in the street", mood: "curious", hours: [12, 48] },
  { en: "cannot stop laughing since the morning, for no reason", mood: "giddy", hours: [2, 6] },
  { en: "thinks they saw a ghost last night", mood: "spooked", hours: [6, 24] },
  { en: "decided to eat only figs for a week", mood: "determined", hours: [24, 96] },
  { en: "a fortune teller told them they will be famous", mood: "grandiose", hours: [12, 48] },
];

/** Moods anyone can fall into now and then, whatever their nature. */
const ANY_MOODS = ["cheerful", "bored", "tired", "curious", "nostalgic", "silly", "sad", "excited", "grumpy", "dreamy", "restless"];

function pick<T>(r: Rand, xs: T[]): T {
  return xs[Math.floor(r() * xs.length) % xs.length];
}

function weightedPick(r: Rand, xs: [string, number][]): string {
  let roll = r() * xs.reduce((s, [, w]) => s + w, 0);
  for (const [x, w] of xs) if ((roll -= w) < 0) return x;
  return xs[xs.length - 1][0];
}

const between = (r: Rand, [a, b]: [number, number]) => a + r() * (b - a);

function rollLevel(r: Rand, swing: number): Life["level"] {
  const x = r();
  if (x < 0.25 * (1 - swing) + 0.08) return "slightly";
  if (x > 0.92 - 0.3 * swing) return "extremely";
  return "";
}

/**
 * Their life now: a happening keeps going until it is over (moods change
 * within it); when nothing is going on, something new may start, or not.
 */
export function lifeNow(spec: LifeSpec, prev: Life | undefined, now: number, r: Rand = Math.random): { life: Life; changed: boolean } {
  const eventGoes = !!prev?.event && (prev.eventUntil ?? 0) > now;
  if (prev && prev.moodUntil > now && (eventGoes || !prev.event)) return { life: prev, changed: false };
  const recent = prev?.recent ?? [];
  let event = eventGoes ? prev!.event : undefined;
  let eventUntil = eventGoes ? prev!.eventUntil : undefined;
  let eventMood: string | undefined;
  if (!eventGoes && r() < 0.55) {
    // their own kind of happening most of the time; sometimes an everyday one; now and then an odd one
    const x = r();
    const pool = x < 0.72 && spec.happenings.length ? spec.happenings : x < 0.9 ? COMMON_HAPPENINGS : ODD_HAPPENINGS;
    const fresh = pool.filter((h) => !recent.includes(h.en));
    const h = pick(r, fresh.length ? fresh : pool);
    event = h.en;
    eventUntil = now + between(r, h.hours) * HOUR;
    eventMood = h.mood;
  }
  const mood = eventMood && r() < 0.8 ? eventMood : r() < 0.12 ? pick(r, ANY_MOODS) : weightedPick(r, spec.moods);
  const life: Life = {
    mood,
    level: rollLevel(r, spec.swing),
    moodUntil: now + between(r, [2, 9]) * HOUR,
    event,
    eventUntil,
    recent: event && event !== prev?.event ? [event, ...recent].slice(0, 4) : recent,
    rolled: now,
  };
  return { life, changed: true };
}

/** "extremely grumpy", "slightly bored", "cheerful". */
export const moodText = (l: Life) => `${l.level ? `${l.level} ` : ""}${l.mood}`;

// ------------------------------------------------------------- replies

/** When they read a message sent now, and when they start answering. */
export function replyTiming(day: Day, tz: string, now: number, r: Rand = Math.random): { readAt: number; startAt: number; why: string } {
  const s = statusAt(day, tz, now);
  const sec = 1000;
  const min = 60 * sec;
  if (s.state === "asleep") {
    // one in twenty: woken up by the phone, and not pleased
    if (r() < 0.05) {
      const readAt = now + between(r, [1, 6]) * min;
      return { readAt, startAt: readAt + between(r, [10, 40]) * sec, why: "the message woke them up" };
    }
    const readAt = nextWake(day, tz, now) + between(r, [3, 45]) * min;
    return { readAt, startAt: readAt + between(r, [20, 240]) * sec, why: "they were asleep and read it after waking up" };
  }
  if (s.state === "busy") {
    if (r() < 0.35) {
      const readAt = now + between(r, [0.5, 4]) * min;
      return { readAt, startAt: readAt + between(r, [5, 30]) * sec, why: `they are busy (${s.what}) and answer quickly in between` };
    }
    const readAt = Math.min(now + between(r, [4, 50]) * min, s.until + between(r, [1, 10]) * min);
    return { readAt, startAt: readAt + between(r, [5, 60]) * sec, why: `they were busy (${s.what})` };
  }
  // free: usually within a minute, sometimes a while later
  const quick = r() < 0.75;
  const readAt = now + (quick ? between(r, [3, 50]) * sec : between(r, [2, 15]) * min);
  return { readAt, startAt: readAt + between(r, [2, 12]) * sec, why: quick ? "they are free" : "they were away from their tablet for a bit" };
}

/** How long typing a message takes (ms). */
export const typingTime = (text: string) => Math.min(14_000, 1200 + text.length * 95);

/** A steady pseudo-random number for a key (the same every time). */
export function hashRand(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}
