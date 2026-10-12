import { describe, expect, it } from "vitest";
import { PARTS } from "../src/content/parts";
import { STORIES } from "../src/content/stories";
import { markSeen, seenSkills } from "../src/trainer/path";
import { newProgress, Progress, recordDay } from "../src/trainer/progress";
import { storyOpen } from "../src/trainer/stories";
import { storyRead, todayStep, WORD_ROUND_AT, wordsGiven } from "../src/trainer/today";

const NOW = Date.parse("2026-10-12T10:00:00Z");
// words never reviewed are due
const vocab = Array.from({ length: 30 }, (_, i) => `w${i}`);

/** A learner who has seen every rule of Lesson I. */
function lessonOne(): Progress {
  const p = newProgress();
  for (const part of PARTS.filter((x) => x.lesson === 1)) markSeen(p, part.id, NOW);
  return p;
}

describe("Continue's day", () => {
  it("starts with the rule, then brings a story that has opened, then the words, then the rule again", () => {
    const p = lessonOne();
    const open = STORIES.filter((s) => storyOpen(s, seenSkills(p)));
    expect(open.length).toBeGreaterThan(1);
    expect(todayStep(p, vocab, NOW)).toMatchObject({ kind: "practise", part: { id: "1.1" } });
    recordDay(p, true, NOW);
    const first = todayStep(p, vocab, NOW);
    expect(first.kind).toBe("story");
    if (first.kind !== "story") return;
    p.stories[first.story.id] = NOW;
    storyRead(p, NOW);
    // one story between two rounds: now the words, which come once a day
    expect(todayStep(p, vocab, NOW)).toMatchObject({ kind: "words", due: vocab.length });
    wordsGiven(p, NOW);
    expect(todayStep(p, vocab, NOW).kind).toBe("practise");
    // after more practice, the next story that is open
    recordDay(p, true, NOW);
    const second = todayStep(p, vocab, NOW);
    expect(second.kind).toBe("story");
    if (second.kind === "story") expect(second.story.id).not.toBe(first.story.id);
  });

  it("gives the words a round only when enough are due, and a new rule its page first", () => {
    const p = lessonOne();
    for (const s of STORIES) p.stories[s.id] = NOW;
    recordDay(p, true, NOW);
    expect(todayStep(p, vocab.slice(0, WORD_ROUND_AT - 1), NOW).kind).toBe("practise");
    expect(todayStep(p, vocab.slice(0, WORD_ROUND_AT), NOW).kind).toBe("words");
    // every part of Lesson I learned: the next rule is new, and opens its page
    for (const part of PARTS.filter((x) => x.lesson === 1)) p.parts[part.id].learned = NOW;
    wordsGiven(p, NOW);
    expect(todayStep(p, vocab, NOW)).toMatchObject({ kind: "learn", part: { id: "2.1" } });
  });
});

describe("Continue and the Ācta Diurna", () => {
  it("brings today's board once something is done, after a story, before the words", () => {
    const p = lessonOne();
    // nothing done yet today: the rule first, board or not
    expect(todayStep(p, vocab, NOW, true).kind).toBe("practise");
    recordDay(p, true, NOW);
    expect(todayStep(p, vocab, NOW, true).kind).toBe("story");
    for (const s of STORIES) p.stories[s.id] = NOW;
    expect(todayStep(p, vocab, NOW, true).kind).toBe("acta");
    // read: the day goes on
    expect(todayStep(p, vocab, NOW, false).kind).toBe("words");
  });
});
