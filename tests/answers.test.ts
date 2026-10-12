import { describe, expect, it } from "vitest";
import { Part, PARTS } from "../src/content/parts";
import { YOU_QUESTIONS } from "../src/content/questions";
import { STORIES } from "../src/content/stories";
import { annotate } from "../src/latin/analyze";
import { seeded } from "../src/latin/generate";
import { full } from "../src/latin/types";
import { answersSession, closingQuestion, openExercise, sceneExercise, storyExercise, storyQuestions, youExercise, youQuestions } from "../src/trainer/answers";
import { CHAT_WORDS } from "../src/chat/words";
import { buildKnowledge, fullLexicon, skillsUpTo } from "../src/trainer/knowledge";
import { lineSkills, readLine } from "../src/trainer/lines";
import { newProgress } from "../src/trainer/progress";

const lex = fullLexicon();
const all = skillsUpTo([1, 2, 3, 4]);
const ctx = (skills = all, seed = 1) => ({ k: buildKnowledge([1, 2, 3, 4], [], 0, skills), lex, r: seeded(seed) });
const you = (id: string, skills = all) => youExercise(ctx(skills), YOU_QUESTIONS.find((q) => q.id === id)!);
/** The rules of the parts up to the one that teaches the last of these skills. */
const upTo = (skills: string[]) => {
  const last = Math.max(...skills.map((s) => PARTS.findIndex((x: Part) => x.skills.includes(s))));
  return new Set(PARTS.slice(0, last + 1).flatMap((x) => x.skills));
};

describe("questions about you", () => {
  it("use only lesson words with the right long marks, and accept their own example", () => {
    for (const q of YOU_QUESTIONS) {
      for (const t of annotate(q.example, lex).filter((x) => x.isWord)) {
        const a = t.analysis ?? t.readings?.[0];
        expect(a, `${q.id}: ${t.text}`).toBeDefined();
        expect(full(a!.form).toLowerCase(), q.id).toBe(t.text.toLowerCase());
      }
      expect(you(q.id).check(q.example).verdict, `${q.id}: ${q.example}`).toBe("correct");
    }
  });

  it("open as soon as their rules are seen, and then need nothing beyond them (tū and ego in sight until 2.2)", () => {
    for (const q of YOU_QUESTIONS) {
      const seen = upTo(q.needs);
      const c = ctx(seen);
      expect(youQuestions(c).map((x) => x.id), q.id).toContain(q.id);
      const ex = youExercise(c, q);
      const example = ex.check("x").expected;
      expect(ex.check(example).verdict, `${q.id}: ${example}`).toBe("correct");
      const used = (example.split(/[.!?]/).filter((x) => x.trim()) as string[]).flatMap((x) => lineSkills(readLine(x, lex)!));
      for (const s of used) expect(seen.has(s), `${q.id}: ${s} in "${example}"`).toBe(true);
      if (!seen.has("s.drop")) expect(ex.ask, q.id).toMatch(/ tū /);
    }
  });

  it("accept any good answer of your own, with or without long marks", () => {
    expect(you("legis").check("Librum lego").verdict).toBe("correct");
    expect(you("legis").check("Ego epistulam legō.").verdict).toBe("correct");
    expect(you("legis").check("Epistulam.").verdict).toBe("correct");
    expect(you("bibis").check("Vinum bibo").verdict).toBe("correct");
    expect(you("ambulas").check("In silvam ambulo.").verdict).toBe("correct");
    expect(you("laboras-cur").check("Quod disco.").verdict).toBe("correct");
    expect(you("es").check("Discipula sum.").verdict).toBe("correct");
    expect(you("potes").check("Scribere possum").verdict).toBe("correct");
  });

  it("say what is wrong: the person, the missing thing, the case, a wrong verb, an unknown word, agreement", () => {
    const issue = (id: string, answer: string) => {
      const res = you(id).check(answer);
      expect(res.verdict, answer).toBe("wrong");
      return res.issues.map((i) => i.message).join(" ");
    };
    expect(issue("legis", "Epistulam legit.")).toContain("-ō");
    expect(issue("legis", "Legō.")).toContain("Say what");
    expect(issue("legis", "Librum habeō.")).toContain("«legō»");
    expect(issue("legis", "Epistulam legō quidquid.")).toContain("I don't know");
    expect(issue("legis", "Epistulam longus legō.")).toMatch(/longam|feminine/);
    expect(issue("laboras-ubi", "In scholam labōrō.")).toContain("no movement");
    expect(issue("ambulas", "In silvā ambulō.")).toContain("movement");
    expect(issue("laboras-cur", "Labōrō.")).toContain("quod");
    expect(issue("es", "Discipulus est.")).toContain("sum");
  });

  it("call a correct but odd sentence almost (one does not read water)", () => {
    const res = you("legis").check("Aquam legō.");
    expect(res.verdict).toBe("almost");
    expect(res.issues[0].message).toContain("odd pair");
  });
});

describe("questions about a story", () => {
  it("ask about the subject, the object, the place or where to, and accept what the story says", () => {
    let made = 0;
    for (const story of STORIES) {
      for (const q of storyQuestions(story, lex, all)) {
        made++;
        const ex = storyExercise(ctx(), story, q);
        expect(ex.check(q.example).verdict, `${q.la} | ${q.example}`).toBe("correct");
        expect(ex.check(q.want.word!.text).verdict, `${q.la} | ${q.want.word!.text}`).toBe("correct");
        expect(q.la).toMatch(/^(Quis|Quid|Ubi|Quō) .+\?$/);
      }
    }
    expect(made).toBeGreaterThan(20);
  });

  it("do not accept another word than the story's", () => {
    const story = STORIES.find((s) => storyQuestions(s, lex, all).some((q) => q.want.slot === "obj" && q.want.word!.id === "aqua"))!;
    const q = storyQuestions(story, lex, all).find((x) => x.want.slot === "obj" && x.want.word!.id === "aqua")!;
    const res = storyExercise(ctx(), story, q).check("Vīnum.");
    expect(res.verdict).toBe("wrong");
    expect(res.issues[0].message).toContain("story");
  });
});

describe("small scenes", () => {
  it("want two sentences about the person, each with its verb in -t", () => {
    for (let seed = 1; seed <= 5; seed++) {
      const ex = sceneExercise(ctx(all, seed), seeded(seed))!;
      expect(ex).not.toBeNull();
      const example = ex.check("x").expected;
      expect(ex.check(example).verdict, example).toBe("correct");
      expect(ex.check(example.split(".")[0] + ".").verdict).toBe("wrong");
    }
    const ex = sceneExercise(ctx(all, 9), seeded(9))!;
    const who = ex.ask!.split(" ")[0];
    expect(ex.check(`${who} labōrō. ${who} dormit.`).verdict).toBe("wrong");
  });
});

describe("a round of open questions", () => {
  it("mixes questions about you, the stories read and scenes, with only the rules seen", () => {
    const p = newProgress();
    p.stories = { aqua: 1 };
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 4; seed++) {
      const items = answersSession(p, ctx(all, seed));
      expect(items.length).toBe(8);
      items.forEach((ex) => kinds.add(ex.instruction.split(",")[1]?.trim() ?? "scene"));
    }
    expect([...kinds].sort()).toEqual(["about yourself", "from the story", "scene"]);
    // a learner who has seen only Lesson I gets questions they can answer
    const early = answersSession(newProgress(), ctx(skillsUpTo([1])));
    for (const ex of early) expect(ex.check(ex.check("x").expected).verdict, ex.ask).toBe("correct");
  });

  it("ends every round: a question on the round's rule when one fits, answerable with the rules seen", () => {
    const p = newProgress();
    for (const part of PARTS) {
      const seen = upTo(part.skills);
      const last = closingQuestion(p, ctx(seen, 7), part.skills);
      if (!last) continue;
      expect(last.last).toBe(true);
      expect(last.skills.every((s) => seen.has(s)), `${part.id}: ${last.ask}`).toBe(true);
      expect(last.check(last.check("x").expected).verdict, `${part.id}: ${last.ask}`).toBe("correct");
    }
    // the rule of -m (2.1) gets a question whose answer needs an object
    const object = closingQuestion(p, ctx(upTo(["n1.acc.sg"]), 2), ["n1.acc.sg"]);
    expect(object?.skills).toContain("n1.acc.sg");
  });
});

describe("fresh questions from Claude (answered in the learner's own words)", () => {
  const chatLex = fullLexicon(CHAT_WORDS);
  const open = (q: { la: string; en: string; example: string; about?: string }, skills = all) => openExercise({ k: buildKnowledge([1, 2, 3, 4], [], 0, skills), lex: chatLex, r: seeded(3) }, q);

  it("accepts any correct answer, creative ones too, and shows the chat words' meanings", () => {
    const ex = open({ la: "Quid hodiē legis?", en: "What are you reading today?", example: "Epistulam legō.", about: "you" });
    expect(ex.gloss).toEqual(expect.arrayContaining(["quid = what", "hodiē = today"]));
    expect(ex.check("Librum magnum legō et epistulam scrībō.").verdict).toBe("correct");
    expect(ex.check("Hodiē nōn legō: dormiō!").verdict).toBe("correct");
    // the engine still catches unknown words and bad grammar; the coach then judges the rest
    expect(ex.check("Cēnam legō.").verdict).toBe("wrong");
    expect(ex.check("Agricola magna labōrat.").verdict).toBe("wrong");
  });

  it("credits the rules the answer uses", () => {
    const ex = open({ la: "Quid agis?", en: "How are you?", example: "Epistulam scrībō." });
    const res = ex.check("Epistulam scrībō et librum legō.");
    expect(Object.keys(res.credit)).toEqual(expect.arrayContaining(["n1.acc.sg", "n2.acc.sg", "s.et"]));
  });
});
