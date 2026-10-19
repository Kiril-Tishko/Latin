// The group as a group (the learner asked for real group dynamics): who is
// around right now and who is not (asleep, busy with no time to look, away),
// who talks a lot and who hardly ever, whom the learner named, and who is
// likely to answer first. The ones around talk; someone not around catches up
// later, on their own time, without holding up the others; the quiet ones say
// a word or nothing unless they are named.
import { stripMarks } from "../latin/text";
import { standing } from "./bond";
import { localTime, Rand } from "./life";
import type { Meta, Who } from "./model";
import { natureOf } from "./nature";

/** Who reads it within this long of the first reader is part of the live talk; the others read it later. */
export const AROUND = 10 * 60_000;
/** Below this talkativeness, someone says one message in a group answer at most, unless named. */
export const QUIET = 0.3;
/** The most messages someone not around sends when they catch up. */
export const CATCH_UP = 2;

export interface When {
  readAt: number;
  startAt: number;
  why: string;
}

/** A group answer's scene: who is here for the live talk, who reads it later, whom the learner named, who is likely to answer first. */
export interface Scene {
  here: string[];
  later: string[];
  named: string[];
  likely: string[];
}

const plain = (s: string) => stripMarks(s).toLowerCase();

/** The people the learner named in what they wrote (any case of their name: «Iūliam», «Marce», «Gāī»). */
export function namedIn(text: string, members: Who[]): string[] {
  const words = plain(text).match(/\p{L}+/gu) ?? [];
  return members
    .filter((w) => {
      const n = plain(w.name);
      // the stem without its ending: Lūci-us, Gā-ius → gai, Marc-us, Iūli-a
      const stem = n.length > 4 ? n.replace(/(us|a|um)$/, "") : n;
      return words.some((x) => x === n || x === plain(w.voc) || (stem.length >= 3 && x.startsWith(stem) && x.length <= stem.length + 3));
    })
    .map((w) => w.id);
}

/** Who is around for a group answer, from when each reads it; and who is likely to answer first (the talkative, the named, the ones who care). */
export function sceneOf(members: Who[], meta: Meta, now: number, byId: Map<string, When>, learnerText: string, r: Rand = Math.random): Scene {
  const first = Math.min(...members.map((w) => byId.get(w.id)?.readAt ?? Infinity));
  const here = members.filter((w) => (byId.get(w.id)?.readAt ?? Infinity) - first <= AROUND).map((w) => w.id);
  const later = members.map((w) => w.id).filter((id) => !here.includes(id));
  const named = namedIn(learnerText, members);
  const score = (id: string) => {
    const lv = standing(id, meta, now).lv;
    return 2 * (natureOf(id, meta)?.talk ?? 0.5) + (named.includes(id) ? 3 : 0) + lv.interest / 10 + (lv.desire >= 5 ? 0.7 : 0) + (lv.hurt >= 5 ? 0.4 : 0) + r() * 0.8;
  };
  const likely = here
    .map((id) => ({ id, s: score(id) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 2)
    .map((x) => x.id);
  return { here, later, named, likely };
}

/** Why someone reads it when they do, in a few words ("free", "busy (teaching), looking in between", "asleep"). */
export function whyShort(why: string): string {
  const busy = /busy \(([^)]+)\)/.exec(why)?.[1];
  const away = /away \(([^)]+)\)/.exec(why)?.[1];
  if (/woke them/.test(why)) return "asleep, but woken by it";
  if (/asleep/.test(why)) return "asleep";
  if (away) return `away (${away})`;
  if (busy) return /in between/.test(why) ? `busy (${busy}), looking in between` : `busy (${busy})`;
  if (/away from their tablet/.test(why)) return "free, back at their tablet in a few minutes";
  if (/not looking at their tablet/.test(why)) return "not looking at their tablet just then";
  return "free";
}

/** The scene in words, for the group's prompt. */
export function sceneBlock(scene: Scene, members: Who[], byId: Map<string, When>, meta: Meta): string {
  const who = (id: string) => members.find((w) => w.id === id);
  const name = (id: string) => who(id)?.name ?? id;
  const why = (id: string) => whyShort(byId.get(id)?.why ?? "");
  const hereLine = scene.here.map((id) => `${name(id)} (${why(id)})`).join(", ");
  const laterLine = scene.later
    .map((id) => {
      const w = who(id);
      const at = byId.get(id)?.readAt;
      return `${name(id)} (${why(id)}${w && at ? `; reads it around ${localTime(at, w.tz).hm} their time` : ""})`;
    })
    .join(", ");
  const quiet = members.filter((w) => (natureOf(w.id, meta)?.talk ?? 0.5) < QUIET).map((w) => w.name);
  return [
    `WHO IS AROUND IN THE GROUP NOW:`,
    `- here now (they read it within minutes): ${hereLine}`,
    scene.later.length ? `- not here: ${laterLine}. They say nothing now; when they come back they may catch up with a message or two (written now, shown when they read it), or say nothing.` : "",
    `They talk as in any group: the ones here answer (often one or two; the talkative ones first and more), answer each other, ignore what bores them.${quiet.length ? ` ${quiet.join(" and ")} hardly ever say${quiet.length > 1 ? "" : "s"} anything in a group: a word, or nothing, unless named.` : ""}`,
    scene.likely.length ? `Most likely to answer first: ${scene.likely.map(name).join(", then ")}.` : "",
    scene.named.length ? `The learner named ${scene.named.map(name).join(" and ")}: they will want to answer${scene.named.some((id) => scene.later.includes(id)) ? " (when they come back)" : ""}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Keeps a group answer like a group's: someone not around catches up with a
 * message or two at most; a quiet one says one message at most unless named.
 * Takes the drafts in order; returns the ones kept.
 */
export function groupCaps<T extends { from?: string }>(drafts: T[], scene: Scene, meta: Meta): T[] {
  const said = new Map<string, number>();
  return drafts.filter((d) => {
    const id = d.from ?? "";
    const n = (said.get(id) ?? 0) + 1;
    const quiet = (natureOf(id, meta)?.talk ?? 0.5) < QUIET && !scene.named.includes(id);
    if ((scene.later.includes(id) && n > CATCH_UP) || (quiet && n > 1)) return false;
    said.set(id, n);
    return true;
  });
}
