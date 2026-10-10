import { describe, expect, it } from "vitest";
import { annotate, Lexicon } from "../src/latin/analyze";
import { LESSONS } from "../src/content/lessons";
import { SKILL_BY_ID } from "../src/latin/skills";

const lex = new Lexicon(LESSONS.flatMap((l) => l.words));
// Words that appear in the videos but are not taught as vocabulary.
const OUTSIDE = new Set(["vēnī", "vīdī", "vīcī", "brūte", "vēritās", "nauseam", "iuppiter", "olympum"]);

function unknownWords(text: string): string[] {
  return annotate(text, lex)
    .filter((t) => t.isWord && !t.analysis && !OUTSIDE.has(t.text.toLowerCase()))
    .map((t) => t.text);
}

describe("lesson content", () => {
  it("uses only words the engine knows, spelled with the right long marks", () => {
    const problems: string[] = [];
    for (const l of LESSONS) {
      const texts = [
        ...l.sentences.map((s) => s.la),
        ...(l.story?.lines.map((s) => s.la) ?? []),
        ...l.rules.flatMap((r) => r.examples.map((e) => e.la)),
        ...l.rules.flatMap((r) => [r.what, r.how, r.when].flatMap((t) => [...t.matchAll(/«([^»]+)»/g)].map((m) => m[1]))),
      ];
      for (const t of texts) {
        const unknown = unknownWords(t);
        if (unknown.length) problems.push(`Lesson ${l.n}: "${t}" -> ${unknown.join(", ")}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("only unlocks skills that exist", () => {
    for (const l of LESSONS) for (const s of l.skills) expect(SKILL_BY_ID.has(s), s).toBe(true);
  });

  it("reads ambiguous endings from context and hints", () => {
    const pick = (text: string, word: string) =>
      annotate(text, lex).find((t) => t.text.toLowerCase() === word)?.analysis?.key;
    expect(pick("In silvā ambulō.", "silvā")).toBe("abl.sg");
    expect(pick("In silvam ambulō.", "silvam")).toBe("acc.sg");
    expect(pick("Epistulam poētae#gen.sg legō.", "poētae")).toBe("gen.sg");
    expect(pick("Puellae#nom.pl fugitant.", "puellae")).toBe("nom.pl");
    expect(pick("Magistra magna discipulam docet.", "magna")).toBe("nom.sg");
    expect(pick("Magistra magnam discipulam docet.", "magnam")).toBe("acc.sg");
    expect(pick("Poēta scrībit.", "scrībit")).toBe("pres.3sg");
    expect(pick("Agricola labōrat.", "agricola")).toBe("nom.sg");
  });
});
