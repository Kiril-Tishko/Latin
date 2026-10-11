import { describe, expect, it } from "vitest";
import { DECK_CARDS } from "../src/content/deck";
import {
  ABBREVIATIONS, ASSIMILATION, FROZEN_VERBS, GRAMMAR_RULES, GRAMMAR_TERMS, LATER_VERBS, LESSON_WORDS_IN_ENGLISH, PHRASES, PLURALS, SPELLINGS, SUFFIXES,
  TABLE_PAIRS, THREE_LANGUAGES, WAVES, quizWords, wordInEnglish,
} from "../src/content/english";
import { LESSON_WORDS, STORY_ONLY } from "../src/content/words";
import { annotate } from "../src/latin/analyze";
import { seeded } from "../src/latin/generate";
import { full } from "../src/latin/types";
import { deriveExercise } from "../src/trainer/exercises";
import { buildKnowledge, fullLexicon } from "../src/trainer/knowledge";
import { buildSession } from "../src/trainer/session";
import { newProgress } from "../src/trainer/progress";

const lex = fullLexicon(DECK_CARDS.map((c) => c.entry));
const lessonWords = Object.values(LESSON_WORDS).flat();

/** Every «…» stretch of Latin in a markup string. */
const marked = (s?: string) => [...(s ?? "").matchAll(/«([^»]+)»/g)].map((m) => m[1]);

describe("Latin in English", () => {
  it("covers every lesson word, and only lesson words", () => {
    const ids = new Set(lessonWords.map((w) => w.id));
    expect(Object.keys(LESSON_WORDS_IN_ENGLISH).filter((id) => !ids.has(id))).toEqual([]);
    expect([...ids].filter((id) => !(id in LESSON_WORDS_IN_ENGLISH))).toEqual([]);
  });

  it("spells every Latin word the site knows with its long marks", () => {
    const texts = [
      ...WAVES.flatMap((w) => [...marked(w.text), ...w.words.flatMap(([, la, gloss]) => [la, ...marked(gloss)])]),
      ...TABLE_PAIRS.flatMap((t) => marked(t.latin)),
      ...FROZEN_VERBS.flatMap((g) => g.items.flatMap((v) => [...marked(v.la), ...marked(v.note)])),
      ...LATER_VERBS.flatMap((v) => marked(v.note)),
      ...PLURALS.flatMap((g) => marked(g.known)),
      ...GRAMMAR_RULES.flatMap((r) => [r.latin, r.english, r.today, r.slavic].flatMap(marked)),
      ...ASSIMILATION.flatMap((a) => marked(a.parts)),
      ...SUFFIXES.flatMap((x) => marked(x.examples)),
      ...SPELLINGS.flatMap((x) => marked(x.latin)),
      ...GRAMMAR_TERMS.flatMap((x) => marked(x.meaning)),
      ...ABBREVIATIONS.flatMap((x) => [...marked(x.latin), ...marked(x.meaning)]),
      ...PHRASES.flatMap((x) => [x.la, ...marked(x.note)]),
      ...THREE_LANGUAGES.flatMap((x) => marked(x.la)),
    ];
    const wrong: string[] = [];
    for (const t of texts) {
      for (const tok of annotate(t, lex)) {
        const a = tok.analysis ?? tok.readings?.[0];
        if (!tok.isWord || !a) continue;
        // a loose match means the long marks differ from the real form
        if (!(tok.readings ?? []).some((r) => full(r.form).toLowerCase() === tok.text.toLowerCase())) wrong.push(`${tok.text} (${full(a.form)}) in "${t}"`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("keeps the ending of each frozen verb form, and the form is what it says", () => {
    const keys: Record<string, string> = { "-ō": "pres.1sg", "-t": "pres.3sg", "-nt": "pres.3pl" };
    for (const g of FROZEN_VERBS) {
      for (const v of g.items) {
        expect(v.en.endsWith(v.ending), v.en).toBe(true);
        const latin = marked(v.la);
        if (latin.length === 1 && keys[g.ending]) {
          const readings = lex.analyze(latin[0]);
          if (readings.length) expect(readings.some((r) => r.key === keys[g.ending]), v.la).toBe(true);
        }
      }
    }
  });

  it("pairs each plural with its singular", () => {
    for (const g of PLURALS) {
      for (const [sg, pl] of g.pairs) {
        expect(sg.endsWith(g.sg), sg).toBe(true);
        expect(pl.endsWith(g.pl), pl).toBe(true);
        expect(sg.slice(0, -g.sg.length), sg).toBe(pl.slice(0, -g.pl.length));
      }
    }
  });

  it("links to words that exist", () => {
    for (const a of ASSIMILATION) if (a.from) expect(lex.get(a.from), a.from).toBeDefined();
    for (const x of THREE_LANGUAGES) expect(lex.get(x.word), x.word).toBeDefined();
  });

  it("finds the English words of lesson words and of Discover cards", () => {
    expect(quizWords("dormio")).toContain("dormitory");
    expect(quizWords("audio")).toContain("audience");
    expect(wordInEnglish("habeo")?.trap).toMatch(/have/);
  });

  it("accepts the Latin word inside an English word in any form, and nothing else", () => {
    let checked = 0;
    for (const e of lessonWords.filter((w) => !STORY_ONLY.has(w.id))) {
      for (const en of quizWords(e.id)) {
        const ex = deriveExercise({ k: buildKnowledge([1, 2, 3, 4]), lex, r: seeded(1) }, e, en);
        const lemma = e.kind === "verb" ? e.pp[0] : e.lemma;
        expect(ex.check(lemma).verdict, `${en} → ${lemma}`).toBe("correct");
        expect(ex.check(lemma.normalize("NFD").replace(/\p{M}/gu, "")).verdict, `${en} → ${lemma} without long marks`).toBe("correct");
        const other = e.id === "aqua" ? "terra" : "aqua";
        expect(ex.check(other).verdict, `${en} is not ${other}`).toBe("wrong");
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(60);
    const dorm = lessonWords.find((w) => w.id === "dormio")!;
    expect(deriveExercise({ k: buildKnowledge([1]), lex, r: seeded(1) }, dorm, "dormitory").check("dormit").verdict).toBe("correct");
  });

  it("accepts either word when two words gave the same English one", () => {
    const amica = lessonWords.find((w) => w.id === "amica")!;
    const ex = deriveExercise({ k: buildKnowledge([1, 2, 3]), lex, r: seeded(1) }, amica, "amicable", ["amicus"]);
    expect(ex.check("amīcus").verdict).toBe("correct");
    expect(ex.check("amīca").verdict).toBe("correct");
  });

  it("builds a practice round of English words from the learner's own words", () => {
    const p = newProgress();
    const words = lessonWords.filter((w) => !STORY_ONLY.has(w.id) && [1, 2].includes((w.source as { lesson: number }).lesson));
    const items = buildSession(p, { k: buildKnowledge([1, 2]), lex, r: seeded(7) }, { size: 10, kinds: ["derive"], vocab: words });
    expect(items.length).toBe(10);
    for (const ex of items) {
      expect(ex.kind).toBe("derive");
      const id = ex.words[0];
      expect(words.some((w) => w.id === id)).toBe(true);
      expect(wordInEnglish(id)?.from.en).toContain(ex.ask);
    }
  });
});
