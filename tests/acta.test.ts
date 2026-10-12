import { describe, expect, it } from "vitest";
import { ACTA_ID, actaKey, actaPrompt, boardOf, earlierBoards, itemsOf, linesOf, writeActa } from "../src/chat/acta";
import { calendarBlock, calendarWords } from "../src/chat/calendar";
import { newMeta, newThread, preview } from "../src/chat/model";
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
    const p = actaPrompt(meta, ctx, ["- 11.10.: The wine of the Meditrinalia: …"]);
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
    const posts = await writeActa(newMeta(), ctx, { ask, opts: {}, lex, r: seeded(1) }, []);
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
    const yesterday = await writeActa(newMeta(), { ...ctx, now: NOW - 86_400_000 }, { ask, opts: {}, lex }, []);
    const today = await writeActa(newMeta(), ctx, { ask, opts: {}, lex }, []);
    const t = { ...newThread(ACTA_ID, "channel"), messages: [...yesterday, ...today] };
    expect(boardOf(t, actaKey(NOW)).map((m) => m.id)).toEqual(today.map((m) => m.id));
    const earlier = earlierBoards(t, NOW);
    expect(earlier.length).toBe(1);
    expect(earlier[0]).toContain("Lucius does not sleep.");
  });
});
