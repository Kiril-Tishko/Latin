import { describe, expect, it } from "vitest";
import { bareWord, cardWord, latinToSend, newWordsIn } from "../src/ui/answer-words";

describe("Ask Claude: words in questions and answers", () => {
  it("knows a word sent alone", () => {
    for (const q of ["aqua", "euge?", "gladius, gladiī", "любовь", "heart"]) expect(bareWord(q), q).toBe(true);
    for (const q of ["what is aqua?", "Why is it agricolae here?"]) expect(bareWord(q), q).toBe(false);
  });
  it("reads a word card's headline", () => {
    expect(cardWord("**gladius, gladiī (m) · sword**\n**Origin:** …")).toBe("gladius");
    expect(cardWord("**«euge»** — well done!")).toBe("euge");
    expect(cardWord("Just a sentence.")).toBeNull();
  });
  it("finds the words an answer marks as new", () => {
    expect(newWordsIn("Say «timeō, timēre» (new): to fear. Also «cor» (new word) = heart.")).toEqual(["timeō", "cor"]);
    expect(newWordsIn("«Amīcī#voc.pl» (new), and «ita» = yes")).toEqual(["Amīcī"]);
    expect(newWordsIn("«puella» = girl")).toEqual([]);
  });

  it("takes the Latin to put in a message: in bold first, else a sentence, else a word", () => {
    expect(latinToSend("**«Ignōsce! Labōrō.»** · Sorry! I'm working.\n- «ignōsce» (new) = forgive")).toBe("Ignōsce! Labōrō.");
    expect(latinToSend("Say «ita» for yes, or repeat the verb: «Ita, legō.»")).toBe("Ita, legō.");
    expect(latinToSend("Just «ita»: it means yes.")).toBe("ita");
    expect(latinToSend("**Yes:** «puellae#gen.sg» is the genitive.")).toBe("puellae");
    expect(latinToSend("No Latin here.")).toBeNull();
  });
});
