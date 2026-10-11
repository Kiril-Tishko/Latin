import { describe, expect, it } from "vitest";
import { LESSONS } from "../src/content/lessons";
import { Part, PARTS, partsOf } from "../src/content/parts";
import { STORY_ONLY } from "../src/content/words";
import { annotate } from "../src/latin/analyze";
import { seeded } from "../src/latin/generate";
import { SKILL_BY_ID } from "../src/latin/skills";
import { full } from "../src/latin/types";
import { Exercise, ExerciseKind } from "../src/trainer/exercises";
import { buildKnowledge, fullLexicon } from "../src/trainer/knowledge";
import { lineSkills, readLine } from "../src/trainer/lines";
import { currentPart, markSeen, meetsKeys, nextNewPart, partProgress, partState, seenSkills, SOLID, updatePath } from "../src/trainer/path";
import { migrate, newProgress, Progress } from "../src/trainer/progress";
import { applyResult, buildSession, partSession } from "../src/trainer/session";
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
  const solid = (p: Progress, part: Part) => {
    for (const s of part.skills) p.skills[s] = { seen: 10, right: 10, ewma: 0.95, last: 0 };
    for (let i = 0; i < SOLID.done; i++) updatePath(p, part.skills);
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

  it("learns a part once a bunch of exercises on it went well, then moves on", () => {
    const p = newProgress();
    markSeen(p, "1.1");
    // the rules known from before do not make it learned at once: it needs practice
    for (const s of PARTS[0].skills) p.skills[s] = { seen: 10, right: 10, ewma: 0.95, last: 0 };
    updatePath(p, []);
    expect(partState(p, PARTS[0])).toBe("practising");
    expect(partProgress(p, PARTS[0])).toBe(0);
    for (let i = 0; i < SOLID.done - 1; i++) expect(updatePath(p, ["v.3sg"])).toEqual([]);
    expect(updatePath(p, ["v.3sg"]).map((x) => x.id)).toEqual(["1.1"]);
    expect(partState(p, PARTS[0])).toBe("learned");
    expect(currentPart(p)?.id).toBe("1.2");
    // and a learned part stays learned when a rule slips
    p.skills["v.3sg"] = { seen: 12, right: 6, ewma: 0.3, last: 0 };
    updatePath(p, ["v.3sg"]);
    expect(partState(p, PARTS[0])).toBe("learned");
  });

  it("does not learn a part while one of its rules is weak", () => {
    const p = newProgress();
    markSeen(p, "1.1");
    for (const s of PARTS[0].skills) p.skills[s] = { seen: 10, right: 10, ewma: 0.95, last: 0 };
    p.skills["n1.nom.sg"] = { seen: 10, right: 5, ewma: 0.5, last: 0 };
    for (let i = 0; i < 20; i++) updatePath(p, PARTS[0].skills);
    expect(partState(p, PARTS[0])).toBe("practising");
  });

  it("keeps the step on the lesson of the current part", () => {
    const p = newProgress();
    for (const part of partsOf(1)) {
      markSeen(p, part.id);
      solid(p, part);
    }
    expect(currentPart(p)?.id).toBe("2.1");
    expect(p.focusLesson).toBe(2);
  });

  it("counts an exercise for a part only when it used the part's rules", () => {
    const p = newProgress();
    markSeen(p, "1.1");
    markSeen(p, "1.2");
    updatePath(p, ["v.1sg"]);
    expect(p.parts["1.1"].done).toBe(0);
    expect(p.parts["1.2"].done).toBe(1);
  });

  it("leaves out the parts of a lesson that is not ticked as watched", () => {
    const p = newProgress();
    markSeen(p, "1.1");
    markSeen(p, "2.1");
    p.lessonsDone = [1];
    expect(seenSkills(p).has("n1.acc.sg")).toBe(false);
    expect(seenSkills(p).has("v.3sg")).toBe(true);
  });

  it("moves saves from before the parts on: earlier lessons learned, the step's lesson from its first part", () => {
    const old = migrate({ version: 3, lessonsDone: [1, 2, 3, 4], focusLesson: 2, updatedAt: 5, skills: { "n1.acc.sg": { seen: 20, right: 19, ewma: 0.97, last: 0 } } });
    expect(old.version).toBe(4);
    for (const part of partsOf(1)) expect(partState(old, part), part.id).toBe("learned");
    expect(partState(old, PARTS.find((x) => x.id === "2.1")!)).toBe("new");
    expect(currentPart(old)?.id).toBe("2.1");
    expect(seenSkills(old).has("n1.acc.sg")).toBe(false);
    // a version 4 save keeps its parts
    markSeen(old, "2.1");
    expect(migrate(JSON.parse(JSON.stringify(old))).parts["2.1"]).toBeDefined();
    expect(migrate({ version: 1, lessonsDone: [1, 2, 3, 4], focusLesson: 4 }).parts).toEqual({});
  });

  it("learns the first part in a round or two of right answers", () => {
    const p = newProgress();
    markSeen(p, "1.1");
    const k = buildKnowledge([1, 2, 3, 4], [], 0, seenSkills(p));
    const learned: string[] = [];
    let done = 0;
    for (let round = 1; round <= 3 && !learned.length; round++) {
      for (const ex of buildSession(p, { k, lex, r: seeded(round) }, { size: 12, adaptive: true, skills: PARTS[0].skills, kinds: STEPWISE })) {
        const answer = modelAnswer(ex);
        learned.push(...applyResult(p, ex, ex.check(answer), answer).map((x) => x.id));
        done++;
        if (learned.length) break;
      }
    }
    expect(learned).toEqual(["1.1"]);
    expect(done).toBeGreaterThanOrEqual(SOLID.done);
    expect(done).toBeLessThanOrEqual(24);
    expect(currentPart(p)?.id).toBe("1.2");
  });
});

describe("practice of each part", () => {
  /** A learner who has seen the parts up to this one: earlier rules solid, this one at mastery m. */
  function learner(part: Part, m: number): Progress {
    const p = newProgress();
    for (const x of PARTS.slice(0, PARTS.indexOf(part) + 1)) {
      p.parts[x.id] = { seen: 1, done: 0, learned: x === part ? undefined : 1 };
      for (const s of x.skills) p.skills[s] = { seen: 10, right: 9, ewma: 0.95, last: 0 };
    }
    for (const s of part.skills) {
      if (m === 0) delete p.skills[s];
      else p.skills[s] = { seen: 10, right: 8, ewma: m, last: 0 };
    }
    return p;
  }

  for (const part of PARTS) {
    it(`${part.id} (${part.title}): only rules seen, every rule of the part practised, each answer accepted`, () => {
      const seen = through(part);
      const k = buildKnowledge([1, 2, 3, 4], [], 0, seen);
      const lines = practiceLines(lex, k);
      const credited = new Set<string>();
      const problems: string[] = [];
      for (const m of [0, 0.75, 0.95]) {
        const p = learner(part, m);
        for (let seed = 1; seed <= 4; seed++) {
          const items = partSession(p, { k, lex, r: seeded(seed * 97 + Math.round(m * 10)), audio: true }, part, lines, { adaptive: true, focusLesson: part.lesson, kinds: STEPWISE, review: 0.2 }, 14);
          expect(items.length, `${part.id} at ${m}`).toBeGreaterThanOrEqual(10);
          for (const ex of items) {
            for (const s of ex.skills) if (!seen.has(s)) problems.push(`${s} in ${ex.context}`);
            const answer = modelAnswer(ex);
            const res = ex.check(answer);
            if (res.verdict !== "correct") problems.push(`not accepted: ${ex.context} | ${answer}`);
            Object.keys(res.credit).forEach((s) => credited.add(s));
            if (ex.kind !== "form") {
              for (const tokens of [ex.latin, res.expectedTokens]) {
                if (!tokens?.length) continue;
                for (const s of lineSkills(tokens)) if (!seen.has(s)) problems.push(`${s} needed by ${ex.kind}: ${ex.context}`);
              }
            }
          }
        }
      }
      expect(problems).toEqual([]);
      for (const s of part.practised ?? part.skills) expect(credited.has(s), `${part.id}: ${s} is never practised`).toBe(true);
    });
  }

  it("starts a new part with simple exercises only, and ends with the hard ones", () => {
    const part = PARTS.find((x) => x.id === "2.1")!;
    const k = buildKnowledge([1, 2, 3, 4], [], 0, through(part));
    const kinds = (m: number) => {
      const out: string[] = [];
      for (let seed = 1; seed <= 6; seed++) {
        const p = learner(part, m);
        out.push(...buildSession(p, { k, lex, r: seeded(seed), audio: true }, { size: 12, adaptive: true, skills: part.skills, focusLesson: 2, kinds: STEPWISE }).map((e) => e.kind));
      }
      return out;
    };
    const fresh = kinds(0);
    expect(fresh.every((kind) => ["choose", "meaning", "tiles", "ending", "la2en"].includes(kind))).toBe(true);
    expect(fresh.filter((kind) => kind === "la2en").length).toBeLessThan(fresh.length * 0.2);
    const late = kinds(0.95);
    expect(late.filter((kind) => kind === "en2la" || kind === "transform").length).toBeGreaterThan(late.length * 0.35);
  });
});
