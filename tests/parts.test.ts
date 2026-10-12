import { describe, expect, it } from "vitest";
import { LESSONS } from "../src/content/lessons";
import { Part, PARTS, partsOf, rulesOfPart } from "../src/content/parts";
import { STORY_ONLY } from "../src/content/words";
import { annotate } from "../src/latin/analyze";
import { seeded } from "../src/latin/generate";
import { SKILL_BY_ID } from "../src/latin/skills";
import { full } from "../src/latin/types";
import { Exercise, ExerciseKind } from "../src/trainer/exercises";
import { buildKnowledge, fullLexicon } from "../src/trainer/knowledge";
import { lineSkills, readLine } from "../src/trainer/lines";
import { currentPart, markSeen, meetsKeys, nextNewPart, PART_GOAL, partPhase, partProgress, partRight, partState, seenSkills, updatePath } from "../src/trainer/path";
import { migrate, newProgress, Progress } from "../src/trainer/progress";
import { applyResult, BLOCK, partExercise } from "../src/trainer/session";
import { practiceLines } from "../src/trainer/stories";

const lex = fullLexicon();
const lessonWords = new Set(LESSONS.flatMap((l) => l.words.map((w) => w.id)));
const STEPWISE: ExerciseKind[] = ["en2la", "la2en", "ending", "choose", "form", "transform", "identify", "listen", "tiles", "meaning"];

/** The rules of this part and every part before it. */
const through = (part: Part) => new Set(PARTS.slice(0, PARTS.indexOf(part) + 1).flatMap((x) => x.skills));

/** Every «Latin» piece of a text. */
const latinIn = (text: string) => [...text.matchAll(/«([^»]+)»/g)].map((m) => m[1]);

/** What a perfect student would answer. */
function modelAnswer(ex: Exercise): string {
  const probe = ex.check("xxxx");
  if (ex.answer === "choice") return ex.correctChoice!;
  if (ex.answer === "ending") return probe.expected.split(" → ")[0].replace("-", "");
  return probe.expected;
}

describe("the parts of the lessons' rules", () => {
  it("cover every rule of every lesson once, in the lesson that teaches it", () => {
    const owner = new Map<string, string>();
    for (const part of PARTS) {
      for (const s of part.skills) {
        expect(SKILL_BY_ID.has(s), `${part.id}: unknown skill ${s}`).toBe(true);
        expect(owner.has(s), `${s} is in ${owner.get(s)} and ${part.id}`).toBe(false);
        owner.set(s, part.id);
      }
    }
    for (const l of LESSONS) {
      for (const s of l.skills) expect(PARTS.find((x) => x.skills.includes(s))?.lesson, `${s} of Lesson ${l.n}`).toBe(l.n);
    }
    expect(owner.size).toBe(new Set(LESSONS.flatMap((l) => l.skills)).size);
  });

  it("keep every full rule of the lessons under some part's More detail, in its own lesson", () => {
    for (const l of LESSONS) {
      for (const r of l.rules) {
        const parts = PARTS.filter((x) => rulesOfPart(x).includes(r));
        expect(parts.length, `${r.id} is under no part`).toBeGreaterThan(0);
        expect(parts.every((x) => x.lesson === l.n), r.id).toBe(true);
      }
    }
  });

  it("are numbered in order, a few to a lesson", () => {
    for (const l of LESSONS) {
      const parts = partsOf(l.n);
      expect(parts.length, `Lesson ${l.n}`).toBeGreaterThanOrEqual(3);
      parts.forEach((part, i) => expect(part.id).toBe(`${l.n}.${i + 1}`));
    }
    expect(PARTS.map((p) => p.lesson)).toEqual([...PARTS.map((p) => p.lesson)].sort((a, b) => a - b));
  });

  it("explain in a few short lines, with examples and two open questions", () => {
    for (const part of PARTS) {
      expect(part.explain.length, part.id).toBeGreaterThanOrEqual(2);
      expect(part.explain.length, part.id).toBeLessThanOrEqual(4);
      for (const line of part.explain) expect(line.split(" ").length, `${part.id}: ${line}`).toBeLessThanOrEqual(30);
      expect(part.examples.length, part.id).toBeGreaterThanOrEqual(2);
      expect(part.questions.length, part.id).toBe(2);
    }
  });

  it("use only words of the videos, with the right long marks", () => {
    const problems: string[] = [];
    for (const part of PARTS) {
      const texts = [
        ...part.explain.flatMap(latinIn),
        ...part.examples.map((e) => e.la),
        ...part.questions.flatMap((q) => [...latinIn(q.q), ...latinIn(q.answer)]),
        ...(part.slavic ? latinIn(part.slavic) : []),
      ];
      for (const text of texts) {
        for (const t of annotate(text, lex).filter((x) => x.isWord)) {
          const a = t.analysis ?? t.readings?.[0];
          if (!a) problems.push(`${part.id}: unknown "${t.text}" in ${text}`);
          else if (!lessonWords.has(a.entry.id) || STORY_ONLY.has(a.entry.id)) problems.push(`${part.id}: "${t.text}" is not a lesson word`);
          else if (full(a.form).toLowerCase() !== t.text.toLowerCase()) problems.push(`${part.id}: "${t.text}" should be "${full(a.form)}"`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("give examples that need only the rules met so far, and show the part's own rule", () => {
    for (const part of PARTS) {
      const allowed = through(part);
      let own = false;
      for (const e of part.examples) {
        const tokens = readLine(e.la, lex);
        expect(tokens, `${part.id}: ${e.la}`).not.toBeNull();
        const skills = lineSkills(tokens!);
        // a single verb form on its own is not "ego / tū left out"
        const needed = tokens!.length === 1 ? skills.filter((s) => s !== "s.drop") : skills;
        for (const s of needed) expect(allowed.has(s), `${part.id}: ${s} in "${e.la}"`).toBe(true);
        if (needed.some((s) => part.skills.includes(s))) own = true;
      }
      expect(own, `${part.id}: no example shows ${part.skills.join(", ")}`).toBe(true);
    }
  });

  it("accept each good answer by its keys, and never 'I don't know'", () => {
    for (const part of PARTS) {
      for (const q of part.questions) {
        expect(meetsKeys(q.answer, q.keys), `${part.id}: ${q.answer}`).toBe(true);
        for (const shrug of ["", "I don't know", "no idea, sorry", "Not sure, I think it is the verb", "не знаю"]) {
          expect(meetsKeys(shrug, q.keys), `${part.id}: "${shrug}" for ${q.q}`).toBe(false);
        }
      }
    }
  });
});

describe("open answers", () => {
  const q = (id: string, i: number) => PARTS.find((p) => p.id === id)!.questions[i];

  it("count in the learner's own words, with or without long marks", () => {
    expect(meetsKeys("the farmer; it ends in -t", q("1.1", 0).keys)).toBe(true);
    expect(meetsKeys("The student is sleeping", q("1.1", 1).keys)).toBe(true);
    expect(meetsKeys("ego laboro", q("1.2", 1).keys)).toBe(true);
    expect(meetsKeys("I'm sleeping", q("2.2", 0).keys)).toBe(true);
    expect(meetsKeys("the farmer's water", q("2.3", 0).keys)).toBe(true);
    expect(meetsKeys("Ad scholam ambulō", q("4.2", 1).keys)).toBe(true);
  });

  it("do not count with the idea missing", () => {
    expect(meetsKeys("the farmer", q("1.1", 0).keys)).toBe(false); // what tells you?
    expect(meetsKeys("the teacher", q("2.4", 1).keys)).toBe(false);
    expect(meetsKeys("Ego labōrās", q("1.2", 1).keys)).toBe(false);
    expect(meetsKeys("it is the verb ending", q("1.3", 0).keys)).toBe(false); // which letter?
    expect(meetsKeys("the students", q("1.1", 0).keys)).toBe(false); // a lone letter must stand alone
    expect(meetsKeys("I think it is the verb", q("1.2", 0).keys)).toBe(false); // "I" alone is not the idea
  });
});

describe("the path through the parts", () => {
  const RIGHT = (skills: string[]) => ({ verdict: "correct", credit: Object.fromEntries(skills.map((s) => [s, 1])) });
  const WRONG = (skills: string[]) => ({ verdict: "wrong", credit: Object.fromEntries(skills.map((s) => [s, 0])) });
  const learn = (p: Progress, part: Part) => {
    markSeen(p, part.id);
    for (let i = 0; i < PART_GOAL; i++) updatePath(p, RIGHT(part.skills));
  };

  it("starts at the first part, with no rules to practise until it is seen", () => {
    const p = newProgress();
    expect(currentPart(p)?.id).toBe("1.1");
    expect(nextNewPart(p)?.id).toBe("1.1");
    expect(seenSkills(p).size).toBe(0);
    expect(partState(p, PARTS[0])).toBe("new");
    markSeen(p, "1.1");
    expect([...seenSkills(p)].sort()).toEqual([...PARTS[0].skills].sort());
    expect(partState(p, PARTS[0])).toBe("practising");
    expect(currentPart(p)?.id).toBe("1.1");
    expect(nextNewPart(p)?.id).toBe("1.2");
  });

  it("adds one for every right answer on the rule, and learns it at ten", () => {
    const p = newProgress();
    markSeen(p, "1.1");
    expect(partRight(p, PARTS[0])).toBe(0);
    for (let i = 1; i < PART_GOAL; i++) {
      expect(updatePath(p, RIGHT(["v.3sg"]))).toEqual([]);
      expect(partRight(p, PARTS[0])).toBe(i);
      expect(partProgress(p, PARTS[0])).toBeCloseTo(i / PART_GOAL);
    }
    expect(updatePath(p, RIGHT(["v.3sg"])).map((x) => x.id)).toEqual(["1.1"]);
    expect(partState(p, PARTS[0])).toBe("learned");
    expect(currentPart(p)?.id).toBe("1.2");
  });

  it("adds nothing for a wrong answer, an answer that got the rule wrong, or one without the rule", () => {
    const p = newProgress();
    markSeen(p, "1.1");
    updatePath(p, WRONG(["v.3sg"]));
    // the sentence was "almost" right, but the slip was in the rule's own ending
    updatePath(p, { verdict: "almost", credit: { "v.3sg": 0, "s.sv": 0.85 } });
    expect(partRight(p, PARTS[0])).toBe(1); // s.sv was right in it
    updatePath(p, RIGHT(["v.1sg"]));
    expect(partRight(p, PARTS[0])).toBe(1);
  });

  it("gives simple exercises for the first five right answers, then harder, then the hardest", () => {
    const p = newProgress();
    markSeen(p, "1.1");
    const phases: string[] = [];
    for (let i = 0; i < PART_GOAL; i++) {
      phases.push(partPhase(p, PARTS[0]));
      updatePath(p, RIGHT(["v.3sg"]));
    }
    expect(phases).toEqual(["simple", "simple", "simple", "simple", "simple", "mixed", "mixed", "mixed", "hard", "hard"]);
  });

  it("counts a right answer in any kind of practice, for every part in practice it shows", () => {
    const p = newProgress();
    markSeen(p, "1.1");
    markSeen(p, "1.2");
    updatePath(p, RIGHT(["v.1sg"]));
    expect(partRight(p, PARTS[0])).toBe(0);
    expect(partRight(p, PARTS[1])).toBe(1);
    updatePath(p, RIGHT(["v.1sg", "v.3sg"]));
    expect(partRight(p, PARTS[0])).toBe(1);
    expect(partRight(p, PARTS[1])).toBe(2);
  });

  it("keeps the step on the lesson of the current part", () => {
    const p = newProgress();
    for (const part of partsOf(1)) learn(p, part);
    expect(currentPart(p)?.id).toBe("2.1");
    expect(p.focusLesson).toBe(2);
  });

  it("leaves out the parts of a lesson that is not ticked as watched", () => {
    const p = newProgress();
    markSeen(p, "1.1");
    markSeen(p, "2.1");
    p.lessonsDone = [1];
    expect(seenSkills(p).has("n1.acc.sg")).toBe(false);
    expect(seenSkills(p).has("v.3sg")).toBe(true);
  });

  it("moves saves on: earlier lessons learned, the step's lesson from its first part, parts in practice counting from nothing", () => {
    const old = migrate({ version: 3, lessonsDone: [1, 2, 3, 4], focusLesson: 2, updatedAt: 5, skills: { "n1.acc.sg": { seen: 20, right: 19, ewma: 0.97, last: 0 } } });
    expect(old.version).toBe(5);
    for (const part of partsOf(1)) expect(partState(old, part), part.id).toBe("learned");
    expect(partState(old, PARTS.find((x) => x.id === "2.1")!)).toBe("new");
    expect(currentPart(old)?.id).toBe("2.1");
    expect(seenSkills(old).has("n1.acc.sg")).toBe(false);
    // a version 4 save: learned parts stay learned, a part in practice counts from 0
    const v4 = migrate({ version: 4, lessonsDone: [1, 2, 3, 4], focusLesson: 3, parts: { "3.1": { seen: 1, done: 11, learned: 2 }, "3.2": { seen: 3, done: 0 } } });
    expect(v4.parts["3.1"]).toEqual({ seen: 1, right: 0, learned: 2 });
    expect(v4.parts["3.2"]).toEqual({ seen: 3, right: 0 });
    expect(partState(v4, PARTS.find((x) => x.id === "3.1")!)).toBe("learned");
    expect(migrate(JSON.parse(JSON.stringify(v4))).parts).toEqual(v4.parts);
    expect(migrate({ version: 1, lessonsDone: [1, 2, 3, 4], focusLesson: 4 }).parts).toEqual({});
  });
});

/** A learner who has learned the parts before this one and has `right` right answers on it. */
function learner(part: Part, right: number): Progress {
  const p = newProgress();
  for (const x of PARTS.slice(0, PARTS.indexOf(part) + 1)) {
    p.parts[x.id] = x === part ? { seen: 1, right } : { seen: 1, right: PART_GOAL, learned: 1 };
    for (const s of x.skills) p.skills[s] = { seen: 10, right: 9, ewma: 0.95, last: 0 };
  }
  for (const s of part.skills) delete p.skills[s];
  return p;
}

/** A round on a part as the page plays it: one exercise at a time, each answered right. */
function playRound(part: Part, seed: number, size = 12, startRight = 0) {
  const p = learner(part, startRight);
  const k = buildKnowledge([1, 2, 3, 4], [], 0, through(part));
  const lines = practiceLines(lex, k);
  const ctx = { k, lex, r: seeded(seed), audio: true };
  const seen = new Set<string>();
  const out: { ex: Exercise; phase: string; counted: boolean; right: number }[] = [];
  for (let i = 0; i < size; i++) {
    const phase = partPhase(p, part);
    const ex = partExercise(p, ctx, part, lines, STEPWISE, seen, out.map((x) => x.ex));
    if (!ex) break;
    const answer = modelAnswer(ex);
    const res = ex.check(answer);
    const before = partRight(p, part);
    applyResult(p, ex, res, answer);
    out.push({ ex, phase, counted: partRight(p, part) > before || partState(p, part) === "learned", right: partRight(p, part) });
    if (partState(p, part) === "learned") break;
  }
  return { p, out };
}

describe("practice of each part", () => {
  for (const part of PARTS) {
    it(`${part.id} (${part.title}): every exercise shows the rule and adds one when right, only rules seen, learned in ten`, () => {
      const seen = through(part);
      const problems: string[] = [];
      const credited = new Set<string>();
      for (let seed = 1; seed <= 3; seed++) {
        const { p, out } = playRound(part, seed * 31, 14);
        // ten right answers learn it; a review exercise (past the simple ones) may come in between
        if (partState(p, part) !== "learned") problems.push(`seed ${seed}: not learned after ${out.length} right answers (${partRight(p, part)})`);
        const reviews = out.filter((x) => !x.counted).length;
        if (reviews > 4) problems.push(`seed ${seed}: ${reviews} exercises did not count`);
        for (const { ex, phase, counted } of out) {
          if (phase === "simple" && !counted) problems.push(`a simple exercise that did not count: ${ex.context}`);
          if (counted) ex.skills.filter((s) => part.skills.includes(s)).forEach((s) => credited.add(s));
          for (const s of ex.skills) if (!seen.has(s)) problems.push(`${s} in ${ex.context}`);
          const res = ex.check(modelAnswer(ex));
          if (res.verdict !== "correct") problems.push(`not accepted: ${ex.context}`);
          if (ex.kind !== "form") {
            for (const tokens of [ex.latin, res.expectedTokens]) {
              if (!tokens?.length) continue;
              for (const s of lineSkills(tokens)) if (!seen.has(s)) problems.push(`${s} needed by ${ex.kind}: ${ex.context}`);
            }
          }
          if (phase === "simple" && ["en2la", "transform", "listen"].includes(ex.kind)) problems.push(`a hard ${ex.kind} while the rule is new: ${ex.context}`);
        }
      }
      expect(problems).toEqual([]);
      for (const s of part.practised ?? part.skills) expect(credited.has(s), `${part.id}: ${s} is never practised`).toBe(true);
    });
  }

  it("starts a new part with simple exercises only, and ends with the hard ones", () => {
    const part = PARTS.find((x) => x.id === "2.1")!;
    const kinds = (startRight: number) => [1, 2, 3, 4, 5, 6].flatMap((seed) => playRound(part, seed, 4, startRight).out.map((x) => x.ex.kind));
    const fresh = kinds(0);
    expect(fresh.every((kind) => ["choose", "meaning", "tiles", "ending", "la2en", "form"].includes(kind))).toBe(true);
    const late = kinds(8);
    expect(late.filter((kind) => kind === "en2la" || kind === "transform").length).toBeGreaterThan(late.length * 0.3);
  });

  it("comes in short blocks of one kind, so one instruction serves a few exercises", () => {
    for (const id of ["2.1", "3.1", "4.2"]) {
      const part = PARTS.find((x) => x.id === id)!;
      for (const seed of [1, 2, 3]) {
        const kinds = playRound(part, seed * 7, 12).out.map((x) => x.ex.kind);
        const runs: number[] = [];
        kinds.forEach((k, i) => (i && k === kinds[i - 1] ? runs[runs.length - 1]++ : runs.push(1)));
        expect(Math.max(...runs), `${id}: ${kinds.join(" ")}`).toBeLessThanOrEqual(BLOCK);
        expect(kinds.length / runs.length, `${id}: ${kinds.join(" ")}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("never gives a hard exercise while a rule is new, even when the usual kinds cannot show it", () => {
    for (const id of ["1.1", "1.4", "1.5", "2.2", "4.3"]) {
      const part = PARTS.find((x) => x.id === id)!;
      for (let seed = 1; seed <= 40; seed++) {
        for (const { ex, phase } of playRound(part, seed, 5).out) {
          if (phase === "simple") expect(["en2la", "transform", "listen", "identify"], `${id}: ${ex.context}`).not.toContain(ex.kind);
        }
      }
    }
  }, 30_000);

  it("after a wrong answer gives nothing harder, and after two in a row something easier", () => {
    const RANK: ExerciseKind[] = ["meaning", "choose", "tiles", "ending", "identify", "form", "la2en", "listen", "transform", "en2la"];
    let stays = 0;
    let down = 0;
    for (const part of PARTS) {
      for (const seed of [3, 9]) {
        const p = learner(part, 5);
        const k = buildKnowledge([1, 2, 3, 4], [], 0, through(part));
        const lines = practiceLines(lex, k);
        const ctx = { k, lex, r: seeded(seed), audio: true };
        const seen = new Set<string>();
        const prev: Exercise[] = [];
        let missed = 0;
        for (let i = 0; i < 7; i++) {
          const ex = partExercise(p, ctx, part, lines, STEPWISE, seen, prev, missed);
          if (!ex) break;
          if (missed > 0 && !ex.earlier) {
            const before = RANK.indexOf(prev.at(-1)!.kind);
            expect(RANK.indexOf(ex.kind), `${part.id}: ${prev.at(-1)!.kind} then ${ex.kind}`).toBeLessThanOrEqual(before);
            if (missed === 1) stays++;
            else if (RANK.indexOf(ex.kind) < before) down++;
          }
          prev.push(ex);
          // the fourth and fifth answers are wrong
          const wrong = i === 3 || i === 4;
          const answer = wrong ? "xxxx" : modelAnswer(ex);
          applyResult(p, ex, ex.check(answer), answer);
          missed = wrong ? missed + 1 : 0;
        }
      }
    }
    expect(stays).toBeGreaterThan(30);
    expect(down).toBeGreaterThan(10);
  }, 30_000);

  it("rule 3.2: the -ī of an -us word is in every exercise (it once was in none)", () => {
    const part = PARTS.find((x) => x.id === "3.2")!;
    const { out } = playRound(part, 5, 5);
    expect(out.length).toBe(5);
    for (const { ex } of out) expect(ex.skills, ex.context).toContain("n2.gen.sg");
  });
});
