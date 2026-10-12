import { describe, expect, it } from "vitest";
import INDEX from "../src/audio/recorded-index.json";
import { audioKey } from "../src/audio/key";
import { fingerprint, fixedTexts } from "../src/audio/fixed";
import { LESSONS } from "../src/content/lessons";

describe("the recorded voice", () => {
  const texts = fixedTexts();
  const clips = INDEX.clips as unknown as Record<string, [string, number, number]>;

  it("has a recording of every fixed text, made from today's texts and pronunciation", () => {
    const missing = texts.filter((t) => !clips[t.key]).map((t) => t.latin);
    expect(missing, "run scripts/audio/record.py").toEqual([]);
    expect(INDEX.fingerprint, "the texts or their respelling changed: run scripts/audio/record.py again").toBe(fingerprint(texts));
  });

  it("finds a text however it is written: long marks, capitals, hints and punctuation aside", () => {
    expect(audioKey("Puella in silvā ambulat.")).toBe("puella in silva ambulat");
    expect(audioKey("«Poētae#gen.sg» epistulam legō!")).toBe("poetae epistulam lego");
    const first = LESSONS[0].sentences[0].la;
    expect(clips[audioKey(first.toUpperCase())]).toBeTruthy();
  });

  it("keeps each clip inside its pack, with a few clips to a pack", () => {
    const packs = INDEX.packs as Record<string, string>;
    for (const [key, [pack, start, len]] of Object.entries(clips)) {
      expect(packs[pack], key).toMatch(/^[a-z0-9-]+-[0-9a-f]{8}\.js$/);
      expect(start, key).toBeGreaterThan(0);
      expect(len, key).toBeGreaterThan(150);
      expect(len, key).toBeLessThan(20_000);
    }
    expect(Object.keys(packs).length).toBeGreaterThanOrEqual(8);
  });
});
