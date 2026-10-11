// Answer in Latin: open questions in Latin (the new question words glossed)
// that the learner answers with their own words. Three kinds, as the learner
// chose: about themselves ("Quid legis?"), about a story they have read ("Quid
// agricola bibit?"), and small scenes (two sentences about the farmer). Only
// known words and the rules of parts seen. The grammar engine checks every
// answer; "I think mine is right" asks Claude for a second opinion.
import { glossesOf, Slot, YOU_QUESTIONS, YouQuestion } from "../content/questions";
import { STORIES, Story } from "../content/stories";
import { annotate, caseOf, Lexicon, numOf } from "../latin/analyze";
import { Issue } from "../latin/check";
import { checkAnswer } from "../latin/facts";
import { generate, latinText, latinTokens, LToken, Rand, sensibleObject, shuffle } from "../latin/generate";
import { conjugate } from "../latin/morph";
import { Case, full, NounEntry, VerbEntry } from "../latin/types";
import { creditFrom, Ctx, Exercise, hintsFor, nextId, wordIds } from "./exercises";
import { lineSkills, readLine } from "./lines";
import { Progress } from "./progress";
import { storyLines, storyOpen } from "./stories";

/** What an answer has to be. */
export interface Want {
  slot: Slot | "subj" | "scene";
  /** The verb the answer must use, when it must be that one (by entry id). */
  verb?: string;
  /** The person of the answer's verb: -ō about yourself, -t / -nt about others. */
  person: "1sg" | "3sg" | "3pl";
  /** From a story: the word the answer must name, in its case (after its preposition). */
  word?: { id: string; case: Case; prep?: "in" | "ad"; text: string };
  /** A scene: the person the sentences are about. */
  about?: NounEntry;
}

/** The sentences of an answer, each read into words (null where a word is unknown). */
const sentencesOf = (answer: string) =>
  answer
    .split(/[.!?;]+/)
    .map((x) => x.trim())
    .filter(Boolean);

const verbOf = (tokens: LToken[]) => tokens.find((t) => t.role === "verb" && t.analysis?.entry.kind === "verb");
const personOf = (t?: LToken) => t?.analysis?.key.split(".")[1];
const formOf = (v: VerbEntry, pn: string) => full(conjugate(v)[`pres.${pn}` as "pres.1sg"]!);
const nounAt = (tokens: LToken[], role: string) => tokens.find((t) => t.role === role && t.analysis?.entry.kind === "noun");

/**
 * Checks an answer: every word known, its grammar right (the engine's own
 * checks), the verb in the person the question asks for, and what the question
 * wants given (a thing with -m, a place with in + -ā / -ō …). An odd but correct
 * sentence ("I read the water") is "almost".
 */
export function judgeAnswer(answer: string, want: Want, ctx: Ctx): { verdict: "correct" | "almost" | "wrong"; issues: Issue[]; tokens: LToken[] } {
  const issues: Issue[] = [];
  const odd: Issue[] = [];
  const sentences = sentencesOf(answer);
  const read: LToken[][] = [];
  for (const s of sentences) {
    const unknown = annotate(s, ctx.lex).filter((t) => t.isWord && !t.analysis && !t.readings?.length);
    for (const u of unknown) issues.push({ kind: "word", message: `I don't know «${u.text}#x»: check its spelling, or use a word from your lessons.` });
    const tokens = unknown.length ? null : readLine(s, ctx.lex);
    if (tokens) read.push(tokens);
    // the engine's grammar checks (long marks are never needed when typing)
    for (const f of checkAnswer(`«${s}»`, ctx.lex)) if (f.kind !== "spelling") issues.push({ kind: "form", message: f.message });
  }
  const tokens = read.flat();
  if (issues.length || !tokens.length) return { verdict: "wrong", issues: issues.length ? issues : [{ kind: "missing", message: "Write your answer in Latin." }], tokens };

  if (want.slot === "scene") {
    if (sentences.length < 2) issues.push({ kind: "missing", message: "Write two sentences: two things he or she does." });
    for (const t of read) {
      const v = verbOf(t);
      const subj = nounAt(t, "subj");
      if (!v) issues.push({ kind: "missing", message: `Each sentence needs a verb: what does «${want.about!.lemma}» do?` });
      else if (personOf(v) !== "3sg") issues.push({ kind: "form", message: `«${want.about!.lemma}» is one person: the verb ends in -t («${formOf(v.analysis!.entry as VerbEntry, "3sg")}»).` });
      if (subj && subj.analysis!.entry.id !== want.about!.id) issues.push({ kind: "word", message: `These sentences are about «${want.about!.lemma}».` });
      const obj = nounAt(t, "obj");
      if (v && obj && !sensibleObject(ctx.k, v.analysis!.entry as VerbEntry, obj.analysis!.entry as NounEntry)) odd.push(oddPair(v, obj));
    }
  } else {
    // the verb: in the right person, and the one the question asks about
    const v = want.slot === "reason" ? read.map((t) => t.find((x) => x.role === "verb"))[0] : verbOf(tokens);
    const reasonOnly = want.slot === "reason" && tokens[0]?.analysis?.entry.id === "quod";
    if (v && !reasonOnly) {
      const entry = v.analysis!.entry as VerbEntry;
      if (want.verb && entry.id !== want.verb && !(want.slot === "inf" && v.role === "inf")) {
        const asked = ctx.k.verbs.find((x) => x.id === want.verb);
        if (asked) issues.push({ kind: "word", message: `Answer with the verb of the question: «${formOf(asked, want.person)}».` });
      } else if (personOf(v) !== want.person && entry.irregular !== "sum" && entry.irregular !== "possum") {
        issues.push({ kind: "form", message: want.person === "1sg" ? `This is about you: the verb ends in -ō («${formOf(entry, "1sg")}»).` : `As in the story: «${formOf(entry, want.person)}».` });
      } else if ((entry.irregular === "sum" || entry.irregular === "possum") && personOf(v) !== want.person) {
        issues.push({ kind: "form", message: `This is about you: «${entry.irregular === "sum" ? "sum" : "possum"}» (I am / I can).` });
      }
    }
    issues.push(...slotIssues(tokens, want));
    const obj = nounAt(tokens, "obj");
    if (v && obj && want.slot === "obj" && !want.word && !sensibleObject(ctx.k, v.analysis!.entry as VerbEntry, obj.analysis!.entry as NounEntry)) odd.push(oddPair(v, obj));
  }
  if (issues.length) return { verdict: "wrong", issues, tokens };
  return { verdict: odd.length ? "almost" : "correct", issues: odd, tokens };
}

function oddPair(v: LToken, obj: LToken): Issue {
  const verb = v.analysis!.entry as VerbEntry;
  const noun = obj.analysis!.entry as NounEntry;
  return { kind: "tip", message: `Good Latin, but an odd pair: to ${verb.env.base} ${noun.en.startsWith("the ") ? noun.en : `the ${noun.en}`}? Think of something one really ${verb.env.base}s.` };
}

/** What the question asks for, given? (a thing with -m, a place, where to, who, to …, why) */
function slotIssues(tokens: LToken[], want: Want): Issue[] {
  const has = (role: string, c?: Case) => tokens.find((t) => t.role === role && t.analysis?.entry.kind === "noun" && (!c || caseOf(t.analysis) === c));
  const prepBefore = (t: LToken) => tokens[tokens.indexOf(t) - 1]?.analysis?.entry.id === "ad-prep" ? "ad" : "in";
  const w = want.word;
  const named = (t?: LToken) => !w || t?.analysis?.entry.id === w.id;
  switch (want.slot) {
    case "obj": {
      const o = has("obj", "acc");
      if (!o) return [{ kind: "missing", message: w ? `Say what: «${w.text}» (as in the story).` : "Say what: the thing gets -m, as the object («epistulam», «librum»)." }];
      return named(o) ? [] : [{ kind: "word", message: `In the story it is «${w!.text}».` }];
    }
    case "subj": {
      const s = has("subj", "nom");
      if (!s) return [{ kind: "missing", message: `Say who: «${w!.text}».` }];
      return named(s) ? [] : [{ kind: "word", message: `In the story it is «${w!.text}».` }];
    }
    case "place": {
      const at = has("pp", "abl");
      if (!at) {
        const to = has("pp", "acc");
        return [{ kind: "form", message: to ? "Where something happens (no movement): «in» + -ā / -ō, as in «in scholā»." : `Say where: «in» + -ā / -ō${w ? `: «${w.text}»` : ", as in «in scholā»"}.` }];
      }
      return named(at) ? [] : [{ kind: "word", message: `In the story it is «${w!.text}».` }];
    }
    case "goal": {
      const to = has("pp", "acc");
      if (!to) {
        const at = has("pp", "abl");
        return [{ kind: "form", message: at ? "Where to (movement): -m, as in «ad scholam», «in silvam»." : `Say where to: «ad» or «in» + -m${w ? `: «${w.text}»` : ", as in «ad scholam»"}.` }];
      }
      if (w?.prep && prepBefore(to) !== w.prep && named(to)) return [];
      return named(to) ? [] : [{ kind: "word", message: `In the story it is «${w!.text}».` }];
    }
    case "pred":
      return tokens.some((t) => (t.analysis?.entry.kind === "noun" || t.analysis?.entry.kind === "adj") && caseOf(t.analysis) === "nom")
        ? []
        : [{ kind: "missing", message: "Say who you are: a word in the subject form, as in «discipulus sum»." }];
    case "inf":
      return tokens.some((t) => t.analysis?.key === "inf") ? [] : [{ kind: "missing", message: "Say what: a 'to …' form in -re, as in «legere possum»." }];
    case "reason": {
      const q = tokens.findIndex((t) => t.analysis?.entry.id === "quod");
      return q >= 0 && tokens.slice(q + 1).some((t) => t.role === "verb") ? [] : [{ kind: "missing", message: "Say why: «quod» (because) and what happens, as in «… quod discō»." }];
    }
  }
  return [];
}

/** An open question as an exercise. */
function answerExercise(ctx: Ctx, o: { la: string; en?: string; instruction: string; want: Want; example: string; story?: string; skills: string[] }): Exercise {
  const exampleTokens = sentencesOf(o.example).flatMap((s) => readLine(s, ctx.lex) ?? []);
  const qTokens = annotate(o.la, ctx.lex)
    .filter((t) => t.isWord && (t.analysis ?? t.readings?.[0]))
    .map((t) => ({ text: t.text, role: "verb" as const, analysis: t.analysis ?? t.readings![0] }));
  const ex: Exercise = {
    id: nextId(),
    kind: "answer",
    instruction: o.instruction,
    ask: o.la,
    gloss: glossesOf(o.la),
    english: o.en,
    audio: o.la,
    hints: hintsFor(qTokens),
    answer: "la",
    skills: o.skills,
    words: wordIds(exampleTokens),
    story: o.story,
    context: `Open question in Latin: "${o.la}"${o.en ? ` ("${o.en}")` : ""}. ${o.instruction}. Any correct, sensible answer counts; for example: ${o.example}`,
    check(answer) {
      const j = judgeAnswer(answer, o.want, ctx);
      const used = j.tokens.length ? lineSkills(j.tokens) : [];
      return {
        verdict: j.verdict,
        issues: j.issues,
        expected: o.example,
        expectedTokens: exampleTokens,
        credit: creditFrom(used, j.verdict, []),
        wordCredit: Object.fromEntries(wordIds(j.tokens).map((id) => [id, j.verdict !== "wrong"])),
      };
    },
  };
  ex.retry = () => answerExercise(ctx, o);
  return ex;
}

/** The questions about the learner that the rules seen allow. */
export function youQuestions(ctx: Ctx): YouQuestion[] {
  return YOU_QUESTIONS.filter((q) => q.needs.every((s) => ctx.k.skills.has(s)) && (!q.verb || ctx.k.verbs.some((v) => v.id === q.verb)));
}

/**
 * A question about the learner. Until leaving out ego and tū is learned (rule
 * 2.2), the question says tū and the example says ego: "Quid tū legis?" "Ego
 * epistulam legō."
 */
export function youExercise(ctx: Ctx, q: YouQuestion): Exercise {
  const drop = ctx.k.skills.has("s.drop");
  const [first, ...rest] = q.la.split(" ");
  return answerExercise(ctx, {
    la: drop ? q.la : [first, "tū", ...rest].join(" "),
    en: q.en,
    instruction: "Answer in Latin, about yourself",
    want: { slot: q.slot, verb: q.verb, person: "1sg" },
    example: drop ? q.example : `Ego ${q.example[0].toLowerCase()}${q.example.slice(1)}`,
    skills: q.needs,
  });
}

const QUESTION_FOR: Record<string, string> = { obj: "Quid", subj: "Quis", place: "Ubi", goal: "Quō" };
const isThing = (n: NounEntry) => !n.tags.includes("person") && !n.tags.includes("animal") && !n.tags.includes("divine");
const isSomeone = (n: NounEntry) => n.tags.includes("person") || n.tags.includes("divine");

/**
 * Questions on a story's lines: a sentence with one verb and no et, nōn, ego or
 * est, asked about its subject (quis), its object (quid), its place (ubi) or
 * where to (quō). The answer must name what the story says.
 */
export function storyQuestions(story: Story, lex: Lexicon, seen: Set<string>): { la: string; want: Want; example: string; skills: string[] }[] {
  const out: { la: string; want: Want; example: string; skills: string[] }[] = [];
  for (const line of storyLines(story, lex)) {
    const t = line.tokens;
    if (!line.skills.every((s) => seen.has(s))) continue;
    const verbs = t.filter((x) => x.role === "verb");
    if (verbs.length !== 1 || t.some((x) => ["conj", "neg", "pron", "pred", "pred-adj", "inf", "adv"].includes(x.role))) continue;
    const person = personOf(verbs[0]) as Want["person"];
    if (person !== "3sg" && person !== "3pl") continue;
    const ask = (slot: Want["slot"], drop: (x: LToken, i: number) => boolean, head: LToken, prep?: "in" | "ad") => {
      const rest = t.filter((x, i) => !drop(x, i));
      const words = rest.map((x) => (x.analysis?.entry.kind === "noun" && (x.analysis.entry.proper || x.analysis.entry.tags.includes("name")) ? x.text : x.text.toLowerCase()));
      const e = head.analysis!.entry as NounEntry;
      out.push({
        la: `${QUESTION_FOR[slot as string]} ${words.join(" ")}?`,
        want: { slot, person, word: { id: e.id, case: caseOf(head.analysis!)!, prep, text: `${prep ? `${prep} ` : ""}${e.proper || e.tags.includes("name") ? head.text : head.text.toLowerCase()}` } },
        example: line.la.replace(/#[a-z0-9]+(?:\.[a-z0-9]+)*/g, ""),
        skills: line.skills,
      });
    };
    const obj = nounAt(t, "obj");
    if (obj && isThing(obj.analysis!.entry as NounEntry)) ask("obj", (x) => x.role.startsWith("obj"), obj);
    const subj = nounAt(t, "subj");
    if (subj && person === "3sg" && numOf(subj.analysis!) === "sg" && isSomeone(subj.analysis!.entry as NounEntry) && !t.some((x) => x.role === "subj-poss"))
      ask("subj", (x) => x.role === "subj" || x.role === "subj-adj", subj);
    const pp = nounAt(t, "pp");
    if (pp) {
      const i = t.indexOf(pp);
      const prep = t[i - 1]?.analysis?.entry.id === "ad-prep" ? "ad" : "in";
      const c = caseOf(pp.analysis!);
      ask(c === "abl" ? "place" : "goal", (x, j) => x.role.startsWith("pp") || (j === i - 1 && x.role === "prep"), pp, prep);
    }
  }
  return out;
}

export const storyExercise = (ctx: Ctx, story: Story, q: ReturnType<typeof storyQuestions>[number]) =>
  answerExercise(ctx, { la: q.la, instruction: "Answer in Latin, from the story", want: q.want, example: q.example, story: story.title, skills: q.skills });

/** The people a scene can be about: known person nouns whose subject ending is a rule seen. */
const SCENE_PEOPLE = ["agricola", "poeta", "magistra", "discipula", "discipulus", "amicus", "amica", "puella"];

/** "Write two sentences in Latin about the farmer": any two true-to-life sentences about them. */
export function sceneExercise(ctx: Ctx, r: Rand): Exercise | null {
  const people = ctx.k.nouns.filter((n) => SCENE_PEOPLE.includes(n.id) && ctx.k.skills.has(n.decl === "1" ? "n1.nom.sg" : "n2.nom.sg"));
  for (const noun of shuffle(r, people)) {
    // an example: two sentences the generator makes about them
    const said: string[] = [];
    for (let i = 0; i < 300 && said.length < 2; i++) {
      const c = generate({ ...ctx.k, richness: 0 }, r, []);
      if (!c || c.subj.kind !== "np" || c.subj.np.noun.id !== noun.id || c.subj.np.adj || c.subj.np.poss || c.num !== "sg" || c.inf || c.pred) continue;
      const text = latinText(latinTokens(c, ctx.k));
      if (!said.includes(text)) said.push(text);
    }
    if (said.length < 2) continue;
    const who = noun.en.replace(/^the /, "");
    const skills = [...new Set(said.flatMap((s) => sentencesOf(s).flatMap((x) => lineSkills(readLine(x, ctx.lex) ?? []))))];
    return answerExercise(ctx, {
      la: `${noun.lemma[0].toUpperCase()}${noun.lemma.slice(1)} …`,
      en: `the ${who}: what does ${noun.gender === "f" ? "she" : "he"} do?`,
      instruction: `Write two sentences in Latin about the ${who}`,
      want: { slot: "scene", person: "3sg", about: noun },
      example: said.map((s) => (s.endsWith(".") ? s : `${s}.`)).join(" "),
      skills,
    });
  }
  return null;
}

/**
 * A round of open questions: about the learner, about the stories they have
 * read (or one story), and a scene or two, mixed. Only what the rules seen allow.
 */
export function answersSession(p: Progress, ctx: Ctx, opts: { story?: string } = {}, size = 8): Exercise[] {
  const seen = ctx.k.skills;
  const stories = opts.story ? STORIES.filter((s) => s.id === opts.story) : STORIES.filter((s) => p.stories[s.id] && storyOpen(s, seen));
  const fromStories = shuffle(ctx.r, stories.flatMap((s) => storyQuestions(s, ctx.lex, seen).map((q) => () => storyExercise(ctx, s, q))));
  if (opts.story) return fromStories.slice(0, size).map((f) => f());
  const aboutYou = shuffle(ctx.r, youQuestions(ctx)).map((q) => () => youExercise(ctx, q));
  const scenes = [0, 1].map(() => () => sceneExercise(ctx, ctx.r));
  const out: Exercise[] = [];
  const queues = [aboutYou, fromStories, aboutYou, scenes];
  for (let i = 0; out.length < size && i < size * 4; i++) {
    const q = queues[i % queues.length];
    const next = q.shift();
    const ex = next?.();
    if (ex && !out.some((x) => x.context === ex.context)) out.push(ex);
  }
  return out;
}
