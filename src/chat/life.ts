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
  /** When it began. */
  eventAt?: number;
  /** It is known around them (see Happening.public). */
  public?: boolean;
  /** A big thing in their life: something comes after it (`then`). */
  heavy?: boolean;
  then?: Happening[];
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
  { en: "had a loud fight with a neighbour", mood: "angry", hours: [3, 10], public: true },
  { en: "has a toothache", mood: "miserable", hours: [8, 30] },
  { en: "got bad news in a letter from far away", mood: "sad", hours: [12, 48] },
  { en: "it is a public holiday with games in the arena", mood: "festive", hours: [8, 20], public: true },
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
  { en: "a goat has been following them around all day", mood: "baffled", hours: [4, 12], public: true },
  { en: "saw an omen in the clouds and thinks something big is coming", mood: "superstitious", hours: [6, 24] },
  { en: "found a mysterious old key in the street", mood: "curious", hours: [12, 48] },
  { en: "cannot stop laughing since the morning, for no reason", mood: "giddy", hours: [2, 6] },
  { en: "thinks they saw a ghost last night", mood: "spooked", hours: [6, 24] },
  { en: "decided to eat only figs for a week", mood: "determined", hours: [24, 96] },
  { en: "a fortune teller told them they will be famous", mood: "grandiose", hours: [12, 48] },
];

/** What real lives also bring, rarely: grief, illness, debt, heartbreak, trouble, a wedding. Long, and moods follow for days. */
export const HEAVY_HAPPENINGS: Happening[] = [
  {
    en: "a relative died; the funeral is in a few days",
    mood: "grieving",
    hours: [72, 240],
    public: true,
    heavy: true,
    then: [
      { en: "after the funeral, the family is quarrelling over the inheritance", mood: "bitter", hours: [48, 168], public: true },
      { en: "keeps the dead one's things and talks of them often", mood: "wistful", hours: [48, 120] },
    ],
  },
  {
    en: "fell seriously ill with a fever",
    mood: "miserable",
    hours: [48, 168],
    public: true,
    heavy: true,
    then: [
      { en: "is getting better, slowly, and very hungry", mood: "weak", hours: [24, 72] },
      { en: "is up again but weak, and grateful to be alive", mood: "grateful", hours: [24, 72] },
    ],
  },
  {
    en: "lost their job",
    mood: "desperate",
    hours: [72, 240],
    public: true,
    heavy: true,
    wants: "to find work again",
    then: [
      { en: "is looking for work and counting every coin", mood: "worried", hours: [72, 168] },
      { en: "found new work, worse paid, with a boss they dislike", mood: "sour", hours: [48, 120], public: true },
    ],
  },
  {
    en: "is deep in debt to a moneylender who has started to threaten them",
    mood: "anxious",
    hours: [72, 336],
    heavy: true,
    wants: "to get out of debt",
    then: [
      { en: "paid the moneylender back by selling something they loved", mood: "hollow", hours: [48, 120] },
      { en: "the moneylender's men came again, and they are hiding", mood: "scared", hours: [48, 120] },
    ],
  },
  {
    en: "a long love affair ended badly",
    mood: "heartbroken",
    hours: [48, 240],
    heavy: true,
    then: [
      { en: "is getting over it, and swears off love (for now)", mood: "defiant", hours: [48, 120] },
      { en: "the ex wants them back, and they do not know what to do", mood: "torn", hours: [48, 120] },
    ],
  },
  {
    en: "is to be married soon, not entirely by choice",
    mood: "nervous",
    hours: [168, 504],
    public: true,
    heavy: true,
    then: [
      { en: "the wedding happened, and they are getting used to married life", mood: "bewildered", hours: [72, 168], public: true },
      { en: "the wedding is off, and the families are not speaking", mood: "relieved", hours: [48, 168], public: true },
    ],
  },
  {
    en: "their home was robbed",
    mood: "furious",
    hours: [24, 96],
    public: true,
    heavy: true,
    then: [
      { en: "the thief was caught: a neighbour's son", mood: "vindicated", hours: [24, 72], public: true },
      { en: "nothing was ever found, so they bought a big dog", mood: "wary", hours: [48, 96], public: true },
    ],
  },
  {
    en: "a fire destroyed part of their street",
    mood: "shaken",
    hours: [48, 168],
    public: true,
    heavy: true,
    then: [
      { en: "is sleeping at a friend's while the street is rebuilt", mood: "restless", hours: [72, 168], public: true },
      { en: "their house was spared, but the street smells of smoke for days", mood: "thankful", hours: [24, 72], public: true },
    ],
  },
  {
    en: "has been accused in court of something they did not do",
    mood: "scared",
    hours: [96, 336],
    public: true,
    heavy: true,
    wants: "to clear their name",
    then: [
      { en: "the court cleared them, and they want the accuser punished", mood: "vengeful", hours: [48, 120], public: true },
      { en: "the case drags on, and the lawyer costs a fortune", mood: "weary", hours: [72, 168], public: true },
    ],
  },
  {
    en: "fell head over heels for someone utterly unsuitable",
    mood: "infatuated",
    hours: [48, 240],
    heavy: true,
    then: [
      { en: "it came to nothing, and they are embarrassed", mood: "sheepish", hours: [24, 72] },
      { en: "it is going on, in secret", mood: "giddy", hours: [72, 168] },
    ],
  },
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
 * within it); when nothing is going on, something new may start, or not. What
 * comes after a heavy happening always comes (its consequences); a heavy one
 * starts only when `heavyOk` (the world has been calm: chat/lives.ts), and
 * their own heavy ones come seldom even then. `started`: a happening that has
 * just begun.
 */
export function lifeNow(spec: LifeSpec, prev: Life | undefined, now: number, r: Rand = Math.random, heavyOk = true): { life: Life; changed: boolean; started?: Happening } {
  const eventGoes = !!prev?.event && (prev.eventUntil ?? 0) > now;
  if (prev && prev.moodUntil > now && (eventGoes || !prev.event)) return { life: prev, changed: false };
  const recent = prev?.recent ?? [];
  let h: Happening | undefined;
  if (!eventGoes && prev?.event && prev.then?.length) h = pick(r, prev.then);
  else if (!eventGoes && r() < 0.55) {
    // their own kind of happening most of the time; sometimes an everyday one; now and then an odd one; rarely a heavy one
    const x = r();
    let pool = x < 0.66 && spec.happenings.length ? spec.happenings : x < 0.84 ? COMMON_HAPPENINGS : x < 0.97 ? ODD_HAPPENINGS : HEAVY_HAPPENINGS;
    const light = pool.filter((p) => !p.heavy);
    if (!heavyOk || (pool === spec.happenings && r() > 0.12)) pool = light.length ? light : COMMON_HAPPENINGS;
    const fresh = pool.filter((p) => !recent.includes(p.en));
    h = pick(r, fresh.length ? fresh : pool);
  }
  const mood = h?.mood && r() < 0.8 ? h.mood : r() < 0.12 ? pick(r, ANY_MOODS) : weightedPick(r, spec.moods);
  const going = eventGoes ? prev! : undefined;
  const life: Life = {
    mood,
    level: rollLevel(r, spec.swing),
    moodUntil: now + between(r, [2, 9]) * HOUR,
    ...(h
      ? { event: h.en, eventUntil: now + between(r, h.hours) * HOUR, eventAt: now, ...(h.public ? { public: true } : {}), ...(h.heavy ? { heavy: true } : {}), ...(h.then?.length ? { then: h.then } : {}) }
      : going
        ? { event: going.event, eventUntil: going.eventUntil, ...(going.eventAt ? { eventAt: going.eventAt } : {}), ...(going.public ? { public: true } : {}), ...(going.heavy ? { heavy: true } : {}), ...(going.then ? { then: going.then } : {}) }
        : {}),
    recent: h && h.en !== prev?.event ? [h.en, ...recent].slice(0, 4) : recent,
    rolled: now,
  };
  return { life, changed: true, ...(h ? { started: h } : {}) };
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
