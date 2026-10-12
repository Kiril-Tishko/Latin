import { describe, expect, it } from "vitest";
import { bareWord, cardWord, newWordsIn } from "../src/ui/answer-words";

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
});
