import { describe, expect, it } from "vitest";
import { addEvent, applyGoalChanges, applyHappen, CALM_DAYS, goalChangesOf, goalId, goalsLine, goalsOf, happensOf, heavyOk, knowsOf, mergeGoals, noteHappening, OWN_CALM_DAYS, publicNow, quietDays, timelineBlock } from "../src/chat/lives";
import { HEAVY_HAPPENINGS, lifeNow } from "../src/chat/life";
import { applyFeelings, refreshLives, writeReply } from "../src/chat/engine";
import { actaPrompt } from "../src/chat/acta";
import { MemoryDraft } from "../src/chat/mind";
import { clip, Meta, mergeWorld, newMeta, newThread, Thread } from "../src/chat/model";
import { applyDeeds, deedsOf } from "../src/chat/world";
import { ownPrompt, replyPrompt } from "../src/chat/prompts";
import { GROUP, PEOPLE, PERSON_BY_ID } from "../src/content/people";
import { allowedWords, chatEntries, chatLexicon, nameEntry } from "../src/chat/words";
import { LESSONS } from "../src/content/lessons";
import { PARTS } from "../src/content/parts";
import { seeded } from "../src/latin/generate";

const entries = chatEntries(LESSONS.flatMap((l) => l.words), [nameEntry("Kiril", "Kiril (your name)", "m")]);
const lex = chatLexicon(entries);
const seen = new Set(PARTS.flatMap((p) => p.skills));
const T0 = Date.UTC(2026, 9, 19, 11, 0);
const DAY = 86400_000;
const HOUR = 3600_000;
const ctxAt = (now: number) => ({ now, me: { name: "Kiril", g: "m" as const }, tz: "Europe/Kyiv", words: allowedWords(entries, seen), seen });
const everyone = new Set(PEOPLE.map((p) => p.id));
const dm = (id: string, la: string, at = T0): Thread => ({ ...newThread(id, "dm"), messages: [{ id: `m-${id}`, from: "me", la, at }] });
const who = (id: string) => ({ ...PERSON_BY_ID.get(id)!, stranger: false });

describe("lives that go on: heavy things are rare and have consequences", () => {
  it("never starts a heavy happening when the world has not been calm", () => {
    const r = seeded(7);
    let prev;
    for (let i = 0; i < 400; i++) {
      const { life, started } = lifeNow(PERSON_BY_ID.get("claudia")!, prev, T0 + i * 10 * HOUR, r, false);
      expect(started?.heavy).toBeFalsy();
      prev = life;
    }
  });

  it("over two months, keeps a calm week between heavy happenings, three weeks for one person, and always brings what comes after", () => {
    const meta = newMeta();
    const r = seeded(11);
    const out: MemoryDraft[] = [];
    const heavy: { who: string; at: number; en: string }[] = [];
    for (let t = T0; t < T0 + 60 * DAY; t += 2 * HOUR) {
      const before = Object.fromEntries(PEOPLE.map((p) => [p.id, meta.life[p.id]?.event]));
      refreshLives(meta, PEOPLE.map((p) => p.id), t, r, out);
      for (const p of PEOPLE) {
        const l = meta.life[p.id];
        if (l?.heavy && l.event !== before[p.id] && l.eventAt === t) heavy.push({ who: p.id, at: t, en: l.event! });
      }
    }
    expect(heavy.length).toBeGreaterThan(0);
    expect(heavy.length).toBeLessThanOrEqual(Math.ceil(60 / CALM_DAYS));
    for (let i = 1; i < heavy.length; i++) expect(heavy[i].at - heavy[i - 1].at).toBeGreaterThanOrEqual(CALM_DAYS * DAY);
    for (const p of PEOPLE) {
      const mine = heavy.filter((h) => h.who === p.id);
      for (let i = 1; i < mine.length; i++) expect(mine[i].at - mine[i - 1].at).toBeGreaterThanOrEqual(OWN_CALM_DAYS * DAY);
    }
    // each heavy one is on the timeline and remembered; what came after it followed (when it was over before the end)
    for (const h of heavy) {
      expect(meta.world!.timeline!.some((e) => e.heavy && e.who.includes(h.who) && e.at === h.at)).toBe(true);
      expect(out.some((m) => m.who === h.who && m.text === h.en && m.weight === 4)).toBe(true);
    }
    const thens = [...PEOPLE.flatMap((p) => p.happenings), ...HEAVY_HAPPENINGS].filter((h) => h.heavy).flatMap((h) => h.then ?? []).map((h) => h.en);
    expect(out.some((m) => thens.includes(m.text))).toBe(true);
  });

  it("leaves a memory, a want and a line on the timeline when a happening matters, nothing for a passing one", () => {
    const meta = newMeta();
    const fired = HEAVY_HAPPENINGS.find((h) => h.en === "lost their job")!;
    const ms = noteHappening(meta, "marcus", fired, T0);
    expect(ms).toEqual([{ who: "marcus", text: "lost their job", kind: "news", weight: 4, about: ["marcus"] }]);
    expect(meta.world!.timeline).toMatchObject([{ en: "Marcus: lost their job", who: ["marcus"], public: true, heavy: true }]);
    expect(goalsOf("marcus", meta).map((g) => g.text)).toContain("to find work again");
    expect(heavyOk(meta, "gaius", T0 + 3 * DAY)).toBe(false);
    expect(heavyOk(meta, "gaius", T0 + (CALM_DAYS + 1) * DAY)).toBe(true);
    expect(heavyOk(meta, "marcus", T0 + (CALM_DAYS + 1) * DAY)).toBe(false);
    expect(noteHappening(meta, "iulia", { en: "had a very strange dream", hours: [3, 10] }, T0)).toEqual([]);
  });
});

describe("what they want from life", () => {
  it("starts from each friend's wants, takes steps, ends them, and finds new ones (a few at most)", () => {
    const meta = newMeta();
    const first = goalsOf("lucius", meta);
    expect(first.map((g) => g.text)).toEqual(PERSON_BY_ID.get("lucius")!.wants);
    const patron = first[0];
    const raw = [
      { who: "lucius", id: patron.id, step: "a freedman read three of his poems and laughed in the right places" },
      { who: "lucius", text: "to make Corvīnus talk" },
      { who: "ghost", text: "x" },
      { who: "iulia", id: "g0" },
    ];
    const changes = goalChangesOf(raw, everyone);
    expect(changes).toHaveLength(2);
    applyGoalChanges(meta, changes, T0);
    const line = goalsLine(who("lucius"), meta, T0);
    expect(line).toContain(`[${patron.id}] a patron who will publish his poems (lately: a freedman read three of his poems and laughed in the right places)`);
    expect(line).toContain("to make Corvīnus talk");
    // got it: off the list of wants, on the timeline (known to him)
    applyGoalChanges(meta, [{ who: "lucius", id: patron.id, status: "done", step: "the freedman will pay for a copy" }], T0 + DAY);
    expect(goalsLine(who("lucius"), meta, T0 + DAY)).toContain("Lately got a patron who will publish his poems");
    expect(meta.world!.timeline!.at(-1)).toMatchObject({ who: ["lucius"], knows: ["lucius"] });
    expect(meta.world!.timeline!.at(-1)!.en).toContain("got what they wanted");
    // four open wants at most
    for (const t of ["a", "b", "c", "d"]) applyGoalChanges(meta, [{ who: "lucius", text: `want ${t}` }], T0 + 2 * DAY);
    expect(goalsOf("lucius", meta).filter((g) => g.status === "open")).toHaveLength(4);
    // two devices: each goal the newer
    const merged = mergeGoals({ lucius: [{ id: "g1", text: "x", status: "open", since: 0, updatedAt: 1 }] }, { lucius: [{ id: "g1", text: "x", status: "done", since: 0, updatedAt: 2 }], iulia: [] })!;
    expect(merged.lucius[0].status).toBe("done");
    expect(goalId("lucius", "X")).toBe(goalId("lucius", "x"));
  });
});

describe("one shared timeline, known as far as it is known", () => {
  it("shows each chat only what its people know of, and the own-writing prompt everything with who knows it", () => {
    const meta = newMeta();
    addEvent(meta, { at: T0 - 2 * DAY, en: "Gāius: hail destroyed the whole harvest", who: ["gaius"], public: true, heavy: true });
    addEvent(meta, { at: T0 - DAY, en: "Marcus owes a bookmaker", who: ["marcus"], knows: ["lucius"] });
    addEvent(meta, { at: T0 - DAY, en: "Marcus owes a bookmaker", who: ["marcus"], knows: ["lucius"] });
    expect(meta.world!.timeline).toHaveLength(2);
    expect(knowsOf(meta.world!.timeline![1], "lucius")).toBe(true);
    expect(knowsOf(meta.world!.timeline![1], "iulia")).toBe(false);
    const toIulia = replyPrompt(dm("iulia", "Salvē!"), meta, ctxAt(T0), { at: T0, why: "free" });
    expect(toIulia).toContain("hail destroyed the whole harvest (everyone around knows)");
    expect(toIulia).not.toContain("bookmaker");
    expect(replyPrompt(dm("lucius", "Salvē!"), meta, ctxAt(T0), { at: T0, why: "free" })).toContain("Marcus owes a bookmaker (known to Marcus, Lūcius)");
    expect(timelineBlock(meta, undefined, T0)).toContain("bookmaker");
    // two devices: one timeline
    const w = mergeWorld({ updatedAt: 1, timeline: [meta.world!.timeline![0]] }, { updatedAt: 2, timeline: [meta.world!.timeline![1]] })!;
    expect(w.timeline).toHaveLength(2);
    // a quiet stretch nudges life along
    expect(quietDays(meta, T0)).toBeCloseTo(1);
    const threads = [...PEOPLE.map((p) => newThread(p.id, "dm")), newThread(GROUP.id, "group")];
    expect(ownPrompt(threads, meta, ctxAt(T0), 1)).not.toContain("Nothing much has happened in their lives for days");
    expect(ownPrompt(threads, meta, ctxAt(T0 + 5 * DAY), 1)).toContain("Nothing much has happened in their lives for days");
  });

  it("lets the neighbours (and the Ācta) know only public happenings", () => {
    const meta: Meta = {
      ...newMeta(),
      life: {
        gaius: { mood: "devastated", level: "", moodUntil: T0 + HOUR, event: "hail destroyed the whole harvest", eventUntil: T0 + 3 * DAY, public: true, recent: [], rolled: T0 },
        marcus: { mood: "panicked", level: "", moodUntil: T0 + HOUR, event: "he lost all his money betting on the Greens and owes a dangerous bookmaker", eventUntil: T0 + 3 * DAY, recent: [], rolled: T0 },
      },
    };
    expect(publicNow(meta, T0)).toEqual(["Gāius: hail destroyed the whole harvest"]);
    const toIulia = replyPrompt(dm("iulia", "Salvē!"), meta, ctxAt(T0), { at: T0, why: "free" });
    expect(toIulia).toContain("WHAT EVERYONE AROUND KNOWS OF THE OTHERS NOW");
    expect(toIulia).toContain("- Gāius: hail destroyed the whole harvest");
    expect(toIulia).not.toContain("bookmaker");
    // Gāius's own chat does not hear of himself as news
    expect(replyPrompt(dm("gaius", "Salvē!"), meta, ctxAt(T0), { at: T0, why: "free" })).not.toContain("WHAT EVERYONE AROUND KNOWS OF THE OTHERS NOW");
    const acta = actaPrompt(meta, ctxAt(T0), []);
    expect(acta).toContain("hail destroyed the whole harvest");
    expect(acta).not.toContain("bookmaker");
  });
});

describe("things that happen because of what went on", () => {
  it("makes Claude's happenings real: their life now, a line on the timeline, a memory", () => {
    const hs = happensOf(
      [
        { who: "marcus", what: "his boss docked his pay for the prank", mood: "sulky", hours: 30 },
        { who: "ghost", what: "x" },
        { who: "gaius", what: "Pompōnia threw him out for a night", hours: 9999, public: true },
      ],
      everyone,
    );
    expect(hs).toEqual([
      { who: "marcus", en: "his boss docked his pay for the prank", mood: "sulky", hours: 30 },
      { who: "gaius", en: "Pompōnia threw him out for a night", hours: 336, public: true },
    ]);
    const meta = newMeta();
    const ms = applyHappen(meta, hs, T0);
    expect(meta.life.marcus).toMatchObject({ event: "his boss docked his pay for the prank", mood: "sulky", eventUntil: T0 + 30 * HOUR });
    expect(meta.life.gaius).toMatchObject({ heavy: true, public: true });
    expect(ms.map((m) => m.who)).toEqual(["marcus", "gaius"]);
    expect(meta.world!.timeline!.map((e) => e.en)).toEqual(["Gāius: Pompōnia threw him out for a night"]);
  });

  it("takes goals and happenings from a reply's answer", async () => {
    const meta = newMeta();
    const ask = async <T,>(): Promise<T> =>
      ({
        messages: [{ from: "marcus", la: "Heu! Labōrō.", en: "Alas! I am working." }],
        goals: [{ who: "marcus", text: "to get his own back on Kiril" }],
        happen: [{ who: "marcus", what: "his boss caught him napping on the scrolls", mood: "grumpy", hours: 20 }],
      }) as T;
    const reply = await writeReply(dm("marcus", "Dormīsne?"), meta, ctxAt(T0), { ask, opts: {}, lex, r: seeded(5) });
    expect(reply.goals).toEqual([{ who: "marcus", text: "to get his own back on Kiril" }]);
    expect(reply.happen).toHaveLength(1);
    const ms = applyFeelings(meta, reply, T0);
    expect(ms[0]).toMatchObject({ who: "marcus", text: "his boss caught him napping on the scrolls" });
    expect(goalsOf("marcus", meta).some((g) => g.text === "to get his own back on Kiril")).toBe(true);
    expect(meta.life.marcus.event).toBe("his boss caught him napping on the scrolls");
    expect(replyPrompt(dm("marcus", "Salvē!"), meta, ctxAt(T0 + HOUR), { at: T0 + HOUR, why: "free" })).toContain("to get his own back on Kiril");
  });
});

describe("their texts, kept whole", () => {
  it("cuts a long text at a sentence or a word, never mid-word, and lets the learner be part of a storyline", () => {
    expect(clip("Lūcius sulks all day long in his room. Marcus laughs at everyone", 45)).toBe("Lūcius sulks all day long in his room.");
    expect(clip("Lūcius sulks. Marcus, who started the rumour, laughs at everyone", 40)).toBe("Lūcius sulks. Marcus, who started the…");
    const cut = clip("the senator's son stares at her through dinner and her father insists on the wedding", 50);
    expect(cut.endsWith("…")).toBe(true);
    expect("the senator's son stares at her through dinner and her father insists on the wedding".startsWith(cut.slice(0, -1))).toBe(true);
    expect(cut.slice(0, -1).endsWith(" ")).toBe(false);
    expect(clip("short", 50)).toBe("short");
    const d = deedsOf({ drama: [{ id: "taurus", en: "x ".repeat(400), who: ["me", "iulia", "ghost"] }] }, everyone, everyone);
    expect(d.dramas[0].who).toEqual(["me", "iulia"]);
    expect(d.dramas[0].en.length).toBeLessThanOrEqual(600);
  });
});

describe("what they do goes on the timeline", () => {
  it("records a storyline begun and ended, someone leaving a group, a block, each known to those who would know", () => {
    const meta = newMeta();
    const threads = Object.fromEntries([...PEOPLE.map((p) => [p.id, newThread(p.id, "dm")]), [GROUP.id, newThread(GROUP.id, "group")]]);
    const deeds = deedsOf(
      {
        acts: [{ who: "lucius", do: "leave" }, { who: "gaius", do: "block" }],
        drama: [{ id: "debt", en: "Marcus owes a bookmaker", who: ["marcus"], knows: ["marcus", "lucius"] }],
      },
      everyone,
      everyone,
    );
    applyDeeds(meta, threads, deeds, T0, GROUP.id);
    const tl = meta.world!.timeline!;
    expect(tl.find((e) => e.en === "Marcus owes a bookmaker")).toMatchObject({ knows: ["marcus", "lucius"] });
    expect(tl.find((e) => e.en.startsWith("Lūcius left the group"))!.knows).toEqual(PEOPLE.map((p) => p.id));
    expect(tl.find((e) => e.en === "Gāius blocked the learner")!.knows).toEqual(["gaius"]);
    // over: known to those who knew of it
    applyDeeds(meta, threads, deedsOf({ drama: [{ id: "debt", over: true }] }, everyone, everyone), T0 + DAY, GROUP.id);
    expect(meta.world!.timeline!.at(-1)).toMatchObject({ en: "over: Marcus owes a bookmaker", knows: ["marcus", "lucius"] });
    // the timeline shows it only to those who know
    expect(timelineBlock(meta, ["iulia"], T0 + DAY)).not.toContain("bookmaker");
    expect(timelineBlock(meta, ["lucius"], T0 + DAY)).toContain("over: Marcus owes a bookmaker");
  });
});
