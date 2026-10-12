// Continue's whole day, so the learner never has to choose: the rule to learn
// or practise (nextStep), and between the rounds what used to wait behind its
// own button: a story as soon as one opens, and once a day the words due.
import { Story } from "../content/stories";
import { nextStep, NextStep } from "./path";
import { dayKey, Progress, today } from "./progress";
import { dueWords } from "./srs";
import { nextStory } from "./stories";

/** Words due before Continue gives them a round of their own, once a day. */
export const WORD_ROUND_AT = 10;
/** Exercises in that round. */
export const WORD_ROUND = 12;

export type TodayStep = NextStep | { kind: "story"; story: Story } | { kind: "words"; due: number };

/**
 * What Continue does now. A day starts with the rule (to learn or to
 * practise). Once something is done, an open story not read yet comes first
 * (one between two rounds), then, once a day and when enough are due, a round
 * of the words.
 */
export function todayStep(p: Progress, vocab: string[], now = Date.now()): TodayStep {
  const step = nextStep(p);
  const day = p.days[dayKey(now)];
  if (step.kind === "none" || !day?.done) return step;
  const story = day.story === undefined || day.done > day.story ? nextStory(p) : undefined;
  if (story) return { kind: "story", story };
  if (day.words === undefined) {
    const due = dueWords(p, vocab, now).length;
    if (due >= WORD_ROUND_AT) return { kind: "words", due };
  }
  return step;
}

/** A story is read: the next one waits for another round. */
export function storyRead(p: Progress, now = Date.now()) {
  const d = today(p, now);
  d.story = d.done;
}

/** The day's round of words has begun: it comes once a day. */
export function wordsGiven(p: Progress, now = Date.now()) {
  const d = today(p, now);
  d.words = d.done;
}
