// The learner's way through the lessons' rules, one small part at a time
// (content/parts.ts). A part is first explained and checked with two open
// questions; then it is "seen" and its rules may appear in exercises. Every
// right answer on its rules adds one: the first five come from simple
// exercises, the next from harder ones, and at ten the part is learned and the
// next one is offered. Practice never uses a rule of a part not seen.
import { Part, PARTS } from "../content/parts";
import { Phase, Progress } from "./progress";

/** Right answers that make a part learned. */
export const PART_GOAL = 10;
/** Simple exercises until this many right answers, the hardest from the second number. */
export const PART_PHASES = { mixedFrom: 5, hardFrom: 8 };

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

/** Right answers on a part so far (a learned part counts as full). */
export function partRight(p: Progress, part: Part): number {
  const st = p.parts[part.id];
  return st?.learned ? PART_GOAL : Math.min(PART_GOAL, st?.right ?? 0);
}

/** 0..1: right answers out of the ten that make the part learned. */
export const partProgress = (p: Progress, part: Part) => partRight(p, part) / PART_GOAL;

/** Which exercises a part gets now: simple for its first five right answers, then harder. */
export function partPhase(p: Progress, part: Part): Phase {
  const n = partRight(p, part);
  return n < PART_PHASES.mixedFrom ? "simple" : n < PART_PHASES.hardFrom ? "mixed" : "hard";
}

/** Whether an answer adds one to a part: it was right, and the part's rule in it was right. */
export function countsFor(part: Part, res: { verdict: string; credit: Record<string, number> }): boolean {
  return res.verdict !== "wrong" && part.skills.some((s) => (res.credit[s] ?? 0) >= 0.85);
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
 * After an exercise: adds one to each part in practice whose rule the answer
 * got right (in any kind of practice), marks the parts that reach ten as
 * learned (for good), and keeps the step (focusLesson) on the current part's
 * lesson. Returns the parts just learned.
 */
export function updatePath(p: Progress, res?: { verdict: string; credit: Record<string, number> }, now = Date.now()): Part[] {
  const learned: Part[] = [];
  for (const part of PARTS) {
    const st = p.parts[part.id];
    if (!st || st.learned) continue;
    if (res && countsFor(part, res)) st.right = (st.right ?? 0) + 1;
    if ((st.right ?? 0) >= PART_GOAL) {
      st.learned = now;
      learned.push(part);
    }
  }
  p.focusLesson = currentPart(p)?.lesson ?? Math.max(1, ...p.lessonsDone);
  return learned;
}

/** The explanation and its questions are done: the part's rules may now be practised. */
export function markSeen(p: Progress, id: string, now = Date.now()) {
  if (!p.parts[id]) p.parts[id] = { seen: now, right: 0 };
  updatePath(p, undefined, now);
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
