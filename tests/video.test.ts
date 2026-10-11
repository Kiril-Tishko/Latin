import { describe, expect, it } from "vitest";
import { DECK_CARDS } from "../src/content/deck";
import { LESSONS } from "../src/content/lessons";
import { seeded } from "../src/latin/generate";
import { buildKnowledge, fullLexicon, skillsUpTo } from "../src/trainer/knowledge";
import { newProgress } from "../src/trainer/progress";
import { videoExercise, videoLines, videoSession } from "../src/trainer/video";

const lex = fullLexicon(DECK_CARDS.map((c) => c.entry));
const all = buildKnowledge([1, 2, 3, 4]);
const step1 = buildKnowledge([1, 2, 3, 4], [], 0, skillsUpTo([1]));

/** What a perfect student would answer. */
function modelAnswer(ex: ReturnType<typeof videoExercise>): string {
  if (!ex) return "";
  const probe = ex.check("xxxx");
  if (ex.answer === "choice") return ex.correctChoice!;
  if (ex.answer === "ending") return probe.expected.split(" → ")[0].replace("-", "");
  return probe.expected;
}

describe("sentences from the videos", () => {
  it("reads most sentences of Lessons I-IV into checkable words", () => {
    const lines = videoLines([1, 2, 3, 4], lex, all);
    const total = LESSONS.filter((l) => l.n <= 4).reduce((n, l) => n + l.sentences.length, 0);
    expect(lines.length).toBeGreaterThan(total * 0.6);
    for (const line of lines) {
      expect(line.tokens.every((t) => t.analysis), line.la).toBe(true);
      expect(line.en.length, line.la).toBeGreaterThan(2);
    }
  });

  it("keeps to the rules of the step", () => {
    const lines = videoLines([1, 2, 3, 4], lex, step1);
    expect(lines.length).toBeGreaterThan(5);
    for (const line of lines) for (const s of line.skills) expect(step1.skills.has(s), `${s} in ${line.la}`).toBe(true);
  });

  it("marks who does what: the subject, the object, the place, the optional ego", () => {
    const lines = videoLines([1, 2, 3, 4], lex, all);
    const roles = (la: string) => lines.find((l) => l.la === la)?.tokens.map((t) => `${t.text}:${t.role}`).join(" ");
    expect(roles("Magistra discipulam docet.")).toBe("magistra:subj discipulam:obj docet:verb");
    expect(roles("Ego scrībō.")).toBe("ego:pron scrībō:verb");
    // a neuter with "you" acting is the object; after es, the predicate
    expect(roles("Vīnum in silvā bibis.")).toBe("vīnum:obj in:prep silvā:pp bibis:verb");
    expect(roles("Tū es discipula.")).toBe("tū:pron es:verb discipula:pred");
  });

  it("accepts tū with a neuter object, as the video allows", () => {
    const ctx = { k: all, lex, r: seeded(5) };
    const lines = videoLines([1, 2, 3, 4], lex, all);
    const wine = lines.find((l) => l.la === "Vīnum in silvā bibis.")!;
    expect(videoExercise(ctx, wine, "en2la", lines)!.check("Tū vīnum in silvā bibis").verdict).toBe("correct");
  });

  it("offers wrong meanings with the same verb, so the ending decides", () => {
    const ctx = { k: all, lex, r: seeded(2) };
    const lines = videoLines([1], lex, step1);
    const work = lines.find((l) => l.la === "Tū labōrās.")!;
    const ex = videoExercise(ctx, work, "meaning", lines)!;
    expect(ex.choices!.map((c) => c.label).filter((l) => /work/i.test(l)).length).toBeGreaterThanOrEqual(2);
  });

  it("accepts the model answer of every kind of exercise on every sentence", () => {
    const ctx = { k: all, lex, r: seeded(5) };
    const lines = videoLines([1, 2, 3, 4], lex, all);
    let made = 0;
    for (const line of lines) {
      for (const kind of ["choose", "ending", "tiles", "en2la", "meaning"] as const) {
        const ex = videoExercise(ctx, line, kind, lines);
        if (!ex) continue;
        made++;
        const answer = modelAnswer(ex);
        const res = ex.check(answer);
        expect(res.verdict, `${kind}: ${ex.context} | ${answer} | ${res.issues.map((i) => i.message).join("; ")}`).toBe("correct");
        expect(ex.video).toBe(line.from.lesson);
      }
    }
    expect(made).toBeGreaterThan(lines.length * 3);
  });

  it("accepts a written sentence in any word order, and without ego", () => {
    const ctx = { k: all, lex, r: seeded(5) };
    const lines = videoLines([1, 2, 3, 4], lex, all);
    const svo = lines.find((l) => l.la === "Magistra discipulam docet.")!;
    expect(videoExercise(ctx, svo, "en2la", lines)!.check("Discipulam magistra docet").verdict).toBe("correct");
    expect(videoExercise(ctx, svo, "en2la", lines)!.check("Magistram discipula docet").verdict).toBe("wrong");
    const ego = lines.find((l) => l.la === "Ego scrībō.")!;
    expect(videoExercise(ctx, ego, "en2la", lines)!.check("scribo").verdict).toBe("correct");
  });

  it("builds a round, gentle kinds first", () => {
    const p = newProgress();
    const items = videoSession(p, { k: step1, lex, r: seeded(9) }, [1]);
    expect(items.length).toBe(12);
    expect(items.every((ex) => ex.video === 1)).toBe(true);
    expect(items.filter((ex) => ex.kind === "en2la").length).toBeLessThan(3);
  });
});
