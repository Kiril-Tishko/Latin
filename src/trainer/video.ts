// The sentences of the videos as practice. Each lesson's sentences are read
// into words the exercises can check (see lines.ts) and paired with the
// lesson's own English. Only sentences whose every rule the learner has met
// (up to the step) are used.
import { LESSONS } from "../content/lessons";
import { Lexicon } from "../latin/analyze";
import { Knowledge } from "../latin/generate";
import { Ctx, Exercise } from "./exercises";
import { kindsFor, Line, lineExercise, LineKind, makeLine, weighted } from "./lines";
import { mastery, phaseOf, Progress } from "./progress";

export type VideoLine = Line & { from: { kind: "video"; lesson: number } };

/** "Tū scrībis. Tū studēs." with its English, one sentence at a time when they pair up. */
function pairs(la: string, en: string): [string, string][] {
  // (a full stop inside a reading hint, agricolae#dat.sg, does not end a sentence)
  const split = (s: string) => (s.match(/(?:[^.!?]|[.!?](?=[a-z]))+[.!?]*/g) ?? []).map((x) => x.trim()).filter(Boolean);
  const english = en.split(" / ")[0].trim();
  const ls = split(la);
  if (ls.length <= 1) return [[la, english]];
  const es = split(english);
  return ls.length === es.length ? ls.map((l, i) => [l, es[i]]) : [];
}

/** The sentences of these lessons' videos that use only what the learner has met. */
export function videoLines(lessons: number[], lex: Lexicon, k: Knowledge): VideoLine[] {
  const out: VideoLine[] = [];
  for (const l of LESSONS.filter((x) => lessons.includes(x.n))) {
    for (const s of l.sentences) {
      for (const [la, en] of pairs(s.la, s.en)) {
        const line = makeLine({ kind: "video", lesson: l.n }, la, en, lex);
        // only the rules of the lessons up to the step, and only sentences (not phrases such as "in Olympō")
        if (line && line.skills.every((sk) => k.skills.has(sk)) && line.tokens.some((t) => t.role === "verb")) out.push(line as VideoLine);
      }
    }
  }
  return out;
}

/** One exercise on a sentence from a video. */
export function videoExercise(ctx: Ctx, line: Line, kind: LineKind, lines: Line[]): Exercise | null {
  return lineExercise(ctx, line, kind, lines);
}

/**
 * A round on fixed sentences: fresh ones first, the weakest rules' sentences
 * more often. A sentence is as hard as its newest rule: while that one is new,
 * the exercises on it are simple ones.
 */
export function linesSession(p: Progress, ctx: Ctx, lines: Line[], size = 12): Exercise[] {
  if (!lines.length) return [];
  const level = (line: Line) => Math.min(...line.skills.map((s) => mastery(p.skills[s])));
  const out: Exercise[] = [];
  const seen = new Set<string>();
  const used = new Map<Line, number>();
  for (let attempt = 0; out.length < size && attempt < size * 8; attempt++) {
    const fresh = lines.filter((x) => (used.get(x) ?? 0) === Math.min(...lines.map((y) => used.get(y) ?? 0)));
    const line = weighted(ctx.r, fresh.map((x) => [x, 1.4 - level(x)] as [Line, number]));
    const ex = lineExercise(ctx, line, weighted(ctx.r, kindsFor(level(line))), lines);
    used.set(line, (used.get(line) ?? 0) + 1);
    if (!ex || seen.has(ex.context)) continue;
    seen.add(ex.context);
    if (phaseOf(level(line)) === "simple") ex.easy = true;
    out.push(ex);
  }
  return out;
}

