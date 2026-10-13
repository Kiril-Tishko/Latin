import { describe, expect, it } from "vitest";
import { checkAnswer, engineFacts } from "../src/latin/facts";
import { fullLexicon, skillsUpTo } from "../src/trainer/knowledge";

const lex = fullLexicon();
const known = skillsUpTo([1, 2, 3, 4]);

// Answers Claude really gave the learner (from their saved conversations).
const TIMIDA = `Good question! Let's build it from what you know.

"The timid farmer watches" = «Timida agricola spectat.»

**Adjectives follow the noun's case, and also its gender.** «agricola» ends in -a but is masculine, so you might expect «timidus». Still, it is a first-declension noun, so the case endings are the -a ones: the adjective takes the same ending, «timida» (nominative), just as «agricola» does.

- The verb is «spectat», with -t for he / she / it, because the farmer is one person.
- If the farmer is the object, both words take -am: «timidam agricolam spectō» = "I watch the timid farmer."

Russian works the same way: «трусливый фермер» (m.) agrees in gender.`;

const DOCERE = `**"Learn to teach" means you are studying how to be a teacher.**

Russian and Ukrainian work the same way, with a verb plus an infinitive:
- Russian: «учишься учить» (you are learning to teach)

In Latin, «Docēre discis.» breaks down like this:
- «discis» = "you learn" (the main verb, with **-s** for "you")
- «docēre» = "to teach" (the infinitive, with **-re**)`;

describe("checking Claude's answers with the grammar engine", () => {
  it("catches the agreement mistake Claude made (timida agricola) and gives the right forms", () => {
    const found = checkAnswer(TIMIDA, lex);
    const agreement = found.filter((f) => f.kind === "agreement").map((f) => f.message);
    expect(agreement).toHaveLength(2);
    expect(agreement[0]).toContain("«agricola» is masculine");
    expect(agreement[0]).toContain("«Timidus agricola spectat.»");
    expect(agreement[1]).toContain("«timidum»");
  });

  it("leaves a correct answer alone, Russian in guillemets included", () => {
    expect(checkAnswer(DOCERE, lex)).toEqual([]);
    expect(checkAnswer("«Agricola timidus spectat.» and «Poēta pulcher est.» and «Silva magna et pulchra est.»", lex)).toEqual([]);
  });

  it("takes a plural adjective with two subjects joined by et, masculine if one of them is", () => {
    expect(checkAnswer("«Agricola et taurus timidī sunt.» «Puella et amīca timidae sunt.» «Poēta et puella laetī sunt.»", lex)).toEqual([]);
    expect(checkAnswer("«Agricola et taurus timidae sunt.»", lex).some((f) => f.kind === "agreement")).toBe(true);
  });

  it("does not flag Latin quoted as a wrong example, word pieces or new words", () => {
    expect(checkAnswer("It is «agricola timidus», not «timida agricola».", lex)).toEqual([]);
    expect(checkAnswer("You wrote «Ego discis», but the ending is -ō.", lex)).toEqual([]);
    expect(checkAnswer("Take «fugitā-» and add «-t».", lex)).toEqual([]);
  });

  it("catches a verb that does not match its subject, and a preposition with the wrong case", () => {
    expect(checkAnswer("«Puella dormiō.»", lex)[0].message).toContain("«Puella dormit.»");
    expect(checkAnswer("«Ego discis.»", lex)[0].message).toContain("«discō»");
    expect(checkAnswer("«Ad silvā ambulō.»", lex)[0].message).toContain("«ad silvam»");
    // calling someone is not a subject
    expect(checkAnswer("«Puella, legis?»", lex)).toEqual([]);
    // with I am / you are, the noun is what one is: "I am a student"
    expect(checkAnswer("«Discipulus sum.» «Poēta es.» «Ego discipula sum.»", lex)).toEqual([]);
    // but a noun with "is" is its subject: one student is, several are
    expect(checkAnswer("«Discipulus est.»", lex)).toEqual([]);
  });

  it("notes long marks missing from an ending, not from a stem", () => {
    expect(checkAnswer("«Tū dormis.»", lex).map((f) => f.message)).toEqual(["Long marks: «dormīs»."]);
    expect(checkAnswer("«Europa ambulat.»", lex)).toEqual([]);
  });
});

describe("facts sent with a question", () => {
  it("tell Claude which group a verb belongs to (no guessing the infinitive)", () => {
    const facts = engineFacts([{ text: "Ego disco sidet. would this be write if i am talking about myself?", mixed: true }], lex, known);
    expect(facts).toContain("«disco» (spelled «discō»)");
    expect(facts).toContain("the -ere group, short e");
    expect(facts).toContain("discere");
  });

  it("say that agricola is masculine and how its adjective goes", () => {
    const facts = engineFacts([{ text: "what if it's timid agricola watches?", mixed: true }], lex, known);
    expect(facts).toContain("noun, masculine");
    expect(facts).toContain("agricola magnus");
  });

  it("list every reading of an ambiguous form, and mark the ones not taught yet", () => {
    const facts = engineFacts([{ text: "how do i know here that it's not goddess's girl?", mixed: true }, { text: "Puella deae epistulam scrībit.", mixed: true }], lex, known);
    expect(facts).toMatch(/«deae», from dea: can be [^\n]*genitive singular[^\n]*nominative plural/);
    expect(facts).toContain("dative singular (to / for), not taught yet");
  });

  it("skip English words that only look like Latin, and send nothing without Latin", () => {
    expect(engineFacts([{ text: "Can you explain the video about Roman history?", mixed: true }], lex, known)).toBe("");
    expect(engineFacts([{ text: "This exercise is from the video of Lesson 2.", mixed: true }, { text: "In Latin, «videō» means I see.", quoted: true }], lex, known)).toContain("«videō»");
  });
});

describe("the learner's own words, quoted back", () => {
  it("are not checked as if Claude had written them", () => {
    expect(checkAnswer("Back to your exercise: you have «fugita», and the ending is missing.", lex)).toEqual([]);
    expect(checkAnswer("Your answer «leges» used the pattern of «docēs».", lex)).toEqual([]);
  });
});

describe("facts for a question about where a word comes from", () => {
  it("carry the extra lines given for each word (the site's checked relatives)", () => {
    const facts = engineFacts([{ text: "where does agricola come from?", mixed: true }], lex, known, 10, (e) => (e.id === "agricola" ? "Relatives (checked): borrowed from Latin: English agriculture." : undefined));
    expect(facts).toContain("noun, masculine");
    expect(facts).toContain("Relatives (checked): borrowed from Latin: English agriculture.");
  });
});
