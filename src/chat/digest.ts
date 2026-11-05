// What the phone routine's helper needs to check and time what it writes
// (scripts/nuntii-routine.py), written by the page beside the brief, in
// `…/messenger/brief/digest`. The data tool keeps the page's documents out of
// files: the routine reads them into its conversation, and copies only this
// summary into the helper's file. So it is small and nearly all numbers:
// times as minutes from `t0`, ids, flags, the words of what the people said as
// short fingerprints (for repeats), the allowed spellings; `sum` lets the
// helper see a copy that came out wrong. Beside it, the chats as text, for the
// routine to read.
import { Brief, romeTime } from "./brief";
import { Meta, Msg, SYS, Thread, unreadCount, whoOf } from "./model";
import { plainWords } from "./pace";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
/** Days of what was said that still counts as said lately (the helper's REPEAT_DAYS). */
const REPEAT_DAYS = 14;
/** The most messages of a chat in the summary (the learner's last one always). */
const PER_CHAT = 40;
/** Each person's last messages in a chat whose words count for repeats (the helper's "said lately"). */
const SAID = 8;

/** A message: its minute from t0, who, how it came (0 on their own, 1 an answer, 2 by the phone routine), flags (1 a photo, 2 a picture, 4 a voice message, 8 deleted), the fingerprints of its words, the photo. */
export type DigestMsg = [number, string, number, number] | [number, string, number, number, string] | [number, string, number, number, string, string];

export interface DigestPerson {
  n: string;
  g: "m" | "f";
  tz: string;
  wake: number;
  sleep: number;
  busy: [number, number][];
  /** patience, minutes of waiting, tries after that. */
  pace: [number, number, number];
  burst: number;
  rate?: string;
  look?: string;
}

export interface Digest {
  v: 2;
  t0: number;
  /** When the learner was last in the messenger (minutes from t0). */
  seen: number;
  me: string;
  people: Record<string, DigestPerson>;
  groups: Record<string, string[]>;
  blocked: string[];
  blockedMe: string[];
  /** Until when someone gives the learner the silent treatment. */
  silent: Record<string, number>;
  muted: string[];
  forms: string[];
  /** Each chat: when the learner read it (null: never), and its messages that matter. */
  chats: Record<string, { read: number | null; m: DigestMsg[] }>;
  /** The messages of the last two hours and the ones planned for later (chat, from, minute, Latin, English): what the notification tells of them. */
  up: [string, string, number, string, string][];
  sum: string;
}

/** FNV-1a over the UTF-8 bytes (the helper's `fnv` is the same). */
export function fnv(s: string): number {
  let h = 2166136261;
  for (const b of new TextEncoder().encode(s)) h = Math.imul(h ^ b, 16777619) >>> 0;
  return h;
}

/** A word's fingerprint: what it was, not how it is spelled (the helper's `print_of`). */
export const printOf = (word: string) => (fnv(word) % 1679616).toString(36);

/** The data as one string, the same whatever the order of its keys (the helper's `canonical`). */
export function canonical(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(canonical).join(",")}]`;
  if (x && typeof x === "object")
    return `{${Object.keys(x)
      .filter((k) => (x as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((x as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(x);
}

const SRC: Record<string, number> = { own: 0, reply: 1, first: 1, routine: 2 };
const spoken = (m: Msg) => m.from !== "me" && m.from !== SYS;

/** The summary of the chats and the people for the routine's helper, at `now`. */
export function makeDigest(brief: Brief, meta: Meta, threads: Thread[], now: number): Digest {
  const t0 = Math.floor(now / MIN) * MIN;
  const min = (t: number) => Math.round((t - t0) / MIN);
  const people: Record<string, DigestPerson> = {};
  for (const p of brief.people)
    people[p.id] = {
      n: p.name,
      g: p.g,
      tz: p.tz,
      wake: p.wake,
      sleep: p.sleep,
      busy: p.busy.map(([a, b]) => [a, b]),
      pace: [p.pace.patience, Math.round(p.pace.wait * 60), p.pace.nudges],
      burst: p.burst,
      ...(p.photoRate ? { rate: p.photoRate } : {}),
      ...(p.look ? { look: p.look } : {}),
    };
  const chats: Digest["chats"] = {};
  const up: Digest["up"] = [];
  for (const t of threads) {
    if (t.gone || t.kind === "channel") continue;
    const msgs = [...t.messages].sort((a, b) => a.at - b.at);
    const last = msgs.map((m) => m.from).lastIndexOf("me");
    // what each said lately, for repeats: their last few here
    const said = new Set<Msg>();
    for (const who of new Set(msgs.filter(spoken).map((m) => m.from)))
      msgs.filter((m) => m.from === who && !m.deletedAt && m.at >= now - REPEAT_DAYS * DAY && m.at <= now).slice(-SAID).forEach((m) => said.add(m));
    // the pace needs what came since the learner last wrote, the group's rhythm and the photo habits the last three days, and photos sent lately
    const kept = msgs.filter((m, i) => i === last || said.has(m) || (spoken(m) && (i > last || m.at >= now - 3 * DAY || (m.photo && m.at >= now - 21 * DAY)))).slice(-PER_CHAT);
    if (last >= 0 && !kept.includes(msgs[last])) kept.unshift(msgs[last]);
    chats[t.id] = {
      read: t.readAt ? min(t.readAt) : null,
      m: kept.map((m): DigestMsg => {
        const flags = (m.photo ? 1 : 0) | (m.pic ? 2 : 0) | (m.voice ? 4 : 0) | (m.deletedAt ? 8 : 0);
        const words = said.has(m) ? [...new Set(plainWords(m.la).map(printOf))].join(".") : "";
        const base: [number, string, number, number] = [min(m.at), m.from, SRC[m.src ?? "reply"] ?? 1, flags];
        return m.photo ? [...base, words, m.photo] : words ? [...base, words] : base;
      }),
    };
    for (const m of msgs) if (spoken(m) && m.at > now - 2 * 60 * MIN && m.src !== "routine") up.push([t.id, m.from, min(m.at), m.la, m.en ?? ""]);
  }
  const data: Omit<Digest, "sum"> = {
    v: 2,
    t0,
    seen: min(meta.seenAt),
    me: brief.me.name,
    people,
    groups: Object.fromEntries(Object.entries(brief.groups).map(([id, g]) => [id, g.members])),
    blocked: brief.blocked,
    blockedMe: Object.keys(meta.world?.blocked ?? {}),
    silent: Object.fromEntries(Object.entries(meta.bonds ?? {}).flatMap(([id, b]) => ((b.silentUntil ?? 0) > now ? [[id, min(b.silentUntil!)]] : []))),
    muted: brief.muted,
    forms: brief.forms,
    chats,
    up,
  };
  return { ...data, sum: fnv(canonical(data)).toString(36) };
}

/**
 * The chats as the routine reads them: the last messages of each (Rome time,
 * the ones still on their way marked), and what each person said lately.
 */
export function digestText(meta: Meta, threads: Thread[], now: number, name: (id: string) => string): string {
  const who = (id: string) => (id === "me" ? name("me") : whoOf(id, meta)?.name ?? name(id));
  const shown = (m: Msg) => `${m.photo || m.pic ? `[photo: ${m.picEn ?? m.photo ?? "a photo"}] ` : m.voice ? "[voice] " : ""}${m.la}${m.deletedAt ? " (deleted)" : ""}`;
  const live = threads.filter((t) => !t.gone && t.kind !== "channel");
  const chats = live.map((t) => {
    const msgs = [...t.messages].sort((a, b) => a.at - b.at);
    const past = msgs.filter((m) => m.at <= now).slice(-10);
    const later = msgs.filter((m) => m.at > now);
    const lines = [
      ...past.map((m) => (m.from === SYS ? `    [${romeTime(m.at)}] (${m.en})` : `    [${romeTime(m.at)}] ${who(m.from)}: ${shown(m)}`)),
      ...later.map((m) => `    [on its way, arrives ${romeTime(m.at)}] ${who(m.from)}: ${shown(m)}`),
    ];
    return `- chat ${t.id}: ${unreadCount(t, now)} unseen by the learner\n${lines.join("\n") || "    (no messages yet)"}`;
  });
  const said = new Map<string, Msg[]>();
  for (const t of live) for (const m of t.messages) if (spoken(m) && m.at <= now && now - m.at < REPEAT_DAYS * DAY) said.set(m.from, [...(said.get(m.from) ?? []), m]);
  const lately = [...said.entries()].map(([id, ms]) => `- ${who(id)}: ${ms.sort((a, b) => a.at - b.at).slice(-8).map((m) => m.la).join(" | ")}`);
  return [
    `CHATS (oldest first; times in Rome):\n${chats.join("\n")}`,
    lately.length ? `WHAT EACH OF THEM SAID LATELY (never say it again; bring something new or write nothing):\n${lately.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
