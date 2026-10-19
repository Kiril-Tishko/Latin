import { describe, expect, it } from "vitest";
import { AROUND, CATCH_UP, groupCaps, namedIn, sceneBlock, sceneOf, When } from "../src/chat/group";
import { timingFor, writeReply } from "../src/chat/engine";
import { ownPrompt } from "../src/chat/prompts";
import { membersOf, newMeta, newThread, Thread } from "../src/chat/model";
import { GROUP, PERSON_BY_ID } from "../src/content/people";
import { allowedWords, chatEntries, chatLexicon, nameEntry } from "../src/chat/words";
import { LESSONS } from "../src/content/lessons";
import { PARTS } from "../src/content/parts";
import { seeded } from "../src/latin/generate";

const entries = chatEntries(LESSONS.flatMap((l) => l.words), [nameEntry("Kiril", "Kiril (your name)", "m")]);
const lex = chatLexicon(entries);
const seen = new Set(PARTS.flatMap((p) => p.skills));
// 21:30 in Rome: Gāius has gone to bed (he gets up at five); the others are free
const T = Date.UTC(2026, 9, 19, 19, 30);
const MIN = 60_000;
const ctxAt = (now: number) => ({ now, me: { name: "Kiril", g: "m" as const }, tz: "Europe/Kyiv", words: allowedWords(entries, seen), seen });
const meta = newMeta();
const members = membersOf(GROUP.id, meta);
const who = (id: string) => ({ ...PERSON_BY_ID.get(id)!, stranger: false });
// when each reads the learner's message: Gāius only after waking, eight hours later
const byId = new Map<string, When>([
  ["marcus", { readAt: T + 20_000, startAt: T + 30_000, why: "they are free" }],
  ["iulia", { readAt: T + 40_000, startAt: T + 50_000, why: "they are free" }],
  ["claudia", { readAt: T + 3 * MIN, startAt: T + 4 * MIN, why: "they were away from their tablet for a bit" }],
  ["lucius", { readAt: T + 60_000, startAt: T + 70_000, why: "they are free" }],
  ["gaius", { readAt: T + 8 * 3600_000, startAt: T + 8 * 3600_000 + 60_000, why: "they were asleep and read it after waking up" }],
]);
const timing = { first: { w: who("marcus"), t: byId.get("marcus")! }, byId };
const group = (la: string): Thread => ({ ...newThread(GROUP.id, "group"), messages: [{ id: "g1", from: "me", la, at: T }] });

describe("the group as a group: who is around, who talks, who catches up later", () => {
  it("knows whom the learner named, in any case of their name", () => {
    expect(namedIn("Salvē, Iūlia! Marce, ubi es?", members)).toEqual(["iulia", "marcus"]);
    expect(namedIn("Gāī, tē videō. Iūliam amō. Claudiae epistulam dō.", members).sort()).toEqual(["claudia", "gaius", "iulia"]);
    expect(namedIn("Lūna lūcet, amīcī.", members)).toEqual([]);
  });

  it("puts the ones who read it within minutes in the live talk, the others later, the named and talkative first", () => {
    const scene = sceneOf(members, meta, T, byId, "Salvēte! Claudia, quid agis?", seeded(1));
    expect(scene.here.sort()).toEqual(["claudia", "iulia", "lucius", "marcus"]);
    expect(scene.later).toEqual(["gaius"]);
    expect(scene.named).toEqual(["claudia"]);
    expect(scene.likely[0]).toBe("claudia");
    const text = sceneBlock(scene, members, byId, meta);
    expect(text).toContain("- not here: Gāius (were asleep and read it after waking up; around 05:30 their time)");
    expect(text).toContain("Gāius hardly ever says anything in a group");
    expect(text).toContain("The learner named Claudia");
    // everyone asleep: the first to wake starts the talk
    const night = new Map([...byId].map(([id, w]) => [id, { ...w, readAt: w.readAt + 9 * 3600_000 }]));
    expect(sceneOf(members, meta, T, night, "", seeded(2)).here.length).toBeGreaterThan(0);
    expect(AROUND).toBe(10 * MIN);
  });

  it("lets a quiet one say a word unless named, and someone not around catch up with a message or two", () => {
    const drafts = [{ from: "gaius" }, { from: "gaius" }, { from: "marcus" }, { from: "gaius" }, { from: "marcus" }];
    const quiet = sceneOf(members, meta, T, byId, "Salvēte!", seeded(1));
    expect(groupCaps(drafts, quiet, meta).map((d) => d.from)).toEqual(["gaius", "marcus", "marcus"]);
    const named = sceneOf(members, meta, T, byId, "Gāī, ubi es?", seeded(1));
    expect(groupCaps(drafts, named, meta).filter((d) => d.from === "gaius")).toHaveLength(CATCH_UP);
  });

  it("does not let a sleeper's answer hold up the others: he answers when he wakes, they answer now", async () => {
    const ask = async <T,>(): Promise<T> =>
      ({
        messages: [
          { from: "marcus", la: "Gāius dormit! 😂", en: "Gāius is asleep! 😂" },
          { from: "gaius", la: "Dormiō.", en: "I am sleeping." },
          { from: "iulia", la: "Hahae!", en: "Haha!" },
          { from: "gaius", la: "Valē.", en: "Bye." },
          { from: "gaius", la: "Nōn.", en: "No." },
        ],
      }) as T;
    const reply = await writeReply(group("Gāī, ubi es?"), meta, ctxAt(T), { ask, opts: {}, lex, r: seeded(3) }, timing);
    const at = Object.fromEntries(reply.messages.map((m) => [m.la, m.at]));
    expect(at["Hahae!"] - T).toBeLessThan(5 * MIN);
    expect(at["Dormiō."]).toBeGreaterThan(T + 8 * 3600_000);
    expect(reply.messages.filter((m) => m.from === "gaius")).toHaveLength(CATCH_UP);
    // the prompt said who is around
    let prompt = "";
    await writeReply(group("Gāī, ubi es?"), meta, ctxAt(T), { ask: async <T,>(p: string): Promise<T> => ((prompt = p), { messages: [] } as T), opts: {}, lex, r: seeded(3) }, timing);
    expect(prompt).toContain("WHO IS AROUND IN THE GROUP NOW:");
    expect(prompt).toContain("The learner named Gāius: they will want to answer (when they come back).");
    // the live talk is capped at eight; someone catching up later is not counted in it
    const busy = async <T,>(): Promise<T> =>
      ({
        messages: [
          ...["Ō!", "Euge!", "Hahae!", "Ita!"].flatMap((la) => [{ from: "marcus", la }, { from: "iulia", la: `${la} ${la}` }]),
          { from: "gaius", la: "Salvē." },
        ].map((m) => ({ ...m, en: "x" })),
      }) as T;
    const many = await writeReply(group("Salvēte! Gāī, ubi es?"), meta, ctxAt(T), { ask: busy, opts: {}, lex, r: seeded(3) }, timing);
    expect(many.messages.map((m) => m.from).filter((f) => f === "gaius")).toHaveLength(1);
    expect(many.messages.filter((m) => m.from !== "gaius").length).toBeLessThanOrEqual(8);
    // a private chat has no scene
    let dmPrompt = "";
    await writeReply({ ...newThread("marcus", "dm"), messages: [{ id: "d1", from: "me", la: "Salvē!", at: T }] }, meta, ctxAt(T), { ask: async <T,>(p: string): Promise<T> => ((dmPrompt = p), { messages: [] } as T), opts: {}, lex, r: seeded(3) }, timingFor([who("marcus")], T, seeded(1)));
    expect(dmPrompt).not.toContain("WHO IS AROUND");
  });
});

describe("the short listings of what was said", () => {
  it("show a message taken back as taken back, and a voice message or photo as such", () => {
    const iulia: Thread = {
      ...newThread("iulia", "dm"),
      messages: [
        { id: "a", from: "me", la: "Salvē!", at: T - 3600_000 },
        { id: "b", from: "iulia", la: "Ego quoque scrībō...", at: T - 3500_000, deletedAt: T - 3490_000 },
        { id: "c", from: "iulia", la: "Ecce!", at: T - 3400_000, photo: "iulia-figs" },
        { id: "d", from: "iulia", la: "Valē!", at: T - 3300_000, voice: true },
      ],
    };
    const p = ownPrompt([iulia, newThread(GROUP.id, "group")], meta, ctxAt(T), 1);
    expect(p).toContain("Iūlia: Ego quoque scrībō... (taken back: the learner saw only «message deleted»)");
    expect(p).toMatch(/Iūlia: \[photo: [^\]]+\] Ecce!/);
    expect(p).toContain("Iūlia: [voice message] Valē!");
  });
});
