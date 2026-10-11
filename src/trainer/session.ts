// Builds practice sessions: mostly the focus lesson, weakest skills first,
// a mix of exercise types, and words that are due for review. Step-by-step
// sessions start a new rule with single forms and endings, and move on to
// whole sentences as it settles.
import { LESSON_BY_N } from "../content/lessons";
import { Lexicon } from "../latin/analyze";
import { Knowledge, pick, Rand } from "../latin/generate";
import { latinKey } from "../latin/text";
import { Entry } from "../latin/types";
import { Ctx, deriveExercise, Exercise, ExerciseKind, MadeKind, makeExercise, Result, vocabExercise } from "./exercises";
import { quizWords, wordInEnglish } from "../content/english";
import { mastery, Mistake, Progress, recordDay, recordMistake, recordSkill } from "./progress";
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
  ["derive", 3],
  ["tiles", 10],
  ["meaning", 6],
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
  // a new rule: pick the form, read the meaning, build from tiles; little typing
  if (m < 0.35) return [["choose", 30], ["meaning", 16], ["tiles", 16], ["la2en", 14], ["ending", 12], ["form", 8], ["en2la", 4]];
  if (m < 0.7) return [["ending", 20], ["tiles", 14], ["choose", 10], ["form", 14], ["la2en", 12], ["meaning", 4], ["en2la", 18], ["transform", 4], ["identify", 2], ["listen", 2]];
  return [["en2la", 34], ["transform", 18], ["la2en", 14], ["ending", 12], ["tiles", 6], ["form", 6], ["choose", 2], ["meaning", 2], ["identify", 2], ["listen", 4]];
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
    } else if (kind === "derive") {
      ex = deriveFrom(ctx, opts.vocab ?? []);
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

/** Mistakes that can come back now: not fixed yet, and about rules of the step (or about a word). */
export function mistakesToFix(p: Progress, k: Knowledge): Mistake[] {
  return p.mistakes.filter((m) => !m.fixed && (m.skills.length ? m.skills.every((s) => k.skills.has(s)) : !!m.words?.length));
}

/** Gentle exercise kinds close to the one a mistake was made in. */
function sameFamily(kind: string): ExerciseKind[] {
  if (["en2la", "tiles", "transform", "listen"].includes(kind)) return ["tiles", "en2la"];
  if (["ending", "choose", "form"].includes(kind)) return ["choose", "ending", "form"];
  if (["la2en", "meaning", "identify"].includes(kind)) return ["meaning", "la2en", "choose"];
  return [];
}

/**
 * "Fix my mistakes": each mistake comes back as a fresh exercise on the same
 * rules (and words), sensible and not too long. A right answer marks it fixed.
 */
export function mistakesSession(p: Progress, ctx: Ctx, vocab: Entry[], size = 10): Exercise[] {
  const c: Ctx = { ...ctx, k: { ...ctx.k, richness: 0.5 } };
  const out: Exercise[] = [];
  const seen = new Set<string>();
  for (const m of mistakesToFix(p, ctx.k)) {
    if (out.length >= size) break;
    const words = vocab.filter((w) => m.words?.includes(w.id));
    let ex: Exercise | null = null;
    if ((m.kind === "vocab" || m.kind === "derive") && words.length) {
      ex = m.kind === "vocab" ? vocabExercise(c, words[0], c.r() < 0.5 ? "la2en" : "en2la") : deriveFrom(c, words);
      if (ex && seen.has(ex.context)) continue;
      if (ex) seen.add(ex.context);
    } else if (m.skills.length) {
      // the same kind of exercise first, then a close one (nextExercise keeps `seen` itself)
      const kinds = sameFamily(m.kind);
      ex =
        nextExercise(p, c, { size: 1, skills: m.skills, kinds: [m.kind as ExerciseKind], vocab }, seen) ??
        nextExercise(p, c, { size: 1, skills: m.skills, kinds: kinds.length ? kinds : undefined, vocab }, seen);
    }
    if (!ex) continue;
    ex.fixes = m.at;
    out.push(ex);
  }
  return out;
}

/**
 * A "find the Latin" question on one of these words, mostly with an English
 * word where the Latin is easy to spot (dormitory, aquarium) and now and then
 * a harder one (wine, envy).
 */
function deriveFrom(ctx: Ctx, vocab: Entry[]): Exercise | null {
  const pool = vocab.flatMap((e) => quizWords(e.id).map((en) => ({ e, en })));
  if (!pool.length) return null;
  const lemma = (e: Entry) => latinKey(e.kind === "verb" ? e.pp[0] : e.lemma);
  const clear = pool.filter(({ e, en }) => en.includes(lemma(e).slice(0, 3)));
  const { e, en } = pick(ctx.r, clear.length && ctx.r() < 0.8 ? clear : pool);
  const accept = vocab.filter((x) => wordInEnglish(x.id)?.from.en?.includes(en)).map((x) => x.id);
  return deriveExercise(ctx, e, en, accept, wordInEnglish(e.id)?.note);
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
    const ex = makeExercise(kind as MadeKind, ctx, usable);
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
  // a mistake brought back and now answered right is fixed; answered wrong, it stays (no second copy)
  const old = ex.fixes !== undefined ? p.mistakes.find((m) => m.at === ex.fixes) : undefined;
  if (old) {
    if (res.verdict !== "wrong") old.fixed = true;
  } else if (res.verdict !== "correct") {
    recordMistake(p, {
      at: now,
      kind: ex.kind,
      prompt: ex.english ?? ex.ask ?? ex.context,
      // a choice is kept as the word chosen, not its number
      answer: ex.choices?.find((c) => c.id === answer)?.label ?? answer,
      expected: res.expected,
      skills: Object.entries(res.credit).filter(([, v]) => v < 0.5).map(([s]) => s),
      notes: res.issues.filter((i) => i.message).map((i) => i.message.replace(/«|»/g, "").replace(/#[a-z0-9]+(?:\.[a-z0-9]+)*/g, "")),
      words: ex.words,
    });
  }
  p.updatedAt = now;
}

export type { Lexicon };
