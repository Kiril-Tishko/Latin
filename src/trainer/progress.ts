// The learner's saved state and the pure functions that update it.
export interface SkillStat {
  seen: number;
  right: number;
  /** Recent accuracy, 0..1 (exponentially weighted). */
  ewma: number;
  /** Last practised, ms since epoch. */
  last: number;
}

export interface WordStat {
  ease: number;
  /** Days until the next review; 0 = learning (due again in minutes). */
  interval: number;
  due: number;
  reps: number;
  lapses: number;
  seen: number;
  right: number;
}

export interface Mistake {
  at: number;
  kind: string;
  prompt: string;
  answer: string;
  expected: string;
  skills: string[];
  notes: string[];
}

export interface Settings {
  /** Show long marks (ā) in Latin text. */
  macrons: boolean;
  dailyGoal: number;
  /** 0 = sensible sentences only, 1 = anything goes. */
  silly: number;
  /** Show (m) / (f) and dictionary hints on English prompts. */
  hints: boolean;
  /** Chosen speech voice (voiceURI); empty = best Italian / Spanish voice. */
  voice?: string;
  /** Speech rate, 0.6-1.1. */
  rate: number;
  /** Read Latin prompts aloud as soon as they appear. */
  autoplay: boolean;
}

export interface Progress {
  version: 1;
  updatedAt: number;
  settings: Settings;
  /** Lessons the learner has watched; their words and rules are unlocked. */
  lessonsDone: number[];
  /** The lesson the trainer concentrates on. */
  focusLesson: number;
  skills: Record<string, SkillStat>;
  words: Record<string, WordStat>;
  /** Discover cards opened (seen) and added to the dictionary. */
  revealed: string[];
  added: string[];
  /** Exercises done per day, keyed YYYY-MM-DD (local time). */
  days: Record<string, { done: number; right: number }>;
  mistakes: Mistake[];
  placementDone: boolean;
}

export const DEFAULT_SETTINGS: Settings = { macrons: true, dailyGoal: 20, silly: 0.35, hints: true, rate: 0.85, autoplay: false };

export function newProgress(): Progress {
  return {
    version: 1,
    updatedAt: 0,
    settings: { ...DEFAULT_SETTINGS },
    lessonsDone: [1, 2, 3, 4],
    focusLesson: 4,
    skills: {},
    words: {},
    revealed: [],
    added: [],
    days: {},
    mistakes: [],
    placementDone: false,
  };
}

/** Fills in fields added by later versions, so old saves keep working. */
export function migrate(raw: unknown): Progress {
  const base = newProgress();
  if (!raw || typeof raw !== "object") return base;
  const p = raw as Partial<Progress>;
  return {
    ...base,
    ...p,
    settings: { ...base.settings, ...(p.settings ?? {}) },
    skills: p.skills ?? {},
    words: p.words ?? {},
    revealed: p.revealed ?? [],
    added: p.added ?? [],
    days: p.days ?? {},
    mistakes: p.mistakes ?? [],
  } as Progress;
}

export const dayKey = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const MIN_SEEN = 6;

/** 0..1: how well a skill is known (needs a few attempts to reach 100%). */
export function mastery(s?: SkillStat): number {
  if (!s || s.seen === 0) return 0;
  return Math.min(1, s.seen / MIN_SEEN) * s.ewma;
}

export function recordSkill(p: Progress, id: string, correct: number, now = Date.now()) {
  const s = p.skills[id] ?? { seen: 0, right: 0, ewma: 0.5, last: 0 };
  const alpha = s.seen < 3 ? 0.45 : 0.25;
  p.skills[id] = {
    seen: s.seen + 1,
    right: s.right + (correct >= 1 ? 1 : 0),
    ewma: s.ewma * (1 - alpha) + correct * alpha,
    last: now,
  };
}

export function recordDay(p: Progress, correct: boolean, now = Date.now()) {
  const k = dayKey(now);
  const d = p.days[k] ?? { done: 0, right: 0 };
  p.days[k] = { done: d.done + 1, right: d.right + (correct ? 1 : 0) };
}

export function recordMistake(p: Progress, m: Mistake) {
  p.mistakes = [m, ...p.mistakes].slice(0, 40);
}

/** Days in a row (ending today, or yesterday if today is not done yet) that met the daily goal. */
export function streak(p: Progress, now = Date.now()): number {
  let n = 0;
  const day = 86400000;
  let t = now;
  if ((p.days[dayKey(t)]?.done ?? 0) < p.settings.dailyGoal) t -= day;
  while ((p.days[dayKey(t)]?.done ?? 0) >= p.settings.dailyGoal) {
    n++;
    t -= day;
  }
  return n;
}

export function todayDone(p: Progress, now = Date.now()): number {
  return p.days[dayKey(now)]?.done ?? 0;
}
