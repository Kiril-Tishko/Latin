// Builds practice sessions: mostly the focus lesson, weakest skills first,
// a mix of exercise types, and words that are due for review. Step-by-step
// sessions start a new rule with single forms and endings, and move on to
// whole sentences as it settles.
import { LESSON_BY_N } from "../content/lessons";
import { Lexicon } from "../latin/analyze";
import { Knowledge, pick, Rand } from "../latin/generate";
import { Entry } from "../latin/types";
import { Ctx, Exercise, ExerciseKind, makeExercise, Result, vocabExercise } from "./exercises";
import { mastery, Progress, recordDay, recordMistake, recordSkill } from "./progress";
import { dueWords, exposeWord, reviewWord } from "./srs";

export const KIND_WEIGHTS: [ExerciseKind, number][] = [
  ["en2la", 30],
  ["ending", 18],
  ["choose", 6],
  ["la2en", 14],
  ["form", 14],
  ["transform", 12],
  ["identify", 6],
  ["vocab", 6],
  ["listen", 10],
];

function weighted<T>(r: Rand, items: [T, number][]): T | undefined {
  if (!items.length) return undefined;
  const total = items.reduce((s, [, w]) => s + w, 0);
  let roll = r() * total;
  for (const [x, w] of items) if ((roll -= w) < 0) return x;
  return items[items.length - 1][0];
}

/** One or two skills to aim the next exercise at: weak ones, mostly from the focus lesson. */
export function pickFocus(p: Progress, k: Knowledge, r: Rand, only?: string[], focusLesson = p.focusLesson): string[] {
  const known = [...k.skills].filter((s) => !only || only.includes(s));
  if (!known.length) return [];
  const lessonSkills = new Set(LESSON_BY_N.get(focusLesson)?.skills ?? []);
  const items: [string, number][] = known.map((s) => {
    const m = mastery(p.skills[s]);
    const recent = Date.now() - (p.skills[s]?.last ?? 0) < 60_000 ? 0.5 : 1;
    return [s, ((1 - m) * 2 + 0.25) * (lessonSkills.has(s) ? 2.2 : 1) * recent];
  });
  const first = weighted(r, items)!;
  const rest = items.filter(([s]) => s !== first);
  if (!rest.length || r() < 0.4) return [first];
  return [first, weighted(r, rest)!];
}

/**
 * Exercise types by how well the focus is known: a new rule is met in single
 * forms, endings and reading; whole sentences to write come as it settles.
 */
export function kindWeights(m: number): [ExerciseKind, number][] {
  if (m < 0.35) return [["choose", 40], ["la2en", 24], ["ending", 16], ["form", 12], ["en2la", 8]];
  if (m < 0.7) return [["ending", 22], ["choose", 14], ["form", 16], ["la2en", 14], ["en2la", 22], ["transform", 6], ["identify", 2], ["listen", 4]];
  return [["en2la", 36], ["transform", 18], ["la2en", 14], ["ending", 12], ["form", 6], ["choose", 2], ["identify", 4], ["listen", 8]];
}

/**
 * How a sentence looks for a rule at mastery m: while it is new, short and
 * sensible, in the usual word order; once it holds, longer and unexpected ones
 * ("the student teaches the teacher") that can only be read by the endings.
 */
export function sentenceStyle(m: number, silly: number): { richness: number; silly: number } {
  if (m < 0.4) return { richness: 0, silly: 0 };
  if (m < 0.7) return { richness: 0.5, silly: silly / 2 };
  return { richness: 1, silly: silly > 0 ? Math.min(1, silly + 0.15) : 0 };
}

export interface SessionOpts {
  size: number;
  kinds?: ExerciseKind[];
  /** Choose exercise types by the mastery of the focus (step-by-step practice). */
  adaptive?: boolean;
  /** The lesson whose skills get extra weight (default: the learner's focus lesson). */
  focusLesson?: number;
  /** Restrict focus to these skills (e.g. one rule or one lesson). */
  skills?: string[];
  /** Words available for recall exercises (default: all known words). */
  vocab?: Entry[];
}

export function nextExercise(p: Progress, ctx: Ctx, opts: SessionOpts, seen: Set<string>): Exercise | null {
  const allowed = ([kind]: [ExerciseKind, number]) => (!opts.kinds || opts.kinds.includes(kind)) && (kind !== "listen" || ctx.audio);
  const kinds = KIND_WEIGHTS.filter(allowed);
  for (let attempt = 0; attempt < 12; attempt++) {
    let focus: string[] | undefined;
    let kind: ExerciseKind | undefined;
    let c = ctx;
    let easy = false;
    if (opts.adaptive) {
      focus = pickFocus(p, ctx.k, ctx.r, opts.skills, opts.focusLesson);
      const m = focus.length ? focus.reduce((sum, f) => sum + mastery(p.skills[f]), 0) / focus.length : 0;
      kind = weighted(ctx.r, kindWeights(m).filter(allowed));
      c = { ...ctx, k: { ...ctx.k, ...sentenceStyle(m, ctx.k.silly) } };
      easy = m < 0.4;
    } else kind = weighted(ctx.r, kinds);
    if (!kind) return null;
    let ex: Exercise | null;
    if (kind === "vocab") {
      const pool = opts.vocab ?? [];
      if (!pool.length) continue;
      const due = dueWords(p, pool.map((e) => e.id));
      const id = due.length && ctx.r() < 0.8 ? due[0] : pick(ctx.r, pool).id;
      const entry = pool.find((e) => e.id === id)!;
      ex = vocabExercise(ctx, entry, ctx.r() < 0.5 ? "la2en" : "en2la");
    } else {
      ex = makeExercise(kind, c, focus ?? pickFocus(p, ctx.k, ctx.r, opts.skills, opts.focusLesson));
    }
    if (!ex || seen.has(ex.context)) continue;
    seen.add(ex.context);
    if (easy) ex.easy = true;
    return ex;
  }
  return null;
}

export function buildSession(p: Progress, ctx: Ctx, opts: SessionOpts): Exercise[] {
  const seen = new Set<string>();
  const out: Exercise[] = [];
  for (let i = 0; i < opts.size; i++) {
    const ex = nextExercise(p, ctx, opts, seen);
    if (ex) out.push(ex);
  }
  return out;
}

/**
 * How ready the learner is to leave a step: the mastery of the lesson's rules
 * practised so far. Ready when they average 80% and none is below 60%.
 */
export function readiness(p: Progress, lesson: number): { value: number; ready: boolean; practised: number } {
  const ids = (LESSON_BY_N.get(lesson)?.skills ?? []).filter((id) => (p.skills[id]?.seen ?? 0) > 0);
  if (!ids.length) return { value: 0, ready: false, practised: 0 };
  const values = ids.map((id) => mastery(p.skills[id]));
  const value = values.reduce((a, b) => a + b, 0) / values.length;
  return { value, ready: ids.length >= 3 && value >= 0.8 && Math.min(...values) >= 0.6, practised: ids.length };
}

/** The first-visit check: a short mix across lessons 1-4 that calibrates mastery. */
export function placementSession(p: Progress, ctx: Ctx): Exercise[] {
  const plan: [ExerciseKind, string[]][] = [
    ["form", ["v.2sg"]],
    ["ending", ["n1.acc.sg"]],
    ["en2la", ["n1.gen.sg"]],
    ["form", ["n2.acc.sg"]],
    ["en2la", ["v.sum"]],
    ["la2en", ["s.svo"]],
    ["ending", ["n1.abl.sg"]],
    ["form", ["n2.abl.sg"]],
    ["en2la", ["s.into"]],
    ["transform", ["s.pl"]],
    ["en2la", ["n2n.acc.sg"]],
    ["la2en", ["s.loc"]],
  ];
  const out: Exercise[] = [];
  for (const [kind, focus] of plan) {
    const usable = focus.filter((f) => ctx.k.skills.has(f));
    const ex = makeExercise(kind as Exclude<ExerciseKind, "vocab">, ctx, usable);
    if (ex) out.push(ex);
  }
  void p;
  return out;
}

/** Records an attempt: skill mastery, word reviews, today's count, and the mistake log. */
export function applyResult(p: Progress, ex: Exercise, res: Result, answer: string, now = Date.now()) {
  for (const [skill, score] of Object.entries(res.credit)) recordSkill(p, skill, score, now);
  for (const [word, ok] of Object.entries(res.wordCredit)) {
    if (ex.kind === "vocab") reviewWord(p, word, ok ? (res.verdict === "almost" ? "hard" : "good") : "again", now);
    else exposeWord(p, word, ok, now);
  }
  recordDay(p, res.verdict !== "wrong", now);
  if (res.verdict !== "correct") {
    recordMistake(p, {
      at: now,
      kind: ex.kind,
      prompt: ex.english ?? ex.ask ?? ex.context,
      answer,
      expected: res.expected,
      skills: Object.entries(res.credit).filter(([, v]) => v < 0.5).map(([s]) => s),
      notes: res.issues.filter((i) => i.message).map((i) => i.message.replace(/«|»/g, "").replace(/#[a-z0-9.]+/g, "")),
    });
  }
  p.updatedAt = now;
}

export type { Lexicon };
