import { describe, expect, it } from "vitest";
import { caseOf } from "../src/latin/analyze";
import { seeded } from "../src/latin/generate";
import { ExerciseKind, makeExercise } from "../src/trainer/exercises";
import { buildKnowledge, fullLexicon, skillsUpTo } from "../src/trainer/knowledge";
import { mastery, migrate, newProgress } from "../src/trainer/progress";
import { buildSession, kindWeights, readiness, sentenceStyle } from "../src/trainer/session";

const lex = fullLexicon();
const kinds: Exclude<ExerciseKind, "vocab" | "derive">[] = ["en2la", "la2en", "ending", "choose", "form", "transform", "identify", "listen"];

describe("step-by-step practice", () => {
  // every word of Lessons I-IV, but only the rules of Lesson I
  const k1 = buildKnowledge([1, 2, 3, 4], [], 0.35, [1]);
  const lesson1 = skillsUpTo([1]);

  it("uses words from every lesson but only the rules of the step", () => {
    expect(k1.skills).toEqual(lesson1);
    expect(k1.nouns.some((n) => n.id === "puella")).toBe(true); // a Lesson II word
    expect(k1.verbs.some((v) => v.id === "ambulo")).toBe(true); // a Lesson IV word
  });

  for (const kind of kinds) {
    it(`${kind}: Lesson I exercises need nothing beyond Lesson I`, () => {
      let made = 0;
      for (let seed = 1; seed <= 150; seed++) {
        const ex = makeExercise(kind, { k: k1, lex, r: seeded(seed) }, []);
        if (!ex) continue;
        made++;
        for (const s of ex.skills) expect(lesson1.has(s), `${s} in ${ex.context}`).toBe(true);
        // no object, place, 'of' or plural endings: only subjects and verbs
        for (const t of ex.latin ?? []) {
          const a = t.analysis;
          if (!a || a.entry.kind === "fixed" || a.entry.kind === "verb") continue;
          expect(caseOf(a), `${t.text} in ${ex.context}`).toBe("nom");
        }
        // and a perfect answer is accepted
        const probe = ex.check("xxxx");
        const answer = ex.answer === "choice" ? ex.correctChoice! : ex.answer === "ending" ? probe.expected.split(" → ")[0].replace("-", "") : probe.expected;
        expect(ex.check(answer).verdict, `${ex.context} | ${answer}`).toBe("correct");
      }
      if (kind === "en2la" || kind === "la2en" || kind === "ending" || kind === "choose" || kind === "form") expect(made).toBeGreaterThan(100);
    });
  }

  it("never asks to build a nominative singular (it is the dictionary form)", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const ex = makeExercise("form", { k: k1, lex, r: seeded(seed) }, ["n1.nom.sg"]);
      expect(ex?.skills).not.toContain("n1.nom.sg");
    }
  });

  it("starts a new rule with choosing and reading, whole sentences later", () => {
    const share = (m: number, ks: ExerciseKind[]) => {
      const w = kindWeights(m);
      const total = w.reduce((s, [, x]) => s + x, 0);
      return w.filter(([kind]) => ks.includes(kind)).reduce((s, [, x]) => s + x, 0) / total;
    };
    // a new rule: choosing a form, reading the meaning, building from tiles; hardly any typing
    expect(share(0, ["choose", "meaning", "tiles", "la2en"])).toBeGreaterThan(0.6);
    expect(share(0, ["choose", "meaning", "tiles", "la2en", "ending", "form"])).toBeGreaterThan(0.9);
    expect(share(0, ["en2la"])).toBeLessThan(0.1);
    expect(share(0, ["transform", "identify", "listen"])).toBe(0);
    expect(share(0.9, ["en2la", "transform"])).toBeGreaterThan(0.5);
  });

  it("keeps sentences short, sensible and in the usual order while a rule is new", () => {
    const k2 = buildKnowledge([1, 2, 3, 4], [], 0.35, [1, 2, 3, 4]);
    const style = (m: number) => ({ ...k2, ...sentenceStyle(m, 0.35) });
    const longest = (k: typeof k2, kind: Exclude<ExerciseKind, "vocab" | "derive">) => {
      let max = 0;
      let objFirst = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const ex = makeExercise(kind, { k, lex, r: seeded(seed) }, []);
        const t = ex?.latin ?? [];
        max = Math.max(max, t.length);
        const subj = t.findIndex((x) => x.role === "subj");
        const obj = t.findIndex((x) => x.role === "obj");
        if (subj >= 0 && obj >= 0 && obj < subj) objFirst++;
      }
      return { max, objFirst };
    };
    const early = longest(style(0), "la2en");
    expect(early.max).toBeLessThanOrEqual(4);
    expect(early.objFirst).toBe(0);
    expect(sentenceStyle(0, 0.35).silly).toBe(0);
    const late = longest(style(0.9), "la2en");
    expect(late.max).toBeGreaterThan(early.max);
    expect(late.objFirst).toBeGreaterThan(0);
    expect(sentenceStyle(0.9, 0).silly).toBe(0); // "sensible only" in Settings is respected
  });

  it("offers options of which only one fits", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const ex = makeExercise("choose", { k: k1, lex, r: seeded(seed) }, []);
      if (!ex) continue;
      const labels = ex.choices!.map((c) => c.label);
      expect(new Set(labels).size).toBe(labels.length);
      expect(labels.length).toBeGreaterThanOrEqual(2);
      // at Lesson I the gap is always a verb with its subject in sight
      expect(ex.latin![ex.blank!].role).toBe("verb");
      expect(ex.latin!.some((t) => t.role === "subj" || t.role === "pron")).toBe(true);
    }
  });

  it("builds a full step session for a beginner", () => {
    const p = newProgress();
    let gentle = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const s = buildSession(p, { k: k1, lex, r: seeded(seed) }, { size: 12, adaptive: true, focusLesson: 1, kinds: ["en2la", "la2en", "ending", "choose", "form", "transform", "identify"] });
      expect(s.length).toBe(12);
      expect(s.every((e) => e.easy)).toBe(true);
      gentle += s.filter((e) => e.kind === "choose" || e.kind === "la2en").length;
    }
    expect(gentle).toBeGreaterThanOrEqual(30); // at least half of 60
  });

  it("is ready for the next step when the step's rules are solid", () => {
    const p = newProgress();
    expect(readiness(p, 1)).toEqual({ value: 0, ready: false, practised: 0 });
    for (const id of ["v.1sg", "v.2sg", "v.3sg", "s.sv"]) p.skills[id] = { seen: 10, right: 9, ewma: 0.9, last: 0 };
    expect(readiness(p, 1).ready).toBe(true);
    p.skills["v.2sg"] = { seen: 10, right: 3, ewma: 0.4, last: 0 };
    expect(readiness(p, 1).ready).toBe(false);
    expect(mastery(p.skills["v.1sg"])).toBeCloseTo(0.9);
  });

  it("restarts saves from before the steps at Lesson I, and keeps later choices", () => {
    const old = migrate({ version: 1, lessonsDone: [1, 2, 3, 4], focusLesson: 4, updatedAt: 5 });
    expect(old.focusLesson).toBe(1);
    expect(old.version).toBe(3);
    expect(old.rulesShown).toEqual({});
    const now = migrate({ ...old, focusLesson: 2 });
    expect(now.focusLesson).toBe(2);
  });

  it("switches saves to sensible sentences once, and keeps a later choice", () => {
    const v2 = migrate({ version: 2, settings: { silly: 0.35 }, lessonsDone: [1, 2, 3, 4], focusLesson: 1 });
    expect(v2.settings.silly).toBe(0);
    expect(migrate({ ...v2, settings: { ...v2.settings, silly: 0.8 } }).settings.silly).toBe(0.8);
    expect(newProgress().settings.silly).toBe(0);
  });
});
