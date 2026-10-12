import { describe, expect, it } from "vitest";
import { makeBrief } from "../src/chat/brief";
import { meetStranger, refreshLives, writeOwn, writeReply } from "../src/chat/engine";
import { COMMON_HAPPENINGS, lifeNow, localTime, replyTiming, statusAt } from "../src/chat/life";
import { newMeta, newThread, Thread } from "../src/chat/model";
import { languageBlock, PromptCtx, replyPrompt } from "../src/chat/prompts";
import { rollStranger } from "../src/chat/strangers";
import { vetMessage, withMacrons } from "../src/chat/vet";
import { allowedWords, CHAT_WORDS, chatEntries, chatLexicon, formsFor, nameEntry, vocativeOf } from "../src/chat/words";
import { LESSONS } from "../src/content/lessons";
import { PARTS } from "../src/content/parts";
import { GROUP, PEOPLE, PERSON_BY_ID } from "../src/content/people";
import { PORTRAIT_BY_ID } from "../src/content/portraits";
import { seeded } from "../src/latin/generate";

const lessonWords = LESSONS.flatMap((l) => l.words);
const seenUpTo = (id: string) => new Set(PARTS.filter((p) => Number(p.id) <= Number(id)).flatMap((p) => p.skills));
const entries = chatEntries(lessonWords, [nameEntry("Kiril", "Kiril (your name)", "m")]);
const lex = chatLexicon(entries);
/** The learner of the smoke test: rules up to 3.2 seen. */
const SEEN = seenUpTo("3.2");
const ALL = seenUpTo("4.5");
const ctxFor = (seen: Set<string>, now = Date.UTC(2026, 9, 12, 12, 0)): PromptCtx => ({ now, me: { name: "Kiril", g: "m" }, tz: "Europe/Kyiv", words: allowedWords(entries, seen), seen });

describe("the messenger's words", () => {
  it("has a meaning for every chat word and declines names", () => {
    for (const w of CHAT_WORDS) expect(w.en.length).toBeGreaterThan(1);
    expect(vocativeOf("Marcus")).toBe("Marce");
    expect(vocativeOf("Lūcius")).toBe("Lūcī");
    expect(vocativeOf("Iūlia")).toBe("Iūlia");
    expect(lex.analyze("Marce").some((a) => a.key === "voc.sg")).toBe(true);
    expect(lex.analyze("Gāī").some((a) => a.key === "voc.sg")).toBe(true);
    expect(lex.analyze("Kiril").length).toBe(1);
  });

  it("allows only the forms of the rules seen", () => {
    const epistula = entries.find((e) => e.id === "epistula")!;
    expect(formsFor(epistula, seenUpTo("1.5"))).toEqual(["epistula"]);
    expect(formsFor(epistula, seenUpTo("2.1"))).toContain("epistulam");
    expect(formsFor(epistula, SEEN)).not.toContain("epistulā");
    const non = entries.find((e) => e.id === "non")!;
    expect(formsFor(non, seenUpTo("2.4"))).toEqual([]);
    expect(formsFor(non, seenUpTo("2.5"))).toEqual(["nōn"]);
    const sum = entries.find((e) => e.id === "sum")!;
    expect(formsFor(sum, SEEN)).toEqual([]);
    expect(formsFor(sum, seenUpTo("3.4"))).toEqual(expect.arrayContaining(["sum", "es", "est"]));
    expect(formsFor(sum, seenUpTo("3.4"))).not.toContain("sunt");
    // verbs: the present of I, you, he / she, they and the infinitive only
    const labor = entries.find((e) => e.id === "laboro")!;
    expect(formsFor(labor, ALL).sort()).toEqual(["labōrant", "labōrat", "labōrās", "labōrō", "labōrāre"].sort());
    // story-only words never; Jupiter may be named
    expect(entries.some((e) => e.id === "qui")).toBe(false);
    expect(formsFor(entries.find((e) => e.id === "iuppiter")!, SEEN)).toEqual(["Iuppiter"]);
  });

  it("vets messages: known words, forms and constructions only, with good grammar", () => {
    const ok = (t: string, seen = SEEN) => vetMessage(t, lex, seen).ok;
    expect(ok("Salvē, Marce! Quid agis? 😄")).toBe(true);
    expect(ok("Hahae! Epistulam scrībō.")).toBe(true);
    expect(ok("Quid legis, Gāī?")).toBe(true);
    expect(ok("HEU! NŌN DORMIŌ!")).toBe(true);
    expect(ok("Salvē, Kiril!")).toBe(true);
    // unknown words, forms and constructions not met yet
    expect(vetMessage("Salvē! Cēnam parō.", lex, SEEN).unknown).toEqual(["Cēnam", "parō"]);
    expect(ok("In silvā ambulō.")).toBe(false);
    expect(ok("In silvā ambulō.", ALL)).toBe(true);
    expect(ok("Lūcius poēta est.")).toBe(false);
    expect(ok("Lūcius poēta est.", ALL)).toBe(true);
    expect(ok("Puellae labōrant.")).toBe(false);
    // grammar: an adjective follows its noun's gender
    expect(ok("Agricola magna labōrat.", ALL)).toBe(false);
    expect(ok("Agricola magnus labōrat.", ALL)).toBe(true);
  });

  it("puts back long marks and keeps capitals", () => {
    expect(withMacrons("Salve Iulia! Epistulam scribo.", lex)).toBe("Salvē Iūlia! Epistulam scrībō.");
    expect(withMacrons("in silva ambulo", lex)).toBe("in silvā ambulō");
    expect(withMacrons("NON!", lex)).toBe("NŌN!");
  });

  it("tells Claude the words, the rules and what is not learned yet", () => {
    const block = languageBlock(ctxFor(SEEN));
    expect(block).toContain("epistula / epistulae / epistulam = letter");
    expect(block).toContain("salvē = hello");
    expect(block).toContain("Marcus / Marcī / Marcum / Marce");
    expect(block).toMatch(/Not learned yet, so never use: .*sum, es, est/);
    expect(block).not.toContain("quī");
  });
});

describe("the five friends", () => {
  it("are complete: a portrait, a time zone, a day, moods and happenings", () => {
    expect(PEOPLE.length).toBe(5);
    expect(PEOPLE.some((p) => p.g === "f" && p.age < 25)).toBe(true);
    for (const p of PEOPLE) {
      expect(PORTRAIT_BY_ID.get(p.portrait)?.g).toBe(p.g);
      expect(() => localTime(0, p.tz)).not.toThrow();
      expect(p.day.wake).toBeLessThan(p.day.sleep);
      expect(p.moods.length).toBeGreaterThan(3);
      expect(p.happenings.length).toBeGreaterThan(5);
      for (const h of p.happenings) expect(h.hours[0]).toBeLessThanOrEqual(h.hours[1]);
      for (const id of Object.keys(p.ties)) expect(PERSON_BY_ID.has(id)).toBe(true);
    }
    expect(new Set(PEOPLE.map((p) => p.portrait)).size).toBe(5);
  });

  it("sleep, work and are free at their own hours (in Rome's time)", () => {
    const at = (h: number) => Date.UTC(2026, 9, 12, h - 2, 0); // Rome is UTC+2 in October
    const lucius = PERSON_BY_ID.get("lucius")!;
    const gaius = PERSON_BY_ID.get("gaius")!;
    expect(statusAt(lucius.day, lucius.tz, at(2)).state).not.toBe("asleep");
    expect(statusAt(lucius.day, lucius.tz, at(8)).state).toBe("asleep");
    expect(statusAt(gaius.day, gaius.tz, at(5.5)).state).toBe("free");
    expect(statusAt(gaius.day, gaius.tz, at(7)).state).toBe("busy");
    expect(statusAt(gaius.day, gaius.tz, at(23)).state).toBe("asleep");
  });

  it("answer a sleeper's message after they wake up", () => {
    const iulia = PERSON_BY_ID.get("iulia")!;
    const night = Date.UTC(2026, 9, 12, 1, 0); // 03:00 in Rome
    const r = seeded(7);
    for (let i = 0; i < 30; i++) {
      const t = replyTiming(iulia.day, iulia.tz, night, r);
      const read = localTime(t.readAt, iulia.tz).h;
      // asleep: read after waking (7:30); one in twenty is woken up by it
      if (t.why.includes("woke")) expect(t.readAt - night).toBeLessThan(10 * 60_000);
      else expect(read).toBeGreaterThanOrEqual(7.5);
      expect(t.startAt).toBeGreaterThan(t.readAt);
    }
  });
});

describe("random lives", () => {
  it("roll moods and happenings: sometimes nothing, sometimes something, sometimes extreme or odd", () => {
    const spec = PERSON_BY_ID.get("lucius")!;
    const r = seeded(11);
    const lives = Array.from({ length: 400 }, (_, i) => lifeNow(spec, undefined, i * 1000, r).life);
    const events = lives.filter((l) => l.event);
    expect(events.length).toBeGreaterThan(120);
    expect(lives.length - events.length).toBeGreaterThan(100);
    expect(lives.some((l) => l.level === "extremely")).toBe(true);
    expect(lives.some((l) => l.level === "slightly")).toBe(true);
    expect(new Set(lives.map((l) => l.mood)).size).toBeGreaterThan(8);
    expect(events.some((l) => spec.happenings.some((h) => h.en === l.event))).toBe(true);
    expect(events.some((l) => COMMON_HAPPENINGS.some((h) => h.en === l.event))).toBe(true);
  });

  it("keep a happening going while it lasts, and change moods within it", () => {
    const spec = PERSON_BY_ID.get("gaius")!;
    const r = seeded(3);
    let life = lifeNow(spec, undefined, 0, r).life;
    for (let i = 0; i < 50 && !life.event; i++) life = lifeNow(spec, { ...life, moodUntil: 0 }, 0, r).life;
    expect(life.event).toBeTruthy();
    const later = lifeNow(spec, life, life.moodUntil + 1, r);
    if ((life.eventUntil ?? 0) > life.moodUntil + 1) {
      expect(later.changed).toBe(true);
      expect(later.life.event).toBe(life.event);
    }
    // nothing changes before it is time
    expect(lifeNow(spec, life, life.moodUntil - 1, r).changed).toBe(false);
  });

  it("make strangers truly different: names, places, tempers, quirks and faces", () => {
    const r = seeded(5);
    const used = { names: [] as string[], portraits: [] as string[] };
    const all = Array.from({ length: 60 }, () => {
      const s = rollStranger(r, used);
      used.names.push(s.name);
      used.portraits.push(s.portrait);
      return s;
    });
    for (const s of all) {
      expect(PORTRAIT_BY_ID.get(s.portrait)?.g).toBe(s.g);
      expect(PEOPLE.some((p) => p.portrait === s.portrait)).toBe(false);
      expect(s.age).toBeGreaterThanOrEqual(18);
      expect(() => localTime(0, s.tz)).not.toThrow();
      expect(s.day.wake).toBeLessThan(s.day.sleep);
    }
    expect(new Set(all.slice(0, 30).map((s) => s.name)).size).toBe(30);
    expect(new Set(all.map((s) => s.city)).size).toBeGreaterThan(10);
    expect(new Set(all.map((s) => s.intensity)).size).toBe(3);
    expect(all.some((s) => !s.quirk) && all.some((s) => s.quirk)).toBe(true);
    expect(new Set(all.map((s) => s.job)).size).toBeGreaterThan(25);
  });
});

describe("writing as the people (Claude played by the test)", () => {
  const meta = newMeta();
  const thread = (id: string, kind: Thread["kind"], la: string): Thread => ({ ...newThread(id, kind), messages: [{ id: "a", from: "me", la, at: Date.UTC(2026, 9, 12, 11, 59) }] });

  it("answers with vetted messages, one after another, and asks once for a rewrite when something slips", async () => {
    const prompts: string[] = [];
    const ask = async <T,>(prompt: string): Promise<T> => {
      prompts.push(prompt);
      if (prompt.includes("break the learner's limits")) return { messages: [{ la: "Nōn dormiō.", en: "I'm not sleeping." }] } as T;
      return { messages: [{ from: "marcus", la: "Salve! Epistulam scribo 😄", en: "Hi! I'm writing a letter 😄", gap: 2 }, { from: "marcus", la: "Vīnum bibō", en: "I'm drinking wine", gap: 3 }], remember: ["likes letters"] } as T;
    };
    const ctx = ctxFor(SEEN);
    const reply = await writeReply(thread("marcus", "dm", "Salvē Marce!"), meta, ctx, { ask, opts: {}, lex, r: seeded(1) });
    expect(reply.messages.map((m) => m.la)).toEqual(["Salvē! Epistulam scrībō 😄", "Nōn dormiō."]);
    expect(reply.messages[1].at).toBeGreaterThan(reply.messages[0].at);
    expect(reply.messages[0].at).toBeGreaterThan(reply.readAt);
    expect(reply.remember).toEqual(["likes letters"]);
    expect(prompts[0]).toContain("You write as Marcus");
    expect(prompts[0]).toMatch(/mood: /);
    expect(prompts[0]).toContain("Salvē Marce!");
    expect(meta.life.marcus).toBeTruthy();
  });

  it("lets only the group's own people speak, each when awake", async () => {
    const ask = async <T,>(): Promise<T> => ({ messages: [{ from: "iulia", la: "Euge!", en: "Great!", gap: 1 }, { from: "nobody", la: "Salvē!", en: "Hi!" }, { from: "gaius", la: "Labōrō.", en: "I'm working.", gap: 1 }] }) as T;
    const reply = await writeReply(thread(GROUP.id, "group", "Salvēte!"), newMeta(), ctxFor(SEEN), { ask, opts: {}, lex, r: seeded(2) });
    expect(reply.messages.map((m) => m.from)).toEqual(["iulia", "gaius"]);
  });

  it("writes on its own only into known chats, from people awake then", async () => {
    const at3am = Date.UTC(2026, 9, 12, 1, 0);
    const ask = async <T,>(): Promise<T> =>
      ({ messages: [{ chat: "iulia", from: "iulia", la: "Salvē!", en: "Hi!", in: 0 }, { chat: "lucius", from: "lucius", la: "Heu...", en: "Alas...", in: 5 }, { chat: "nowhere", from: "x", la: "Salvē!", en: "Hi!", in: 1 }] }) as T;
    const threads = [...PEOPLE.map((p) => newThread(p.id, "dm")), newThread(GROUP.id, "group")];
    const own = await writeOwn(threads, newMeta(), ctxFor(SEEN, at3am), { ask, opts: {}, lex, r: seeded(4) });
    // Iūlia is asleep at three in the morning; Lūcius, the night owl, is not
    expect(own.map((o) => o.chat)).toEqual(["lucius"]);
    expect(own[0].msg.at).toBeGreaterThanOrEqual(at3am + 5 * 60_000);
  });

  it("meets a stranger: rolled at random, made real by Claude, maybe writing first", async () => {
    const m = newMeta();
    const ask = async <T,>(): Promise<T> => ({ about: "A loud baker.", secret: "Cannot read.", happenings: [{ en: "the oven broke", mood: "furious", hours: [4, 12] }], first: [{ la: "Salvē! Quis es?", en: "Hi! Who are you?", gap: 1 }] }) as T;
    const { stranger, first, life } = await meetStranger(m, ctxFor(ALL), { ask, opts: {}, lex, r: seeded(9) });
    expect(stranger.about).toBe("A loud baker.");
    expect(stranger.happenings[0].en).toBe("the oven broke");
    expect(life.mood).toBeTruthy();
    if (stranger.writesFirst) expect(first.map((x) => x.la)).toEqual(["Salvē! Quis es?"]);
    else expect(first).toEqual([]);
    m.strangers[stranger.id] = stranger;
    expect(refreshLives(m, [stranger.id], Date.now())).toBe(true);
  });

  it("puts the moment of delivery and the learner into the prompt", () => {
    const t = thread("claudia", "dm", "Salvē Claudia!");
    const p = replyPrompt(t, newMeta(), ctxFor(SEEN), { at: Date.UTC(2026, 9, 12, 12, 5), why: "they are free" });
    expect(p).toContain("THE LEARNER: Kiril");
    expect(p).toContain("words about them take the endings of amīcus, discipulus");
    expect(p).toContain("they are free");
    expect(p).toContain("Never correct the learner's Latin");
  });
});

describe("the brief for the phone routine", () => {
  it("carries the words, everyone's sheet and their lives rolled ahead", () => {
    const now = Date.UTC(2026, 9, 12, 12, 0);
    const brief = makeBrief(newMeta(), ctxFor(SEEN, now), [], seeded(8));
    expect(brief.forms).toContain("epistulam");
    expect(brief.forms).toContain("salve");
    expect(brief.forms).not.toContain("est");
    expect(brief.people.map((p) => p.id)).toEqual(PEOPLE.map((p) => p.id));
    for (const p of PEOPLE) {
      const lives = brief.lives[p.id];
      expect(lives[0].from).toBe(now);
      expect(lives.length).toBeGreaterThan(3);
      for (let i = 1; i < lives.length; i++) expect(lives[i].from).toBeGreaterThan(lives[i - 1].from);
    }
    expect(brief.language).toContain("Words (only these forms)");
  });
});
