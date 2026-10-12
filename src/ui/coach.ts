// The coach for Answer in Latin: fresh questions written for this learner each
// round (only their words and rules, so they can answer them), and the
// judgment of an answer written in their own words: any correct, sensible
// answer counts, inventive ones most of all.
import { PEOPLE } from "../content/people";
import { languageBlock } from "../chat/prompts";
import { vetMessage } from "../chat/vet";
import { engineFacts } from "../latin/facts";
import { creditFrom, Exercise, Result } from "../trainer/exercises";
import { chatWords, promptCtx } from "./messenger";
import { coachOpts } from "./models";
import { sampleErrorText, sampler, storage } from "./platform";
import { derived, getProgress } from "./store";
import { allowedWords } from "../chat/words";
import { deviceZone } from "../chat/life";

export interface FreshQuestion {
  la: string;
  en: string;
  example: string;
  about?: string;
}

const ASKED_KEY = "tabula-latina-asked-v1";
const asked = (): string[] => {
  try {
    return JSON.parse(storage.get(ASKED_KEY) ?? "[]");
  } catch {
    return [];
  }
};

/** The words and rules the learner has, as the people in the messenger use them (with a stand-in name before they have one). */
function languageNow(): string {
  const ctx = promptCtx() ?? { now: Date.now(), me: { name: "", g: "m" as const }, tz: deviceZone(), words: allowedWords(chatWords().entries, derived().seenKnowledge.skills), seen: derived().seenKnowledge.skills };
  return languageBlock(ctx);
}

/** Questions Claude writes for this round; only those the learner can read and answer pass. */
export async function freshQuestions(n: number, signal?: AbortSignal): Promise<FreshQuestion[] | { error: string }> {
  const sample = await sampler();
  if (!sample) return { error: "Fresh questions come from Claude when this page is open on claude.ai." };
  const p = getProgress();
  const me = p.settings.me;
  const before = asked().slice(-40);
  const prompt = `Write ${n + 4} fresh questions in Latin for a beginner, who answers each in Latin with their own words. Make them different every time and fun to answer: some about the learner's own life, habits, likes and wishes; some about the five friends from their messenger (${PEOPLE.map((x) => `${x.name}: ${x.job}`).join("; ")}); some little imaginary situations or scenes to describe ("you are in a forest: what do you see?"), opinions, a small story to continue. Vary the form too: what, who, where, where to, why, yes or no, "tell me two things"…
${me ? `The learner is ${me.name}, a ${me.g === "m" ? "man" : "woman"}.` : ""}
Every question must be answerable with the learner's words below, and must itself use only those words (the question words quid, quis, ubi, quō, cūr and the chat words are fine: the page shows their meanings). Never ask about something they have no words for. A question about the learner uses the "you" forms (-s), so the answer uses "I" (-ō).
${before.length ? `Asked recently, so not these again: ${before.join(" | ")}` : ""}

${languageNow()}

Reply with only JSON: {"questions": [{"la": "<the question in Latin>", "en": "<English>", "example": "<one good answer in Latin, with the learner's words>", "about": "you" | "friends" | "scene" | "imagine"}]}`;
  try {
    const out = await sample.json<{ questions?: Partial<FreshQuestion>[] }>(prompt, { ...coachOpts(), cache: false, signal });
    const { lex } = chatWords();
    const seen = derived().seenKnowledge.skills;
    const good = (out?.questions ?? [])
      .map((q) => ({ la: String(q.la ?? "").trim(), en: String(q.en ?? "").trim(), example: String(q.example ?? "").trim(), about: String(q.about ?? "") }))
      .filter((q) => q.la && q.en && q.example && vetMessage(q.la, lex, seen).ok && vetMessage(q.example, lex, seen).ok)
      .slice(0, n);
    storage.set(ASKED_KEY, JSON.stringify([...before, ...good.map((q) => q.la)].slice(-60)));
    return good;
  } catch (e) {
    return { error: sampleErrorText((e as { code?: string })?.code) || "Stopped." };
  }
}

export interface OpenJudgement {
  verdict: "correct" | "almost" | "wrong";
  note: string;
  better?: string;
}

/** The coach's judgment of an answer in the learner's own words (the engine's findings go along as facts). */
export async function judgeOpen(ex: Exercise, answer: string, res: Result): Promise<OpenJudgement | { error: string }> {
  const sample = await sampler();
  if (!sample) return { error: "Claude is not available here." };
  const prompt = `You check a beginner's answer in a Latin practice app. The learner answered a question in Latin with their own words. This is open and creative: any correct, sensible answer counts, inventive and funny ones are welcome, and the example is only one of many possibilities.

Question: «${ex.ask}»${ex.english ? ` (${ex.english})` : ""}
Task: ${ex.instruction}.
An example of a good answer: «${res.expected}»
The learner's answer: "${answer}"
The site's grammar engine says: ${res.verdict}${res.issues.length ? `: ${res.issues.map((i) => i.message.replace(/«|»/g, "").replace(/#[a-z0-9.]+/g, "")).join(" ")}` : " (no problems found)"}. Trust it about forms and endings; it cannot judge meaning.

Decide:
- "correct": correct Latin that answers the question (word order is free; long marks are never needed; a correct Latin word they have not learned yet is fine, say what it means).
- "almost": it answers the question, with one small slip (an ending, a person of the verb).
- "wrong": it does not answer the question, has several mistakes, or is not Latin.
Reply with only JSON: {"verdict": "correct" | "almost" | "wrong", "note": "<one or two short, warm sentences to the learner: something specific about their idea, then the fix if there is one; Latin inside «»>", "better": "<their answer corrected, keeping their idea, with long marks; empty when correct>"}

${languageNow()}

${engineFacts([{ text: answer, mixed: true }, { text: ex.ask ?? "", mixed: true }], derived().lexicon, derived().seenKnowledge.skills)}`;
  try {
    const out = await sample.json<Partial<OpenJudgement>>(prompt, { ...coachOpts(), cache: false });
    const verdict = out?.verdict === "correct" || out?.verdict === "almost" || out?.verdict === "wrong" ? out.verdict : null;
    if (!verdict) return { error: "Claude's reply could not be read." };
    return { verdict, note: String(out?.note ?? ""), better: out?.better ? String(out.better) : undefined };
  } catch (e) {
    return { error: sampleErrorText((e as { code?: string })?.code) || "Stopped." };
  }
}

/** The result once the coach has judged: the coach's verdict, its note, and credit for the rules used. */
export function withJudgement(ex: Exercise, res: Result, j: OpenJudgement): Result {
  const used = Object.keys(res.credit).length ? Object.keys(res.credit) : ex.skills;
  return {
    ...res,
    verdict: j.verdict,
    issues: [{ kind: j.verdict === "correct" ? "tip" : "form", message: j.note }],
    expected: j.better || res.expected,
    expectedTokens: j.better ? undefined : res.expectedTokens,
    credit: creditFrom(used, j.verdict, []),
    wordCredit: Object.fromEntries(Object.keys(res.wordCredit).map((k) => [k, j.verdict !== "wrong"])),
    coached: !!j.better,
  };
}

