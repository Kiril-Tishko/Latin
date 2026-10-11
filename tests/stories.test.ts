import { describe, expect, it } from "vitest";
import { STORIES } from "../src/content/stories";
import { LESSONS } from "../src/content/lessons";
import { annotate } from "../src/latin/analyze";
import { seeded } from "../src/latin/generate";
import { full } from "../src/latin/types";
import { buildKnowledge, fullLexicon, skillsUpTo } from "../src/trainer/knowledge";
import { lineExercise, lineSkills, readLine } from "../src/trainer/lines";
import { newProgress } from "../src/trainer/progress";
import { nextStory, partsBefore, storyLines, storyOpen, storySession } from "../src/trainer/stories";
import { PARTS } from "../src/content/parts";
import { markSeen } from "../src/trainer/path";
import { videoLines } from "../src/trainer/video";

const lex = fullLexicon();
const lessonIds = new Set(LESSONS.flatMap((l) => l.words.map((w) => w.id)));
const upTo = (n: number) => skillsUpTo(Array.from({ length: n }, (_, i) => i + 1));

/** What a perfect student would answer. */
function modelAnswer(ex: NonNullable<ReturnType<typeof lineExercise>>): string {
  const probe = ex.check("xxxx");
  if (ex.answer === "choice") return ex.correctChoice!;
  if (ex.answer === "ending") return probe.expected.split(" → ")[0].replace("-", "");
  if (ex.answer === "tiles") return probe.expected;
  return probe.expected;
}

describe("stories", () => {
  it("use only words of the videos, spelled with the right long marks", () => {
    const problems: string[] = [];
    for (const s of STORIES) {
      for (const l of [...s.lines.map((x) => x.la), s.title]) {
        for (const t of annotate(l, lex).filter((x) => x.isWord)) {
          const a = t.analysis ?? t.readings?.[0];
          if (!a) problems.push(`${s.id}: unknown "${t.text}" in ${l}`);
          else if (!lessonIds.has(a.entry.id)) problems.push(`${s.id}: "${t.text}" is not a lesson word`);
          else if (full(a.form).toLowerCase() !== t.text.toLowerCase()) problems.push(`${s.id}: "${t.text}" should be "${full(a.form)}"`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("need only the rules up to their step, and use the rules of that step", () => {
    for (const s of STORIES) {
      const allowed = upTo(s.step);
      const used = new Set<string>();
      for (const l of s.lines) {
        const tokens = readLine(l.la, lex)!;
        for (const sk of lineSkills(tokens)) {
          expect(allowed.has(sk), `${s.id}: ${sk} in "${l.la}"`).toBe(true);
          used.add(sk);
        }
      }
      if (s.step > 1) {
        const own = [...upTo(s.step)].filter((sk) => !upTo(s.step - 1).has(sk));
        expect(own.some((sk) => used.has(sk)), `${s.id} uses nothing of Lesson ${s.step}`).toBe(true);
      }
    }
  });

  it("are in step order with unique ids, and every question has three different answers", () => {
    expect(new Set(STORIES.map((s) => s.id)).size).toBe(STORIES.length);
    STORIES.forEach((s, i) => i && expect(s.step).toBeGreaterThanOrEqual(STORIES[i - 1].step));
    for (const s of STORIES) {
      expect(s.questions.length, s.id).toBeGreaterThanOrEqual(2);
      for (const q of s.questions) expect(new Set(q.options).size, q.q).toBe(3);
      expect(s.lines.length).toBeGreaterThanOrEqual(5);
    }
    // three stories for every step the videos cover
    for (const step of [1, 2, 3, 4]) expect(STORIES.filter((s) => s.step === step).length).toBeGreaterThanOrEqual(3);
  });

  it("turn every line with a verb into practice, and accept each exercise's own answer", () => {
    const all = buildKnowledge([1, 2, 3, 4]);
    let made = 0;
    for (const s of STORIES) {
      const lines = storyLines(s, lex);
      expect(lines.length, s.id).toBe(s.lines.filter((l) => /[a-zā-ū]+(t|s|ō|nt|re|m|um|est|es|sum)\b/i.test(l.la) && l.la !== "Et tū?").length);
      for (const line of lines) {
        for (const kind of ["choose", "ending", "tiles", "en2la", "meaning"] as const) {
          const ex = lineExercise({ k: all, lex, r: seeded(made + 3) }, line, kind, lines);
          if (!ex) continue;
          made++;
          const answer = modelAnswer(ex);
          const res = ex.check(answer);
          expect(res.verdict, `${s.id} ${kind}: ${line.la} | ${answer} | ${res.issues.map((i) => i.message).join("; ")}`).toBe("correct");
          expect(ex.story).toBe(s.title);
        }
      }
    }
    expect(made).toBeGreaterThan(150);
  });

  it("build a round on one story, and offer the next unread story the learner's rules open", () => {
    const p = newProgress();
    const story = STORIES.find((s) => s.id === "epistula-poetae")!;
    const round = storySession(p, { k: buildKnowledge([1, 2, 3, 4]), lex, r: seeded(4) }, [story]);
    expect(round.length).toBe(12);
    expect(round.every((ex) => ex.story === story.title)).toBe(true);
    // nothing is open before the first part is seen
    expect(nextStory(p)).toBeUndefined();
    for (const part of PARTS.filter((x) => x.lesson <= 2)) markSeen(p, part.id);
    p.focusLesson = 2;
    expect(nextStory(p)?.step).toBe(2);
    for (const s of STORIES.filter((x) => x.step === 2)) p.stories[s.id] = 1;
    expect(nextStory(p)?.step).toBe(1);
  });

  it("open once the parts of their rules are seen, and say which parts are missing", () => {
    for (const s of STORIES) {
      const before = new Set(PARTS.filter((x) => x.lesson < s.step).flatMap((x) => x.skills));
      const all = new Set(PARTS.filter((x) => x.lesson <= s.step).flatMap((x) => x.skills));
      expect(storyOpen(s, all), s.id).toBe(true);
      if (s.step > 1) {
        expect(storyOpen(s, before), s.id).toBe(false);
        expect(partsBefore(s, before).every((x) => x.lesson === s.step), s.id).toBe(true);
      }
    }
  });
});

describe("the rules a fixed sentence needs", () => {
  const skills = (la: string) => lineSkills(readLine(la, lex)!);
  it("sees constructions, not only endings", () => {
    expect(skills("Ego legō.")).not.toContain("s.drop");
    expect(skills("Legō.")).toContain("s.drop");
    expect(skills("Magistra discipulam docet.")).toContain("s.svo");
    expect(skills("Poēta epistulam amīcae#gen.sg legit.")).toContain("s.gen");
    expect(skills("In silvā ambulō.")).toContain("s.loc");
    expect(skills("In silvam ambulō.")).toContain("s.into");
    expect(skills("Ad scholam ambulō.")).toContain("s.ad");
    expect(skills("Magistra docet sed nēmō discit.")).toContain("s.conn");
    expect(skills("Agricola magnus est.")).toEqual(expect.arrayContaining(["adj.gender", "s.est", "v.sum"]));
    expect(skills("Sed legere nōn potest.")).toEqual(expect.arrayContaining(["s.inf", "s.non", "v.possum"]));
  });

  it("keeps a Lesson II sentence out of step I practice", () => {
    const step1 = buildKnowledge([1, 2, 3, 4], [], 0, skillsUpTo([1]));
    const lines = videoLines([1, 2, 3, 4], lex, step1);
    expect(lines.some((l) => l.la.includes("nēmō"))).toBe(false);
  });
});
