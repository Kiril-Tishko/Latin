// Builds practice sessions: mostly the part (or lesson) practised, weakest
// skills first, a mix of exercise types, and words that are due for review.
// A new rule is met in simple exercises (pick, build, fill in an ending) and
// whole sentences come as it holds (phaseOf in progress.ts).
import { LESSON_BY_N } from "../content/lessons";
import { Lexicon } from "../latin/analyze";
import { Knowledge, pick, Rand, shuffle } from "../latin/generate";
import { latinKey } from "../latin/text";
import { Entry } from "../latin/types";
import { Ctx, deriveExercise, Exercise, ExerciseKind, MadeKind, makeExercise, Result, vocabExercise } from "./exercises";
import { quizWords, wordInEnglish } from "../content/english";
import { mastery, Mistake, Phase, phaseOf, Progress, recordDay, recordMistake, recordSkill } from "./progress";
import { partPhase, updatePath } from "./path";
import { Part } from "../content/parts";
import { kindsFor, Line, lineExercise } from "./lines";
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
 * Exercise types by how well the focus is known: a new rule sinks in with
 * simple exercises (pick the form, pick the meaning, build from tiles, type an
 * ending in the gap); whole sentences to write and change come as it holds.
 */
export function kindWeights(m: number): [ExerciseKind, number][] {
  const phase = phaseOf(m);
  if (phase === "simple") return [["choose", 30], ["meaning", 22], ["tiles", 22], ["ending", 18], ["la2en", 8]];
  if (phase === "mixed") return [["ending", 16], ["tiles", 14], ["form", 14], ["la2en", 14], ["en2la", 18], ["choose", 8], ["meaning", 6], ["transform", 6], ["identify", 2], ["listen", 2]];
  return [["en2la", 34], ["transform", 18], ["la2en", 12], ["form", 10], ["ending", 8], ["tiles", 6], ["listen", 6], ["identify", 2], ["choose", 2], ["meaning", 2]];
}

/**
 * How a sentence looks for a rule at mastery m: while it is new, short and
 * sensible, in the usual word order; once it holds, longer and unexpected ones
 * ("the student teaches the teacher") that can only be read by the endings.
 */
export function sentenceStyle(m: number, silly: number): { richness: number; silly: number } {
  const phase = phaseOf(m);
  if (phase === "simple") return { richness: 0, silly: 0 };
  if (phase === "mixed") return { richness: 0.5, silly: silly / 2 };
  return { richness: 1, silly: silly > 0 ? Math.min(1, silly + 0.15) : 0 };
}

export interface SessionOpts {
  size: number;
  kinds?: ExerciseKind[];
  /** Choose exercise types by the mastery of the focus (step-by-step practice). */
  adaptive?: boolean;
  /** The lesson whose skills get extra weight (default: the learner's focus lesson). */
  focusLesson?: number;
  /** Restrict focus to these skills (e.g. one part, one rule or one lesson). */
  skills?: string[];
  /**
   * Share of exercises aimed at the other rules the learner knows, once the
   * focus is past its simple phase (a part's practice keeps earlier parts alive).
   */
  review?: number;
  /** Words available for recall exercises (default: all known words). */
  vocab?: Entry[];
}

/** The average mastery of some skills (0 for none). */
const average = (p: Progress, skills: string[]) => (skills.length ? skills.reduce((sum, f) => sum + mastery(p.skills[f]), 0) / skills.length : 0);

export function nextExercise(p: Progress, ctx: Ctx, opts: SessionOpts, seen: Set<string>): Exercise | null {
  const allowed = ([kind]: [ExerciseKind, number]) => (!opts.kinds || opts.kinds.includes(kind)) && (kind !== "listen" || ctx.audio);
  const kinds = KIND_WEIGHTS.filter(allowed);
  for (let attempt = 0; attempt < 12; attempt++) {
    let focus: string[] | undefined;
    let kind: ExerciseKind | undefined;
    let c = ctx;
    let easy = false;
    if (opts.adaptive) {
      const reviewing = !!opts.review && !!opts.skills && phaseOf(average(p, opts.skills)) !== "simple" && ctx.r() < opts.review;
      focus = pickFocus(p, ctx.k, ctx.r, reviewing ? undefined : opts.skills, opts.focusLesson);
      const m = average(p, focus);
      kind = weighted(ctx.r, kindWeights(m).filter(allowed));
      c = { ...ctx, k: { ...ctx.k, ...sentenceStyle(m, ctx.k.silly) } };
      easy = phaseOf(m) === "simple";
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
    } else if (kind === "answer") {
      continue; // open questions come from their own round (answers.ts)
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

/** What a part's phase stands for when choosing exercise kinds and how rich a sentence is. */
const PHASE_LEVEL: Record<Phase, number> = { simple: 0.3, mixed: 0.75, hard: 0.95 };

/**
 * The next exercise of a round on one part, made for where the learner is right
 * now: simple ones for its first five right answers, then harder ones. Every
 * exercise shows the part's rule, its weakest piece first: a new sentence aimed
 * at it, or about one in three from the videos and stories (some rules, like et
 * between two verbs, live only there). A piece that only a single form can show
 * (to …: -re; vīnī) gets one. Past the simple ones, one in five reviews earlier rules.
 */
export function partExercise(p: Progress, ctx: Ctx, part: Part, lines: Line[], kinds: ExerciseKind[], seen: Set<string>): Exercise | null {
  const phase = partPhase(p, part);
  const level = PHASE_LEVEL[phase];
  const allowed = kinds.filter((kind) => kind !== "vocab" && kind !== "derive" && (kind !== "listen" || !!ctx.audio)) as MadeKind[];
  const phaseKinds = kindWeights(level).filter(([kind]) => allowed.includes(kind as MadeKind));
  const lineKinds = kindsFor(level);
  const fits = (ex: Exercise | null, wanted: string[]): ex is Exercise => !!ex && !seen.has(ex.context) && ex.skills.some((s) => wanted.includes(s));
  const done = (ex: Exercise) => {
    seen.add(ex.context);
    if (phase === "simple") ex.easy = true;
    return ex;
  };
  if (phase !== "simple" && ctx.r() < 0.2) {
    const review = nextExercise(p, ctx, { size: 1, adaptive: true, kinds }, seen);
    if (review) return review;
  }
  const fixed = lines.filter((l) => l.skills.some((s) => part.skills.includes(s)) && l.skills.every((s) => ctx.k.skills.has(s)));
  const c: Ctx = { ...ctx, k: { ...ctx.k, ...sentenceStyle(level, ctx.k.silly) } };
  const focus = pickFocus(p, ctx.k, ctx.r, part.practised ?? part.skills, part.lesson);
  // the weakest piece of the rule, in the phase's kinds of exercise
  for (let attempt = 0; attempt < 16 && phaseKinds.length; attempt++) {
    const ex =
      fixed.length && ctx.r() < 1 / 3
        ? lineExercise(c, pick(ctx.r, fixed), weighted(ctx.r, lineKinds) ?? "tiles", lines)
        : makeExercise(weighted(ctx.r, phaseKinds) as MadeKind, c, focus);
    if (fits(ex, focus)) return done(ex);
  }
  // a piece only a single form can show: the form first, then the phase's kinds (the harder ones never while the rule is new)
  const order = [...new Set([...allowed.filter((k) => k === "form"), ...phaseKinds.map(([k]) => k as MadeKind), ...(phase === "simple" ? [] : shuffle(ctx.r, allowed))])];
  for (const kind of order) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const ex = makeExercise(kind, c, focus);
      if (fits(ex, focus)) return done(ex);
    }
  }
  // any piece of the rule: the fixed sentences (et between two verbs), then new ones
  for (const line of shuffle(ctx.r, fixed)) {
    for (const [kind] of shuffle(ctx.r, lineKinds)) {
      const ex = lineExercise(c, line, kind, lines);
      if (fits(ex, part.skills)) return done(ex);
    }
  }
  for (let attempt = 0; attempt < 12 && phaseKinds.length; attempt++) {
    const ex = makeExercise(weighted(ctx.r, phaseKinds) as MadeKind, c, part.skills);
    if (fits(ex, part.skills)) return done(ex);
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
 * Records an attempt: skill mastery, word reviews, today's count, the mistake
 * log, and the learner's path. Returns the parts of the rules that now hold.
 */
export function applyResult(p: Progress, ex: Exercise, res: Result, answer: string, now = Date.now()): Part[] {
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
  } else if (res.verdict !== "correct" && ex.kind !== "answer") {
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
  return updatePath(p, res, now);
}

export type { Lexicon };
