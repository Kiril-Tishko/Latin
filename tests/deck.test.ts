import { describe, expect, it } from "vitest";
import { DECK_CARDS } from "../src/content/deck";
import { LESSONS } from "../src/content/lessons";
import { english, generate, latinText, latinTokens, seeded } from "../src/latin/generate";
import { normalizeEnglish } from "../src/latin/english";
import { buildKnowledge } from "../src/trainer/knowledge";
import { cardExamples, cardUnlocked, nextCard, withWord } from "../src/trainer/discover";
import { makeExercise } from "../src/trainer/exercises";
import { fullLexicon } from "../src/trainer/knowledge";

const k = buildKnowledge([1, 2, 3, 4]);

describe("discover deck", () => {
  it("has unique ids that do not clash with lesson words", () => {
    const ids = DECK_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    // the deck was made with Lessons I-IV: a card a later lesson teaches (via, dūcō) is that same word,
    // a card until the lesson is watched and the lesson's word after (the deck leaves it out then)
    for (const c of DECK_CARDS) {
      const lesson = LESSONS.find((l) => l.words.some((w) => w.id === c.id));
      if (!lesson) continue;
      const w = lesson.words.find((x) => x.id === c.id)!;
      expect(lesson.n, c.id).toBeGreaterThan(4);
      expect(w.kind, c.id).toBe(c.entry.kind);
    }
  });

  it("every card has relatives and a memory hook", () => {
    for (const c of DECK_CARDS) {
      const rel = [...Object.values(c.from), ...Object.values(c.kin)].flat();
      expect(rel.length, c.id).toBeGreaterThan(0);
      expect(c.hook.length, c.id).toBeGreaterThan(10);
    }
  });

  it("all cards are open after lessons 1-4 and give example sentences", () => {
    const thin: string[] = [];
    for (const [i, c] of DECK_CARDS.entries()) {
      expect(cardUnlocked(c, k), c.id).toBe(true);
      const ex = cardExamples(c, k, seeded(i + 1), 2);
      if (ex.length < 2) thin.push(c.id);
    }
    expect(thin).toEqual([]);
  });

  it("offers cards in order and skips revealed ones", () => {
    const first = nextCard([], k, new Set())!;
    expect(first.id).toBe(DECK_CARDS[0].id);
    expect(nextCard([first.id], k, new Set())!.id).toBe(DECK_CARDS[1].id);
  });

  it("added words work in generated sentences and exercises", () => {
    let k2 = k;
    for (const c of DECK_CARDS) k2 = withWord(k2, c);
    const lex = fullLexicon(DECK_CARDS.map((c) => c.entry));
    const failures: string[] = [];
    for (let seed = 1; seed <= 600; seed++) {
      const c = generate(k2, seeded(seed));
      if (!c) continue;
      const en = english(c, k2);
      if (!en.pattern.test(normalizeEnglish(en.text.replace(/ \((m|f)\)/g, "")))) failures.push(`${latinText(latinTokens(c, k2))} -> ${en.text}`);
    }
    expect(failures.slice(0, 5)).toEqual([]);
    for (let seed = 1; seed <= 200; seed++) {
      const ex = makeExercise("en2la", { k: k2, lex, r: seeded(seed) }, []);
      if (!ex) continue;
      const res = ex.check(ex.check("x").expected);
      expect(res.verdict, ex.context).toBe("correct");
    }
  });

  it("prints sample cards (for reading)", () => {
    const lines = DECK_CARDS.slice(0, 6).map((c, i) => {
      const ex = cardExamples(c, k, seeded(100 + i), 2);
      return `${c.id}: ${ex.map((e) => `${e.latin} = ${e.english}`).join(" | ")}`;
    });
    console.log(lines.join("\n"));
  });
});
