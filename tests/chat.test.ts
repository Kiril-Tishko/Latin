import { describe, expect, it } from "vitest";
import { makeBrief } from "../src/chat/brief";
import { meetStranger, refreshLives, writeOwn, writeReply } from "../src/chat/engine";
import { COMMON_HAPPENINGS, lifeNow, localTime, replyTiming, statusAt } from "../src/chat/life";
import { newMeta, newThread, preview, Thread, voiceOf } from "../src/chat/model";
import { adYear, birthdaysNear, calendarBlock, calendarWords, festivalsNear, romanDate, todayLine } from "../src/chat/calendar";
import { PHOTOS, photoSrc, photosFor } from "../src/content/photos";
import { literalReading } from "../src/latin/facts";
import { languageBlock, PromptCtx, replyPrompt } from "../src/chat/prompts";
import { LINKS, rollStranger } from "../src/chat/strangers";
import { vetMessage, withMacrons } from "../src/chat/vet";
import { allowedWords, calendarEntry, CHAT_WORDS, chatEntries, chatLexicon, formsFor, nameEntry, notLatin, strangeWords, vocativeOf } from "../src/chat/words";
import { LESSONS } from "../src/content/lessons";
import { PARTS } from "../src/content/parts";
import { GROUP, PEOPLE, PERSON_BY_ID } from "../src/content/people";
import { PORTRAIT_BY_ID } from "../src/content/portraits";
import { ENGRAVINGS } from "../src/content/engravings";
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

describe("the Roman year they live through", () => {
  it("names the days the Roman way", () => {
    expect(romanDate({ y: 2026, m: 10, d: 1 })).toBe("Kal. Oct.");
    expect(romanDate({ y: 2026, m: 10, d: 7 })).toBe("Nōn. Oct.");
    expect(romanDate({ y: 2026, m: 10, d: 12 })).toBe("a.d. IV Īd. Oct.");
    expect(romanDate({ y: 2026, m: 10, d: 15 })).toBe("Īd. Oct.");
    expect(romanDate({ y: 2026, m: 10, d: 31 })).toBe("prīdiē Kal. Nov.");
    expect(romanDate({ y: 2026, m: 12, d: 31 })).toBe("prīdiē Kal. Iān.");
    expect(romanDate({ y: 2026, m: 1, d: 5 })).toBe("Nōn. Iān.");
    expect(romanDate({ y: 2028, m: 2, d: 24 })).toBe("a.d. bis VI Kal. Mart.");
    expect(romanDate({ y: 2028, m: 2, d: 25 })).toBe("a.d. VI Kal. Mart.");
  });

  it("lives in AD 100 in 2026, with the festivals, birthdays and news of the day", () => {
    const oct12 = Date.UTC(2026, 9, 12, 10, 0);
    expect(adYear(2026)).toBe(100);
    expect(todayLine(oct12).la).toBe("a.d. IV Īd. Oct. · Augustālia");
    const block = calendarBlock(oct12);
    expect(block).toContain("AD 100, the 853rd year since Rome was founded");
    expect(block).toMatch(/tomorrow, the Fontinalia/);
    // next spring Trajan leaves for the Dacian war, and everyone talks of it the day before
    expect(calendarBlock(Date.UTC(2027, 2, 24, 10, 0))).toMatch(/Trajan leaves Rome for the war.*\(tomorrow\)/);
    expect(birthdaysNear({ y: 2026, m: 5, d: 1 }).map((x) => [x.item, x.days])).toEqual([["iulia", 1]]);
    expect(festivalsNear({ y: 2026, m: 12, d: 20 }).map((x) => x.item.la)).toContain("Sāturnālia");
  });

  it("lets the day's names be written while they are near", () => {
    const words = calendarWords(Date.UTC(2027, 2, 24, 10, 0)).map((w) => w.word);
    expect(words).toEqual(expect.arrayContaining(["Trāiānus", "Decebalus", "Dācia"]));
    const trajan = calendarEntry({ word: "Trāiānus", g: "m", en: "Trajan", decline: true });
    expect(formsFor(trajan, ALL)).toEqual(expect.arrayContaining(["Trāiānus", "Trāiānum"]));
    const saturnalia = calendarEntry({ word: "Sāturnālia", en: "the Saturnalia", decline: false });
    expect(formsFor(saturnalia, ALL)).toEqual(["Sāturnālia"]);
  });
});

describe("people who know each other", () => {
  it("links most strangers to one of the friends, living where the link needs them", () => {
    const rolled = Array.from({ length: 200 }, (_, i) => rollStranger(seeded(i + 1), { names: [], portraits: [] }, 1));
    const linked = rolled.filter((s) => s.link);
    expect(linked.length / rolled.length).toBeGreaterThan(0.55);
    expect(linked.length / rolled.length).toBeLessThan(0.85);
    for (const s of linked) {
      expect(PERSON_BY_ID.has(s.link!.to)).toBe(true);
      const spec = LINKS.find(([to, how]) => to === s.link!.to && how === s.link!.how)!;
      if (spec[2] === true) expect(s.city).toMatch(/^(Rome|Ostia)/);
      if (typeof spec[2] === "string") expect(s.city).toBe(spec[2]);
    }
  });

  it("tells each friend about the others' lives, the group and the strangers they know", () => {
    const meta = newMeta();
    const s = { ...rollStranger(seeded(3), { names: [], portraits: [] }, 1), link: { to: "marcus", how: "Marcus owes them money" } };
    meta.strangers[s.id] = s;
    const group = { ...newThread(GROUP.id, "group"), messages: [{ id: "g1", from: "lucius", la: "Heu...", at: Date.UTC(2026, 9, 12, 11, 0) }] };
    const t = { ...newThread("marcus", "dm"), messages: [{ id: "a", from: "me", la: "Salvē Marce!", at: Date.UTC(2026, 9, 12, 11, 59) }] };
    const p = replyPrompt(t, meta, { ...ctxFor(SEEN), group, calendar: calendarBlock(Date.UTC(2026, 9, 12, 12, 0)) }, { at: Date.UTC(2026, 9, 12, 12, 5), why: "free" });
    expect(p).toContain("THE OTHER FRIENDS, RIGHT NOW");
    expect(p).toMatch(/- Iūlia: .*mood/);
    expect(p).toContain("LATELY IN THE GROUP «Amīcī»");
    expect(p).toContain(`${s.name} (${s.job}, ${s.city}): Marcus owes them money`);
    expect(p).toContain("THE DAY IN ROME");
    const sp = replyPrompt({ ...newThread(s.id, "stranger"), messages: t.messages }, meta, ctxFor(SEEN), { at: Date.UTC(2026, 9, 12, 12, 5), why: "free" });
    expect(sp).toContain("Knows Marcus: Marcus owes them money");
    expect(sp).toContain("FRIEND AMONG THE LEARNER'S FRIENDS");
    expect(sp).toMatch(/- Marcus: .*mood/);
  });
});

describe("mistakes taken literally, voice messages and photos", () => {
  it("reads the learner's words literally and names the slips", () => {
    const r = literalReading("Ego aquam bibit", lex);
    expect(r).toContain("«bibit»: the form for he / she / it of bibō (drink)");
    expect(r).toContain("With Ego the verb is bibō");
    expect(literalReading("Salvē Iūlia! Quid agis?", lex)).not.toContain("The engine also finds");
    expect(literalReading("Aqua puellam bibit", lex)).toContain("«Aqua»: nominative singular (subject) of aqua (water)");
  });

  it("sends the literal reading with the answer, and keeps voice messages and real photos", async () => {
    const prompts: string[] = [];
    const ask = async <T,>(prompt: string): Promise<T> => {
      prompts.push(prompt);
      return {
        messages: [
          { from: "iulia", la: "Aqua tē bibit?! 😂", en: "The water drinks you?! 😂", gap: 1, voice: true },
          { from: "iulia", la: "", en: "", gap: 2, photo: "earring" },
          { from: "iulia", la: "Ecce!", en: "Look!", gap: 2, photo: "no-such-photo" },
        ],
        remember: [],
      } as T;
    };
    const t = { ...newThread("iulia", "dm"), messages: [{ id: "a", from: "me", la: "Ego aqua bibō", at: Date.UTC(2026, 9, 12, 11, 59) }] };
    const reply = await writeReply(t, newMeta(), ctxFor(ALL), { ask, opts: {}, lex, r: seeded(5) });
    expect(prompts[0]).toContain("HOW THE LEARNER'S LAST MESSAGE READS");
    expect(prompts[0]).toContain("«aqua»: nominative singular (subject)");
    expect(prompts[0]).toContain('"earring"');
    expect(reply.messages[0].voice).toBe(true);
    expect(reply.messages[1].photo).toBe("earring");
    expect(reply.messages[2].photo).toBeUndefined();
    expect(reply.messages[2].la).toBe("Ecce!");
    expect(preview(reply.messages[0])).toBe("🎤 Voice message");
    expect(preview(reply.messages[1])).toBe("📷 Photo");
  });

  it("has every photo in the build, credited, sent by people who exist", () => {
    expect(PHOTOS.length).toBeGreaterThan(20);
    // every photo's image is a file beside the page (built from src/content/photos)
    const files = Object.keys(import.meta.glob("../src/content/photos/*.webp")).map((f) => f.split("/").pop());
    for (const p of PHOTOS) {
      expect(photoSrc(p.id), p.id).toBe(`photos/${p.id}.webp`);
      expect(files, p.id).toContain(`${p.id}.webp`);
      expect(p.credit).toContain("CC0");
      if (p.who !== "any") for (const w of p.who) expect(PERSON_BY_ID.has(w), `${p.id}: ${w}`).toBe(true);
    }
    for (const person of PEOPLE) expect(photosFor(person.id, false).length, person.id).toBeGreaterThan(3);
    // the portraits and the engravings are files beside the page too
    const portraits = Object.keys(import.meta.glob("../src/content/portraits/*.webp")).map((f) => f.split("/").pop());
    for (const x of PORTRAIT_BY_ID.values()) expect(portraits, x.id).toContain(x.src.replace("portraits/", ""));
    const engravings = Object.keys(import.meta.glob("../src/content/engravings/*.webp")).map((f) => `engravings/${f.split("/").pop()}`);
    for (const x of Object.values(ENGRAVINGS)) expect(engravings).toContain(x.src);
    expect(photosFor("s123", true).every((p) => p.who === "any")).toBe(true);
  });

  it("gives each friend a voice of their own, and strangers one by age and sex", () => {
    expect(voiceOf(PERSON_BY_ID.get("gaius")!).pitch).toBeLessThan(voiceOf(PERSON_BY_ID.get("iulia")!).pitch);
    expect(voiceOf({ g: "f", age: 70 }).rate).toBeLessThan(voiceOf({ g: "f", age: 20 }).rate);
  });

  it("puts the day in Rome and the photos into the brief for the phone routine", () => {
    const now = Date.UTC(2027, 2, 24, 10, 0);
    const brief = makeBrief(newMeta(), ctxFor(SEEN, now), [], seeded(8));
    expect(brief.calendar.map((c) => c.day)).toEqual(["2027-03-24", "2027-03-25", "2027-03-26"]);
    expect(brief.calendar[0].text).toContain("THE DAY IN ROME");
    expect(brief.forms).toContain("traianus");
    expect(brief.photos.length).toBe(PHOTOS.length);
  });
});

describe("Check on English: how do I say it in Latin", () => {
  it("tells English, Russian and Ukrainian from Latin", () => {
    for (const t of ["I love you", "Salve Iulia, how are you?", "how to say because I love", "я тебе люблю", "Як справи?"]) expect(notLatin(t), t).toBe(true);
    for (const t of ["Ego amo te", "Puella est pulchra", "Salvē, Marce! Quid agis?", "In silvā ambulō.", "Ego volo tu"]) expect(notLatin(t), t).toBe(false);
  });
});

describe("New words stick: the words of a message the site does not know", () => {
  it("finds the learner's own new words, each once", () => {
    expect(strangeWords("Iūlia, cor timet! Cor!", lex)).toEqual(["cor", "timet"]);
    expect(strangeWords("Cor meum! In Londīniō sum.", lex)).toEqual(["cor", "Londīniō"]);
    expect(strangeWords("Salvē, Marce! Quid agis? Ego in silvā ambulō.", lex)).toEqual([]);
  });
  it("leaves out English messages, emoji codes and single letters", () => {
    expect(strangeWords("how do I say heart?", lex)).toEqual([]);
    expect(strangeWords("Salvē :lupa: :laurus: :laurea: ō", lex)).toEqual([]);
  });
});
