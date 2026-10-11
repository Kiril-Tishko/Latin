import { describe, expect, it } from "vitest";
import { seeded } from "../src/latin/generate";
import { buildKnowledge, fullLexicon, lessonWords } from "../src/trainer/knowledge";
import { makeExercise } from "../src/trainer/exercises";
import { newProgress } from "../src/trainer/progress";
import { applyResult, mistakesSession, mistakesToFix } from "../src/trainer/session";

const lex = fullLexicon();
const all = buildKnowledge([1, 2, 3, 4]);
const step1 = buildKnowledge([1, 2, 3, 4], [], 0, [1]);
const vocab = lessonWords([1, 2, 3, 4]).filter((w) => w.kind !== "fixed");

/** Answers an exercise wrong (on purpose), so its mistake is recorded. */
function miss(p: ReturnType<typeof newProgress>, seed: number, kind: "choose" | "en2la" = "choose", k = all) {
  const ex = makeExercise(kind, { k, lex, r: seeded(seed) }, [])!;
  const answer = ex.answer === "choice" ? ex.choices!.find((c) => c.id !== ex.correctChoice)!.id : "xxx yyy";
  applyResult(p, ex, ex.check(answer), answer, seed * 1000);
  return ex;
}

describe("fix my mistakes", () => {
  it("remembers the words of a mistake", () => {
    const p = newProgress();
    const ex = miss(p, 1);
    expect(p.mistakes[0].words).toEqual(ex.words);
  });

  it("brings mistakes back within the step only", () => {
    const p = newProgress();
    for (let seed = 1; seed <= 12; seed++) miss(p, seed);
    const all4 = mistakesToFix(p, all);
    const onlyStep1 = mistakesToFix(p, step1);
    expect(all4.length).toBeGreaterThan(0);
    for (const m of onlyStep1) for (const s of m.skills) expect(step1.skills.has(s)).toBe(true);
  });

  it("marks a mistake fixed after a right answer, and keeps one copy after another miss", () => {
    const p = newProgress();
    for (let seed = 1; seed <= 6; seed++) miss(p, seed);
    const before = p.mistakes.length;
    const round = mistakesSession(p, { k: all, lex, r: seeded(3) }, vocab);
    expect(round.length).toBeGreaterThan(0);
    expect(round.every((ex) => ex.fixes !== undefined)).toBe(true);
    const [first, second] = round;
    const right = (ex: typeof first) => {
      const probe = ex.check("xxxx");
      return ex.answer === "choice" ? ex.correctChoice! : ex.answer === "ending" ? probe.expected.split(" → ")[0].replace("-", "") : probe.expected;
    };
    applyResult(p, first, first.check(right(first)), right(first));
    expect(p.mistakes.find((m) => m.at === first.fixes)?.fixed).toBe(true);
    if (second) {
      applyResult(p, second, second.check("xxx yyy"), "xxx yyy");
      expect(p.mistakes.length).toBe(before);
      expect(p.mistakes.find((m) => m.at === second.fixes)?.fixed).toBeFalsy();
    }
    expect(mistakesToFix(p, all).some((m) => m.at === first.fixes)).toBe(false);
  });
});
