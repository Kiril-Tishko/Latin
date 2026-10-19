import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { allowOwn, BURST_MAX, groupMayWrite, mayWrite, overPace, paceNow, paceOf, paceLine, similar, strangerPace } from "../src/chat/pace";
import { writeOwn } from "../src/chat/engine";
import { returnLine } from "../src/chat/prompts";
import { Meta, Msg, newMeta, newThread, Thread } from "../src/chat/model";
import { GROUP, PEOPLE, PERSON_BY_ID } from "../src/content/people";
import { allowedWords, chatEntries, chatLexicon, nameEntry } from "../src/chat/words";
import { LESSONS } from "../src/content/lessons";
import { PARTS } from "../src/content/parts";
import { seeded } from "../src/latin/generate";

const H = 3600_000;
const M = 60_000;
/** 13:00 in Rome on a Monday: everyone is awake. */
const T0 = Date.UTC(2026, 9, 19, 11, 0);
let n = 0;
const msg = (from: string, at: number, la = `Nūntius ${++n}`, extra: Partial<Msg> = {}): Msg => ({ id: `m${++n}`, from, la, at, src: from === "me" ? undefined : "own", ...extra });
const chat = (id: string, msgs: Msg[], readAt = 0): Thread => ({ ...newThread(id, id === GROUP.id ? "group" : "dm"), messages: msgs, readAt });

describe("pacing like real people: a message or two, then they wait", () => {
  it("counts the bursts someone sent since the learner last wrote, not their answer to it", () => {
    const t = chat("iulia", [msg("me", T0), msg("iulia", T0 + M, "", { src: "reply" }), msg("iulia", T0 + 2 * M, "", { src: "reply" }), msg("iulia", T0 + 3 * H), msg("iulia", T0 + 3 * H + 10 * M), msg("iulia", T0 + 8 * H)]);
    const p = paceNow(t, "iulia", T0 + 9 * H);
    expect(p).toMatchObject({ unanswered: 2, lastAt: T0 + 8 * H, learnerAt: T0 });
    // after the learner writes again, nothing is owed
    expect(paceNow({ ...t, messages: [...t.messages, msg("me", T0 + 10 * H)] }, "iulia", T0 + 11 * H).unanswered).toBe(0);
  });

  it("each waits in their own way: Iūlia twice, then once more after a day and more; Gāius once, then nothing", () => {
    const iulia = PERSON_BY_ID.get("iulia")!.pace;
    expect(mayWrite(iulia, { unanswered: 1, lastAt: T0, learnerAt: T0 - H, seen: false }, T0 + H).ok).toBe(true);
    const waiting = mayWrite(iulia, { unanswered: 2, lastAt: T0, learnerAt: T0 - H, seen: false }, T0 + H);
    expect(waiting.ok).toBe(false);
    expect(waiting.until).toBe(T0 + iulia.wait * H);
    expect(mayWrite(iulia, { unanswered: 2, lastAt: T0, learnerAt: T0 - H, seen: false }, T0 + iulia.wait * H)).toMatchObject({ ok: true, last: true });
    expect(mayWrite(iulia, { unanswered: 3, lastAt: T0, learnerAt: T0 - H, seen: false }, T0 + 99 * H)).toMatchObject({ ok: false, until: Infinity });
    const gaius = PERSON_BY_ID.get("gaius")!.pace;
    expect(mayWrite(gaius, { unanswered: 0, lastAt: 0, learnerAt: T0, seen: false }, T0)).toMatchObject({ ok: true, last: true });
    expect(mayWrite(gaius, { unanswered: 1, lastAt: T0, learnerAt: T0 - H, seen: false }, T0 + 500 * H).ok).toBe(false);
    // the five are not alike
    expect(new Set(PEOPLE.map((p) => JSON.stringify(p.pace))).size).toBe(5);
  });

  it("strangers wait by their temper; someone the learner never answered counts every burst", () => {
    const meta = newMeta();
    meta.strangers.s1 = { intensity: "extreme" } as Meta["strangers"][string];
    expect(paceOf("s1", meta)).toEqual(strangerPace({ intensity: "extreme" }));
    expect(strangerPace({ intensity: "mild" }).patience).toBeLessThan(strangerPace({ intensity: "extreme" }).patience);
    const t = chat("s1", [msg("s1", T0, "", { src: "first" }), msg("s1", T0 + 5 * H)]);
    expect(paceNow(t, "s1", T0 + 6 * H).unanswered).toBe(2);
  });

  it("tells the prompt who is waiting, and the person notices when the learner comes back", () => {
    const t = chat("claudia", [msg("me", T0), msg("claudia", T0 + M, "", { src: "reply" }), msg("claudia", T0 + 20 * H)], T0 + 21 * H);
    const pace = PERSON_BY_ID.get("claudia")!.pace;
    const line = paceLine("Claudia", pace, paceNow(t, "claudia", T0 + 22 * H), T0 + 22 * H, "Europe/Rome", "Kiril");
    expect(line).toContain("Claudia has written once since Kiril last wrote here");
    expect(line).toContain("Kiril has seen it and said nothing");
    expect(line).toContain("They wait: nothing before");
    const back = { ...t, messages: [...t.messages, msg("me", T0 + 30 * H, "Salvē!")] };
    const ctx = { now: T0 + 30 * H + 1000, me: { name: "Kiril", g: "m" as const }, tz: "Europe/Kyiv", words: [], seen: new Set<string>() };
    expect(returnLine(back, { ...PERSON_BY_ID.get("claudia")!, stranger: false }, ctx)).toMatch(/CLAUDIA HAD BEEN WAITING: .* wrote once more with no answer, the last 10 hours ago/);
  });

  it("gives the group a rhythm of its own: quieter while the learner is away, three hours apart", () => {
    const away = chat(GROUP.id, [msg("me", T0 - 5 * 24 * H), msg("marcus", T0 - 16 * H), msg("iulia", T0 - 16 * H + M)]);
    // yesterday's talk does not count today; today, once
    expect(groupMayWrite(away, T0).ok).toBe(true);
    const today = { ...away, messages: [...away.messages, msg("lucius", T0 + 10 * M), msg("gaius", T0 + 12 * M)] };
    expect(groupMayWrite(today, T0 + 4 * H)).toMatchObject({ ok: false });
    // while the learner takes part, more often, but not right after the last talk
    const busy = chat(GROUP.id, [msg("me", T0 - H), msg("marcus", T0 - H + M, "", { src: "reply" }), msg("iulia", T0)]);
    expect(groupMayWrite(busy, T0 + H).ok).toBe(false);
    expect(groupMayWrite(busy, T0 + 3 * H + M).ok).toBe(true);
  });

  it("knows a repeat when it sees one (a one-word cry may come back)", () => {
    expect(similar("Tū bene dormīs?", "Tū bene dormīs? 🌙")).toBe(true);
    expect(similar("Cyrille! Marcus male dormit!", "Cyrille! Marcus nōn dormit.")).toBe(true);
    expect(similar("Cyrille! Hodiē Mārs! 🏇🔥", "Cyrille! Hodiē Mārs!!! :laurus:")).toBe(true);
    expect(similar("Heu!", "Heu!")).toBe(false);
    expect(similar("Cyrille! Tū vidēs?", "Cyrille! Tū bene dormīs?")).toBe(false);
  });

  it("lets a burst go on (a few messages), refuses a repeat and a photo sent there lately", () => {
    const pace = PERSON_BY_ID.get("marcus")!.pace;
    let t = chat("marcus", [msg("me", T0 - 24 * H), msg("marcus", T0 - 24 * H + M, "Salvē!", { src: "reply" }), msg("marcus", T0 - 2 * H, "Hodiē Mārs! Spectō!", { photo: "marcus-crowd" })]);
    expect(allowOwn(t, "marcus", { la: "Pānem edō 🍞" }, T0, pace, false).ok).toBe(true);
    expect(allowOwn(t, "marcus", { la: "Hodiē Mārs!!! Spectō!" }, T0, pace, false)).toMatchObject({ ok: false, why: "says again what they said lately" });
    expect(allowOwn(t, "marcus", { la: "Ecce!", photo: "marcus-crowd" }, T0, pace, false)).toMatchObject({ ok: false, why: "that photo was sent here lately" });
    const lines = ["Pānem edō", "Equus currit", "Iūlia rīdet", "Nunc labōrō"];
    for (let i = 0; i < BURST_MAX; i++) {
      const at = T0 + i * M;
      expect(allowOwn(t, "marcus", { la: lines[i] }, at, pace, false).ok).toBe(true);
      t = { ...t, messages: [...t.messages, msg("marcus", at, lines[i])] };
    }
    expect(allowOwn(t, "marcus", { la: "Et aliud" }, T0 + BURST_MAX * M, pace, false)).toMatchObject({ ok: false, why: "enough messages in a row" });
  });

  it("keeps someone waiting from writing on their own, and lets the others write", async () => {
    const meta = newMeta();
    const words = LESSONS.flatMap((l) => l.words);
    const entries = chatEntries(words, [nameEntry("Kiril", "Kiril (your name)", "m")]);
    const seen = new Set(PARTS.flatMap((p) => p.skills));
    const ctx = { now: T0, me: { name: "Kiril", g: "m" as const }, tz: "Europe/Kyiv", words: allowedWords(entries, seen), seen };
    const threads = [
      chat("iulia", [msg("me", T0 - 50 * H), msg("iulia", T0 - 50 * H + M, "Salvē!", { src: "reply" }), msg("iulia", T0 - 30 * H, "Ubi es?"), msg("iulia", T0 - 20 * H, "Cyrille?")]),
      chat("claudia", [msg("me", T0 - 50 * H), msg("claudia", T0 - 50 * H + M, "Valē!", { src: "reply" })]),
      newThread(GROUP.id, "group"),
    ];
    const ask = async <T,>(): Promise<T> =>
      ({
        messages: [
          { chat: "iulia", from: "iulia", la: "Cyrille, labōrās?", en: "Cyrillus, are you working?", in: 0 },
          { chat: "claudia", from: "claudia", la: "Hodiē discipulae bene labōrant.", en: "Today the students work well.", in: 1 },
          { chat: "claudia", from: "claudia", la: "Et tū?", en: "And you?", in: 2 },
        ],
      }) as T;
    const own = await writeOwn(threads, meta, ctx, { ask, opts: {}, lex: chatLexicon(entries), r: seeded(3) });
    expect(own.messages.map((o) => [o.chat, o.msg.la])).toEqual([
      ["claudia", "Hodiē discipulae bene labōrant."],
      ["claudia", "Et tū?"],
    ]);
  });

  it("tidies what was written beyond someone's pace and not seen yet; keeps what the learner saw and every answer", () => {
    const t = chat(
      "marcus",
      [
        msg("me", T0),
        msg("marcus", T0 + M, "Salvē!", { src: "reply" }),
        msg("marcus", T0 + 5 * H, "Hodiē Mārs!", { src: "routine" }),
        msg("marcus", T0 + 6 * H, "Pānem edō", { src: "routine" }),
        msg("marcus", T0 + 7 * H, "Cyrille!!! Equī currunt!", { src: "routine" }),
        msg("marcus", T0 + 40 * H, "Ubi es, Cyrille?", { src: "routine" }),
        msg("marcus", T0 + 41 * H, "Heu", { src: "routine" }),
      ],
      T0 + 6 * H + M,
    );
    const drop = overPace(t, newMeta(), false);
    const kept = t.messages.filter((m) => !drop.includes(m.id)).map((m) => m.la);
    // seen: the first two of his own stay; unseen: the third burst goes; a day later one last try; then nothing
    expect(kept.slice(1)).toEqual(["Salvē!", "Hodiē Mārs!", "Pānem edō", "Ubi es, Cyrille?"]);
    expect(kept).toContain("Hodiē Mārs!");
    expect(kept).toContain("Pānem edō");
    expect(kept).not.toContain("Cyrille!!! Equī currunt!");
    expect(kept).toContain("Ubi es, Cyrille?");
    expect(kept).not.toContain("Heu");
  });
});

describe("the phone routine's helper paces exactly like the page", () => {
  it("allows and refuses the same messages as allowOwn, counting the inbox as sent", () => {
    const dir = mkdtempSync(join(tmpdir(), "nuntii-"));
    const base = join(dir, "data/users/me/messenger");
    mkdirSync(join(base, "threads"), { recursive: true });
    mkdirSync(join(base, "inbox"), { recursive: true });
    mkdirSync(join(base, "brief"), { recursive: true });
    const meta = newMeta();
    const threads: Record<string, Thread> = {
      iulia: chat("iulia", [msg("me", T0 - 50 * H), msg("iulia", T0 - 50 * H + M, "Salvē Cyrille", { src: "reply" }), msg("iulia", T0 - 30 * H, "Ubi tū")]),
      gaius: chat("gaius", [msg("me", T0 - 10 * H), msg("gaius", T0 - 10 * H + M, "Bene", { src: "reply" })]),
      claudia: chat("claudia", [msg("me", T0 - 3 * H), msg("claudia", T0 - 3 * H + M, "Valē Cyrille", { src: "reply" })]),
      [GROUP.id]: chat(GROUP.id, [msg("me", T0 - 5 * 24 * H), msg("marcus", T0 - 16 * H, "Hodiē Mārs")]),
    };
    for (const [id, t] of Object.entries(threads)) writeFileSync(join(base, "threads", `${id}.json`), JSON.stringify(t));
    // Iūlia's second try is still in the inbox: it counts
    const inboxAt = T0 - 20 * H;
    writeFileSync(join(base, "inbox", "rinbox1.json"), JSON.stringify({ chat: "iulia", from: "iulia", la: "Cyrille tū labōrās", en: "x", at: inboxAt }));
    writeFileSync(join(base + ".json"), JSON.stringify(meta));
    const words = ["salve", "cyrille", "ubi", "tu", "bene", "vale", "hodie", "mars", "laboras", "specto", "et", "aquam", "bibo", "puella", "ecce", "nunc", "scribo", "non", "dormio"];
    const brief = {
      v: 1,
      me: { name: "Cyrillus", g: "m", tz: "Europe/Kyiv" },
      forms: words,
      people: PEOPLE.map((p) => ({ id: p.id, name: p.name, tz: p.tz, wake: p.day.wake, sleep: p.day.sleep, busy: p.day.busy, sheet: "", pace: p.pace, burst: p.nature.burst })),
      photos: [{ id: "claudia-books", en: "books", who: ["claudia"] }],
      groups: { [GROUP.id]: { name: "Amīcī", members: PEOPLE.map((p) => p.id) } },
    };
    writeFileSync(join(base, "brief/now.json"), JSON.stringify(brief));
    const drafts = [
      { chat: "iulia", from: "iulia", la: "Cyrille, nunc scrībō", en: "x" },
      { chat: "gaius", from: "gaius", la: "Aquam bibō", en: "x" },
      { chat: "gaius", from: "gaius", la: "Et nunc", en: "x" },
      { chat: "gaius", from: "gaius", la: "Puella bene", en: "x" },
      { chat: "claudia", from: "claudia", la: "Ecce!", en: "x", photo: "claudia-books" },
      { chat: "claudia", from: "claudia", la: "Valē, Cyrille!", en: "x" },
      { chat: GROUP.id, from: "lucius", la: "Nunc nōn dormiō", en: "x" },
      { chat: GROUP.id, from: "marcus", la: "Hodiē Mārs!", en: "x" },
    ];
    writeFileSync(join(dir, "draft.json"), JSON.stringify(drafts));
    let out: string;
    try {
      const env = (globalThis as unknown as { process: { env: Record<string, string> } }).process.env;
      const helper = new URL("../scripts/nuntii-routine.py", import.meta.url).pathname;
      out = execFileSync("python3", ["-I", helper, "vet", dir, join(dir, "draft.json"), join(dir, "new.json")], { env: { ...env, NUNTII_NOW: String(T0) }, encoding: "utf8" });
    } catch (e) {
      if ((e as { code?: string }).code === "ENOENT") return; // no python here
      throw e;
    }
    const saved = JSON.parse(readFileSync(join(dir, "new.json"), "utf8")) as { chat: string; la: string; at: number; id: string }[];
    // the page's own rules, message by message, with the same times
    const sim: Record<string, Thread> = Object.fromEntries(Object.entries(threads).map(([id, t]) => [id, { ...t, messages: [...t.messages] }]));
    sim.iulia.messages.push({ id: "rinbox1", from: "iulia", la: "Cyrille tū labōrās", at: inboxAt, src: "routine" });
    const last: Record<string, number> = {};
    const expected: string[] = [];
    for (const d of drafts) {
      const when = Math.max(T0 + 3000, (last[d.chat] ?? 0) + 2000 + Math.min(14000, 1200 + d.la.length * 95));
      const t = sim[d.chat];
      if (allowOwn(t, d.from, d, when, paceOf(d.from, meta), d.chat === GROUP.id, PERSON_BY_ID.get(d.from)!.nature.burst).ok) {
        expected.push(`${d.chat}:${d.la}`);
        t.messages.push({ id: `x${expected.length}`, from: d.from, la: d.la, at: when, src: "routine", ...(d.photo ? { photo: d.photo } : {}) });
        last[d.chat] = when;
      }
    }
    expect(saved.map((s) => `${s.chat}:${s.la}`)).toEqual(expected);
    // what it is: Iūlia waits (her inbox message was her second try); Gāius writes once, two messages at most; Claudia may, but not say goodbye again;
    // the group talks once today, and Marcus does not say again what he said yesterday
    expect(expected).toEqual(["gaius:Aquam bibō", "gaius:Et nunc", "claudia:Ecce!", `${GROUP.id}:Nunc nōn dormiō`]);
    expect(out).toContain("NOT ALLOWED [iulia] iulia");
    expect(out).toContain("says again what they said lately");
    expect(saved.every((s) => /^r[0-9a-z]+[a-z]{3}$/.test(s.id) && s.at >= T0)).toBe(true);
  });
});
