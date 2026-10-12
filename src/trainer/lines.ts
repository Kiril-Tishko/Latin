// Fixed sentences as practice: the videos' sentences, the stories, a word's own
// examples. Each sentence is read into words the exercises can check (the role
// each word plays and the ending it shows), and the rules it needs are worked
// out from its endings and its constructions, so a sentence is offered only
// once the learner's step covers all of them.
import { Analysis, annotate, caseOf, Lexicon, numOf } from "../latin/analyze";
import { LToken, Rand, Role, shuffle } from "../latin/generate";
import { adjDecl, nounSkill } from "../latin/skills";
import { chooseOn, Ctx, endingOn, Exercise, ExerciseKind, meaningOn, tilesOn, tokenRules, writeOn } from "./exercises";
import { phaseOf } from "./progress";

/** A sentence to read and practise. */
export interface Line {
  /** Where it comes from: a lesson's video or a story. */
  from: { kind: "video"; lesson: number } | { kind: "story"; id: string; title: string };
  /** The Latin as written (with reading hints such as poētae#gen.sg). */
  la: string;
  /** The English, as a reader would put it. */
  en: string;
  /** The English an exercise shows, when it needs more than `en` (the friend (f)). */
  prompt?: string;
  tokens: LToken[];
  /** Every rule the sentence needs: its endings and its constructions. */
  skills: string[];
}

/** The ending a word shows, as the skill that teaches it. */
export function skillOf(a: Analysis): string | undefined {
  const e = a.entry;
  if (e.kind === "verb") return a.key === "inf" ? "v.inf" : e.irregular === "sum" ? (a.key === "pres.3pl" ? "v.sunt" : "v.sum") : e.irregular === "possum" ? "v.possum" : `v.${a.key.split(".")[1]}`;
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
      if (e.role === "pron" && (e.id === "ego" || e.id === "tu" || e.id === "nos")) {
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
    // a city as the goal takes no preposition: Via Rōmam dūcit
    if (c === "acc" && e.kind === "noun" && e.tags.includes("city")) return "pp";
    if (c === "acc") return adj ? "obj-adj" : "obj";
    if (c === "dat") return adj ? "dat-adj" : "dat";
    if (c === "gen") return "subj-poss";
    if (c === "abl") return adj ? "pp-adj" : "pp";
    // after est, or a second noun with est: the predicate
    if (hasSum && (subject || (verbAt >= 0 && i > verbAt)) && (adj || subject)) return adj ? "pred-adj" : "pred";
    if (!adj) subject = true;
    return adj ? "subj-adj" : "subj";
  });
}

/** One sentence as exercise words, or null if any word is unknown. */
export function readLine(la: string, lex: Lexicon): LToken[] | null {
  const words = annotate(la, lex).filter((t) => t.isWord);
  if (!words.length || words.some((w) => !(w.analysis ?? w.readings?.[0]))) return null;
  const analyses = words.map((w) => (w.analysis ?? w.readings![0]) as Analysis);
  // a neuter looks the same as subject and object: with I / you acting, or a subject
  // already there, it is the object (Vīnum bibis: you drink wine)
  const verb = analyses.find((a) => a.entry.kind === "verb" && a.key.startsWith("pres."));
  const person = verb?.key.split(".")[1] ?? "";
  // -ō without a preposition before it is the dative (to whom), not the ablative (in which)
  analyses.forEach((a, i) => {
    if (caseOf(a) !== "abl" || words[i].analysis) return;
    const prev = analyses[i - 1]?.entry;
    if (prev?.kind === "fixed" && prev.role === "prep") return;
    const asDative = (words[i].readings ?? []).find((r) => r.entry.id === a.entry.id && caseOf(r) === "dat");
    if (asDative) analyses[i] = asDative;
  });
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

/** Indeclinable words that are a rule of their own. */
const WORD_RULES: Record<string, string> = { et: "s.et", non: "s.non", sed: "s.conn", quod: "s.conn", nemo: "s.conn", bene: "s.conn" };

/**
 * Every rule a sentence needs: the endings it shows, and its constructions: an
 * object, "of", nōn, a verb with ego / tū left out, an infinitive after a verb,
 * X est Y, in + a place, plural subjects, an adjective that follows gender.
 */
export function lineSkills(tokens: LToken[]): string[] {
  const out = new Set<string>();
  const has = (r: (t: LToken) => boolean) => tokens.some(r);
  for (const t of tokens) {
    if (t.skill) out.add(t.skill);
    const e = t.analysis?.entry;
    if (e?.kind === "fixed" && WORD_RULES[e.id]) out.add(WORD_RULES[e.id]);
    if (e?.kind === "adj") tokenRules(t, tokens).forEach((s) => out.add(s));
  }
  if (has((t) => t.role === "obj" && t.analysis?.entry.kind !== "fixed")) out.add("s.svo");
  if (has((t) => t.role.endsWith("-poss"))) out.add("s.gen");
  if (has((t) => t.role === "pred" || t.role === "pred-adj")) out.add("s.est");
  if (has((t) => t.role === "inf") && has((t) => t.role === "verb")) out.add("s.inf");
  const pron = has((t) => t.role === "pron");
  if (!pron && has((t) => t.role === "verb" && /\.(1sg|2sg|1pl)$/.test(t.analysis?.key ?? ""))) out.add("s.drop");
  if (has((t) => t.role === "dat")) out.add("s.dat");
  if (has((t) => t.role === "pp" && t.analysis?.entry.kind === "noun" && t.analysis.entry.tags.includes("city"))) out.add("s.city");
  if (has((t) => t.role === "verb" && t.analysis?.key === "pres.3pl")) out.add("s.pl");
  tokens.forEach((t, i) => {
    const e = t.analysis?.entry;
    if (e?.kind !== "fixed" || e.role !== "prep") return;
    const next = tokens.slice(i + 1).find((n) => n.role === "pp");
    const c = next?.analysis ? caseOf(next.analysis) : undefined;
    if (e.id === "ad-prep") out.add("s.ad");
    else if (c === "abl") out.add("s.loc");
    else if (c === "acc") out.add("s.into");
  });
  return [...out];
}

/** A sentence read into a line, or null if a word is unknown. */
export function makeLine(from: Line["from"], la: string, en: string, lex: Lexicon, prompt?: string): Line | null {
  const tokens = readLine(la, lex);
  if (!tokens || !tokens.some((t) => t.skill)) return null;
  return { from, la, en, prompt, tokens, skills: lineSkills(tokens) };
}

export type LineKind = Extract<ExerciseKind, "choose" | "ending" | "tiles" | "en2la" | "meaning">;

/** Simple kinds while a sentence's rules are new; writing it out as they hold. */
export function kindsFor(m: number): [LineKind, number][] {
  const phase = phaseOf(m);
  if (phase === "simple") return [["choose", 32], ["meaning", 26], ["tiles", 26], ["ending", 16]];
  if (phase === "mixed") return [["tiles", 26], ["ending", 22], ["en2la", 26], ["choose", 14], ["meaning", 12]];
  return [["en2la", 44], ["tiles", 20], ["ending", 18], ["choose", 10], ["meaning", 8]];
}

export function weighted<T>(r: Rand, items: [T, number][]): T {
  let roll = r() * items.reduce((sum, [, w]) => sum + w, 0);
  for (const [x, w] of items) if ((roll -= w) < 0) return x;
  return items[items.length - 1][0];
}

/** One exercise on a fixed sentence. */
export function lineExercise(ctx: Ctx, line: Line, kind: LineKind, lines: Line[]): Exercise | null {
  const en = line.prompt ?? line.en;
  // wrong meanings come from the other sentences: best the same verb with another
  // person (so the ending decides), then ones that share a word; none much longer
  const others = () => {
    const verbOf = (x: Line) => x.tokens.find((t) => t.role === "verb")?.analysis?.entry.id;
    const ids = new Set(line.tokens.map((t) => t.analysis?.entry.id));
    const size = en.split(" ").length;
    const fair = lines.filter((x) => x !== line && (x.prompt ?? x.en) !== en && (x.prompt ?? x.en).split(" ").length <= size + 3);
    const sameVerb = shuffle(ctx.r, fair.filter((x) => verbOf(x) && verbOf(x) === verbOf(line)));
    const shared = shuffle(ctx.r, fair.filter((x) => !sameVerb.includes(x) && x.tokens.some((t) => ids.has(t.analysis?.entry.id))));
    const rest = shuffle(ctx.r, fair.filter((x) => !sameVerb.includes(x) && !shared.includes(x)));
    return [...sameVerb, ...shared, ...rest].map((x) => x.prompt ?? x.en);
  };
  const ex =
    kind === "choose" ? chooseOn(ctx, line.tokens, en, line.skills)
    : kind === "ending" ? endingOn(ctx, line.tokens, en, line.skills)
    : kind === "tiles" ? tilesOn(ctx, line.tokens, en, line.skills, line.skills)
    : kind === "meaning" ? meaningOn(ctx, line.tokens, en, line.skills, others())
    : writeOn(ctx, line.tokens, en, line.skills);
  if (!ex) return null;
  if (line.from.kind === "video") ex.video = line.from.lesson;
  else ex.story = line.from.title;
  ex.retry = () => {
    for (const k of shuffle(ctx.r, ["choose", "ending", "tiles", "meaning"] as LineKind[])) {
      const again = k === kind ? null : lineExercise(ctx, line, k, lines);
      if (again) return again;
    }
    return null;
  };
  return ex;
}
