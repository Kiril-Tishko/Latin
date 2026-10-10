// What the learner knows right now: unlocked skills and usable words.
import { LESSONS } from "../content/lessons";
import { STORY_ONLY } from "../content/words";
import { Lexicon } from "../latin/analyze";
import { Knowledge } from "../latin/generate";
import { AdjEntry, Entry, FixedEntry, NounEntry, VerbEntry } from "../latin/types";

export function skillsUpTo(lessonsUnlocked: number[]): Set<string> {
  const set = new Set<string>();
  for (const l of LESSONS) if (lessonsUnlocked.includes(l.n)) l.skills.forEach((s) => set.add(s));
  return set;
}

export function lessonWords(lessonsUnlocked: number[]): Entry[] {
  return LESSONS.filter((l) => lessonsUnlocked.includes(l.n)).flatMap((l) => l.words);
}

/** Every word the site knows about, for coloring any Latin text. */
export function fullLexicon(extra: Entry[] = []): Lexicon {
  return new Lexicon([...LESSONS.flatMap((l) => l.words), ...extra]);
}

export function buildKnowledge(lessonsUnlocked: number[], extraWords: Entry[] = [], silly = 0.35): Knowledge {
  const words = [...lessonWords(lessonsUnlocked), ...extraWords].filter((w) => !STORY_ONLY.has(w.id));
  const seen = new Set<string>();
  const unique = words.filter((w) => (seen.has(w.id) ? false : (seen.add(w.id), true)));
  return {
    skills: skillsUpTo(lessonsUnlocked),
    nouns: unique.filter((w): w is NounEntry => w.kind === "noun"),
    verbs: unique.filter((w): w is VerbEntry => w.kind === "verb"),
    adjs: unique.filter((w): w is AdjEntry => w.kind === "adj"),
    fixed: new Map(unique.filter((w): w is FixedEntry => w.kind === "fixed").map((w) => [w.id, w])),
    silly,
  };
}
