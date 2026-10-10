import { describe, expect, it } from "vitest";
import { checkEnglish, checkLatin, slotsFor } from "../src/latin/check";
import { Clause, english, latinTokens, NP, swapRoles } from "../src/latin/generate";
import { buildKnowledge, fullLexicon } from "../src/trainer/knowledge";
import { NounEntry, VerbEntry } from "../src/latin/types";

const k = buildKnowledge([1, 2, 3, 4]);
const lex = fullLexicon();
const N = (id: string) => k.nouns.find((n) => n.id === id)! as NounEntry;
const V = (id: string) => k.verbs.find((v) => v.id === id)! as VerbEntry;
const np = (id: string, c: NP["case"], num: NP["num"] = "sg"): NP => ({ noun: N(id), case: c, num });

const teach: Clause = {
  subj: { kind: "np", np: np("magistra", "nom") },
  person: 3, num: "sg", verb: V("doceo"), neg: false,
  obj: np("puella", "acc"), skills: [],
};
const walkIn: Clause = {
  subj: { kind: "pron", person: 1, shown: false },
  person: 1, num: "sg", verb: V("ambulo"), neg: false,
  pp: { prep: "in", case: "abl", np: np("silva", "abl") }, skills: [],
};

const check = (c: Clause, answer: string) => checkLatin(answer, slotsFor(latinTokens(c, k), k), lex);

describe("Latin answers", () => {
  it("accepts any word order, case and missing long marks", () => {
    expect(check(teach, "Magistra puellam docet.").verdict).toBe("correct");
    expect(check(teach, "puellam magistra docet").verdict).toBe("correct");
    expect(check(teach, "Docet magistra puellam").verdict).toBe("correct");
  });

  it("explains a wrong case", () => {
    const r = check(teach, "Magistra puella docet");
    expect(r.verdict).toBe("wrong");
    expect(r.tokens[1].status).toBe("form");
    expect(r.issues[0].message).toContain("nominative");
    expect(r.issues[0].message).toContain("accusative");
    expect(r.issues[0].skill).toBe("n1.acc.sg");
  });

  it("explains a wrong verb ending", () => {
    const r = check(teach, "Magistra puellam doceō");
    expect(r.verdict).toBe("wrong");
    expect(r.issues[0].message).toContain("he / she / it");
  });

  it("tells a spelling slip from a wrong ending", () => {
    expect(check(teach, "Magistra puelam docet").verdict).toBe("almost");
    expect(check(teach, "Magistra puellam docit").verdict).toBe("wrong");
    expect(check(teach, "Magistra puellem docet").verdict).toBe("wrong");
  });

  it("reports missing and extra words", () => {
    const missing = check(teach, "Magistra docet");
    expect(missing.verdict).toBe("wrong");
    expect(missing.issues.some((i) => i.kind === "missing")).toBe(true);
    const extra = check(teach, "Magistra puellam et docet");
    expect(extra.issues.some((i) => i.kind === "extra")).toBe(true);
  });

  it("lets ego / tū be added or dropped", () => {
    expect(check(walkIn, "In silvā ambulō").verdict).toBe("correct");
    expect(check(walkIn, "Ego in silva ambulo").verdict).toBe("correct");
  });

  it("keeps prepositions next to their noun", () => {
    expect(check(walkIn, "Silvā in ambulō").verdict).toBe("almost");
    const wrongCase = check(walkIn, "In silvam ambulō");
    expect(wrongCase.verdict).toBe("wrong");
    expect(wrongCase.issues[0].message).toContain("ablative");
  });

  it("wants nōn before the verb", () => {
    const neg: Clause = { ...teach, neg: true };
    expect(check(neg, "Magistra puellam non docet").verdict).toBe("correct");
    expect(check(neg, "Non magistra puellam docet").verdict).toBe("almost");
  });

  it("gives a tip about the long ablative ending", () => {
    const r = check(walkIn, "In silva ambulo");
    expect(r.verdict).toBe("correct");
    expect(r.issues.some((i) => i.kind === "tip")).toBe(true);
  });
});

describe("English answers", () => {
  const en = english(teach, k);
  const swapped = english(swapRoles(teach)!, k);
  it("accepts articles, progressive and contractions", () => {
    for (const a of ["The teacher teaches the girl.", "A teacher teaches a girl", "the teacher is teaching the girl", "Teacher teaches girl"]) {
      expect(checkEnglish(a, en).verdict, a).toBe("correct");
    }
    const neg = english({ ...teach, neg: true }, k);
    for (const a of ["The teacher doesn't teach the girl", "the teacher does not teach the girl", "The teacher isn't teaching the girl"]) {
      expect(checkEnglish(a, neg).verdict, a).toBe("correct");
    }
  });

  it("spots swapped roles", () => {
    const r = checkEnglish("The girl teaches the teacher", en, swapped);
    expect(r.verdict).toBe("wrong");
    expect(r.issues[0].message).toContain("swapped");
  });

  it("notices a missing not", () => {
    const neg = english({ ...teach, neg: true }, k);
    expect(checkEnglish("The teacher teaches the girl", neg).issues[0].kind).toBe("missing");
  });

  it("accepts both readings of X est Y and possessives", () => {
    const est: Clause = {
      subj: { kind: "np", np: np("agricola", "nom") }, person: 3, num: "sg", verb: V("sum"), neg: false,
      pred: { np: np("poeta", "nom"), gender: "m", predFirst: true }, skills: [],
    };
    const e = english(est, k);
    expect(checkEnglish("The farmer is a poet", e).verdict).toBe("correct");
    expect(checkEnglish("The poet is a farmer", e).verdict).toBe("correct");
    const poss: Clause = { ...teach, obj: { ...np("epistula", "acc"), poss: np("poeta", "gen") } };
    const p = english(poss, k);
    expect(checkEnglish("The teacher teaches the poet's letter", p).verdict).toBe("correct");
    expect(checkEnglish("The teacher teaches the letter of the poet", p).verdict).toBe("correct");
  });
});
