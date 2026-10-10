// Builds practice sessions: mostly the focus lesson, weakest skills first,
// a mix of exercise types, and words that are due for review.
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
  ["la2en", 14],
  ["form", 14],
  ["transform", 12],
  ["identify", 6],
  ["vocab", 6],
];

function weighted<T>(r: Rand, items: [T, number][]): T | undefined {
  if (!items.length) return undefined;
  const total = items.reduce((s, [, w]) => s + w, 0);
  let roll = r() * total;
  for (const [x, w] of items) if ((roll -= w) < 0) return x;
  return items[items.length - 1][0];
}

/** One or two skills to aim the next exercise at: weak ones, mostly from the focus lesson. */
export function pickFocus(p: Progress, k: Knowledge, r: Rand, only?: string[]): string[] {
  const known = [...k.skills].filter((s) => !only || only.includes(s));
  if (!known.length) return [];
  const lessonSkills = new Set(LESSON_BY_N.get(p.focusLesson)?.skills ?? []);
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

export interface SessionOpts {
  size: number;
  kinds?: ExerciseKind[];
  /** Restrict focus to these skills (e.g. one rule or one lesson). */
  skills?: string[];
  /** Words available for recall exercises (default: all known words). */
  vocab?: Entry[];
}

export function nextExercise(p: Progress, ctx: Ctx, opts: SessionOpts, seen: Set<string>): Exercise | null {
  const kinds = KIND_WEIGHTS.filter(([kind]) => !opts.kinds || opts.kinds.includes(kind));
  for (let attempt = 0; attempt < 12; attempt++) {
    const kind = weighted(ctx.r, kinds);
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
      ex = makeExercise(kind, ctx, pickFocus(p, ctx.k, ctx.r, opts.skills));
    }
    if (!ex || seen.has(ex.context)) continue;
    seen.add(ex.context);
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
