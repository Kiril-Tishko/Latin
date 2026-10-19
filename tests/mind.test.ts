import { describe, expect, it } from "vitest";
import { applyMinds, memoriesOf, Memory, memoryId, mergeMinds, migrateMinds, Mind, newMind, prune, recall, tellsOf } from "../src/chat/mind";
import { writeReply } from "../src/chat/engine";
import { dramaBlock, ownPrompt, replyPrompt } from "../src/chat/prompts";
import { makeBrief } from "../src/chat/brief";
import { deedsOf } from "../src/chat/world";
import { membersOf, Meta, newMeta, newThread, Thread } from "../src/chat/model";
import { GROUP, PEOPLE } from "../src/content/people";
import { allowedWords, chatEntries, chatLexicon, nameEntry } from "../src/chat/words";
import { LESSONS } from "../src/content/lessons";
import { PARTS } from "../src/content/parts";
import { seeded } from "../src/latin/generate";

const entries = chatEntries(LESSONS.flatMap((l) => l.words), [nameEntry("Kiril", "Kiril (your name)", "m")]);
const lex = chatLexicon(entries);
const seen = new Set(PARTS.flatMap((p) => p.skills));
const T0 = Date.UTC(2026, 9, 19, 11, 0);
const DAY = 86400_000;
const ctxAt = (now: number, minds?: Record<string, Mind>) => ({ now, me: { name: "Kiril", g: "m" as const }, tz: "Europe/Kyiv", words: allowedWords(entries, seen), seen, ...(minds ? { minds } : {}) });
const everyone = new Set(PEOPLE.map((p) => p.id));
const mem = (text: string, at: number, extra: Partial<Memory> = {}): Memory => ({ id: memoryId("x", text, at), at, text, about: ["me"], kind: "fact", weight: 2, from: "saw", updatedAt: at, ...extra });
const nameOf = (id: string) => PEOPLE.find((p) => p.id === id)?.name ?? (id === "me" ? "Kiril" : id);
const dm = (id: string, la: string, at = T0): Thread => ({ ...newThread(id, "dm"), messages: [{ id: `m-${id}`, from: "me", la, at }] });

describe("each person's memory: weighted, recalled when it matters", () => {
  it("recalls what weighs, what is recent, what is open, and what the talk touches; never what is outdated", () => {
    const mind: Mind = {
      id: "iulia",
      memories: [
        mem("Kiril likes figs", T0 - 20 * DAY, { weight: 1 }),
        mem("Kiril slept a lot on Tuesday", T0 - 6 * DAY, { weight: 1 }),
        mem("Kiril told me he misses me", T0 - 5 * DAY, { weight: 5, kind: "moment" }),
        mem("Kiril promised to write me a poem", T0 - 3 * DAY, { weight: 3, kind: "promise" }),
        mem("Flavia is ill", T0 - 4 * DAY, { weight: 3, outdated: true }),
        mem("Flavia is well again", T0 - 2 * DAY, { weight: 3, about: ["iulia"] }),
      ],
      updatedAt: 0,
    };
    const got = recall(mind, { now: T0, with: ["me", "iulia"], chat: "iulia", text: "Quid agit Flāvia? How is Flavia?", k: 3 }).map((m) => m.text);
    expect(got).toContain("Kiril told me he misses me");
    expect(got).toContain("Kiril promised to write me a poem");
    expect(got).toContain("Flavia is well again");
    expect(got).not.toContain("Flavia is ill");
    expect(got).not.toContain("Kiril slept a lot on Tuesday");
  });

  it("keeps what matters when there are too many, and merges two devices' copies", () => {
    const many = [mem("never forgotten", T0 - 300 * DAY, { weight: 5 }), ...Array.from({ length: 30 }, (_, i) => mem(`small thing ${i}`, T0 - i * 3600_000, { weight: 1 }))];
    const kept = prune(many, T0, 10);
    expect(kept).toHaveLength(10);
    expect(kept.map((m) => m.text)).toContain("never forgotten");
    const a: Mind = { id: "marcus", memories: [mem("one", T0), { ...mem("two", T0), updatedAt: T0 }], updatedAt: 1 };
    const b: Mind = { id: "marcus", memories: [{ ...mem("two", T0), done: true, updatedAt: T0 + 5 }, mem("three", T0)], updatedAt: 2 };
    const m = mergeMinds(a, b, T0)!;
    expect(m.memories.map((x) => x.text).sort()).toEqual(["one", "three", "two"]);
    expect(m.memories.find((x) => x.text === "two")!.done).toBe(true);
  });

  it("takes from Claude only the people of the chat, each with their own view, a few at most", () => {
    const raw = {
      remember: [
        { who: "iulia", text: "Kiril says he can't sleep because of a girl", kind: "secret", weight: 4, about: ["me", "nobody"], secret: true },
        { who: "marcus", text: "Kiril is mooning over some girl, ha", kind: "joke", weight: 2 },
        { who: "gaius", text: "not here", weight: 3 },
        { who: "iulia", text: "Kiril will come to the theatre on the Ides", kind: "promise", weight: 3, until: "2026-10-15" },
      ],
    };
    const got = memoriesOf(raw, ["iulia", "marcus"], everyone);
    expect(got.map((m) => m.who)).toEqual(["iulia", "marcus", "iulia"]);
    expect(got[0]).toMatchObject({ kind: "secret", weight: 4, about: ["me"], secret: true });
    expect(got[2].until).toBe(Date.parse("2026-10-15"));
    // in a private chat, a bare fact is the one person's
    expect(memoriesOf({ remember: ["likes wine"] }, ["gaius"], everyone)).toEqual([{ who: "gaius", text: "likes wine", kind: "fact", weight: 2, about: ["me"] }]);
    // someone named who is not in the chat remembers nothing of it
    expect(memoriesOf({ remember: [{ who: "iulia", text: "likes wine" }] }, ["gaius"], everyone)).toEqual([]);
  });
});

describe("knowledge has boundaries: what is said in private stays there, until someone tells", () => {
  it("keeps a secret told to Iūlia out of Marcus's prompt, until Iūlia tells someone (who may tell it wrong)", async () => {
    const meta = newMeta();
    const ask = async <T,>(): Promise<T> =>
      ({ messages: [{ from: "iulia", la: "Ō! Nēmō scit!", en: "Oh! Nobody knows!" }], remember: [{ who: "iulia", text: "Kiril secretly loves Claudia's cousin", kind: "secret", weight: 4, secret: true }] }) as T;
    const reply = await writeReply(dm("iulia", "Amō…"), meta, ctxAt(T0), { ask, opts: {}, lex, r: seeded(2) });
    let minds: Record<string, Mind> = Object.fromEntries(applyMinds({}, { memories: reply.memories, chat: "iulia", settled: reply.settled, outdated: reply.outdated }, T0, nameOf).map((m) => [m.id, m]));
    const later = T0 + 3600_000;
    expect(replyPrompt(dm("marcus", "Salvē!", later), meta, ctxAt(later, minds), { at: later, why: "free" })).not.toContain("Claudia's cousin");
    const toIulia = replyPrompt(dm("iulia", "Salvē!", later), meta, ctxAt(later, minds), { at: later, why: "free" });
    expect(toIulia).toContain("Kiril secretly loves Claudia's cousin");
    expect(toIulia).toContain("a secret they keep");
    // she cannot keep it: she tells Claudia, and Claudia passes on a garbled version to Marcus
    const tells = tellsOf(
      [
        { from: "iulia", to: "claudia", what: "Kiril secretly loves your cousin!", about: ["me"], weight: 4 },
        { from: "claudia", to: "marcus", what: "Kiril is going to marry my cousin", about: ["me"], weight: 3, untrue: true },
        { from: "iulia", to: "iulia", what: "x" },
        { from: "nobody", to: "marcus", what: "x" },
      ],
      new Set(["iulia", "claudia"]),
      everyone,
    );
    expect(tells).toHaveLength(2);
    for (const m of applyMinds(minds, { tells }, later, nameOf)) minds = { ...minds, [m.id]: m };
    const toClaudia = replyPrompt(dm("claudia", "Salvē!", later + 1), meta, ctxAt(later + 1, minds), { at: later + 1, why: "free" });
    expect(toClaudia).toContain("Kiril secretly loves your cousin!");
    expect(toClaudia).toContain("Iūlia told them");
    const toMarcus = replyPrompt(dm("marcus", "Salvē!", later + 1), meta, ctxAt(later + 1, minds), { at: later + 1, why: "free" });
    expect(toMarcus).toContain("Kiril is going to marry my cousin");
    expect(toMarcus).toContain("untrue, though they believe it");
    // and Iūlia remembers telling
    expect(minds.iulia.memories.some((m) => m.text.startsWith("I told Claudia:"))).toBe(true);
  });

  it("shows a storyline only to those who know of it", () => {
    const meta: Meta = { ...newMeta(), world: { updatedAt: 1, dramas: [{ id: "suitor", en: "Iūlia's father wants her to marry the senator's son", who: ["iulia"], knows: ["iulia", "claudia"], since: 1, updatedAt: 1 }] } };
    expect(dramaBlock(meta, ["marcus"])).toBe("");
    expect(dramaBlock(meta, ["claudia"])).toContain("senator's son");
    expect(dramaBlock(meta, ["claudia"])).toContain("known to: Iūlia, Claudia");
    expect(replyPrompt(dm("marcus", "Salvē!"), meta, ctxAt(T0), { at: T0, why: "free" })).not.toContain("senator's son");
    // the group: someone there knows it (and must keep it to those who know)
    expect(replyPrompt({ ...newThread(GROUP.id, "group"), messages: [] }, meta, ctxAt(T0), { at: T0, why: "free" })).toContain("only those who know of one can speak of it");
    // Claude says who knows of a new storyline
    const d = deedsOf({ drama: [{ id: "debt", en: "Marcus owes a bookmaker", who: ["marcus"], knows: ["marcus", "lucius", "ghost"] }] }, everyone, everyone);
    expect(d.dramas[0].knows).toEqual(["marcus", "lucius"]);
  });

  it("gives the phone routine each person's own memories, and the own-writing prompt the telling", () => {
    const minds = { gaius: { id: "gaius", memories: [mem("Kiril praised my goat", T0 - DAY, { weight: 3, kind: "moment" })], updatedAt: T0 } };
    const brief = makeBrief(newMeta(), ctxAt(T0, minds), [], seeded(1));
    expect(brief.people.find((p) => p.id === "gaius")!.sheet).toContain("Kiril praised my goat");
    expect(brief.people.find((p) => p.id === "marcus")!.sheet).not.toContain("goat");
    const p = ownPrompt([...PEOPLE.map((x) => newThread(x.id, "dm")), newThread(GROUP.id, "group")], newMeta(), ctxAt(T0, minds), 1);
    expect(p).toContain("WHAT GĀIUS REMEMBERS");
    expect(p).toContain('"tell"');
  });
});

describe("moving the old memories in", () => {
  it("turns each chat's old facts and each bond's moments into the people's memories, once", () => {
    const meta: Meta = { ...newMeta(), bonds: { iulia: { feel: "", moments: ["13 Oct: Kiril called me beautiful like the moon"], updatedAt: 1 } } };
    const threads: Thread[] = [
      { ...newThread("iulia", "dm"), memory: ["Kiril writes at night"], updatedAt: T0 - DAY },
      { ...newThread(GROUP.id, "group"), memory: ["Kiril copies Lūcius's roses"], updatedAt: T0 - DAY },
    ];
    const members = (chat: string) => membersOf(chat, meta).map((w) => w.id);
    const moved = Object.fromEntries(migrateMinds(meta, threads, {}, members, T0).map((m) => [m.id, m]));
    expect(moved.iulia.memories.map((m) => m.text).sort()).toEqual(["Kiril called me beautiful like the moon", "Kiril copies Lūcius's roses", "Kiril writes at night"]);
    expect(moved.iulia.memories.find((m) => m.text.includes("moon"))!.kind).toBe("moment");
    expect(moved.marcus.memories.map((m) => m.text)).toEqual(["Kiril copies Lūcius's roses"]);
    expect(moved.iulia.v).toBe(1);
    // done once; and the same ids on another device
    expect(migrateMinds(meta, threads, moved, members, T0 + 1)).toEqual([]);
    expect(migrateMinds(meta, threads, {}, members, T0 + 5).find((m) => m.id === "iulia")!.memories.map((m) => m.id).sort()).toEqual(moved.iulia.memories.map((m) => m.id).sort());
    expect(newMind("x").memories).toEqual([]);
  });
});
