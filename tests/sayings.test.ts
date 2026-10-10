import { describe, expect, it } from "vitest";
import { DECK_CARDS } from "../src/content/deck";
import { SAYINGS, sayingsFor } from "../src/content/sayings";
import { LESSON_WORDS, STORY_ONLY } from "../src/content/words";
import { annotate } from "../src/latin/analyze";
import { seeded } from "../src/latin/generate";
import { wordExamples } from "../src/trainer/discover";
import { buildKnowledge, fullLexicon } from "../src/trainer/knowledge";

const lessonWords = Object.values(LESSON_WORDS).flat().filter((w) => !STORY_ONLY.has(w.id));
const allWords = [...lessonWords, ...DECK_CARDS.map((c) => c.entry)];

describe("famous sayings", () => {
  it("link only to real words, and every hint matches a reading", () => {
    const ids = new Set([...Object.values(LESSON_WORDS).flat(), ...DECK_CARDS.map((c) => c.entry)].map((w) => w.id));
    const lex = fullLexicon(DECK_CARDS.map((c) => c.entry));
    for (const s of SAYINGS) {
      expect(s.words.length, s.la).toBeGreaterThan(0);
      for (const w of s.words) expect(ids.has(w), `${w} in ${s.la}`).toBe(true);
      expect(s.la, s.la).toMatch(/[.!?]$/);
      for (const [, word, hint] of s.la.matchAll(/([\p{L}]+)#([a-z0-9]+(?:\.[a-z0-9]+)*)/gu)) {
        if (hint === "x") continue;
        const t = annotate(`${word}#${hint}`, lex).find((x) => x.isWord);
        expect(t?.analysis?.key, `${word}#${hint} in ${s.la}`).toBe(hint);
      }
    }
  });

  it("cover most lesson words", () => {
    const covered = lessonWords.filter((w) => sayingsFor(w.id).length > 0).length;
    expect(covered / lessonWords.length).toBeGreaterThan(0.6);
  });
});

describe("dictionary examples", () => {
  it("give every word with grammar of its own a sensible sentence", () => {
    const k = buildKnowledge([1, 2, 3, 4]);
    const none = allWords
      .filter((w) => w.kind !== "fixed")
      .filter((w, i) => wordExamples(w, k, seeded(i + 3), 2).length === 0)
      .map((w) => w.id);
    expect(none).toEqual([]);
  });

  it("never pair an adjective with a noun it does not suit, or repeat it", () => {
    const k = buildKnowledge([1, 2, 3, 4]);
    for (const [i, w] of allWords.filter((x) => x.kind === "noun").entries()) {
      for (const ex of wordExamples(w, k, seeded(i + 11), 3)) {
        expect(ex.latin, ex.latin).not.toMatch(/\\b(\\w+) est \\1\\b/);
        expect(ex.english, ex.latin).not.toMatch(/(long|white|red) (wine|water|life|smoke)/);
      }
    }
  });
});
