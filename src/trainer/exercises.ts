// Exercise factories. Each exercise carries its own checker and the skills
// and words it practises, so the session can update mastery afterwards.
import { Analysis, Lexicon } from "../latin/analyze";
import { checkEnglish, checkLatin, CheckedToken, describe, hinted, Issue, slotsFor, Verdict } from "../latin/check";
import { en3s, enIng, enPlural, normalizeEnglish } from "../latin/english";
import {
  chance, Clause, english, generate, Knowledge, latinText, latinTokens, LToken, NP, pick, Rand, shuffle, swapRoles, verbUsable,
  nounUsable, adjUsable, adjFits, makesSense, sensibleObject,
} from "../latin/generate";
import { conjugate, declineAdj, declineNoun, dictionaryForm } from "../latin/morph";
import { SKILL_BY_ID, adjDecl, declGroup, nounSkill } from "../latin/skills";
import { latinKey, words } from "../latin/text";
import { AdjEntry, Case, CASE_NAMES, Entry, full, NounKey, Num, PN, VerbEntry, VerbKey } from "../latin/types";

export type ExerciseKind = "en2la" | "la2en" | "ending" | "choose" | "form" | "transform" | "identify" | "vocab" | "listen" | "derive" | "tiles" | "meaning" | "answer";

/** Kinds made from the generator (the others need a word, a sentence or a question to work on). */
export type MadeKind = Exclude<ExerciseKind, "vocab" | "derive" | "answer">;

export const KIND_LABEL: Record<ExerciseKind, string> = {
  en2la: "Translate into Latin",
  la2en: "Translate into English",
  ending: "Fill in the ending",
  choose: "Choose the right word",
  form: "Build the form",
  transform: "Change the sentence",
  identify: "Find the word",
  vocab: "Word recall",
  listen: "Listen and write",
  derive: "Find the Latin word",
  tiles: "Build the sentence",
  meaning: "What does it mean?",
  answer: "Answer in Latin",
};

export interface Result {
  verdict: Verdict;
  issues: Issue[];
  /** The model answer as plain text. */
  expected: string;
  /** The model answer as Latin tokens (colored in the UI). */
  expectedTokens?: LToken[];
  /** The learner's Latin words with their status. */
  tokens?: CheckedToken[];
  /** Skill id -> score 0..1 for this attempt. */
  credit: Record<string, number>;
  /** Word id -> correct? */
  wordCredit: Record<string, boolean>;
  /** Judged by the coach (an answer in the learner's own words): `expected` is then their answer corrected. */
  coached?: boolean;
}

export interface Exercise {
  id: string;
  kind: ExerciseKind;
  instruction: string;
  /** Latin shown in the prompt. */
  latin?: LToken[];
  /** Token index shown as stem + blank. */
  blank?: number;
  english?: string;
  /** English of the expected answer when it differs from `english` (transform). */
  answerEnglish?: string;
  /** A short request line such as "puella → accusative singular", or a question to answer in Latin. */
  ask?: string;
  /** The meanings of new words in the question ("quid = what"). */
  gloss?: string[];
  askCase?: Case;
  askNum?: Num;
  /** Dictionary forms that help, revealed on request. */
  hints: string[];
  answer: "la" | "en" | "ending" | "choice" | "tiles";
  choices?: { id: string; label: string }[];
  /** For "choice": the correct choice id. */
  correctChoice?: string;
  check: (answer: string) => Result;
  skills: string[];
  words: string[];
  /** Plain-text summary for Ask Claude. */
  context: string;
  /** Latin to read aloud for the prompt (listening, or Latin shown on screen). */
  audio?: string;
  /** Aimed at a rule that is still new: shown with colors and as plainly as possible. */
  easy?: boolean;
  /** A review between a rule's exercises (a mistake to fix, a word that is due): it doesn't break a block of one kind. */
  aside?: boolean;
  /** An earlier rule, reviewed in a rule's round (one in five past its simple exercises). */
  earlier?: boolean;
  /** The round's last: a question the learner answers in their own Latin, with the rule just practised. */
  last?: boolean;
  /** For "tiles": the words to build the answer from (the right ones and a wrong form or two). */
  tiles?: string[];
  /** For "tiles": how many of them are extra (wrong forms to leave out). */
  extra?: number;
  /** Where the gapped word is in `english` ([start, end)): marked there too, so the gap and its meaning are seen together. */
  mark?: [number, number];
  /** A sentence from the video of this lesson. */
  video?: number;
  /** A sentence from this story (its title). */
  story?: string;
  /** The mistake (its time) this exercise brings back in "Fix my mistakes". */
  fixes?: number;
  /** Another exercise on the same material, for a wrong answer to come back to. */
  retry?: () => Exercise | null;
}

export interface Ctx {
  k: Knowledge;
  lex: Lexicon;
  r: Rand;
  /** The device can read Latin aloud, so listening exercises are possible. */
  audio?: boolean;
}

let counter = 0;
export const nextId = () => `ex${Date.now().toString(36)}${(counter++).toString(36)}`;

const plainText = (s: string) => s.replace(/«|»/g, "").replace(/#[a-z0-9]+(?:\.[a-z0-9]+)*/g, "");

function contentWords(tokens: LToken[]): Entry[] {
  const seen = new Set<string>();
  const out: Entry[] = [];
  for (const t of tokens) {
    const e = t.analysis?.entry;
    if (!e || e.kind === "fixed" || seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}

export function wordIds(tokens: LToken[]): string[] {
  return contentWords(tokens).map((e) => e.id);
}

export function hintsFor(tokens: LToken[]): string[] {
  return contentWords(tokens).map((e) => `${dictionaryForm(e)}: ${e.en}`);
}

/** Credit every skill in the sentence; skills blamed by an issue get 0. */
export function creditFrom(skills: string[], verdict: Verdict, issues: Issue[]): Record<string, number> {
  const blamed = new Set(issues.filter((i) => i.kind !== "tip" && i.kind !== "typo").map((i) => i.skill).filter(Boolean) as string[]);
  const base = verdict === "correct" ? 1 : verdict === "almost" ? 0.85 : 0.55;
  const out: Record<string, number> = {};
  for (const s of skills) out[s] = blamed.has(s) ? 0 : base;
  for (const s of blamed) out[s] = 0;
  return out;
}

function wordsCredit(ids: string[], ok: boolean): Record<string, boolean> {
  return Object.fromEntries(ids.map((id) => [id, ok]));
}

// ---------------------------------------------------------- translate

/** Write a sentence in Latin from its English (a generated one or one from a video); any word order counts. */
export function writeOn(ctx: Ctx, tokens: LToken[], englishText: string, skills: string[]): Exercise {
  const slots = slotsFor(tokens, ctx.k);
  const ids = wordIds(tokens);
  return {
    id: nextId(),
    kind: "en2la",
    instruction: KIND_LABEL.en2la,
    english: englishText,
    hints: hintsFor(tokens),
    answer: "la",
    skills,
    words: ids,
    context: `Translate into Latin: "${englishText}". Model answer: ${latinText(tokens)}`,
    check(answer) {
      const r = checkLatin(answer, slots, ctx.lex);
      const blamedWords = new Set(r.tokens.filter((t) => t.status === "word").map((t) => t.slot?.analysis?.entry.id));
      return {
        verdict: r.verdict,
        issues: r.issues,
        expected: latinText(tokens),
        expectedTokens: tokens,
        tokens: r.tokens,
        credit: creditFrom(skills, r.verdict, r.issues),
        wordCredit: Object.fromEntries(ids.map((id) => [id, !blamedWords.has(id)])),
      };
    },
  };
}

function en2la(ctx: Ctx, focus: string[]): Exercise | null {
  const c = generate(ctx.k, ctx.r, focus);
  if (!c) return null;
  return writeOn(ctx, latinTokens(c, ctx.k), english(c, ctx.k).text, c.skills);
}

/**
 * Build the Latin sentence from word tiles: the right words and a wrong form or
 * two of them, so the choice is about endings, not spelling. Any order counts.
 */
export function tilesOn(ctx: Ctx, tokens: LToken[], englishText: string, skills: string[], focus: string[] = []): Exercise | null {
  if (tokens.length < 2 || tokens.length > 7) return null;
  const right = tokens.map((t) => latinKey(t.text));
  const candidates = tokens
    .map((t) => ({ t, wrong: t.analysis && ["verb", "noun", "adj"].includes(t.analysis.entry.kind) ? wrongForms(ctx.k, t).filter((w) => !right.includes(latinKey(w.text))) : [] }))
    .filter((x) => x.wrong.length > 0);
  const focused = candidates.filter((x) => tokenRules(x.t, tokens).some((s) => focus.includes(s)));
  const chosen = shuffle(ctx.r, focused.length ? focused : candidates).slice(0, tokens.length <= 3 ? 1 : 2);
  if (!chosen.length) return null;
  const tiles = shuffle(ctx.r, [...tokens.map((t) => t.text), ...chosen.map((x) => pick(ctx.r, x.wrong).text)]);
  const ex = writeOn(ctx, tokens, englishText, skills);
  return {
    ...ex,
    kind: "tiles",
    instruction: KIND_LABEL.tiles,
    answer: "tiles",
    tiles,
    extra: chosen.length,
    hints: [],
    context: `Build the Latin for "${englishText}" from the tiles ${tiles.join(" / ")}. Model answer: ${latinText(tokens)}`,
  };
}

function tilesEx(ctx: Ctx, focus: string[]): Exercise | null {
  for (let attempt = 0; attempt < 6; attempt++) {
    const c = generate(ctx.k, ctx.r, focus);
    if (!c) return null;
    // with ego / tū in sight the verb form is the choice that matters
    const shown: Clause = c.subj.kind === "pron" ? { ...c, subj: { ...c.subj, shown: true } } : c;
    const ex = tilesOn(ctx, latinTokens(shown, ctx.k), english(shown, ctx.k).text, shown.skills, focus);
    if (ex) return ex;
  }
  return null;
}

/** Which English sentence says what the Latin says? Two others are the wrong options. */
export function meaningOn(ctx: Ctx, tokens: LToken[], englishText: string, skills: string[], others: string[]): Exercise | null {
  const same = normalizeEnglish(englishText);
  const wrong = [...new Map(others.filter((o) => normalizeEnglish(o) !== same).map((o) => [normalizeEnglish(o), o])).values()].slice(0, 2);
  if (wrong.length < 2) return null;
  const all = shuffle(ctx.r, [englishText, ...wrong]);
  const correct = String(all.indexOf(englishText));
  const ids = wordIds(tokens);
  return {
    id: nextId(),
    kind: "meaning",
    instruction: KIND_LABEL.meaning,
    latin: tokens,
    audio: latinText(tokens),
    hints: hintsFor(tokens),
    answer: "choice",
    choices: all.map((en, i) => ({ id: String(i), label: en })),
    correctChoice: correct,
    skills,
    words: ids,
    context: `Which English sentence means "${latinText(tokens)}"? Options: ${all.join(" / ")}. Answer: ${englishText}`,
    check(answer) {
      const ok = answer === correct;
      return {
        verdict: ok ? "correct" : "wrong",
        issues: ok ? [] : [{ kind: "word", message: `Read the endings again: ${hinted(latinText(tokens))} means "${englishText.replace(/\.$/, "")}".` }],
        expected: englishText,
        credit: Object.fromEntries(skills.map((sk) => [sk, ok ? 1 : 0.3])),
        wordCredit: wordsCredit(ids, ok),
      };
    },
  };
}

/** The meaning of a generated sentence, against the same words with the roles swapped and another sentence. */
function meaningEx(ctx: Ctx, focus: string[]): Exercise | null {
  for (let attempt = 0; attempt < 6; attempt++) {
    const c = generate(ctx.k, ctx.r, focus);
    if (!c) return null;
    const tokens = latinTokens(c, ctx.k);
    const swapped = swapRoles(c);
    const more = [0, 1, 2].map(() => generate(ctx.k, ctx.r, focus));
    const others = [swapped, ...more].filter(Boolean).map((x) => english(x!, ctx.k).text);
    const ex = meaningOn(ctx, tokens, english(c, ctx.k).text, c.skills, others);
    if (ex) return ex;
  }
  return null;
}

function la2en(ctx: Ctx, focus: string[]): Exercise | null {
  const c = generate(ctx.k, ctx.r, focus);
  if (!c) return null;
  const tokens = latinTokens(c, ctx.k);
  const en = english(c, ctx.k);
  const swapped = swapRoles(c);
  const swappedEn = swapped ? english(swapped, ctx.k) : undefined;
  const ids = wordIds(tokens);
  return {
    id: nextId(),
    kind: "la2en",
    instruction: KIND_LABEL.la2en,
    latin: tokens,
    audio: latinText(tokens),
    hints: hintsFor(tokens),
    answer: "en",
    skills: c.skills,
    words: ids,
    context: `Translate into English: ${latinText(tokens)} Model answer: "${en.text}"`,
    check(answer) {
      const r = checkEnglish(answer, en, swappedEn);
      const roleSkills =
        r.issues.some((i) => i.message.includes("swapped"))
          ? tokens.filter((t) => t.role === "subj" || t.role === "obj").map((t) => t.skill!).filter(Boolean)
          : [];
      const credit = creditFrom(c.skills, r.verdict, r.issues);
      for (const s of roleSkills) credit[s] = 0;
      return {
        verdict: r.verdict,
        issues: r.issues,
        expected: en.text,
        expectedTokens: tokens,
        credit,
        wordCredit: wordsCredit(ids, r.verdict !== "wrong"),
      };
    },
  };
}

// --------------------------------------------------------------- ending

function ending(ctx: Ctx, focus: string[]): Exercise | null {
  const c = generate(ctx.k, ctx.r, focus);
  if (!c) return null;
  return endingOn(ctx, latinTokens(c, ctx.k), english(c, ctx.k).text, focus);
}

/** Fill in the ending of one word of a sentence (a generated one or one from a video). */
/**
 * The rules a word's ending tests: its own ending, and for a describing word
 * the agreement with its noun (and the gender rule when the noun is a
 * masculine -a word like agricola).
 */
export function tokenRules(t: LToken, tokens: LToken[]): string[] {
  const out = t.skill ? [t.skill] : [];
  if (t.analysis?.entry.kind !== "adj") return out;
  out.push("adj.agree");
  // after est it goes with the subject: agricola magnus est
  const owner = t.role === "pred-adj" ? "subj" : t.role.replace("-adj", "");
  const noun = tokens.find((n) => n.analysis?.entry.kind === "noun" && n.role === owner)?.analysis?.entry;
  if (noun?.kind === "noun" && ((noun.decl === "1" && noun.gender === "m") || (noun.decl === "2" && noun.gender === "f"))) out.push("adj.gender");
  return out;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Where a word of the Latin sentence is in its English: the noun, describing
 * word or verb that the gap stands for ("girl" in "The farmer sees the girl."),
 * so the exercise can mark it in both lines. When a word comes twice ("the
 * friend (f) of the friend (m)"), its role picks the one: whose → after "of" or
 * before "'s", the object → the later one, the subject → the first.
 */
export function englishMark(englishText: string, t: LToken): [number, number] | null {
  const e = t.analysis?.entry;
  if (!e || e.kind === "fixed") return null;
  const meanings = [e.en, ...(e.alt ?? [])].map((m) => m.replace(/^(the|a|an|to) /, "").replace(/\s*\(.*\)$/, "").trim()).filter(Boolean);
  let forms: string[];
  if (e.kind === "verb") {
    const vs = [e.env, ...(e.altv ?? [])];
    forms = vs.flatMap((v) => [v.base, en3s(v), enIng(v), v.past ?? "", v.pp ?? ""]).filter(Boolean);
    if (e.irregular === "sum") forms.push("am", "are", "is");
    if (e.irregular === "possum") forms.push("can", "cannot", "able");
  } else if (e.kind === "noun") forms = meanings.flatMap((m) => [m, enPlural(m, e.enPl)]);
  else forms = meanings;
  // the longest first, so "reads" is not cut to "read"
  const words = [...new Set(forms)].sort((a, b) => b.length - a.length).map(escape);
  if (!words.length) return null;
  const re = new RegExp(`\\b(?:${words.join("|")})(?:'s|s'|')?(?![\\w])`, "gi");
  const hits = [...englishText.matchAll(re)].map((m) => [m.index!, m.index! + m[0].length] as [number, number]);
  if (!hits.length) return null;
  if (hits.length === 1) return hits[0];
  const before = (h: [number, number]) => englishText.slice(0, h[0]);
  const whose = (h: [number, number]) => /\bof (the |a |an |my )?$/i.test(before(h)) || /'s?$/.test(englishText.slice(h[0], h[1]));
  if (t.role.endsWith("-poss")) return hits.find(whose) ?? hits[0];
  const plain = hits.filter((h) => !whose(h));
  const pool = plain.length ? plain : hits;
  return t.role.startsWith("obj") || t.role.startsWith("pp") || t.role.startsWith("dat") ? pool[pool.length - 1] : pool[0];
}

export function endingOn(ctx: Ctx, tokens: LToken[], englishText: string, focus: string[]): Exercise | null {
  // before subject and object are told apart (Lesson II), a subject's ending is
  // just the dictionary form: blank something that tests a rule instead
  const trivial = (t: LToken) => !ctx.k.skills.has("s.svo") && t.analysis?.key === "nom.sg";
  const all = tokens
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.analysis && t.analysis.entry.kind !== "fixed" && t.analysis.form.ending && t.analysis.form.stem);
  const candidates = all.some(({ t }) => !trivial(t)) ? all.filter(({ t }) => !trivial(t)) : all;
  if (!candidates.length) return null;
  const focused = candidates.filter(({ t }) => tokenRules(t, tokens).some((s) => focus.includes(s)));
  const { t: target, i: blank } = pick(ctx.r, focused.length ? focused : candidates);
  const a = target.analysis!;
  const skills = tokenRules(target, tokens);
  return {
    id: nextId(),
    kind: "ending",
    instruction: KIND_LABEL.ending,
    latin: tokens,
    blank,
    english: englishText,
    mark: englishMark(englishText, target) ?? undefined,
    hints: [`${dictionaryForm(a.entry)}: ${a.entry.en}`],
    answer: "ending",
    skills,
    words: [a.entry.id],
    context: `Fill in the ending of "${a.form.stem}___" in: ${latinText(tokens)} ("${englishText}"). Answer: -${a.form.ending}`,
    check(answer) {
      const typed = latinKey(answer.trim().replace(/^-/, ""));
      const end = latinKey(a.form.ending);
      const whole = latinKey(full(a.form));
      const ok = typed === end || typed === whole;
      const issues: Issue[] = [];
      if (!ok) {
        const attempt = typed.startsWith(latinKey(a.form.stem)) ? answer.trim() : a.form.stem + answer.trim().replace(/^-/, "");
        const mine = ctx.lex.analyzeAs(attempt, a.entry.id)[0];
        issues.push({
          kind: "form",
          message: mine
            ? `${hinted(attempt, mine)} would be the ${describe(mine)}. Here it must be the ${describe(a)}: ${hinted(full(a.form), a)}.`
            : `The ending is -${a.form.ending}: ${hinted(full(a.form), a)} (${describe(a)}).`,
          skill: target.skill,
        });
      }
      return {
        verdict: ok ? "correct" : "wrong",
        issues,
        expected: `-${a.form.ending} → ${full(a.form)}`,
        expectedTokens: tokens,
        credit: Object.fromEntries(skills.map((s) => [s, ok ? 1 : 0])),
        wordCredit: { [a.entry.id]: ok },
      };
    },
  };
}

// --------------------------------------------------------------- choose

const PERSONS: PN[] = ["1sg", "2sg", "3sg", "1pl", "3pl"];
const NOUN_KEYS: NounKey[] = ["nom.sg", "acc.sg", "gen.sg", "dat.sg", "abl.sg", "nom.pl"];

/**
 * Other forms of a word that the learner knows, as wrong options. Only forms
 * that cannot also make a correct sentence: no "of" form unless that is the
 * answer, and after in / ad only forms a preposition never takes.
 */
function wrongForms(k: Knowledge, t: LToken): LToken[] {
  const a = t.analysis!;
  const e = a.entry;
  const out: LToken[] = [];
  if (e.kind === "verb" && t.role === "verb" && !a.key.startsWith("inf")) {
    for (const pn of PERSONS) {
      const key = `pres.${pn}` as VerbKey;
      const form = conjugate(e)[key];
      if (key !== a.key && form && verbUsable(k, e, pn)) out.push({ text: full(form), role: t.role, analysis: { entry: e, key, form }, skill: `v.${pn}` });
    }
  } else if (e.kind === "noun") {
    for (const key of NOUN_KEYS) {
      const [c, n] = key.split(".") as [Case, Num];
      if (key === a.key || !nounUsable(k, e, c, n)) continue;
      // no "of" or "to whom" form unless it is the answer: either could make another right sentence
      if ((c === "gen" || c === "dat") && !a.key.startsWith(c)) continue;
      if (t.role === "pp" && (c === "acc" || c === "abl")) continue;
      const form = declineNoun(e)[key];
      if (form) out.push({ text: full(form), role: t.role, analysis: { entry: e, key, gender: e.gender, form }, skill: nounSkill(e.decl, c, n) });
    }
  } else if (e.kind === "adj" && e.cls === "12" && a.gender) {
    const g = a.gender;
    const adjForm = (gender: typeof g, key: NounKey): LToken => {
      const [c, n] = key.split(".") as [Case, Num];
      const form = declineAdj(e, gender)[key];
      return { text: full(form), role: t.role, analysis: { entry: e, key, gender, form }, skill: nounSkill(adjDecl(gender), c, n) };
    };
    // the same gender in another case: magnam for magna
    for (const key of NOUN_KEYS) {
      const [c, n] = key.split(".") as [Case, Num];
      if (key === a.key || !k.skills.has(nounSkill(adjDecl(g), c, n))) continue;
      if ((c === "gen" || c === "dat") && !a.key.startsWith(c)) continue;
      if (t.role === "pp-adj" && (c === "acc" || c === "abl")) continue;
      out.push(adjForm(g, key));
    }
    // the other gender in the same case: pulcher for pulchra, and magna for agricola's magnus
    const other = g === "m" ? "f" : g === "f" ? "m" : undefined;
    const [c, n] = a.key.split(".") as [Case, Num];
    if (other && k.skills.has(nounSkill(adjDecl(other), c, n))) out.push(adjForm(other, a.key as NounKey));
  }
  // one option per spelling (puellae is both "of the girl" and "girls")
  const seen = new Set([latinKey(t.text)]);
  return out.filter((x) => !seen.has(latinKey(x.text)) && (seen.add(latinKey(x.text)), true));
}

const whatForm = (a: Analysis) => (a.entry.kind === "verb" ? describe(a) : `the ${describe(a)}`);

/** Pick the right form for the gap out of two or three: the gentlest way to meet an ending. */
function choose(ctx: Ctx, focus: string[]): Exercise | null {
  for (let attempt = 0; attempt < 8; attempt++) {
    const generated = generate(ctx.k, ctx.r, focus);
    if (!generated) return null;
    // with ego / tū in sight only one verb form fits
    const c: Clause = generated.subj.kind === "pron" ? { ...generated, subj: { ...generated.subj, shown: true } } : generated;
    const ex = chooseOn(ctx, latinTokens(c, ctx.k), english(c, ctx.k).text, focus);
    if (ex) return ex;
  }
  return null;
}

/** The right form for a gap in a sentence (a generated one or one from a video), out of two or three. */
export function chooseOn(ctx: Ctx, tokens: LToken[], englishText: string, focus: string[]): Exercise | null {
  const options = tokens
    .map((t, i) => ({ t, i, wrong: t.analysis && ["verb", "noun", "adj"].includes(t.analysis.entry.kind) ? wrongForms(ctx.k, t) : [] }))
    .filter((x) => x.wrong.length > 0);
  if (!options.length) return null;
  const focused = options.filter((x) => tokenRules(x.t, tokens).some((s) => focus.includes(s)));
  const { t: target, i: blank, wrong } = pick(ctx.r, focused.length ? focused : options);
  const all = shuffle(ctx.r, [target, ...shuffle(ctx.r, wrong).slice(0, 2)]);
  const correct = String(all.indexOf(target));
  const a = target.analysis!;
  const skills = tokenRules(target, tokens);
  return {
    id: nextId(),
    kind: "choose",
    instruction: KIND_LABEL.choose,
    latin: tokens,
    blank,
    english: englishText,
    mark: englishMark(englishText, target) ?? undefined,
    hints: [`${dictionaryForm(a.entry)}: ${a.entry.en}`],
    answer: "choice",
    choices: all.map((x, i) => ({ id: String(i), label: x.text })),
    correctChoice: correct,
    skills,
    words: [a.entry.id],
    context: `Choose the word for the gap in: ${latinText(tokens)} ("${englishText}"). Options: ${all.map((x) => x.text).join(" / ")}. Answer: ${target.text}`,
    check(answer) {
      const ok = answer === correct;
      const chosen = all[Number(answer)];
      const issues: Issue[] = [];
      if (!ok && chosen?.analysis) {
        issues.push({
          kind: "form",
          message: `${hinted(chosen.text, chosen.analysis)} is ${whatForm(chosen.analysis)}. Here it must be ${whatForm(a)}: ${hinted(target.text, a)}.`,
          skill: target.skill,
        });
      }
      return {
        verdict: ok ? "correct" : "wrong",
        issues,
        expected: target.text,
        expectedTokens: tokens,
        credit: Object.fromEntries(skills.map((sk) => [sk, ok ? 1 : 0])),
        wordCredit: { [a.entry.id]: ok },
      };
    },
  };
}

// ----------------------------------------------------------------- form

const ROLE_OF_CASE: Partial<Record<Case, string>> = {
  nom: "subject",
  acc: "object",
  gen: "of / 's",
  abl: "place: in …",
  dat: "to / for",
};

function nounFormExercise(ctx: Ctx, skillId: string, focus: string[] = []): Exercise | null {
  const [group, c, n] = skillId.split(".") as [string, Case, Num];
  const pool = ctx.k.nouns.filter((x) => declGroup(x.decl) === group && nounUsable(ctx.k, x, c, n));
  if (!pool.length) return null;
  const noun = pick(ctx.r, pool);
  const key = `${c}.${n}` as NounKey;
  const form = declineNoun(noun)[key]!;
  let adj: AdjEntry | undefined;
  // an adjective comes along once the endings settle, or when agreement is the point
  const rich = ctx.k.richness ?? 1;
  const adjChance = rich >= 0.5 ? 0.35 * rich : focus.includes("adj.agree") ? 0.6 : 0;
  if (chance(ctx.r, adjChance)) {
    const adjs = ctx.k.adjs.filter(
      (x) => x.id !== "meus" && adjUsable(ctx.k, x, noun, c, n) && adjUsable(ctx.k, x, noun, "nom", "sg") && (ctx.k.silly > 0 || adjFits(x, noun.tags)),
    );
    if (adjs.length) adj = pick(ctx.r, adjs);
  }
  const nounNom = full(declineNoun(noun)["nom.sg"] ?? form);
  const adjNom = adj ? full(declineAdj(adj, noun.gender)["nom.sg"]) : "";
  const adjForm = adj ? declineAdj(adj, noun.gender)[key] : undefined;
  const target: LToken[] = [
    ...(adjForm ? [{ text: full(adjForm), role: "subj-adj" as const, analysis: { entry: adj!, key, gender: noun.gender, form: adjForm } }] : []),
    { text: full(form), role: "subj", analysis: { entry: noun, key, gender: noun.gender, form }, skill: skillId },
  ];
  const expected = target.map((t) => t.text).join(" ");
  const skills = [skillId, ...(adj ? ["adj.agree", nounSkill(adjDecl(noun.gender), c, n)] : [])];
  const label = `${CASE_NAMES[c]} ${n === "pl" ? "plural" : "singular"}`;
  return {
    id: nextId(),
    kind: "form",
    instruction: KIND_LABEL.form,
    ask: `${adj ? adjNom + " " : ""}${nounNom} → ${label} (${ROLE_OF_CASE[c] ?? ""})`,
    askCase: c,
    askNum: n,
    hints: [SKILL_BY_ID.get(skillId)?.hint ?? "", `${dictionaryForm(noun)}: ${noun.en}`],
    answer: "la",
    skills: [...new Set(skills)],
    words: [noun.id, ...(adj ? [adj.id] : [])],
    context: `Put "${adj ? adjNom + " " : ""}${nounNom}" into the ${label}. Answer: ${expected}`,
    check(answer) {
      const typed = words(answer);
      const want = target.map((t) => latinKey(t.text));
      const keys = typed.map(latinKey);
      const ok = keys.length === want.length && want.every((w) => keys.includes(w));
      const issues: Issue[] = [];
      if (!ok) {
        for (const t of target) {
          if (keys.includes(latinKey(t.text))) continue;
          const mineWord = typed.find((w) => ctx.lex.analyzeAs(w, t.analysis!.entry.id).length);
          const mine = mineWord ? ctx.lex.analyzeAs(mineWord, t.analysis!.entry.id)[0] : undefined;
          issues.push({
            kind: "form",
            message: mine
              ? `${hinted(mineWord!, mine)} is the ${describe(mine)}. The ${label} is ${hinted(t.text, t.analysis)}.`
              : `The ${label} is ${hinted(t.text, t.analysis)}.`,
            skill: t.skill ?? skillId,
          });
        }
      }
      return {
        verdict: ok ? "correct" : "wrong",
        issues,
        expected,
        expectedTokens: target,
        credit: Object.fromEntries(skills.map((s) => [s, ok ? 1 : 0])),
        wordCredit: { [noun.id]: ok },
      };
    },
  };
}

function verbFormExercise(ctx: Ctx, skillId: string): Exercise | null {
  let verb: VerbEntry | undefined;
  let key: VerbKey;
  let label: string;
  if (skillId === "v.inf") {
    // from the tū form, whose vowel decides the infinitive (from discō alone it can't be known)
    const pool = ctx.k.verbs.filter((v) => !v.irregular && verbUsable(ctx.k, v, "2sg"));
    if (!pool.length) return null;
    verb = pick(ctx.r, pool);
    key = "inf";
    label = "infinitive (to …)";
  } else {
    let pn: PN;
    if (skillId === "v.sum" || skillId === "v.possum") {
      verb = ctx.k.verbs.find((v) => v.irregular === (skillId === "v.sum" ? "sum" : "possum"));
      pn = pick(ctx.r, ["1sg", "2sg", "3sg"] as PN[]);
    } else if (skillId === "v.sunt") {
      verb = ctx.k.verbs.find((v) => v.irregular === "sum");
      pn = "3pl";
    } else {
      pn = skillId.slice(2) as PN;
      const pool = ctx.k.verbs.filter((v) => !v.irregular && verbUsable(ctx.k, v, pn));
      if (!pool.length) return null;
      verb = pick(ctx.r, pool);
    }
    if (!verb || !verbUsable(ctx.k, verb, pn)) return null;
    key = `pres.${pn}` as VerbKey;
    const who = pn === "1sg" ? "ego (I)" : pn === "2sg" ? "tū (you)" : pn === "3sg" ? "he / she / it" : pn === "1pl" ? "nōs (we)" : "they";
    label = who;
  }
  const form = conjugate(verb)[key]!;
  const expected = full(form);
  // the infinitive and the "we" form come from the tū form, whose vowel they keep (ambulās → ambulāmus)
  const fromYou = key === "inf" || key === "pres.1pl";
  const shown = fromYou ? full(conjugate(verb)["pres.2sg"]!) : full(conjugate(verb).inf!);
  const token: LToken = { text: expected, role: "verb", analysis: { entry: verb, key, form }, skill: skillId };
  // the hints never spell out the answer
  const hints =
    key === "inf"
      ? ["The vowel before -s gives the infinitive: -ās → -āre, -ēs → -ēre, -īs → -īre, a short -is → -ere.", `${shown} = you ${verb.en}`]
      : [SKILL_BY_ID.get(skillId)?.hint ?? "", fromYou ? `${shown} = you ${verb.en}` : `${shown} = to ${verb.irregular === "possum" ? "be able (can)" : verb.en}`];
  return {
    id: nextId(),
    kind: "form",
    instruction: KIND_LABEL.form,
    ask: `${shown} → ${label}`,
    hints,
    answer: "la",
    skills: [skillId],
    words: [verb.id],
    context: `Give the form of "${shown}" for ${label}. Answer: ${expected}`,
    check(answer) {
      // the pronoun may come along: «nōs scrībimus» is right too
      const typed = words(answer).map(latinKey).filter((w) => w !== "ego" && w !== "tu" && w !== "nos");
      const ok = typed.length === 1 && typed[0] === latinKey(expected);
      const issues: Issue[] = [];
      if (!ok && typed.length) {
        const mine = ctx.lex.analyzeAs(typed[0], verb!.id)[0];
        issues.push({
          kind: "form",
          message: mine
            ? `${hinted(words(answer).at(-1)!)} is ${describe(mine)}. For ${label} it is ${hinted(expected)}.`
            : `For ${label} the form is ${hinted(expected)}.`,
          skill: skillId,
        });
      }
      return {
        verdict: ok ? "correct" : "wrong",
        issues,
        expected,
        expectedTokens: [token],
        credit: { [skillId]: ok ? 1 : 0 },
        wordCredit: { [verb!.id]: ok },
      };
    },
  };
}

function formEx(ctx: Ctx, focus: string[]): Exercise | null {
  // the nominative singular is the dictionary form itself: nothing to build
  const formSkills = [...ctx.k.skills].filter((s) => /^n\d|^v\./.test(s) && !s.endsWith(".nom.sg"));
  const focused = focus.filter((s) => formSkills.includes(s));
  const skillId = pick(ctx.r, focused.length ? focused : formSkills);
  if (!skillId) return null;
  return skillId.startsWith("v.") ? verbFormExercise(ctx, skillId) : nounFormExercise(ctx, skillId, focus);
}

// ------------------------------------------------------------ transform

interface Transform {
  name: string;
  instruction: string;
  skill: string;
  apply: (c: Clause, k: Knowledge) => Clause | null;
}

const TRANSFORMS: Transform[] = [
  {
    name: "plural",
    instruction: "Make the subject plural.",
    skill: "s.pl",
    apply: (c, k) => {
      if (c.subj.kind !== "np" || c.subj.np.num !== "sg" || c.pred || c.verb.irregular) return null;
      const np: NP = { ...c.subj.np, num: "pl", poss: undefined };
      if (!nounUsable(k, np.noun, "nom", "pl") || np.noun.tags.includes("mass") || np.noun.proper) return null;
      if (np.adj && !adjUsable(k, np.adj, np.noun, "nom", "pl")) return null;
      if (!verbUsable(k, c.verb, "3pl")) return null;
      if (c.obj?.poss) return null;
      return { ...c, subj: { kind: "np", np }, num: "pl", skills: [...c.skills, "s.pl", "v.3pl", nounSkill(np.noun.decl, "nom", "pl")] };
    },
  },
  {
    name: "swap",
    instruction: "Swap who does what (the object becomes the subject).",
    skill: "s.svo",
    apply: (c, k) => {
      const s = swapRoles(c);
      if (!s || s.subj.kind !== "np" || !s.obj) return null;
      if (!nounUsable(k, s.subj.np.noun, "nom", "sg") || !nounUsable(k, s.obj.noun, "acc", "sg")) return null;
      if (s.subj.np.adj && !adjUsable(k, s.subj.np.adj, s.subj.np.noun, "nom", "sg")) return null;
      if (s.obj.adj && !adjUsable(k, s.obj.adj, s.obj.noun, "acc", "sg")) return null;
      if (s.subj.np.poss || s.obj.poss || s.inf) return null;
      // sensible both ways: "the girl sees the poet" ↔ "the poet sees the girl", not "the water carries the girl"
      if (k.silly === 0 && (!s.subj.np.noun.tags.includes("person") || !sensibleObject(k, s.verb, s.obj.noun) || !makesSense(s))) return null;
      return s;
    },
  },
  {
    name: "ego",
    instruction: "Say it about yourself (I …).",
    skill: "v.1sg",
    apply: (c, k) => {
      if (c.subj.kind !== "np" || c.num !== "sg" || c.pred || c.verb.irregular === "sum") return null;
      if (!verbUsable(k, c.verb, "1sg")) return null;
      // ego stays in sight until leaving it out has been learned
      const shown = !k.skills.has("s.drop");
      return { ...c, subj: { kind: "pron", person: 1, shown }, person: 1, skills: [...c.skills, "v.1sg", ...(shown ? [] : ["s.drop"])] };
    },
  },
  {
    name: "tu",
    instruction: "Say it to a friend (you …).",
    skill: "v.2sg",
    apply: (c, k) => {
      if (c.subj.kind !== "np" || c.num !== "sg" || c.pred || c.verb.irregular === "sum") return null;
      if (!verbUsable(k, c.verb, "2sg")) return null;
      const shown = !k.skills.has("s.drop");
      return { ...c, subj: { kind: "pron", person: 2, shown }, person: 2, skills: [...c.skills, "v.2sg", ...(shown ? [] : ["s.drop"])] };
    },
  },
  {
    name: "nos",
    instruction: "Say it about yourself and others (we …).",
    skill: "v.1pl",
    apply: (c, k) => {
      if (c.subj.kind !== "np" || c.num !== "sg" || c.pred || c.verb.irregular) return null;
      if (!verbUsable(k, c.verb, "1pl") || !k.fixed.has("nos")) return null;
      const shown = !k.skills.has("s.drop");
      return { ...c, subj: { kind: "pron", person: 1, shown, pl: true }, person: 1, num: "pl", skills: [...c.skills, "v.1pl", ...(shown ? [] : ["s.drop"])] };
    },
  },
  {
    name: "negate",
    instruction: "Make it negative (add nōn, 'not').",
    skill: "s.non",
    apply: (c, k) => (c.neg || !k.skills.has("s.non") || c.subj.kind === "nemo" ? null : { ...c, neg: true, skills: [...c.skills, "s.non"] }),
  },
];

function transform(ctx: Ctx, focus: string[]): Exercise | null {
  const usable = TRANSFORMS.filter((t) => ctx.k.skills.has(t.skill));
  if (!usable.length) return null;
  const preferred = usable.filter((t) => focus.includes(t.skill));
  for (let attempt = 0; attempt < 12; attempt++) {
    const t = pick(ctx.r, preferred.length && chance(ctx.r, 0.7) ? preferred : usable);
    const c = generate(ctx.k, ctx.r, focus, t.name === "swap" ? ["svo"] : undefined);
    if (!c) continue;
    const out = t.apply(c, ctx.k);
    if (!out) continue;
    const from = latinTokens(c, ctx.k);
    const to = latinTokens(out, ctx.k);
    const slots = slotsFor(to, ctx.k);
    const skills = [...new Set(out.skills)];
    const ids = wordIds(to);
    return {
      id: nextId(),
      kind: "transform",
      instruction: t.instruction,
      latin: from,
      audio: latinText(from),
      english: english(c, ctx.k).text,
      answerEnglish: english(out, ctx.k).text,
      hints: hintsFor(to),
      answer: "la",
      skills,
      words: ids,
      context: `${t.instruction} Start: ${latinText(from)}. Model answer: ${latinText(to)} ("${english(out, ctx.k).text}")`,
      check(answer) {
        const r = checkLatin(answer, slots, ctx.lex);
        return {
          verdict: r.verdict,
          issues: r.issues,
          expected: latinText(to),
          expectedTokens: to,
          tokens: r.tokens,
          credit: creditFrom(skills, r.verdict, r.issues),
          wordCredit: wordsCredit(ids, r.verdict !== "wrong"),
        };
      },
    };
  }
  return null;
}

// ------------------------------------------------------------- identify

const QUESTIONS: { roles: string[]; ask: string }[] = [
  { roles: ["subj"], ask: "Which word is the subject (who does it)?" },
  { roles: ["obj"], ask: "Which word is the object (what the action is done to)?" },
  { roles: ["pp"], ask: "Which word says where?" },
  { roles: ["subj-poss", "obj-poss", "pp-poss", "pred-poss"], ask: "Which word says whose?" },
  { roles: ["dat"], ask: "Which word says to whom (the one who gets it)?" },
];

function identify(ctx: Ctx, focus: string[]): Exercise | null {
  for (let attempt = 0; attempt < 10; attempt++) {
    const c = generate(ctx.k, ctx.r, focus, ["svo", "loc", "motion", "dat"]);
    if (!c) continue;
    const tokens = latinTokens(c, ctx.k);
    const options = QUESTIONS.filter((q) => tokens.filter((t) => q.roles.includes(t.role)).length === 1);
    if (!options.length) continue;
    const q = pick(ctx.r, options);
    const idx = tokens.findIndex((t) => q.roles.includes(t.role));
    const target = tokens[idx];
    const skills = [target.skill, c.skills.includes("s.svo") ? "s.svo" : undefined].filter(Boolean) as string[];
    return {
      id: nextId(),
      kind: "identify",
      instruction: q.ask,
      latin: tokens,
      hints: target.skill ? [SKILL_BY_ID.get(target.skill)?.hint ?? ""] : [],
      answer: "choice",
      choices: tokens.map((t, i) => ({ id: String(i), label: t.text })),
      correctChoice: String(idx),
      skills,
      words: wordIds(tokens),
      context: `${q.ask} Sentence: ${latinText(tokens)}. Answer: ${target.text}`,
      check(answer) {
        const ok = answer === String(idx);
        const chosen = tokens[Number(answer)];
        const issues: Issue[] = [];
        if (!ok && chosen) {
          const a: Analysis | undefined = chosen.analysis;
          issues.push({
            kind: "form",
            message: `${hinted(chosen.text, a)}${a && a.entry.kind !== "fixed" ? ` is the ${describe(a)}` : ""}. The answer is ${hinted(target.text, target.analysis)}${target.analysis ? ` (${describe(target.analysis)})` : ""}.`,
            skill: target.skill,
          });
        }
        return {
          verdict: ok ? "correct" : "wrong",
          issues,
          expected: target.text,
          expectedTokens: tokens,
          credit: Object.fromEntries(skills.map((s) => [s, ok ? 1 : 0])),
          wordCredit: {},
        };
      },
    };
  }
  return null;
}

// ---------------------------------------------------------------- vocab

const stripArticle = (s: string) => s.replace(/^(the|a|an|to) /, "");

export function vocabExercise(_ctx: Ctx, entry: Entry, direction: "la2en" | "en2la"): Exercise {
  const meanings = [entry.en, ...(entry.alt ?? [])].map((m) => stripArticle(normalizeEnglish(m)));
  const latinForms = new Set<string>();
  if (entry.kind === "noun") latinForms.add(latinKey(entry.lemma));
  else if (entry.kind === "adj") latinForms.add(latinKey(entry.lemma)).add(latinKey(entry.fem));
  else if (entry.kind === "verb") {
    latinForms.add(latinKey(entry.pp[0]));
    const inf = conjugate(entry).inf;
    if (inf) latinForms.add(latinKey(full(inf)));
  } else latinForms.add(latinKey(entry.lemma));
  const dict = dictionaryForm(entry);
  const gender = entry.kind === "noun" && ["discipulus", "discipula", "amicus", "amica"].includes(entry.id) ? (entry.gender === "f" ? " (f)" : " (m)") : "";
  return {
    id: nextId(),
    kind: "vocab",
    instruction: direction === "la2en" ? "What does it mean?" : "How do you say it in Latin?",
    ask: direction === "la2en" ? dict : `${entry.en}${gender}`,
    hints: entry.note ? [entry.note] : [],
    answer: direction === "la2en" ? "en" : "la",
    skills: [],
    words: [entry.id],
    context: direction === "la2en" ? `Meaning of ${dict}? Answer: ${entry.en}` : `Latin for "${entry.en}"? Answer: ${dict}`,
    check(answer) {
      let ok: boolean;
      if (direction === "la2en") {
        const a = stripArticle(normalizeEnglish(answer));
        ok = meanings.some((m) => m === a || a.split(/ ?[,/;] ?| or /).includes(m));
      } else {
        const first = latinKey(words(answer)[0] ?? "");
        ok = latinForms.has(first);
      }
      return {
        verdict: ok ? "correct" : "wrong",
        issues: ok ? [] : [{ kind: "word", message: direction === "la2en" ? `${hinted(entry.kind === "verb" ? entry.pp[0] : (entry as { lemma: string }).lemma)} means "${entry.en}".` : `It is ${hinted(dict)}${dict.endsWith(".") ? "" : "."}` }],
        expected: direction === "la2en" ? entry.en : dict,
        credit: {},
        wordCredit: { [entry.id]: ok },
      };
    },
  };
}

// --------------------------------------------------------------- derive

/**
 * "Which Latin word is inside 'dormitory'?" Any form of the word counts, and so
 * does any other known word the English word comes from (`accept`).
 */
export function deriveExercise(ctx: Ctx, entry: Entry, english: string, accept: string[] = [], note?: string): Exercise {
  const dict = dictionaryForm(entry);
  const ok = new Set([entry.id, ...accept]);
  return {
    id: nextId(),
    kind: "derive",
    instruction: "Which Latin word that you know is inside this English word?",
    ask: english,
    hints: [`It means "${entry.en}".`],
    answer: "la",
    skills: [],
    words: [entry.id],
    context: `Which Latin word that the learner knows is inside the English word "${english}"? Answer: ${dict} (${entry.en}).`,
    answerEnglish: `Means "${entry.en}".${note ? ` ${note}` : ""}`,
    check(answer) {
      const good = ctx.lex.analyze(words(answer)[0] ?? "").some((a) => ok.has(a.entry.id));
      return {
        verdict: good ? "correct" : "wrong",
        // the answer and its meaning are shown below the verdict
        issues: [],
        expected: dict,
        credit: {},
        wordCredit: { [entry.id]: good },
      };
    },
  };
}

// --------------------------------------------------------------- listen

function listen(ctx: Ctx, focus: string[]): Exercise | null {
  for (let attempt = 0; attempt < 8; attempt++) {
    const c = generate(ctx.k, ctx.r, focus, ["sv", "svo", "loc", "motion", "est"]);
    if (!c) continue;
    const tokens = latinTokens(c, ctx.k);
    if (tokens.length > 6) continue;
    const en = english(c, ctx.k);
    const slots = slotsFor(tokens, ctx.k);
    const ids = wordIds(tokens);
    return {
      id: nextId(),
      kind: "listen",
      instruction: KIND_LABEL.listen,
      latin: tokens,
      english: en.text,
      audio: latinText(tokens),
      hints: hintsFor(tokens),
      answer: "la",
      skills: c.skills,
      words: ids,
      context: `Dictation: the learner heard "${latinText(tokens)}" ("${en.text}") and wrote it down in Latin.`,
      check(answer) {
        const r = checkLatin(answer, slots, ctx.lex);
        return {
          verdict: r.verdict,
          issues: r.issues,
          expected: latinText(tokens),
          expectedTokens: tokens,
          tokens: r.tokens,
          credit: creditFrom(c.skills, r.verdict, r.issues),
          wordCredit: wordsCredit(ids, r.verdict !== "wrong"),
        };
      },
    };
  }
  return null;
}

// ---------------------------------------------------------------- entry

const FACTORIES: Record<MadeKind, (ctx: Ctx, focus: string[]) => Exercise | null> = {
  en2la,
  la2en,
  ending,
  choose,
  form: formEx,
  transform,
  identify,
  listen,
  tiles: tilesEx,
  meaning: meaningEx,
};

export function makeExercise(kind: MadeKind, ctx: Ctx, focus: string[]): Exercise | null {
  return FACTORIES[kind]?.(ctx, focus) ?? null;
}

export { shuffle, plainText };

/** The answer an exercise takes as right (to check, before showing it, what a right answer would count for). */
export function rightAnswer(ex: Exercise): string {
  if (ex.answer === "choice") return ex.correctChoice!;
  const expected = ex.check("xxxx").expected;
  return ex.answer === "ending" ? expected.split(" → ")[0].replace("-", "") : expected;
}
