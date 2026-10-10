import { describe, expect, it } from "vitest";
import { nuclei, respell, respellWord, stressIndex } from "../src/audio/pronounce";

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

describe("respelling for an Italian voice", () => {
  it("keeps c and g hard, v as w, ae as 'eye', and marks stress", () => {
    expect(respellWord("discipula", "it")).toBe("dischìpula");
    expect(respellWord("magistra", "it")).toBe("maghìstra");
    expect(respellWord("vīnum", "it")).toBe("uìnum");
    expect(respellWord("puellae", "it")).toBe("puèllai");
    expect(respellWord("Caesar", "it")).toBe("càisar");
    expect(respellWord("cīvis", "it")).toBe("chìuis");
    expect(respellWord("magnus", "it")).toBe("màngnus");
    expect(respellWord("est", "it")).toBe("est");
    expect(respellWord("dux", "it")).toBe("ducs");
  });

  it("respells whole sentences and drops ambiguity hints", () => {
    expect(respell("Puella in silvā ambulat.", "it")).toBe("puèlla in sìlua àmbulat.");
    expect(respell("Epistulam poētae#gen.sg legō.", "it")).toBe("epìstulam poètai lègo.");
  });
});

describe("respelling for a Spanish voice", () => {
  it("uses Spanish spelling for hard c, g and qu", () => {
    expect(respellWord("discipula", "es")).toBe("disquípula");
    expect(respellWord("puella", "es")).toBe("puéla");
    expect(respellWord("quī", "es")).toBe("cui");
  });
});

import { LESSONS } from "../src/content/lessons";
import { DECK_CARDS } from "../src/content/deck";
import { dictionaryForm } from "../src/latin/morph";

describe("samples (for reading)", () => {
  it("prints lesson sentences as the Italian voice will read them", () => {
    const lines = LESSONS.flatMap((l) => l.sentences.slice(0, 6).map((s) => `${s.la.padEnd(48)} -> ${respell(s.la, "it")}`));
    lines.push(...DECK_CARDS.slice(0, 12).map((c) => `${dictionaryForm(c.entry).padEnd(48)} -> ${respell(dictionaryForm(c.entry).replace(/, (m|f|n)\.$/, ""), "it")}`));
    console.log(lines.join("\n"));
  });
});
