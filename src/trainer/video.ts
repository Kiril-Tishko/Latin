// The sentences of the videos as practice. Each lesson's sentences are read
// into words the exercises can check (the role each word plays and the ending
// it shows) and paired with the lesson's own English. Only sentences whose
// every word and form the learner has met (up to the step) are used.
import { LESSONS } from "../content/lessons";
import { Analysis, annotate, caseOf, Lexicon, numOf } from "../latin/analyze";
import { Knowledge, LToken, Rand, Role, shuffle } from "../latin/generate";
import { adjDecl, nounSkill } from "../latin/skills";
import { chooseOn, Ctx, endingOn, Exercise, ExerciseKind, meaningOn, tilesOn, writeOn } from "./exercises";
import { mastery, Progress } from "./progress";

export interface VideoLine {
  lesson: number;
  /** The Latin as the lesson writes it (with reading hints). */
  la: string;
  en: string;
  tokens: LToken[];
  /** The endings the sentence shows. */
  skills: string[];
}

/** "Tū scrībis. Tū studēs." with its English, one sentence at a time when they pair up. */
function pairs(la: string, en: string): [string, string][] {
  const split = (s: string) => (s.match(/[^.!?]+[.!?]?/g) ?? []).map((x) => x.trim()).filter(Boolean);
  const english = en.split(" / ")[0].trim();
  const ls = split(la);
  if (ls.length <= 1) return [[la, english]];
  const es = split(english);
  return ls.length === es.length ? ls.map((l, i) => [l, es[i]]) : [];
}

/** The ending a word shows, as the skill that teaches it. */
function skillOf(a: Analysis): string | undefined {
  const e = a.entry;
  if (e.kind === "verb") return a.key === "inf" ? "v.inf" : e.irregular === "sum" ? "v.sum" : e.irregular === "possum" ? "v.possum" : `v.${a.key.split(".")[1]}`;
  const c = caseOf(a);
  const n = numOf(a);
  if (!c || !n) return undefined;
  if (e.kind === "noun") return nounSkill(e.decl, c, n);
  if (e.kind === "adj") return nounSkill(adjDecl(a.gender ?? "m"), c, n);
  return undefined;
}

/** What each word does in the sentence, as far as the checker cares (pronouns optional, prepositions before their noun). */
function rolesOf(words: Analysis[]): Role[] {
  const isSum = (a?: Analysis) => a?.entry.kind === "verb" && a.entry.irregular === "sum";
  const hasSum = words.some(isSum);
  const verbAt = words.findIndex((a) => a.entry.kind === "verb");
  let subject = false;
  return words.map((a, i) => {
    const e = a.entry;
    if (e.kind === "verb") return a.key === "inf" ? "inf" : "verb";
    if (e.kind === "fixed") {
      if (e.role === "pron" && (e.id === "ego" || e.id === "tu")) {
        subject = true;
        return "pron";
      }
      if (e.role === "pron") return e.id === "se" ? "obj" : "subj";
      return e.role === "prep" ? "prep" : e.role === "neg" ? "neg" : e.role === "adv" ? "adv" : "conj";
    }
    const adj = e.kind === "adj";
    const before = [words[i - 1], words[i - 2]].map((w) => w?.entry);
    const afterPrep = (before[0]?.kind === "fixed" && before[0].role === "prep") || (adj === false && before[1]?.kind === "fixed" && before[1].role === "prep" && before[0]?.kind === "adj");
    const c = caseOf(a);
    if (afterPrep && (c === "abl" || c === "acc")) return adj ? "pp-adj" : "pp";
    if (c === "acc") return adj ? "obj-adj" : "obj";
    if (c === "gen") return "subj-poss";
    if (c === "abl") return adj ? "pp-adj" : "pp";
    // after est, or a second noun with est: the predicate
    if (hasSum && (subject || (verbAt >= 0 && i > verbAt)) && (adj || subject)) return adj ? "pred-adj" : "pred";
    if (!adj) subject = true;
    return adj ? "subj-adj" : "subj";
  });
}

/** One sentence as exercise words, or null if any word is unknown. */
function tokensOf(la: string, lex: Lexicon): LToken[] | null {
  const words = annotate(la, lex).filter((t) => t.isWord);
  if (!words.length || words.some((w) => !(w.analysis ?? w.readings?.[0]))) return null;
  const analyses = words.map((w) => (w.analysis ?? w.readings![0]) as Analysis);
  // a neuter looks the same as subject and object: with I / you acting, or a subject
  // already there, it is the object (Vīnum bibis: you drink wine)
  const verb = analyses.find((a) => a.entry.kind === "verb" && a.key.startsWith("pres."));
  const person = verb?.key.split(".")[1] ?? "";
  analyses.forEach((a, i) => {
    if (caseOf(a) !== "nom") return;
    const asObject = (words[i].readings ?? []).find((r) => r.entry.id === a.entry.id && caseOf(r) === "acc" && numOf(r) === numOf(a));
    if (!asObject) return;
    const otherSubject = analyses.some((b, j) => j !== i && b.entry.kind === "noun" && caseOf(b) === "nom" && !(words[j].readings ?? []).some((r) => r.entry.id === b.entry.id && caseOf(r) === "acc"));
    if (["1sg", "2sg", "1pl", "2pl"].includes(person) || otherSubject) analyses[i] = asObject;
  });
  const roles = rolesOf(analyses);
  return words.map((w, i) => {
    const a = analyses[i];
    const proper = a.entry.kind === "noun" && (a.entry.proper || a.entry.tags.includes("name"));
    return { text: proper ? w.text : w.text.toLowerCase(), role: roles[i], analysis: a, skill: skillOf(a) };
  });
}

/** The sentences of these lessons' videos that use only what the learner has met. */
export function videoLines(lessons: number[], lex: Lexicon, k: Knowledge): VideoLine[] {
  const out: VideoLine[] = [];
  for (const l of LESSONS.filter((x) => lessons.includes(x.n))) {
    for (const s of l.sentences) {
      for (const [la, en] of pairs(s.la, s.en)) {
        const tokens = tokensOf(la, lex);
        if (!tokens || !tokens.some((t) => t.skill)) continue;
        // only endings of the lessons up to the step
        const skills = [...new Set(tokens.map((t) => t.skill).filter(Boolean) as string[])];
        if (!skills.every((sk) => k.skills.has(sk))) continue;
        out.push({ lesson: l.n, la, en, tokens, skills });
      }
    }
  }
  return out;
}

type VideoKind = Extract<ExerciseKind, "choose" | "ending" | "tiles" | "en2la" | "meaning">;

/** Gentle kinds while a sentence's rules are new; writing it out as they settle. */
function kindsFor(m: number): [VideoKind, number][] {
  if (m < 0.35) return [["choose", 32], ["meaning", 26], ["tiles", 26], ["ending", 16]];
  if (m < 0.7) return [["tiles", 26], ["ending", 22], ["en2la", 26], ["choose", 14], ["meaning", 12]];
  return [["en2la", 44], ["tiles", 20], ["ending", 18], ["choose", 10], ["meaning", 8]];
}

function weighted<T>(r: Rand, items: [T, number][]): T {
  let roll = r() * items.reduce((sum, [, w]) => sum + w, 0);
  for (const [x, w] of items) if ((roll -= w) < 0) return x;
  return items[items.length - 1][0];
}

/** One exercise on a sentence from a video. */
export function videoExercise(ctx: Ctx, line: VideoLine, kind: VideoKind, lines: VideoLine[]): Exercise | null {
  // wrong meanings come from other video sentences: best the same verb with another
  // person (so the ending decides), then ones that share a word; none much longer
  const others = () => {
    const verbOf = (x: VideoLine) => x.tokens.find((t) => t.role === "verb")?.analysis?.entry.id;
    const ids = new Set(line.tokens.map((t) => t.analysis?.entry.id));
    const size = line.en.split(" ").length;
    const fair = lines.filter((x) => x !== line && x.en.split(" ").length <= size + 3);
    const sameVerb = shuffle(ctx.r, fair.filter((x) => verbOf(x) && verbOf(x) === verbOf(line)));
    const shared = shuffle(ctx.r, fair.filter((x) => !sameVerb.includes(x) && x.tokens.some((t) => ids.has(t.analysis?.entry.id))));
    const rest = shuffle(ctx.r, fair.filter((x) => !sameVerb.includes(x) && !shared.includes(x)));
    return [...sameVerb, ...shared, ...rest].map((x) => x.en);
  };
  const ex =
    kind === "choose" ? chooseOn(ctx, line.tokens, line.en, line.skills)
    : kind === "ending" ? endingOn(ctx, line.tokens, line.en, line.skills)
    : kind === "tiles" ? tilesOn(ctx, line.tokens, line.en, line.skills, line.skills)
    : kind === "meaning" ? meaningOn(ctx, line.tokens, line.en, line.skills, others())
    : writeOn(ctx, line.tokens, line.en, line.skills);
  if (!ex) return null;
  ex.video = line.lesson;
  ex.retry = () => {
    for (const k of shuffle(ctx.r, ["choose", "ending", "tiles", "meaning"] as VideoKind[])) {
      const again = k === kind ? null : videoExercise(ctx, line, k, lines);
      if (again) return again;
    }
    return null;
  };
  return ex;
}

/** A round on the sentences of the videos: the weakest rules' sentences more often. */
export function videoSession(p: Progress, ctx: Ctx, lessons: number[], size = 12): Exercise[] {
  const lines = videoLines(lessons, ctx.lex, ctx.k);
  if (!lines.length) return [];
  const level = (line: VideoLine) => line.skills.reduce((sum, s) => sum + mastery(p.skills[s]), 0) / line.skills.length;
  const out: Exercise[] = [];
  const seen = new Set<string>();
  const used = new Map<VideoLine, number>();
  for (let attempt = 0; out.length < size && attempt < size * 8; attempt++) {
    // fresh sentences first, weaker ones more often
    const fresh = lines.filter((x) => (used.get(x) ?? 0) === Math.min(...lines.map((y) => used.get(y) ?? 0)));
    const line = weighted(ctx.r, fresh.map((x) => [x, 1.4 - level(x)] as [VideoLine, number]));
    const ex = videoExercise(ctx, line, weighted(ctx.r, kindsFor(level(line))), lines);
    used.set(line, (used.get(line) ?? 0) + 1);
    if (!ex || seen.has(ex.context)) continue;
    seen.add(ex.context);
    if (level(line) < 0.4) ex.easy = true;
    out.push(ex);
  }
  return out;
}
