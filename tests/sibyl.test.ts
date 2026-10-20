import { describe, expect, it } from "vitest";
import { rollAhead } from "../src/chat/brief";
import { calendarBlock } from "../src/chat/calendar";
import { refreshLives, specOf } from "../src/chat/engine";
import { applyFates, Fate, withFates } from "../src/chat/lives";
import { mergeWorld, Meta, Msg, newMeta, newThread, Thread } from "../src/chat/model";
import { PromptCtx } from "../src/chat/prompts";
import { keepLeaf, leafDay, leafOf, leafState, leavesOf, SIBYL_ID, sibylPrompt, toldIn, writeLeaf } from "../src/chat/sibyl";
import { allowedWords, chatEntries, chatLexicon, nameEntry } from "../src/chat/words";
import { LESSONS } from "../src/content/lessons";
import { PARTS } from "../src/content/parts";
import { PEOPLE } from "../src/content/people";
import { seeded } from "../src/latin/generate";

const HOUR = 3600_000;
const NOW = Date.UTC(2026, 9, 20, 9, 0);
const entries = chatEntries(LESSONS.flatMap((l) => l.words), [nameEntry("Kiril", "Kiril (your name)", "m")]);
const lex = chatLexicon(entries);
const SEEN = new Set(PARTS.filter((p) => Number(p.id) <= 3.2).flatMap((p) => p.skills));
const ctx: PromptCtx = { now: NOW, me: { name: "Kiril", g: "m" }, tz: "Europe/Kyiv", words: allowedWords(entries, SEEN), seen: SEEN, calendar: calendarBlock(NOW) };

const RAW = {
  who: "gaius",
  lines: [
    { la: "Agricola dormit…", en: "The farmer sleeps…" },
    { la: "taurus magnus vīnum bibit!", en: "a big bull drinks the wine!" },
  ],
  fate: "A neighbour's bull breaks into Gaius's cellar and drinks a whole jar of new wine.",
  mood: "furious",
  after: 14,
  hours: 20,
  public: true,
  signs: ["taurus"],
};

const fate = (over: Partial<Fate> = {}): Fate => ({ id: "folium-20261020", who: "gaius", en: RAW.fate, mood: "furious", at: NOW + 14 * HOUR, hours: 20, public: true, signs: ["taurus"], ...over });
const withFate = (f: Fate): Meta => ({ ...newMeta(), world: { updatedAt: NOW, fates: [f] } });
const msg = (id: string, from: string, la: string, at: number): Msg => ({ id, from, la, at });

describe("the Sibyl's leaves", () => {
  it("asks the Sibyl for one thing to come for one friend, a riddle in the learner's words", () => {
    const p = sibylPrompt(newMeta(), ctx, [fate()]);
    expect(p).toContain("Sibyl of Cumae");
    for (const person of PEOPLE) expect(p).toContain(`id "${person.id}"`);
    expect(p).toContain("EARLIER LEAVES");
    expect(p).toContain("Use ONLY the words and forms listed here");
    expect(p).toContain('"signs"');
    expect(p).toMatch(/never grief, illness, death/i);
  });

  it("reads a leaf: a real friend, one to three lines, the hours kept within bounds", () => {
    const l = leafOf(RAW)!;
    expect(l.who).toBe("gaius");
    expect(l.lines.length).toBe(2);
    expect(l.signWords).toEqual(["taurus"]);
    expect(leafOf({ ...RAW, who: "nero" })).toBeNull();
    expect(leafOf({ ...RAW, lines: [] })).toBeNull();
    expect(leafOf({ ...RAW, fate: "" })).toBeNull();
    expect(leafOf({ ...RAW, after: 500, hours: -3 })).toMatchObject({ after: 36, hours: 4 });
    expect(leafOf({ ...RAW, lines: Array.from({ length: 6 }, () => RAW.lines[0]) })!.lines.length).toBe(3);
  });

  it("writes a leaf with long marks put back, its signs the words that name what happens", async () => {
    const leaf = (await writeLeaf(newMeta(), ctx, { ask: async <T,>() => RAW as T, opts: {}, lex, r: seeded(2) }))!;
    expect(leaf.lines[1].la).toBe("taurus magnus vīnum bibit!");
    expect(leaf.signs).toEqual([lex.analyze("taurus")[0].entry.id]);
    // no signs given (or none the learner knows): the nouns of its lines
    const bare = (await writeLeaf(newMeta(), ctx, { ask: async <T,>() => ({ ...RAW, signs: ["leo"] }) as T, opts: {}, lex }))!;
    expect(bare.signs.sort()).toEqual([lex.analyze("agricola")[0].entry.id, lex.analyze("taurus")[0].entry.id, lex.analyze("vīnum")[0].entry.id].sort());
    expect(await writeLeaf(newMeta(), ctx, { ask: async <T,>() => ({}) as T, opts: {}, lex })).toBeNull();
  });

  it("keeps a caught leaf as the day's page of the book, its fate hours ahead", () => {
    const leaf = { ...leafOf(RAW)!, signs: ["taurus"] };
    const { msg: m, fate: f } = keepLeaf(leaf, NOW);
    expect(m).toMatchObject({ id: "folium-20261020", from: SIBYL_ID, la: "Agricola dormit…\ntaurus magnus vīnum bibit!", at: NOW });
    expect(f).toMatchObject({ id: m.id, who: "gaius", at: NOW + 14 * HOUR, hours: 20, public: true, signs: ["taurus"] });
    expect(leavesOf({ ...newThread(SIBYL_ID, "channel"), messages: [m, msg("x", "sibylla", "x", 1)] })).toEqual([m]);
  });

  it("blows a leaf on about two days in five, the first one at once, never twice a day nor over two waiting fates", () => {
    const meta = newMeta();
    expect(leafDay(NOW, [], meta)).toBe(true);
    const today = msg("folium-20261020", SIBYL_ID, "x", NOW - HOUR);
    expect(leafDay(NOW, [today], meta)).toBe(false);
    const old = [msg("folium-20261001", SIBYL_ID, "x", NOW - 19 * 24 * HOUR)];
    const days = Array.from({ length: 200 }, (_, i) => leafDay(NOW + i * 24 * HOUR, old, meta)).filter(Boolean).length;
    expect(days).toBeGreaterThan(55);
    expect(days).toBeLessThan(105);
    const two: Meta = { ...meta, world: { updatedAt: 0, fates: [fate({ id: "a" }), fate({ id: "b" })] } };
    expect(Array.from({ length: 30 }, (_, i) => leafDay(NOW + i * 24 * HOUR, old, two)).some(Boolean)).toBe(false);
  });

  it("makes a fate their life at its hour, once: a happening, a memory, and the timeline when the neighbours know", () => {
    const meta = withFate(fate());
    expect(applyFates(meta, NOW + 13 * HOUR)).toEqual([]);
    expect(meta.life.gaius?.event).toBeUndefined();
    const memories = applyFates(meta, NOW + 15 * HOUR);
    expect(meta.life.gaius).toMatchObject({ event: RAW.fate, eventAt: NOW + 14 * HOUR, eventUntil: NOW + 34 * HOUR, mood: "furious", public: true });
    expect(memories.map((m) => m.who)).toEqual(["gaius"]);
    expect(meta.world?.fates?.[0].done).toBe(NOW + 15 * HOUR);
    expect(meta.world?.timeline?.map((e) => e.en)).toEqual([`Gāius: ${RAW.fate}`]);
    // once only
    expect(applyFates(meta, NOW + 16 * HOUR)).toEqual([]);
    expect(meta.world?.timeline?.length).toBe(1);
  });

  it("lets a fate that came and went while the page was closed be their history", () => {
    const meta = withFate(fate({ public: false }));
    const memories = applyFates(meta, NOW + 3 * 24 * HOUR);
    expect(meta.life.gaius?.event).toBeUndefined();
    expect(meta.world?.timeline?.[0]).toMatchObject({ at: NOW + 14 * HOUR, who: ["gaius"] });
    expect(memories[0]).toMatchObject({ who: "gaius", kind: "news" });
  });

  it("comes first when their lives are rolled on, and the moods after it keep it going", () => {
    const meta = withFate(fate());
    refreshLives(meta, ["gaius"], NOW + 15 * HOUR, seeded(3));
    expect(meta.life.gaius?.event).toBe(RAW.fate);
    refreshLives(meta, ["gaius"], NOW + 30 * HOUR, seeded(4));
    expect(meta.life.gaius?.event).toBe(RAW.fate);
  });

  it("is in the lives the phone routine's brief rolls ahead, from its hour", () => {
    const meta = withFate(fate());
    const lives = withFates(rollAhead(specOf("gaius", meta)!, undefined, NOW, 48, seeded(5)), "gaius", meta, NOW, 48);
    const at = lives.find((l) => l.event === RAW.fate);
    expect(at?.from).toBe(NOW + 14 * HOUR);
    expect(lives.filter((l) => l.from > at!.from && l.from < NOW + 34 * HOUR)).toEqual([]);
    expect(lives.map((l) => l.from)).toEqual([...lives.map((l) => l.from)].sort((a, b) => a - b));
  });

  it("merges fates from two devices, the one made real winning", () => {
    const a = { updatedAt: 1, fates: [fate({ done: NOW })] };
    const b = { updatedAt: 2, fates: [fate(), fate({ id: "folium-20261022" })] };
    expect(mergeWorld(a, b)?.fates?.map((f) => [f.id, f.done])).toEqual([
      ["folium-20261020", NOW],
      ["folium-20261022", undefined],
    ]);
  });

  it("finds the message that tells of it: from its person, after its hour, with one of its words in any form", () => {
    const f = fate({ signs: [lex.analyze("taurus")[0].entry.id] });
    const chat = (id: string, msgs: Msg[]): Thread => ({ ...newThread(id, "dm"), messages: msgs });
    const threads = [
      chat("gaius", [msg("m1", "gaius", "Taurus magnus!", f.at - HOUR), msg("m2", "gaius", "Heu!", f.at + HOUR), msg("m3", "gaius", "Taurum videō!!", f.at + 2 * HOUR)]),
      chat("amici", [msg("g1", "marcus", "Taurus?", f.at + HOUR), msg("g2", "gaius", "Taurus vīnum bibit 😡", f.at + 3 * HOUR)]),
    ];
    expect(toldIn(f, threads, lex)?.msg.id).toBe("m3");
    expect(toldIn(f, [threads[1]], lex)).toMatchObject({ chat: "amici", msg: { id: "g2" } });
    expect(toldIn({ ...f, signs: [] }, threads, lex)).toBeNull();
    // where a leaf stands
    expect(leafState(f, threads, lex, f.at - HOUR, NOW).state).toBe("waits");
    expect(leafState(f, threads, lex, f.at + 2.5 * HOUR, NOW)).toMatchObject({ state: "told", msg: { id: "m3" } });
    expect(leafState(f, [chat("gaius", [])], lex, f.at + HOUR, NOW).state).toBe("coming");
    expect(leafState(f, [chat("gaius", [])], lex, f.at + 40 * HOUR, NOW)).toMatchObject({ state: "known", who: "gaius" });
    expect(leafState(undefined, threads, lex, NOW + 5 * 24 * HOUR, NOW).state).toBe("known");
  });
});
