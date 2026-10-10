import { describe, expect, it } from "vitest";
import { seeded } from "../src/latin/generate";
import { buildKnowledge, fullLexicon, lessonWords } from "../src/trainer/knowledge";
import { ExerciseKind, makeExercise, vocabExercise } from "../src/trainer/exercises";
import { applyResult, buildSession, placementSession } from "../src/trainer/session";
import { mastery, newProgress } from "../src/trainer/progress";

const k = buildKnowledge([1, 2, 3, 4]);
const lex = fullLexicon();
const kinds: Exclude<ExerciseKind, "vocab">[] = ["en2la", "la2en", "ending", "form", "transform", "identify"];

/** The answer a perfect student would type. */
function modelAnswer(ex: ReturnType<typeof makeExercise>, res: ReturnType<NonNullable<typeof ex>["check"]>): string {
  if (!ex) return "";
  if (ex.answer === "choice") return ex.correctChoice!;
  if (ex.answer === "ending") return res.expected.split(" → ")[0].replace("-", "");
  return res.expected;
}

describe("exercises", () => {
  for (const kind of kinds) {
    it(`${kind}: the model answer is always accepted`, () => {
      let made = 0;
      for (let seed = 1; seed <= 250; seed++) {
        const ex = makeExercise(kind, { k, lex, r: seeded(seed) }, []);
        if (!ex) continue;
        made++;
        const probe = ex.check("xxxx");
        const answer = modelAnswer(ex, probe);
        const res = ex.check(answer);
        expect(res.verdict, `${ex.context} | answer: ${answer} | ${res.issues.map((i) => i.message).join("; ")}`).toBe("correct");
      }
      expect(made).toBeGreaterThan(150);
    });
  }

  it("vocab accepts dictionary forms and meanings", () => {
    for (const w of lessonWords([1, 2, 3, 4]).filter((w) => w.kind !== "fixed")) {
      const a = vocabExercise({ k, lex, r: seeded(1) }, w, "la2en");
      expect(a.check(w.en).verdict, w.id).toBe("correct");
      const b = vocabExercise({ k, lex, r: seeded(1) }, w, "en2la");
      const latin = w.kind === "verb" ? w.pp[0] : (w as { lemma: string }).lemma;
      expect(b.check(latin).verdict, w.id).toBe("correct");
    }
  });

  it("builds full sessions and placement checks", () => {
    const p = newProgress();
    const ctx = { k, lex, r: seeded(42) };
    const s = buildSession(p, ctx, { size: 20, vocab: lessonWords([1, 2, 3, 4]).filter((w) => w.kind !== "fixed") });
    expect(s.length).toBe(20);
    expect(new Set(s.map((e) => e.kind)).size).toBeGreaterThan(3);
    const pl = placementSession(p, ctx);
    expect(pl.length).toBeGreaterThanOrEqual(10);
  });

  it("raises mastery when answers are right", () => {
    const p = newProgress();
    const ctx = { k, lex, r: seeded(7) };
    for (let i = 0; i < 8; i++) {
      const ex = makeExercise("form", ctx, ["n1.acc.sg"])!;
      const res = ex.check(ex.check("x").expected);
      applyResult(p, ex, res, "x");
    }
    expect(mastery(p.skills["n1.acc.sg"])).toBeGreaterThan(0.8);
  });
});
