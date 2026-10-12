import { describe, expect, it } from "vitest";
import { seeded } from "../src/latin/generate";
import { buildKnowledge, fullLexicon, lessonWords } from "../src/trainer/knowledge";
import { englishMark, ExerciseKind, makeExercise, vocabExercise } from "../src/trainer/exercises";
import { LToken } from "../src/latin/generate";
import { applyResult, buildSession, nextExercise } from "../src/trainer/session";
import { mastery, newProgress } from "../src/trainer/progress";

const k = buildKnowledge([1, 2, 3, 4]);
const lex = fullLexicon();
const kinds: Exclude<ExerciseKind, "vocab" | "derive" | "answer">[] = ["en2la", "la2en", "ending", "choose", "form", "transform", "identify", "listen", "tiles", "meaning"];

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

  it("builds full sessions", () => {
    const p = newProgress();
    const ctx = { k, lex, r: seeded(42) };
    const s = buildSession(p, ctx, { size: 20, vocab: lessonWords([1, 2, 3, 4]).filter((w) => w.kind !== "fixed") });
    expect(s.length).toBe(20);
    expect(new Set(s.map((e) => e.kind)).size).toBeGreaterThan(3);
  });

  it("retries a single weak skill (regression: one-skill focus)", () => {
    const p = newProgress();
    const ctx = { k, lex, r: seeded(3) };
    for (let i = 0; i < 30; i++) {
      const ex = nextExercise(p, ctx, { size: 1, skills: ["n2.gen.sg"], kinds: ["ending"] }, new Set());
      expect(ex).not.toBeNull();
    }
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

describe("the English above a gap marks the word the gap stands for", () => {
  /** The token of a word as a sentence would carry it (only its entry and role matter here). */
  const tok = (form: string, id: string, role: string): LToken => {
    const a = lex.analyze(form).find((x) => x.entry.id === id)!;
    return { text: form, role: role as LToken["role"], analysis: a };
  };
  const marked = (en: string, t: LToken) => {
    const m = englishMark(en, t);
    return m ? en.slice(m[0], m[1]) : null;
  };
  it("finds nouns, describing words and verbs", () => {
    expect(marked("The farmer sees the girl.", tok("puellam", "puella", "obj"))).toBe("girl");
    expect(marked("The timid farmer drinks the water.", tok("timidus", "timidus", "subj-adj"))).toBe("timid");
    expect(marked("I read the letter.", tok("legō", "lego", "verb"))).toBe("read");
    expect(marked("The poet reads the letter.", tok("legit", "lego", "verb"))).toBe("reads");
    expect(marked("The girls carry the water.", tok("puellae", "puella", "subj"))).toBe("girls");
  });
  it("picks the right one of two, by its role", () => {
    const en = "The friend (f) of the friend (m) has the beautiful book.";
    expect(englishMark(en, tok("amīca", "amica", "subj"))).toEqual([4, 10]);
    expect(englishMark(en, tok("amīcī", "amicus", "subj-poss"))).toEqual([22, 28]);
    expect(marked("The goddess's friend (f) learns.", tok("deae", "dea", "subj-poss"))).toBe("goddess's");
    expect(marked("The poet's student (f) walks.", tok("poētae", "poeta", "subj-poss"))).toBe("poet's");
  });
  it("marks nearly every gap in real exercises", () => {
    let gaps = 0;
    const missed: string[] = [];
    for (let seed = 1; seed <= 300; seed++) {
      for (const kind of ["ending", "choose"] as const) {
        const ex = makeExercise(kind, { k, lex, r: seeded(seed) }, []);
        if (!ex || ex.blank === undefined) continue;
        gaps++;
        if (!ex.mark) missed.push(`${ex.latin![ex.blank].text} in "${ex.english}"`);
      }
    }
    expect(gaps).toBeGreaterThan(400);
    expect(missed.length / gaps, missed.slice(0, 12).join("; ")).toBeLessThan(0.03);
  });
});
