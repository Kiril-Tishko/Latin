// Spaced repetition for words (a small SM-2 variant): a word comes back just
// before you would forget it, sooner when it was hard.
import { Progress, WordStat } from "./progress";

const MIN = 60_000;
const DAY = 86_400_000;

export type Grade = "again" | "hard" | "good" | "easy";

export function newWord(now = Date.now()): WordStat {
  return { ease: 2.4, interval: 0, due: now, reps: 0, lapses: 0, seen: 0, right: 0 };
}

export function review(w: WordStat, grade: Grade, now = Date.now()): WordStat {
  const next = { ...w, seen: w.seen + 1, right: w.right + (grade === "again" ? 0 : 1) };
  switch (grade) {
    case "again":
      next.lapses += 1;
      next.ease = Math.max(1.3, w.ease - 0.2);
      next.interval = 0;
      next.due = now + 10 * MIN;
      break;
    case "hard":
      next.ease = Math.max(1.3, w.ease - 0.15);
      next.interval = Math.max(1, Math.round(w.interval * 1.2));
      next.due = now + (w.interval === 0 ? 30 * MIN : next.interval * DAY);
      if (w.interval === 0) next.interval = 0;
      break;
    case "good":
      next.reps += 1;
      next.interval = w.interval === 0 ? 1 : w.interval === 1 ? 3 : Math.round(w.interval * w.ease);
      next.due = now + next.interval * DAY;
      break;
    case "easy":
      next.reps += 1;
      next.ease = w.ease + 0.15;
      next.interval = w.interval === 0 ? 3 : Math.round(w.interval * w.ease * 1.3);
      next.due = now + next.interval * DAY;
      break;
  }
  return next;
}

export function reviewWord(p: Progress, id: string, grade: Grade, now = Date.now()) {
  p.words[id] = review(p.words[id] ?? newWord(now), grade, now);
}

/** A word met inside a sentence exercise: counts as light practice, never reschedules a mature word. */
export function exposeWord(p: Progress, id: string, correct: boolean, now = Date.now()) {
  const w = p.words[id] ?? newWord(now);
  if (w.reps === 0 || !correct) p.words[id] = review(w, correct ? "good" : "again", now);
  else p.words[id] = { ...w, seen: w.seen + 1, right: w.right + 1 };
}

export function dueWords(p: Progress, ids: string[], now = Date.now()): string[] {
  return ids
    .filter((id) => (p.words[id]?.due ?? 0) <= now)
    .sort((a, b) => (p.words[a]?.due ?? 0) - (p.words[b]?.due ?? 0));
}

/** 0..1 strength for display (grows with the review interval). */
export function strength(w?: WordStat): number {
  if (!w || w.seen === 0) return 0;
  return Math.min(1, (w.interval + (w.right / Math.max(1, w.seen)) * 0.5) / 10);
}
