import { describe, expect, it } from "vitest";
import { applyBondChanges, applyTieChanges, bondChangesOf, bondPace, levelsNow, MAX_TIES, mergeTies, NEUTRAL, standing, standingLine, stepLevels, tieChangesOf, tieNow, tiesLine } from "../src/chat/bond";
import { applyFeelings, writeReply } from "../src/chat/engine";
import { makeBrief } from "../src/chat/brief";
import { mayWrite, paceOf } from "../src/chat/pace";
import { ownPrompt, replyPrompt } from "../src/chat/prompts";
import { Meta, newMeta, newThread, Thread } from "../src/chat/model";
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
const ctxAt = (now: number) => ({ now, me: { name: "Kiril", g: "m" as const }, tz: "Europe/Kyiv", words: allowedWords(entries, seen), seen });
const everyone = new Set(PEOPLE.map((p) => p.id));
const dm = (id: string, la: string, at = T0): Thread => ({ ...newThread(id, "dm"), messages: [{ id: `m-${id}`, from: "me", la, at }] });
const iulia = { ...PERSON_BY_ID.get("iulia")!, stranger: false };

describe("where each of them stands with the learner: levels that move like real feelings", () => {
  it("lets hurt heal at each one's pace, interest come back to their usual, warmth and desire fade only after a long silence", () => {
    const base = { ...NEUTRAL, interest: 6 };
    const lv = { warmth: 8, trust: 7, respect: 6, desire: 6, hurt: 6, interest: 10 };
    const a = levelsNow(lv, T0, T0 + 2 * DAY, base, 3);
    expect(a.hurt).toBe(0); // Marcus forgets by tomorrow
    expect(a.interest).toBe(10); // two days apart: still as interested
    expect(levelsNow(lv, T0, T0 + 2 * DAY, base, 0.3).hurt).toBeCloseTo(5.4); // Gāius holds a grudge
    const b = levelsNow(lv, T0, T0 + 12 * DAY, base, 1);
    expect(b.interest).toBe(7); // ten days of drifting back toward their usual 6
    expect(b.warmth).toBeCloseTo(7.8);
    expect(b.desire).toBeCloseTo(5.8);
    expect([b.trust, b.respect]).toEqual([7, 6]); // trust and respect do not drift
  });

  it("moves by small steps, grows no faster than a day allows, and falls at once", () => {
    const cur = { ...NEUTRAL };
    let { lv, gain } = stepLevels(cur, undefined, { warmth: 9, trust: -9, desire: 3 }, T0, 1.5);
    expect(lv.warmth).toBe(7); // +3 at most in one step, and +2 a day
    expect(lv.trust).toBe(2); // lost at once, but −3 at most per step
    expect(lv.desire).toBe(1.5); // she may fall only 1.5 a day
    ({ lv, gain } = stepLevels(lv, gain, { warmth: 2, desire: 2, hurt: 3 }, T0 + 3600_000, 1.5));
    expect(lv.warmth).toBe(7); // the day's warmth is spent
    expect(lv.desire).toBe(1.5);
    expect(lv.hurt).toBe(3); // a hurt has no daily limit
    // a new day, a new allowance
    ({ lv } = stepLevels(lv, gain, { warmth: 1, desire: 1 }, T0 + DAY, 1.5));
    expect([lv.warmth, lv.desire]).toEqual([8, 2.5]);
  });

  it("makes a crush take days: Lūcius falls fast, Gāius hardly at all, however often Claude says so", () => {
    const fall = (id: string, days: number) => {
      const meta = newMeta();
      for (let d = 0; d < days; d++) for (let h = 0; h < 5; h++) applyBondChanges(meta, [{ who: id, delta: { desire: 3 } }], T0 + d * DAY + h * 3600_000);
      return standing(id, meta, T0 + days * DAY).lv.desire;
    };
    expect(fall("lucius", 1)).toBe(3); // 1 + 2
    expect(fall("lucius", 3)).toBe(7);
    expect(fall("iulia", 1)).toBe(3.5); // 2 + 1.5
    expect(fall("gaius", 3)).toBeCloseTo(0.9);
  });

  it("takes a first measure once, for someone never measured, then only steps", () => {
    const meta = newMeta();
    expect(standing("iulia", meta, T0)).toEqual({ lv: PERSON_BY_ID.get("iulia")!.nature.start, set: false });
    const raw = { levels: { iulia: { warmth: 8, desire: 6, hurt: 4, interest: "9", trust: null }, ghost: { warmth: 1 } }, bond: { marcus: { warmth: 1, mood: 3 } } };
    const changes = bondChangesOf(raw, everyone);
    expect(changes).toEqual([
      { who: "marcus", delta: { warmth: 1 } },
      { who: "iulia", levels: { warmth: 8, desire: 6, hurt: 4, interest: 9 } },
    ]);
    applyBondChanges(meta, changes, T0);
    expect(standing("iulia", meta, T0)).toEqual({ lv: { warmth: 8, trust: 4, respect: 5, desire: 6, hurt: 4, interest: 9 }, set: true });
    expect(standing("marcus", meta, T0).lv.warmth).toBe(7); // his start, 6, and a step
    // a second "levels" is ignored: once measured, feelings only move by steps
    applyBondChanges(meta, [{ who: "iulia", levels: { warmth: 1 } }], T0 + 60_000);
    expect(standing("iulia", meta, T0 + 60_000).lv.warmth).toBe(8);
    // the feelings in words are kept beside the levels
    meta.bonds!.iulia.feel = "He watches me.";
    applyBondChanges(meta, [{ who: "iulia", delta: { hurt: -2 } }], T0 + 120_000);
    expect(meta.bonds!.iulia.feel).toBe("He watches me.");
  });

  it("puts the standing in the prompt: asks for a first measure, then shows the levels in words", () => {
    const meta = newMeta();
    const first = replyPrompt(dm("iulia", "Salvē!"), meta, ctxAt(T0), { at: T0, why: "free" });
    expect(first).toContain('Where Iūlia stands with the learner: NOT SET YET');
    expect(first).toContain('give "levels" for Iūlia');
    expect(first).toContain('"bond": {"<person id>": {"warmth": <change>');
    applyBondChanges(meta, [{ who: "iulia", levels: { warmth: 8, desire: 6, hurt: 4, interest: 9, trust: 5, respect: 6 } }], T0);
    const later = replyPrompt(dm("iulia", "Salvē!"), meta, ctxAt(T0), { at: T0, why: "free" });
    expect(later).toContain("Where Iūlia stands with the learner now (0-10, private): warmth 8 (fond) · trust 5 (trusts) · respect 6 (respects) · desire 6 (falling for) · hurt 4 (hurt) · interest 9 (fascinated).");
    expect(later).not.toContain("Where Iūlia stands with the learner: NOT SET YET");
    // the routine's sheet shows the standing, but asks nothing (the routine does not measure)
    const brief = makeBrief(newMeta(), ctxAt(T0), [], seeded(1));
    const sheet = brief.people.find((p) => p.id === "gaius")!.sheet;
    expect(sheet).toContain("Where Gāius stands with the learner, by their nature");
    expect(sheet).not.toContain('give "levels"');
    expect(standingLine(iulia, meta, T0)).toContain("warmth 8");
  });
});

describe("how they see each other: ties that change with what happens", () => {
  it("starts from each friend's own ties, takes Claude's changes and notes, and lets hurt heal", () => {
    const meta = newMeta();
    expect(tieNow("lucius", "iulia", meta, T0).lv).toMatchObject({ warmth: 9, desire: 8 });
    expect(tieNow("marcus", "lucius", meta, T0).lv).toMatchObject({ trust: 4, hurt: 1 });
    const raw = [
      { from: "lucius", to: "iulia", note: "She laughed at my ode in front of everyone.", hurt: 5, warmth: -1 },
      { from: "marcus", to: "marcus", warmth: 2 },
      { from: "ghost", to: "iulia", warmth: 2 },
      { from: "iulia", to: "lucius" },
    ];
    const changes = tieChangesOf(raw, everyone, everyone);
    expect(changes).toEqual([{ from: "lucius", to: "iulia", note: "She laughed at my ode in front of everyone.", delta: { hurt: 5, warmth: -1 } }]);
    applyTieChanges(meta, changes, T0);
    const t = tieNow("lucius", "iulia", meta, T0);
    expect(t.lv).toMatchObject({ warmth: 8, desire: 8, hurt: 3 }); // a step is 3 at most
    expect(t.note).toBe("She laughed at my ode in front of everyone.");
    expect(tieNow("lucius", "iulia", meta, T0 + 2 * DAY).lv.hurt).toBe(1); // Lūcius forgives one a day
    // a later change keeps the note when it brings none
    applyTieChanges(meta, [{ from: "lucius", to: "iulia", delta: { warmth: 1 } }], T0 + DAY);
    expect(tieNow("lucius", "iulia", meta, T0 + DAY).note).toBe("She laughed at my ode in front of everyone.");
  });

  it("shows each person only their own feelings about the others", () => {
    const meta = newMeta();
    applyTieChanges(meta, [{ from: "lucius", to: "marcus", note: "He mocks me and still has my sandals.", delta: { hurt: 3, warmth: -2 } }], T0);
    const lucius = { ...PERSON_BY_ID.get("lucius")!, stranger: false };
    const line = tiesLine(lucius, meta, T0);
    expect(line).toContain('Marcus: borrows money from him; now: "He mocks me and still has my sandals."');
    expect(line).toContain("Iūlia: in love with her; writes her poems [warmth 9, desire 8, interest 9]");
    const toLucius = replyPrompt(dm("lucius", "Salvē!"), meta, ctxAt(T0), { at: T0, why: "free" });
    expect(toLucius).toContain("still has my sandals");
    // Marcus does not know how Lūcius feels about him, nor how Lūcius feels about Iūlia (his own block only)
    const toMarcus = replyPrompt(dm("marcus", "Salvē!"), meta, ctxAt(T0), { at: T0, why: "free" });
    expect(toMarcus).not.toContain("sandals");
    expect(toMarcus).not.toContain("desire 8");
    // in the group each member's own feelings are there, for Claude to play them
    const group = replyPrompt({ ...newThread(GROUP.id, "group"), messages: [{ id: "g1", from: "me", la: "Salvēte!", at: T0 }] }, meta, ctxAt(T0), { at: T0, why: "free" });
    expect(group).toContain("still has my sandals");
    expect(group).toContain('"ties": [{"from": "<person id>"');
    expect(ownPrompt([...PEOPLE.map((p) => newThread(p.id, "dm")), newThread(GROUP.id, "group")], meta, ctxAt(T0), 1)).toContain('"ties" (when something between two of them changed');
  });

  it("merges two devices' ties pair by pair, and keeps the newest when there are too many", () => {
    const tie = (at: number) => ({ lv: { ...NEUTRAL }, at, updatedAt: at });
    const m = mergeTies({ "a>b": tie(1), "a>c": tie(5) }, { "a>b": tie(3), "a>c": tie(2), "b>a": tie(1) })!;
    expect(Object.fromEntries(Object.entries(m).map(([k, t]) => [k, t.updatedAt]))).toEqual({ "a>b": 3, "a>c": 5, "b>a": 1 });
    const meta: Meta = { ...newMeta(), ties: Object.fromEntries(Array.from({ length: MAX_TIES }, (_, i) => [`x${i}>y`, tie(i)])) };
    applyTieChanges(meta, [{ from: "iulia", to: "marcus", delta: { warmth: 1 } }], T0);
    expect(Object.keys(meta.ties!)).toHaveLength(MAX_TIES);
    expect(meta.ties!["iulia>marcus"]).toBeDefined();
    expect(meta.ties!["x0>y"]).toBeUndefined();
  });
});

describe("feelings change how they write first", () => {
  it("makes the deeply hurt wait for the learner, the smitten try once more, the bored stop chasing", () => {
    const pace = { patience: 2, wait: 24, nudges: 1 };
    expect(bondPace(pace, { ...NEUTRAL, hurt: 8 })).toEqual({ patience: 0, wait: 24, nudges: 0 });
    expect(bondPace(pace, { ...NEUTRAL, hurt: 5 })).toEqual({ patience: 1, wait: 24, nudges: 1 });
    expect(bondPace(pace, { ...NEUTRAL, desire: 7 })).toEqual({ patience: 2, wait: 18, nudges: 2 });
    expect(bondPace(pace, { ...NEUTRAL, interest: 2 })).toEqual({ patience: 2, wait: 36, nudges: 0 });
    const meta = newMeta();
    // until measured, their own pace
    expect(paceOf("iulia", meta, T0)).toEqual(PERSON_BY_ID.get("iulia")!.pace);
    // a first measure stays within reach of their nature (hurt 4 at most), then a shock
    applyBondChanges(meta, [{ who: "iulia", levels: { hurt: 9 }, delta: { hurt: 3 } }], T0);
    expect(standing("iulia", meta, T0).lv.hurt).toBe(7);
    applyBondChanges(meta, [{ who: "iulia", delta: { hurt: 2 } }], T0);
    const p = paceOf("iulia", meta, T0 + 3600_000);
    expect(p.patience).toBe(0);
    expect(mayWrite(p, { unanswered: 0, lastAt: 0, learnerAt: T0 - DAY, seen: false }, T0 + 3600_000).ok).toBe(false);
    // hurt heals (1.5 a day): in three days she may write first again
    expect(paceOf("iulia", meta, T0 + 3 * DAY).patience).toBeGreaterThan(0);
    // the routine's brief carries the changed pace
    expect(makeBrief(meta, ctxAt(T0 + 3600_000), [], seeded(1)).people.find((x) => x.id === "iulia")!.pace.patience).toBe(0);
  });
});

describe("a conversation's answer moves them", () => {
  it("takes the levels, the steps and the ties from Claude's answer and keeps them", async () => {
    const meta = newMeta();
    const ask = async <T,>(): Promise<T> =>
      ({
        messages: [{ from: "iulia", la: "Hahae! Tū mē rīdēre facis.", en: "Haha! You make me laugh." }],
        levels: { iulia: { warmth: 7, trust: 5, respect: 6, desire: 5, hurt: 2, interest: 8 } },
        bond: { marcus: { warmth: 2 } },
        ties: [{ from: "iulia", to: "lucius", note: "His poems are getting on my nerves.", warmth: -1 }],
        feel: { iulia: "He is funnier than I thought." },
      }) as T;
    const reply = await writeReply(dm("iulia", "Ego poēta sum!"), meta, ctxAt(T0), { ask, opts: {}, lex, r: seeded(3) });
    expect(reply.bonds).toEqual([{ who: "iulia", levels: { warmth: 7, trust: 5, respect: 6, desire: 5, hurt: 2, interest: 8 } }]); // Marcus is not in this chat
    expect(reply.ties).toHaveLength(1);
    applyFeelings(meta, reply, T0);
    expect(standing("iulia", meta, T0)).toMatchObject({ set: true, lv: { desire: 5, interest: 8 } });
    expect(meta.bonds!.iulia.feel).toBe("He is funnier than I thought.");
    expect(tieNow("iulia", "lucius", meta, T0)).toMatchObject({ note: "His poems are getting on my nerves.", lv: { warmth: 4 } });
    expect(standing("marcus", meta, T0).set).toBe(false);
  });
});
