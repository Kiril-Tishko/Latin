import { describe, expect, it } from "vitest";
import { ACTA_ID, actaKey, actaPicture, actaPrompt, BOARD_GAP, boardDue, boardMemories, boardOf, earlierBoards, firstEditions, itemsOf, linesOf, pastBoards, writeActa } from "../src/chat/acta";
import { calendarBlock, calendarWords } from "../src/chat/calendar";
import { Msg, newMeta, newThread, preview } from "../src/chat/model";
import { natureOf } from "../src/chat/nature";
import { PromptCtx } from "../src/chat/prompts";
import { allowedWords, calendarEntry, chatEntries, chatLexicon, nameEntry } from "../src/chat/words";
import { LESSONS } from "../src/content/lessons";
import { PARTS } from "../src/content/parts";
import { PEOPLE } from "../src/content/people";
import { seeded } from "../src/latin/generate";

const NOW = Date.UTC(2026, 9, 12, 7, 30);
// as on the page: the learner's words, the chat words, the names, and the names the day brings (Augustālia)
const entries = chatEntries(LESSONS.flatMap((l) => l.words), [nameEntry("Kiril", "Kiril (your name)", "m"), ...calendarWords(NOW).map(calendarEntry)]);
const lex = chatLexicon(entries);
const SEEN = new Set(PARTS.filter((p) => Number(p.id) <= 3.2).flatMap((p) => p.skills));
const ctx: PromptCtx = { now: NOW, me: { name: "Kiril", g: "m" }, tz: "Europe/Kyiv", words: allowedWords(entries, SEEN), seen: SEEN, calendar: calendarBlock(NOW) };

const BOARD = {
  items: [
    { kind: "day", title: "Augustālia", titleEn: "The Augustalia", lines: [{ la: "Hodiē Augustālia!", en: "Today is the Augustalia!" }, { la: "Agricola vīnum bibit.", en: "The farmer drinks wine." }] },
    { kind: "friends", title: "Lūcius", titleEn: "Lucius", lines: [{ la: "Lūcius nōn dormit.", en: "Lucius does not sleep." }, { la: "Poēta epistulam scribit.", en: "The poet writes a letter." }] },
    { kind: "notice", title: "Taurus", titleEn: "A bull", lines: [{ la: "Agricola taurum dēsīderat.", en: "A farmer misses his bull." }, { la: "Taurus magnus est.", en: "The bull is big." }] },
    { kind: "gossip", title: "", titleEn: "", lines: [{ la: "", en: "" }] },
  ],
};

describe("the Ācta Diurna", () => {
  it("asks for today's board from the day in Rome, the friends' lives and the learner's words", () => {
    const meta = newMeta();
    const p = actaPrompt(meta, ctx, { boards: ["- 11.10.: The wine of the Meditrinalia: …"] });
    expect(p).toContain("Ācta Diurna");
    expect(p).toContain("THE DAY IN ROME");
    expect(p).toContain("Augustālia");
    for (const person of PEOPLE) expect(p).toContain(person.name);
    expect(p).toContain("EARLIER BOARDS");
    expect(p).toContain("Pompeii");
    // the strict language block, written as a board, not as texting
    expect(p).toContain("Use ONLY the words and forms listed here");
    expect(p).not.toContain("Real texting");
    expect(p).toContain('"items"');
  });

  it("keeps known kinds, at most five items of three lines, and drops empty ones", () => {
    const items = itemsOf(BOARD);
    expect(items.map((x) => x.kind)).toEqual(["day", "friends", "notice"]);
    expect(itemsOf({ items: Array.from({ length: 8 }, () => BOARD.items[0]) }).length).toBe(5);
    expect(itemsOf({ items: [{ kind: "omen", title: "X", lines: Array.from({ length: 6 }, () => ({ la: "Taurus dormit.", en: "x" })) }] })[0].lines.length).toBe(3);
    expect(itemsOf(null)).toEqual([]);
    expect(itemsOf({ items: [{ kind: "nonsense", title: "Urbs", lines: [{ la: "Poēta legit.", en: "The poet reads." }] }] })[0].kind).toBe("city");
  });

  it("writes the board as posts of the day: vetted lines, long marks put back, a rewrite asked for what slips", async () => {
    const prompts: string[] = [];
    const ask = async <T,>(prompt: string): Promise<T> => {
      prompts.push(prompt);
      // the rewrite: "est" is a rule this learner has not met (anything else asked for comes back as it was)
      if (prompt.includes("break the learner's limits")) {
        const bad = [...prompt.matchAll(/^\d+\. «(.+?)» \((.*?)\)\. Problems/gm)].map((m) => ({ la: m[1], en: m[2] }));
        return { messages: bad.map((b) => (b.la === "Taurus magnus est." ? { la: "Taurus magnus fugitat.", en: "The big bull runs away." } : b)) } as T;
      }
      return BOARD as T;
    };
    const posts = await writeActa(newMeta(), ctx, { ask, opts: {}, lex, r: seeded(1) });
    expect(posts.map((m) => m.id)).toEqual(["acta-20261012-0", "acta-20261012-1", "acta-20261012-2"]);
    expect(posts.every((m) => m.from === ACTA_ID && m.title)).toBe(true);
    expect(posts[1].la).toBe("Lūcius nōn dormit.\nPoēta epistulam scrībit.");
    expect(linesOf(posts[2])).toEqual([
      { la: "Agricola taurum dēsīderat.", en: "A farmer misses his bull." },
      { la: "Taurus magnus fugitat.", en: "The big bull runs away." },
    ]);
    expect(prompts.length).toBe(2);
    expect(posts[1].at).toBeGreaterThan(posts[0].at);
    expect(preview(posts[0])).toBe("Augustālia");
  });

  it("knows the day's board and the earlier ones, by the Roman day", async () => {
    expect(actaKey(NOW)).toBe("20261012");
    // after midnight in Rome it is the next day, although not yet in London
    expect(actaKey(Date.UTC(2026, 9, 12, 22, 30))).toBe("20261013");
    const ask = async <T,>(): Promise<T> => BOARD as T;
    const yesterday = await writeActa(newMeta(), { ...ctx, now: NOW - 86_400_000 }, { ask, opts: {}, lex });
    const today = await writeActa(newMeta(), ctx, { ask, opts: {}, lex });
    const t = { ...newThread(ACTA_ID, "channel"), messages: [...yesterday, ...today] };
    expect(boardOf(t, actaKey(NOW)).map((m) => m.id)).toEqual(today.map((m) => m.id));
    const earlier = earlierBoards(t, NOW);
    expect(earlier.length).toBe(1);
    expect(earlier[0]).toContain("Lucius does not sleep.");
  });

  it("carries a picture of the day on the board's first item, made like the people's pictures", async () => {
    expect(actaPrompt(newMeta(), ctx)).toContain("THE PICTURE OF THE DAY");
    const ask = async <T,>(): Promise<T> => ({ ...BOARD, picture: "  The Forum at dawn, garlands on the shops for the Augustalia.  " }) as T;
    const posts = await writeActa(newMeta(), ctx, { ask, opts: {}, lex });
    expect(posts[0]).toMatchObject({ pic: "acta-20261012-pic", picEn: "The Forum at dawn, garlands on the shops for the Augustalia." });
    expect(posts.slice(1).some((m) => m.pic)).toBe(false);
    // the list still shows the item's title, not "📷"
    expect(preview(posts[0])).toBe("Augustālia");
    expect(actaPicture(posts[0], NOW, newMeta())).toEqual({ id: "acta-20261012-pic", by: ACTA_ID, en: posts[0].picEn, prompt: posts[0].picEn, status: "wanted", at: NOW });
    expect(actaPicture(posts[1], NOW, newMeta())).toBeNull();
    // no picture asked for: none wanted
    const plain = await writeActa(newMeta(), ctx, { ask: async <T,>(): Promise<T> => BOARD as T, opts: {}, lex });
    expect(plain[0].pic).toBeUndefined();
  });
});

describe("a newspaper, not the same board again", () => {
  const DAY = 86_400_000;
  const post = (key: string, i: number, at: number, tag: string, title: string, la: string, en: string): Msg => ({ id: `acta-${key}-${i}`, from: ACTA_ID, la, en, at: at + i, src: "own", title: { la: title, en: title }, tag });
  const t = {
    ...newThread(ACTA_ID, "channel"),
    messages: [
      post("20261003", 0, NOW - 9 * DAY, "notice", "Taurus fugitat", "Taurus fugitat.", "A bull runs away."),
      post("20261011", 0, NOW - DAY, "day", "Meditrīnālia", "Hodiē vīnum bibimus.", "Today we drink wine."),
      post("20261011", 1, NOW - DAY, "friends", "Euge, Iūlia!", "Iūlia bene scrībit.", "Iulia writes well."),
    ],
  };

  it("tells the scribe what the earlier boards said, in Latin and English, and every title of the last two weeks", () => {
    const past = pastBoards(t, NOW);
    expect(past.boards[0]).toContain("[Amīcī] «Euge, Iūlia!»");
    expect(past.boards[0]).toContain("Iulia writes well.");
    expect(past.titles.sort()).toEqual(["Euge, Iūlia!", "Meditrīnālia", "Taurus fugitat"]);
    expect(past.at).toBe(NOW - DAY + 1);
    const p = actaPrompt(newMeta(), ctx, past);
    expect(p).toContain("TITLES ALREADY USED");
    expect(p).toContain("«Taurus fugitat»");
    expect(p).toContain("only with what happened next");
  });

  it("gives as the friends' news only what began since the last board", () => {
    const meta = newMeta();
    meta.life.gaius = { mood: "sad", level: "", moodUntil: NOW + DAY, event: "a fox took two of his hens", eventUntil: NOW + 2 * DAY, eventAt: NOW - 2 * DAY, public: true, recent: [], rolled: NOW };
    meta.life.claudia = { mood: "proud", level: "", moodUntil: NOW + DAY, event: "her pupils won the reading contest", eventUntil: NOW + DAY, eventAt: NOW - 3600_000, public: true, recent: [], rolled: NOW };
    const p = actaPrompt(meta, ctx, pastBoards(t, NOW));
    expect(p).toContain("her pupils won the reading contest");
    expect(p).not.toContain("a fox took two of his hens");
    // with no earlier board, all of it
    expect(actaPrompt(meta, ctx)).toContain("a fox took two of his hens");
  });

  it("leaves out an item whose title an earlier board used (not the day's own), while enough are left", async () => {
    const board = {
      items: [
        { kind: "day", title: "Meditrīnālia", titleEn: "x", lines: [{ la: "Hodiē Rōma bibit.", en: "Today Rome drinks." }] },
        { kind: "notice", title: "Taurus fugitat!", titleEn: "x", lines: [{ la: "Taurus fugitat.", en: "A bull runs away." }] },
        { kind: "friends", title: "Lūcius", titleEn: "x", lines: [{ la: "Lūcius nōn dormit.", en: "Lucius does not sleep." }] },
        { kind: "city", title: "Aqua nova", titleEn: "x", lines: [{ la: "Rōma aquam novam habet.", en: "Rome has new water." }] },
      ],
    };
    const ask = async <T,>(): Promise<T> => board as T;
    const posts = await writeActa(newMeta(), ctx, { ask, opts: {}, lex }, pastBoards(t, NOW));
    expect(posts.map((m) => m.title?.la)).toEqual(["Meditrīnālia", "Lūcius", "Aqua nova"]);
    expect(posts.map((m) => m.id)).toEqual(["acta-20261012-0", "acta-20261012-1", "acta-20261012-2"]);
    // too few would be left: the board stays whole
    const two = { items: board.items.slice(0, 2) };
    expect((await writeActa(newMeta(), ctx, { ask: async <T,>(): Promise<T> => two as T, opts: {}, lex }, pastBoards(t, NOW))).length).toBe(2);
  });

  it("writes no board soon after the last one, nor a second one a day", () => {
    expect(boardDue(t, NOW)).toBe(true);
    // the last board came out late last night, an hour ago: the new day's waits
    const late = { ...t, messages: [...t.messages, post("20261011", 2, NOW - 3600_000, "notice", "Domus", "Domus.", "A house.")] };
    expect(boardDue(late, NOW)).toBe(false);
    expect(boardDue(late, NOW + BOARD_GAP)).toBe(true);
    const done = { ...t, messages: [...t.messages, post("20261012", 0, NOW - 8 * 3600_000, "day", "Hodiē", "Hodiē.", "Today.")] };
    expect(boardDue(done, NOW)).toBe(false);
  });

  it("keeps the edition of a day's board that came out first when two devices wrote it at once", () => {
    const a = [post("20261012", 0, NOW, "day", "A", "A.", "A."), post("20261012", 1, NOW, "city", "A", "A.", "A.")];
    const b = [post("20261012", 0, NOW + 5000, "day", "B", "B.", "B."), post("20261012", 1, NOW + 5000, "city", "B", "B.", "B."), post("20261012", 2, NOW + 5000, "notice", "B", "B.", "B.")];
    const other: Msg = { id: "m1", from: "iulia", la: "Salvē", at: NOW + 9000 };
    expect(firstEditions([...b, ...a, other]).map((m) => `${m.id}:${m.title?.la ?? ""}`)).toEqual(["acta-20261012-0:A", "acta-20261012-1:A", "m1:"]);
  });

  it("draws the friends in the picture of the day as they look, and lets them know what it told of them", () => {
    const meta = newMeta();
    const pic = actaPicture({ ...post("20261012", 0, NOW, "day", "x", "x", "x"), pic: "acta-20261012-pic", picEn: "Iūlia reading her poems at the market" }, NOW, meta)!;
    expect(pic.prompt).toBe(`${natureOf("iulia", meta)!.look}. the woman reading her poems at the market`);
    expect(pic.en).toBe("Iūlia reading her poems at the market");
    const mems = boardMemories([post("20261012", 1, NOW, "friends", "Euge, Iūlia!", "Iūlia bene scrībit.", "Iulia writes well."), post("20261012", 2, NOW, "notice", "Domus", "Domus nova.", "A new house for sale at the market.")], meta);
    expect(mems.length).toBe(5);
    expect(mems.find((m) => m.who === "iulia")).toMatchObject({ kind: "news", weight: 3, about: ["iulia"] });
    expect(mems.find((m) => m.who === "iulia")!.text).toContain("told this of me");
    expect(mems.find((m) => m.who === "marcus")!.text).toContain("Iulia writes well.");
    // "market" is not Marcus
    expect(boardMemories([post("20261012", 3, NOW, "notice", "Domus", "Domus nova.", "A new house for sale at the market.")], meta)).toEqual([]);
  });
});
