import { describe, expect, it } from "vitest";
import { emojiCodes, knownEmojiOnly, onlyEmoji, plainEmoji, showEmoji, withoutEmoji } from "../src/chat/emoji";
import { vetMessage, withMacrons } from "../src/chat/vet";
import { chatEntries, chatLexicon } from "../src/chat/words";
import { relativesFact } from "../src/content/english";
import { LESSONS } from "../src/content/lessons";
import { PARTS } from "../src/content/parts";
import { ROMAN_EMOJI } from "../src/content/roman-emoji";
import { generate, seeded, sensibleObject } from "../src/latin/generate";
import { declineNoun } from "../src/latin/morph";
import { full, NounEntry, VerbEntry } from "../src/latin/types";
import { buildKnowledge } from "../src/trainer/knowledge";
import { freeId, fromClaude, fromLine, lookupPrompt, ownEntry } from "../src/trainer/own";
import routinePy from "../scripts/nuntii-routine.py?raw";
import routineMd from "../scripts/messenger-routine.md?raw";

const lessonWords = LESSONS.flatMap((l) => l.words);
const taken = new Set(lessonWords.map((w) => w.id));
const seen = new Set(PARTS.flatMap((p) => p.skills));
const story = { origin: "From an old word.", history: "Lamps lit Roman homes.", from: { en: ["lantern"] }, kin: { en: [] }, examples: [{ la: "Lucernam portō.", en: "I carry a lamp." }] };
const card = (o: Record<string, unknown>) => ({ found: true, alt: [], ...story, ...o });

describe("words the learner adds", () => {
  it("builds every kind of word from Claude's card, with its story", () => {
    const lamp = fromClaude(card({ kind: "noun", dict: "lucerna, lucernae, f.", en: "lamp", tags: ["thing", "nonsense"] }), taken);
    if ("error" in lamp) throw new Error(lamp.error);
    expect(lamp.word.id).toBe("lucerna");
    expect(lamp.word.tags).toEqual(["thing"]);
    expect(lamp.entry.kind).toBe("noun");
    expect(full(declineNoun(lamp.entry as NounEntry)["acc.sg"]!)).toBe("lucernam");
    expect(lamp.entry.story?.history).toContain("Roman");
    expect("own" in lamp.entry.source).toBe(true);

    const soldier = fromClaude(card({ kind: "noun", dict: "mīles, mīlitis, m.", en: "soldier", tags: ["person"] }), taken);
    if ("error" in soldier) throw new Error(soldier.error);
    expect(full(declineNoun(soldier.entry as NounEntry)["acc.sg"]!)).toBe("mīlitem");

    const fight = fromClaude(card({ kind: "verb", dict: "pugnō, pugnāre, pugnāvī, pugnātum", en: "fight", tags: [], verb: { s: "fights", ing: "fighting", past: "fought", pp: "fought", trans: false, intrans: true, objects: [] } }), taken);
    if ("error" in fight) throw new Error(fight.error);
    expect((fight.entry as VerbEntry).conj).toBe("1");
    expect((fight.entry as VerbEntry).env.past).toBe("fought");

    const brave = fromClaude(card({ kind: "adj", dict: "fortis, forte", en: "brave", tags: ["person", "animal"] }), taken);
    if ("error" in brave) throw new Error(brave.error);
    expect(brave.entry.kind === "adj" && brave.entry.cls).toBe("3");

    const often = fromClaude(card({ kind: "fixed", dict: "saepe", en: "often", tags: [], role: "adv" }), taken);
    if ("error" in often) throw new Error(often.error);
    expect(often.word.practice).toBe(false);
  });

  it("refuses what the engine cannot build yet, and what Claude did not find", () => {
    const talk = fromClaude(card({ kind: "verb", dict: "loquor, loquī, locūtus sum", en: "speak", tags: [], verb: { deponent: true } }), taken);
    expect("error" in talk && talk.error).toMatch(/deponent/);
    expect(fromClaude({ found: false, why: "Not a Latin word." }, taken)).toEqual({ error: "Not a Latin word." });
    expect("error" in fromClaude(card({ kind: "noun", dict: "lucerna", en: "lamp", tags: [] }), taken)).toBe(true);
  });

  it("keeps ids apart: līber (free) next to liber (book)", () => {
    expect(freeId("liber", "adj", new Set(["liber"]))).toBe("liber-adj");
    expect(freeId("liber", "adj", new Set(["liber", "liber-adj"]))).toBe("liber-adj2");
    const free = fromClaude(card({ kind: "adj", dict: "līber, lībera, līberum", en: "free", tags: ["person"] }), new Set(["liber"]));
    expect("word" in free && free.word.id).toBe("liber-adj");
  });

  it("reads a word typed in by hand, for reading only", () => {
    const res = fromLine("hasta, hastae, f. = spear", taken);
    if ("error" in res) throw new Error(res.error);
    expect(res.word.kind).toBe("noun");
    expect(res.word.practice).toBe(false);
    const v = fromLine("currō, currere, cucurrī, cursum — to run", taken);
    expect("word" in v && v.word.kind === "verb" && v.word.en).toBe("run");
    expect("error" in fromLine("hasta", taken)).toBe(true);
  });

  it("asks Claude with the tags the sentence maker reads, and the learner's words", () => {
    const prompt = lookupPrompt("sword", ["puella", "amō"]);
    expect(prompt).toContain('They typed: "sword"');
    expect(prompt).toContain("- weapon:");
    expect(prompt).toContain("puella, amō");
  });

  it("gives Claude an added word's story as facts", () => {
    const lamp = ownEntry({ id: "lucerna", kind: "noun", dict: "lucerna, lucernae, f.", en: "lamp", tags: ["thing"], story, practice: true, added: 0 });
    if ("error" in lamp) throw new Error(lamp.error);
    expect(relativesFact(lamp)).toContain("Lamps lit Roman homes.");
    expect(relativesFact(lamp)).toContain("lantern");
  });

  it("uses an added noun in practice, with verbs that suit it", () => {
    const lamp = fromClaude(card({ kind: "noun", dict: "lucerna, lucernae, f.", en: "lamp", tags: ["thing"] }), taken);
    if ("error" in lamp) throw new Error(lamp.error);
    const k = buildKnowledge([1, 2, 3, 4], [lamp.entry], 0, seen);
    const lex = chatLexicon(chatEntries([...lessonWords, lamp.entry]));
    let used = 0;
    const r = seeded(11);
    for (let i = 0; i < 2500 && used < 6; i++) {
      const c = generate(k, r, ["n1.acc.sg"], ["svo"]);
      if (!c || c.obj?.noun.id !== "lucerna") continue;
      used++;
      expect(sensibleObject(k, c.verb, lamp.entry as NounEntry)).toBe(true);
      expect(["lego", "scribo", "audio", "doceo", "voco", "bibo"]).not.toContain(c.verb.id);
    }
    expect(used).toBeGreaterThan(0);
    expect(lex.analyze("lucernam").length).toBeGreaterThan(0);
  });

  it("gives an added verb only the objects Claude named, and none when it named none", () => {
    const eat = fromClaude(card({ kind: "verb", dict: "edō, edere, ēdī, ēsum", en: "eat", tags: [], verb: { s: "eats", ing: "eating", past: "ate", pp: "eaten", trans: true, intrans: true, objects: ["food"] } }), taken);
    const fight = fromClaude(card({ kind: "verb", dict: "pugnō, pugnāre, pugnāvī, pugnātum", en: "fight", tags: [], verb: { trans: true, intrans: true, objects: [] } }), taken);
    if ("error" in eat || "error" in fight) throw new Error("not built");
    const k = buildKnowledge([1, 2, 3, 4], [eat.entry, fight.entry], 0, seen);
    const book = lessonWords.find((w) => w.id === "liber") as NounEntry;
    expect(sensibleObject(k, eat.entry as VerbEntry, book)).toBe(false);
    expect(sensibleObject(k, fight.entry as VerbEntry, book)).toBe(false);
  });
});

describe("the Roman emoji", () => {
  it("are stored as codes and shown as the font's characters", () => {
    const lupa = ROMAN_EMOJI.find((e) => e.code === "lupa")!;
    expect(showEmoji("Salvē :lupa:!")).toBe(`Salvē ${lupa.char}!`);
    expect(emojiCodes(`Salvē ${lupa.char}!`)).toBe("Salvē :lupa:!");
    expect(plainEmoji("Salvē :lupa:")).toBe("Salvē 🐺");
    expect(knownEmojiOnly("Salvē :toga: :lupa:")).toBe("Salvē :lupa:");
    expect(withoutEmoji("Salvē:lupa:").trim()).toBe("Salvē");
    expect(onlyEmoji(":laurus: :lupa:")).toBe(true);
    expect(onlyEmoji("😊🍷")).toBe(true);
    expect(onlyEmoji("Salvē :lupa:")).toBe(false);
    expect(new Set(ROMAN_EMOJI.map((e) => e.char)).size).toBe(ROMAN_EMOJI.length);
  });

  it("are not words to the messenger's checks, and keep their codes", () => {
    const lex = chatLexicon(chatEntries(lessonWords));
    expect(vetMessage("Salvē :aquila: :gladius:", lex, seen).unknown).toEqual([]);
    expect(withMacrons("Salve :lucerna: in silva", lex)).toBe("Salvē :lucerna: in silvā");
  });

  it("are the same in the phone routine's helper", () => {
    for (const e of ROMAN_EMOJI) {
      expect(routinePy).toContain(`"${e.code}": "${e.fallback}"`);
      expect(routineMd).toContain(`"${e.code}": "${e.fallback}"`);
    }
  });
});
