import { describe, expect, it } from "vitest";
import { english, generate, latinText, latinTokens, makesSense, seeded, TEMPLATE_NAMES } from "../src/latin/generate";
import { normalizeEnglish } from "../src/latin/english";
import { buildKnowledge } from "../src/trainer/knowledge";
import { SKILL_BY_ID } from "../src/latin/skills";

const ALL = buildKnowledge([1, 2, 3, 4]);

function englishAnswer(text: string) {
  return normalizeEnglish(text.replace(/ \((m|f)\)/g, ""));
}

describe("sentence generator", () => {
  it("only uses skills the learner has unlocked", () => {
    const k1 = buildKnowledge([1]);
    for (let seed = 1; seed <= 300; seed++) {
      const c = generate(k1, seeded(seed));
      expect(c).not.toBeNull();
      for (const s of c!.skills) expect(k1.skills.has(s), `${s} in ${latinText(latinTokens(c!, k1))}`).toBe(true);
    }
  });

  it("produces English whose pattern accepts its own translation", () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 800; seed++) {
      const c = generate(ALL, seeded(seed));
      if (!c) continue;
      const en = english(c, ALL);
      if (!en.pattern.test(englishAnswer(en.text))) failures.push(`${latinText(latinTokens(c, ALL))} -> ${en.text}`);
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it("every skill it reports exists", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const c = generate(ALL, seeded(seed));
      for (const s of c?.skills ?? []) expect(SKILL_BY_ID.has(s), s).toBe(true);
    }
  });

  it("can build every template once its lessons are known", () => {
    // the dative needs Lesson V's dō
    const FIVE = buildKnowledge([1, 2, 3, 4, 5]);
    for (const t of TEMPLATE_NAMES) {
      let built = 0;
      for (let seed = 1; seed <= 60; seed++) if (generate(t === "dat" ? FIVE : ALL, seeded(seed), [], [t])) built++;
      expect(built, t).toBeGreaterThan(20);
    }
  });

  it("aims at focus skills", () => {
    let hits = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const c = generate(ALL, seeded(seed), ["n2.abl.sg"]);
      if (c?.skills.includes("n2.abl.sg")) hits++;
    }
    expect(hits).toBeGreaterThan(80);
  });

  it("prints a sample (for reading)", () => {
    const lines: string[] = [];
    for (let seed = 1; seed <= 40; seed++) {
      const c = generate(ALL, seeded(seed * 7919));
      if (c) lines.push(`${latinText(latinTokens(c, ALL)).padEnd(52)} ${english(c, ALL).text}`);
    }
    console.log(lines.join("\n"));
  });
});

describe("sensible sentences (from the learner's own questions)", () => {
  const sensible = buildKnowledge([1, 2, 3, 4], [], 0);
  const many = (n = 1500) =>
    Array.from({ length: n }, (_, i) => generate(sensible, seeded(i + 1))).filter((c): c is NonNullable<typeof c> => !!c);

  it("teaches and learns only what can be learned: to write, to read; not to flee or to sleep", () => {
    const odd: string[] = [];
    for (const c of many()) {
      if (!c.inf || (c.verb.id !== "disco" && c.verb.id !== "doceo")) continue;
      if (["dormio", "fugito", "bibo", "habito", "specto", "video", "desidero", "sedeo"].includes(c.inf.verb.id)) odd.push(english(c, sensible).text);
      if (c.verb.id === "doceo" && c.obj && (c.obj.noun.tags.includes("divine") || !c.obj.noun.tags.includes("person"))) odd.push(english(c, sensible).text);
    }
    expect(odd).toEqual([]);
  });

  it("never puts a genitive between two nouns (Puella deae epistulam scrībit)", () => {
    const nounish = (r?: string) => !!r && /^(subj|obj|pred|pp)(-adj)?$/.test(r);
    const tangled: string[] = [];
    for (const c of many()) {
      const t = latinTokens(c, sensible);
      t.forEach((tok, i) => {
        if (!tok.role.endsWith("-poss")) return;
        const l = t[i - 1]?.role.replace("-adj", "");
        const r = t[i + 1]?.role.replace("-adj", "");
        if (nounish(l) && nounish(r) && l !== r) tangled.push(latinText(t));
      });
    }
    expect(tangled).toEqual([]);
  });

  it("gives a name only what suits a person: pulchra or timida Eurōpa, not big Europa", () => {
    const odd: string[] = [];
    for (const c of many()) {
      const nps = [c.subj.kind === "np" ? c.subj.np : null, c.obj, c.pp?.np, c.pred?.np].filter(Boolean);
      for (const np of nps) if (np!.noun.proper && np!.adj && !["pulcher", "timidus"].includes(np!.adj.id)) odd.push(english(c, sensible).text);
    }
    expect(odd).toEqual([]);
  });

  it("keeps gods on Olympus and people in school: every sentence makes sense", () => {
    const odd = many().filter((c) => !makesSense(c)).map((c) => english(c, sensible).text);
    expect(odd).toEqual([]);
    const rich = buildKnowledge([1, 2, 3, 4], [], 0);
    const lines: string[] = [];
    for (let seed = 2000; seed < 2040; seed++) {
      const c = generate(rich, seeded(seed), [], ["loc", "motion", "learnTo", "est"]);
      if (c) lines.push(`${latinText(latinTokens(c, rich)).padEnd(52)} ${english(c, rich).text}`);
    }
    console.log(lines.join("\n"));
  });
});

describe("an 'of' phrase only when the genitive is practised", () => {
  it("leaves it out of sensible sentences aimed at other rules, and makes it when aimed at it", () => {
    const k = { ...ALL, silly: 0 };
    let gen = 0;
    for (let i = 1; i <= 300; i++) {
      const c = generate(k, seeded(i), [i % 2 ? "n2.acc.sg" : "v.3sg"]);
      if (c?.skills.includes("s.gen")) gen++;
    }
    expect(gen).toBe(0);
    let aimed = 0;
    for (let i = 1; i <= 60; i++) if (generate(k, seeded(i), ["n1.gen.sg"])?.skills.includes("s.gen")) aimed++;
    expect(aimed).toBeGreaterThan(40);
  });
});
