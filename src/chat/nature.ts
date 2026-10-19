// What makes each person different, as data the code uses, not only words in a
// description (the learner asked for people who are not variations of one
// assistant): how much they talk in a group, how long they write and how many
// messages in a row, what they do when something matters, how they keep
// secrets, show feelings, love, send photos, what fills their days, and how
// they look in every picture of them. The five friends have theirs in
// content/people.ts; a stranger's comes from their rolled style and temper,
// and from what Claude made of them.
import { PERSON_BY_ID } from "../content/people";
import type { Levels } from "./bond";
import type { Meta } from "./model";
import type { Stranger } from "./strangers";

export interface Nature {
  /** How much they talk in a group: 0 (a word now and then) to 1 (always first, always more). */
  talk: number;
  /** The most messages they send in a row. */
  burst: number;
  /** How long their messages are, and how they come (English, for Claude). */
  length: string;
  /** How they write when something matters: news, a fight, grief, love. */
  deep: string;
  /** Showing feelings: 0 never says what they feel, 1 shows everything. */
  open: number;
  /** Keeping secrets: 0 tells everyone within the hour, 1 a vault. */
  discretion: number;
  /** How often they send photos, and of what. */
  photos: { rate: "often" | "sometimes" | "rarely"; what: string };
  /** Love and attraction: who they could fall for, how they flirt, where the lines are. */
  romance: string;
  /** What fills their days and their talk, besides the learner. */
  interests: string[];
  /** How they look, the same in every picture of them (from their portrait). */
  look: string;
  /** Where they stand with the learner before anything has happened (chat/bond.ts). */
  start: Levels;
  /** How much hurt heals in a day by itself: 0.3 a grudge for weeks, 3 forgotten by tomorrow. */
  forgive: number;
  /** How fast they may fall for someone: the most desire grows in a day. */
  fall: number;
}

const LENGTHS: Record<string, Pick<Nature, "burst" | "length">> = {
  "very short messages, one to three words": { burst: 2, length: "very short: one to three words a message" },
  "short messages": { burst: 3, length: "short messages, a few words each" },
  "chatty: several messages in a row": { burst: 4, length: "chatty: several short messages in a row" },
};

/** A steady number in [0, 1) from a person's id (so a stranger's nature does not change). */
function steady(id: string, salt: string): number {
  let h = 2166136261;
  for (const c of `${id}:${salt}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

/** A stranger's nature: from their rolled style and temper, and what Claude made of them. */
export function strangerNature(s: Stranger): Nature {
  const len = Object.entries(LENGTHS).find(([k]) => s.style.includes(k))?.[1] ?? { burst: 3, length: "short messages" };
  const strong = s.intensity === "extreme" ? 0.3 : s.intensity === "strong" ? 0.15 : 0;
  return {
    talk: Math.min(1, 0.2 + steady(s.id, "talk") * 0.6 + strong),
    ...len,
    deep: "a little more than usual, in their own way",
    open: Math.min(1, 0.2 + steady(s.id, "open") * 0.6 + strong),
    discretion: steady(s.id, "secret"),
    photos: { rate: (["rarely", "sometimes", "often"] as const)[Math.floor(steady(s.id, "photo") * 3)], what: s.job ? `their life as a ${s.job}` : "their day" },
    romance: s.romance ?? "their own: as Claude made them",
    interests: s.interests ?? [],
    look: s.look ?? `a ${s.g === "m" ? "man" : "woman"} of ${s.age}`,
    // first impressions are Claude's to set ("levels" at their first answer); until then, a little warmth or wariness by the dice
    start: {
      warmth: 3 + Math.round(steady(s.id, "warm") * 4),
      trust: 2 + Math.round(steady(s.id, "trust") * 4),
      respect: 3 + Math.round(steady(s.id, "respect") * 4),
      desire: 0,
      hurt: 0,
      interest: Math.min(10, 4 + Math.round(steady(s.id, "interest") * 3) + (s.intensity === "extreme" ? 2 : s.intensity === "strong" ? 1 : 0)),
    },
    forgive: Math.round((0.3 + steady(s.id, "forgive") * 2.7) * 10) / 10,
    fall: Math.round((s.intensity === "extreme" ? 1.5 : s.intensity === "strong" ? 1 : 0.5) * (0.5 + steady(s.id, "fall")) * 10) / 10,
  };
}

/** Someone's nature: a friend's own, a stranger's from their dice. */
export function natureOf(id: string, meta: Meta): Nature | undefined {
  const p = PERSON_BY_ID.get(id);
  if (p) return p.nature;
  const s = meta.strangers[id];
  return s ? strangerNature(s) : undefined;
}

/** How much someone talks in a group, in words. */
export const talkText = (n: Nature) =>
  n.talk >= 0.75 ? "talks a lot in a group, often first and often more than the others" : n.talk >= 0.4 ? "joins in when something interests them" : "rarely says anything in a group: a word now and then, or nothing";

/** How someone shows feelings, in words. */
export const openText = (n: Nature) =>
  n.open >= 0.8 ? "shows every feeling at once, theatrically" : n.open >= 0.45 ? "shows feelings, though the deepest ones come out sideways" : n.open >= 0.2 ? "hides feelings behind jokes or manners; the real ones slip out rarely" : "never says what they feel; it shows only in what they do";

/** How someone keeps secrets, in words. */
export const discretionText = (n: Nature) =>
  n.discretion >= 0.75 ? "keeps a secret to the grave" : n.discretion >= 0.45 ? "keeps most secrets, but may hint or let one slip when moved" : n.discretion >= 0.2 ? "keeps a secret about a day, then tells a friend 'only you'" : "cannot keep a secret: anything juicy is out within the hour";

/** How often someone sends photos, in words. */
export const photoText = (n: Nature) =>
  `${n.photos.rate === "often" ? "sends photos often" : n.photos.rate === "sometimes" ? "sends a photo now and then" : "rarely sends a photo"}: ${n.photos.what}`;
