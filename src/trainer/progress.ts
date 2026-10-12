// The learner's saved state and the pure functions that update it.
import type { OwnWord } from "./own";
import { PARTS } from "../content/parts";

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
  /** The words of the exercise. */
  words?: string[];
  /** Put right later in "Fix my mistakes". */
  fixed?: boolean;
}

/** A part of a lesson's rules (content/parts.ts) on the learner's path. */
export interface PartStat {
  /** When its explanation and questions were done: its rules may be practised. */
  seen: number;
  /** Right answers on its rules since then (ten make it learned). */
  right: number;
  /** When it reached ten (it stays learned). */
  learned?: number;
}

/** Which Claude answers: the model family (quick = Haiku, default = Sonnet, complex = Opus) and how hard it thinks. */
export type ModelTier = "quick" | "default" | "complex";
export type Effort = "low" | "medium" | "high";
export interface ModelChoice {
  tier: ModelTier;
  effort: Effort;
}

/** Who the learner is in the messenger: how the people there call them, and the endings that go with it. */
export interface Me {
  name: string;
  g: "m" | "f";
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
  /** The recorded voice for the texts that have one (unset: on). */
  recorded?: boolean;
  /** Read Latin prompts aloud as soon as they appear. */
  autoplay: boolean;
  /** The coach: Ask Claude, the checks of answers, Answer in Latin. */
  coach: ModelChoice;
  /** The people in the messenger (Nūntiī). */
  chat: ModelChoice;
  /** The learner in the messenger (unset until they say). */
  me?: Me;
  /** The learner's time zone (IANA), e.g. "Europe/Kyiv"; unset: the device's. */
  tz?: string;
}

/** One day: exercises done and right, and where Continue's day stands (exercises done when it last gave a story, when it gave the words). */
export interface Day {
  done: number;
  right: number;
  story?: number;
  words?: number;
}

export interface Progress {
  version: 5;
  updatedAt: number;
  settings: Settings;
  /** Lessons the learner has watched; their words and rules are unlocked. */
  lessonsDone: number[];
  /** The lesson of the part the learner is on (kept by trainer/path.ts). */
  focusLesson: number;
  /** The parts of the rules seen and learned, keyed by part id ("2.1"). */
  parts: Record<string, PartStat>;
  /** Day (YYYY-MM-DD) each part's recap was last shown before practice, keyed by part id. */
  rulesShown: Record<string, string>;
  skills: Record<string, SkillStat>;
  words: Record<string, WordStat>;
  /** Mystery cards opened (seen) and added to the dictionary. */
  revealed: string[];
  added: string[];
  /** Words the learner added to their dictionary themselves (Claude filled them in). */
  own: OwnWord[];
  /** Exercises done per day, keyed YYYY-MM-DD (local time), and Continue's marks for the day. */
  days: Record<string, Day>;
  mistakes: Mistake[];
  /** Stories read to the end, keyed by id: when. */
  stories: Record<string, number>;
  /** The screen reached in Latin in English (read one screen at a time). */
  english?: number;
}

// sensible sentences only: silly pairings confused the learner
// the coach: the balanced model thinking hard; the people in the messenger: the most capable one, as the learner asked
export const DEFAULT_SETTINGS: Settings = {
  macrons: true,
  dailyGoal: 20,
  silly: 0,
  hints: true,
  rate: 0.85,
  autoplay: false,
  coach: { tier: "default", effort: "high" },
  chat: { tier: "complex", effort: "high" },
};

export function newProgress(): Progress {
  return {
    version: 5,
    updatedAt: 0,
    settings: { ...DEFAULT_SETTINGS },
    lessonsDone: [1, 2, 3, 4],
    focusLesson: 1,
    parts: {},
    rulesShown: {},
    skills: {},
    words: {},
    revealed: [],
    added: [],
    own: [],
    days: {},
    mistakes: [],
    stories: {},
  };
}

/** Fills in fields added by later versions, so old saves keep working. */
export function migrate(raw: unknown): Progress {
  const base = newProgress();
  if (!raw || typeof raw !== "object") return base;
  const p = raw as Omit<Partial<Progress>, "version"> & { version?: number };
  const out = {
    ...base,
    ...p,
    version: 5,
    settings: { ...base.settings, ...(p.settings ?? {}) },
    skills: p.skills ?? {},
    words: p.words ?? {},
    revealed: p.revealed ?? [],
    added: p.added ?? [],
    own: Array.isArray(p.own) ? p.own : [],
    days: p.days ?? {},
    mistakes: p.mistakes ?? [],
    rulesShown: p.rulesShown ?? {},
    stories: p.stories ?? {},
    parts: p.parts ?? {},
  } as Progress;
  out.settings.coach = modelChoice(out.settings.coach, base.settings.coach);
  out.settings.chat = modelChoice(out.settings.chat, base.settings.chat);
  // Version 2 practises step by step. The learner remembered the words but not
  // the rules, so saves from version 1 start again at Lesson I.
  if ((p.version ?? 1) < 2) out.focusLesson = out.lessonsDone.length ? Math.min(...out.lessonsDone) : 1;
  // Version 3: sensible sentences only, as the learner asked (silly ones confused them).
  if ((p.version ?? 1) < 3) out.settings.silly = 0;
  // Version 4 learns the rules in small parts. The lessons before the step are
  // done; the step's own rules start again with their first part.
  if ((p.version ?? 1) < 4) {
    const now = Date.now();
    out.parts = {};
    for (const part of PARTS) if (part.lesson < out.focusLesson) out.parts[part.id] = { seen: now, right: 0, learned: now };
  }
  // Version 5 counts right answers per part (ten make it learned) instead of
  // exercises and mastery: parts in practice start counting from nothing.
  out.parts = Object.fromEntries(
    Object.entries(out.parts).map(([id, st]) => [id, { seen: st.seen, right: st.right ?? 0, ...(st.learned ? { learned: st.learned } : {}) }]),
  );
  return out;
}

const TIERS: ModelTier[] = ["quick", "default", "complex"];
const EFFORTS: Effort[] = ["low", "medium", "high"];

/** A saved model choice, or the default where it is missing or unknown. */
function modelChoice(x: unknown, fallback: ModelChoice): ModelChoice {
  const m = (x ?? {}) as Partial<ModelChoice>;
  return {
    tier: TIERS.includes(m.tier as ModelTier) ? (m.tier as ModelTier) : fallback.tier,
    effort: EFFORTS.includes(m.effort as Effort) ? (m.effort as Effort) : fallback.effort,
  };
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

/**
 * How far a rule has sunk in, by its mastery: simple exercises while it is new
 * (about five right answers), then a mix with whole sentences to write, then
 * mostly the hard ones.
 */
export type Phase = "simple" | "mixed" | "hard";
export const SIMPLE_UNTIL = 0.65;
export const HARD_FROM = 0.9;
export const phaseOf = (m: number): Phase => (m < SIMPLE_UNTIL ? "simple" : m < HARD_FROM ? "mixed" : "hard");

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
  const d = today(p, now);
  d.done += 1;
  if (correct) d.right += 1;
}

/** Today's record, made if it isn't there yet. */
export function today(p: Progress, now = Date.now()): Day {
  const k = dayKey(now);
  return (p.days[k] ??= { done: 0, right: 0 });
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
