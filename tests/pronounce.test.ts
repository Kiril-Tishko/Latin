import { describe, expect, it } from "vitest";
import { nuclei, respell, respellWord, stressIndex } from "../src/audio/pronounce";
import { DECK_CARDS } from "../src/content/deck";
import { LESSONS } from "../src/content/lessons";
import { dictionaryForm } from "../src/latin/morph";

const stressed = (w: string) => {
  const n = nuclei(w);
  const i = stressIndex(w);
  return i === null ? null : w.slice(n[i].start, n[i].end);
};

describe("Latin stress", () => {
  it("stresses a long penult, otherwise the antepenult", () => {
    expect(stressed("puella")).toBe("e"); // pu-EL-la: two consonants make it long
    expect(stressed("agricola")).toBe("i"); // a-GRI-co-la
    expect(stressed("discipula")).toBe("i");
    expect(nuclei("discipula").length).toBe(4);
    expect(stressIndex("discipula")).toBe(1);
    expect(stressed("labōrat")).toBe("ō"); // la-BŌ-rat
    expect(stressed("magistra")).toBe("i"); // ma-GIS-tra
    expect(stressed("epistulam")).toBe("i"); // e-PIS-tu-lam
    expect(stressed("gladius")).toBe("a"); // GLA-di-us
    expect(stressed("Eurōpa".toLowerCase())).toBe("ō");
  });

  it("stresses the first syllable of two-syllable words and nothing in one-syllable words", () => {
    expect(stressed("aquam")).toBe("a");
    expect(stressed("vīnum")).toBe("ī");
    expect(stressed("est")).toBeNull();
    expect(stressed("quī")).toBeNull();
  });

  it("treats qu, consonantal i and diphthongs correctly", () => {
    expect(nuclei("aqua").length).toBe(2);
    expect(nuclei("iuppiter").length).toBe(3);
    expect(nuclei("puellae").length).toBe(3);
    expect(stressed("puellae")).toBe("e");
    expect(stressed("patria")).toBe("a"); // PA-tri-a: tr does not lengthen
  });
});

describe("respelling for a Spanish voice", () => {
  it("keeps c and g hard, v as w, ae as 'eye', and marks the Latin stress with an acute accent", () => {
    expect(respellWord("discipula", "es")).toBe("disquípula");
    expect(respellWord("magistra", "es")).toBe("maguístra");
    expect(respellWord("vīnum", "es")).toBe("uínum");
    expect(respellWord("videō", "es")).toBe("uídeo");
    expect(respellWord("puella", "es")).toBe("puéla");
    expect(respellWord("puellae", "es")).toBe("puélai");
    expect(respellWord("Caesar", "es")).toBe("cáisar");
    expect(respellWord("cīvis", "es")).toBe("quíuis");
    expect(respellWord("magnus", "es")).toBe("mángnus");
    expect(respellWord("aqua", "es")).toBe("ácua");
    expect(respellWord("quī", "es")).toBe("cui");
    expect(respellWord("sanguis", "es")).toBe("sángüis");
    expect(respellWord("est", "es")).toBe("est");
    expect(respellWord("dux", "es")).toBe("ducs");
  });

  it("respells whole sentences and drops ambiguity hints", () => {
    expect(respell("Puella in silvā ambulat.", "es")).toBe("puéla in sílua ámbulat.");
    expect(respell("Epistulam poētae#gen.sg legō.", "es")).toBe("epístulam poétai légo.");
  });
});

describe("respelling for an Italian voice", () => {
  // an Italian voice read "uìdeo" as "u i accento grave deo"
  it("keeps the classical sounds but writes no accent marks", () => {
    expect(respellWord("videō", "it")).toBe("uideo");
    expect(respellWord("discipula", "it")).toBe("dischipula");
    expect(respellWord("magistra", "it")).toBe("maghistra");
    expect(respellWord("puellae", "it")).toBe("puellai");
    expect(respellWord("Caesar", "it")).toBe("caisar");
    expect(respellWord("cīvis", "it")).toBe("chiuis");
    expect(respellWord("magnus", "it")).toBe("mangnus");
    expect(respell("Epistulam poētae#gen.sg legō.", "it")).toBe("epistulam poetai lego.");
  });

  it("never puts an accent into any lesson sentence", () => {
    for (const l of LESSONS) for (const x of l.sentences) expect(respell(x.la, "it")).not.toMatch(/[àèìòùáéíóú]/);
  });
});

describe("samples (for reading)", () => {
  it("prints lesson sentences as the Spanish voice will read them", () => {
    const lines = LESSONS.flatMap((l) => l.sentences.slice(0, 6).map((s) => `${s.la.padEnd(48)} -> ${respell(s.la, "es")}`));
    lines.push(...DECK_CARDS.slice(0, 12).map((c) => `${dictionaryForm(c.entry).padEnd(48)} -> ${respell(dictionaryForm(c.entry).replace(/, (m|f|n)\.$/, ""), "es")}`));
    console.log(lines.join("\n"));
  });
});
