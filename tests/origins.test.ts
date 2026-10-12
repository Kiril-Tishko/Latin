import { describe, expect, it } from "vitest";
import { CULTURE } from "../src/content/culture";
import { LESSONS } from "../src/content/lessons";
import { DECK_CARDS } from "../src/content/deck";
import { Lexicon } from "../src/latin/analyze";
import { full } from "../src/latin/types";
import { familyMatches, familyOf, hiddenLinks, wordFamilies } from "../src/trainer/origins";

const lessonWords = LESSONS.flatMap((l) => l.words);
const lex = new Lexicon(lessonWords);
const ids = new Set(lessonWords.map((w) => w.id));
/** Words in the stories that only look like a lesson word: līber (free) is not liber (book). */
const LOOK_ALIKES = new Set(["līber"]);

describe("culture in words", () => {
  it("has stories, each with its Latin, a teaser, a text and today's words", () => {
    expect(CULTURE.length).toBeGreaterThanOrEqual(15);
    expect(new Set(CULTURE.map((s) => s.id)).size).toBe(CULTURE.length);
    for (const s of CULTURE) {
      expect(s.latin, s.id).toMatch(/«.+»/);
      expect(s.teaser.length, s.id).toBeGreaterThan(10);
      expect(s.text.length, s.id).toBeGreaterThanOrEqual(1);
      for (const p of s.text) expect(p.split(" ").length, `${s.id}: ${p}`).toBeLessThanOrEqual(80);
      expect(s.modern.en.length + s.modern.ru.length + s.modern.uk.length, s.id).toBeGreaterThan(0);
      for (const id of s.words) expect(ids.has(id), `${s.id}: ${id}`).toBe(true);
    }
  });

  it("spells the learner's own words with their long marks, and names them", () => {
    const problems: string[] = [];
    for (const s of CULTURE) {
      const latin = [s.latin, ...s.text].flatMap((t) => [...t.matchAll(/«([^»]+)»/g)].map((m) => m[1]));
      for (const word of latin.flatMap((l) => l.split(/[^\p{L}]+/u)).filter(Boolean)) {
        const readings = lex.analyze(word);
        if (!readings.length || LOOK_ALIKES.has(word.toLowerCase())) continue;
        if (!readings.some((r) => full(r.form).toLowerCase() === word.toLowerCase())) problems.push(`${s.id}: «${word}» should be ${full(readings[0].form)}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("touches many of the learner's words", () => {
    const touched = new Set(CULTURE.flatMap((s) => s.words));
    expect(touched.size).toBeGreaterThanOrEqual(15);
  });
});

describe("hidden links", () => {
  it("collects them from the learner's words and from Ask Claude's word cards, newest first, each once", () => {
    const own = [{ dict: "fortis, forte", added: 100, story: { link: "«fortis» → \"fortress\", \"forte\" in music" } }, { dict: "cor, cordis, n.", added: 50 }];
    const chats = [
      {
        turns: [
          { role: "user", content: "euge", at: 200 },
          { role: "assistant", content: "**euge · well done!**\n**Origin:** Greek eu.\n**Hidden link:** «euge» → Eugene, \"Євген\" → \"eugenics\".", at: 210 },
          { role: "user", content: "and valē?", at: 300 },
          { role: "assistant", content: "It means goodbye.\n- **Hidden link:** «valē» → \"Valentine\", \"valid\".", at: 310 },
          { role: "user", content: "again euge", at: 400 },
          { role: "assistant", content: "**euge**\n**Hidden link:** «euge» → Eugene, \"Євген\" → \"eugenics\".", at: 410 },
        ],
      },
    ];
    const links = hiddenLinks(own, chats);
    expect(links.map((l) => l.word)).toEqual(["euge", "valē", "fortis"]);
    expect(links[0]).toMatchObject({ from: "ask", at: 410 });
    expect(links[1].text).toContain("Valentine");
    expect(links[2]).toMatchObject({ word: "fortis", from: "own" });
  });
});

describe("word families", () => {
  it("come from the lesson list, a mystery card, or a word's own card", () => {
    const aqua = familyOf(lessonWords.find((w) => w.id === "aqua")!);
    expect(aqua?.from.en).toContain("aquarium");
    const card = DECK_CARDS.find((c) => c.from.en?.length);
    expect(familyOf(card!.entry)?.from.en?.length).toBeGreaterThan(0);
    const own = { ...lessonWords.find((w) => w.id === "aqua")!, id: "fortis-own", story: { from: { en: ["fortress"] }, link: "forte" } };
    expect(familyOf(own)?.from.en).toEqual(["fortress"]);
  });
  it("cover most lesson words, and are found by a relative in any language", () => {
    const fams = wordFamilies(lessonWords.filter((w) => w.kind !== "fixed"));
    expect(fams.length).toBeGreaterThan(30);
    const aqua = fams.find((f) => f.entry.id === "aqua")!;
    expect(familyMatches(aqua, "aquarium")).toBe(true);
    expect(familyMatches(aqua, "water")).toBe(true);
    expect(familyMatches(aqua, "gladiator")).toBe(false);
  });
});
