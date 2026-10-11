// The learner's way through the lessons' rules, one small part at a time
// (content/parts.ts). A part is first explained and checked with two open
// questions; then it is "seen" and its rules may appear in exercises. It is
// practised from simple exercises to harder ones until it holds ("learned"),
// and then the next part is offered. Practice never uses a rule of a part the
// learner has not seen.
import { Part, PARTS } from "../content/parts";
import { mastery, Progress } from "./progress";

/** A part holds after this many exercises on it, with its rules known this well. */
export const SOLID = { done: 8, average: 0.85, min: 0.65 };

const watched = (p: Progress, part: Part) => p.lessonsDone.includes(part.lesson);

/** The rules of every part the learner has seen (in the lessons watched). */
export function seenSkills(p: Progress): Set<string> {
  const out = new Set<string>();
  for (const part of PARTS) if (p.parts[part.id] && watched(p, part)) part.skills.forEach((s) => out.add(s));
  return out;
}

export type PartState = "new" | "practising" | "learned";

export function partState(p: Progress, part: Part): PartState {
  const st = p.parts[part.id];
  return st?.learned ? "learned" : st ? "practising" : "new";
}

/** How well a part's rules are known: their average mastery, and the weakest one. */
export function partMastery(p: Progress, part: Part): { value: number; min: number } {
  const ms = (part.practised ?? part.skills).map((s) => mastery(p.skills[s]));
  return { value: ms.reduce((a, b) => a + b, 0) / ms.length, min: Math.min(...ms) };
}

/** 0..1 on the way to holding: as far as the weakest of the three conditions. */
export function partProgress(p: Progress, part: Part): number {
  const st = p.parts[part.id];
  if (!st) return 0;
  if (st.learned) return 1;
  const m = partMastery(p, part);
  return Math.min(1, st.done / SOLID.done, m.value / SOLID.average, m.min / SOLID.min);
}

function holds(p: Progress, part: Part): boolean {
  const st = p.parts[part.id];
  if (!st) return false;
  const m = partMastery(p, part);
  return st.done >= SOLID.done && m.value >= SOLID.average && m.min >= SOLID.min;
}

/** 0..1: how far a lesson's rules are learned (each part counts as far as it has come). */
export function lessonProgress(p: Progress, lesson: number): number {
  const parts = PARTS.filter((part) => part.lesson === lesson);
  return parts.length ? parts.reduce((sum, part) => sum + partProgress(p, part), 0) / parts.length : 0;
}

/** The part to work on now: the first one, in lesson order, not learned yet. */
export function currentPart(p: Progress): Part | undefined {
  return PARTS.find((part) => watched(p, part) && !p.parts[part.id]?.learned);
}

/** The first part not seen yet: the next rule to learn. */
export function nextNewPart(p: Progress): Part | undefined {
  return PARTS.find((part) => watched(p, part) && !p.parts[part.id]);
}

/** The parts seen and still being practised. */
export const partsInPractice = (p: Progress) => PARTS.filter((part) => watched(p, part) && partState(p, part) === "practising");

/**
 * After an exercise: counts it for each part in practice whose rules it used,
 * marks the parts that now hold as learned (for good), and keeps the step
 * (focusLesson) on the current part's lesson. Returns the parts just learned.
 */
export function updatePath(p: Progress, used: string[] = [], now = Date.now()): Part[] {
  const learned: Part[] = [];
  for (const part of PARTS) {
    const st = p.parts[part.id];
    if (!st || st.learned) continue;
    if (part.skills.some((s) => used.includes(s))) st.done++;
    if (holds(p, part)) {
      st.learned = now;
      learned.push(part);
    }
  }
  p.focusLesson = currentPart(p)?.lesson ?? Math.max(1, ...p.lessonsDone);
  return learned;
}

/** The explanation and its questions are done: the part's rules may now be practised. */
export function markSeen(p: Progress, id: string, now = Date.now()) {
  if (!p.parts[id]) p.parts[id] = { seen: now, done: 0 };
  updatePath(p, [], now);
}

// ------------------------------------------------------- open questions

/** Lower case, no long marks, only words: "I don't" → " i don t ". */
const plainWords = (s: string) =>
  ` ${s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9Ѐ-ӿ]+/g, " ")
    .trim()} `;

const DONT_KNOW = / (i don t know|i do not know|don t know|dont know|no idea|not sure|dunno|idk|не знаю) /;

/**
 * Whether an answer to an open question has the idea in it: every group of
 * keys has one of its keys in the answer. A key of one or two letters must
 * stand alone (-t, ō); a longer one may go on (sleep → sleeps). "I don't know"
 * never counts.
 */
export function meetsKeys(answer: string, keys: string[][]): boolean {
  const text = plainWords(answer);
  if (!text.trim() || DONT_KNOW.test(text)) return false;
  return keys.every((group) =>
    group.some((key) => {
      const k = plainWords(key).trim();
      return text.includes(` ${k}${k.length <= 2 ? " " : ""}`);
    }),
  );
}
