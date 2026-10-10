import { describe, expect, it } from "vitest";
import { english, generate, latinText, latinTokens, seeded, TEMPLATE_NAMES } from "../src/latin/generate";
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

  it("can build every template once all four lessons are known", () => {
    for (const t of TEMPLATE_NAMES) {
      let built = 0;
      for (let seed = 1; seed <= 60; seed++) if (generate(ALL, seeded(seed), [], [t])) built++;
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
