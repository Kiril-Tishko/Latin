import { describe, expect, it } from "vitest";
import { makeBrief } from "../src/chat/brief";
import { applyFeelings, meetFromStory, meetStranger, refreshLives, writeOwn, writeReply } from "../src/chat/engine";
import { COMMON_HAPPENINGS, lifeNow, localTime, replyTiming, statusAt } from "../src/chat/life";
import { deletedNow, groupIds, groupMembers, groupName, iBlocked, isBlocked, isGroupId, membersOf, mergeBonds, mergeMine, mergeReactions, mergeWorld, Msg, newMeta, newThread, preview, reactionsOf, silentNow, SYS, Thread, voiceOf } from "../src/chat/model";
import { applyDeeds, deedsOf, welcome } from "../src/chat/world";
import { applyMinds } from "../src/chat/mind";
import { adYear, birthdaysNear, calendarBlock, calendarWords, festivalsNear, romanDate, todayLine } from "../src/chat/calendar";
import { PHOTO_CREDIT, PHOTOS, photoSrc, photosFor } from "../src/content/photos";
import scenes from "../scripts/content/photos.json";
import routinePy from "../scripts/nuntii-routine.py?raw";
import routineMd from "../scripts/messenger-routine.md?raw";
import picturesMd from "../scripts/pictures-routine.md?raw";
import { phrasebook } from "../src/content/phrases";
import { literalReading } from "../src/latin/facts";
import { conversationBlock, languageBlock, ownPrompt, PromptCtx, replyPrompt, worldLine } from "../src/chat/prompts";
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
    expect(block).toMatch(/Not learned yet, so never use these constructions \(the words in them may still be listed for other uses\): .*sum, es, est/);
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
    expect(reply.memories).toEqual([{ who: "marcus", text: "likes letters", kind: "fact", weight: 2, about: ["me"] }]);
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
    expect(own.messages.map((o) => o.chat)).toEqual(["lucius"]);
    expect(own.messages[0].msg.at).toBeGreaterThanOrEqual(at3am + 5 * 60_000);
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
    expect(p).toContain("never correct the learner's Latin");
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
    // the others' lives reach him only as memories (told, or seen in the group): no news of them for free
    expect(p).not.toContain("THE OTHER FRIENDS, RIGHT NOW");
    expect(p).toContain("LATELY IN THE GROUP «Amīcī»");
    expect(p).toContain(`${s.name} (${s.job}, ${s.city}): Marcus owes them money`);
    expect(p).toContain("THE DAY IN ROME");
    const sp = replyPrompt({ ...newThread(s.id, "stranger"), messages: t.messages }, meta, ctxFor(SEEN), { at: Date.UTC(2026, 9, 12, 12, 5), why: "free" });
    expect(sp).toContain("Knows Marcus: Marcus owes them money");
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
          { from: "iulia", la: "", en: "", gap: 2, photo: "iulia-figs" },
          { from: "iulia", la: "Ecce!", en: "Look!", gap: 2, photo: "no-such-photo" },
        ],
        remember: [],
      } as T;
    };
    const t = { ...newThread("iulia", "dm"), messages: [{ id: "a", from: "me", la: "Ego aqua bibō", at: Date.UTC(2026, 9, 12, 11, 59) }] };
    const reply = await writeReply(t, newMeta(), ctxFor(ALL), { ask, opts: {}, lex, r: seeded(5) });
    expect(prompts[0]).toContain("HOW THE LEARNER'S LAST MESSAGE READS");
    expect(prompts[0]).toContain("«aqua»: nominative singular (subject)");
    expect(prompts[0]).toContain('"iulia-figs"');
    expect(reply.messages[0].voice).toBe(true);
    expect(reply.messages[1].photo).toBe("iulia-figs");
    expect(reply.messages[2].photo).toBeUndefined();
    expect(reply.messages[2].la).toBe("Ecce!");
    expect(preview(reply.messages[0])).toBe("🎤 Voice message");
    expect(preview(reply.messages[1])).toBe("📷 Photo");
  });

  it("has every photo in the build, sent by people who exist, each scene ready to be made again", () => {
    expect(PHOTOS.length).toBeGreaterThan(100);
    expect(PHOTO_CREDIT).toContain("AI");
    // the scenes the pictures were made from (scripts/content/photos.py makes any that is missing)
    expect(scenes.map((x) => x.id).sort()).toEqual(PHOTOS.map((p) => p.id).sort());
    // every photo's image is a file beside the page (built from src/content/photos)
    const files = Object.keys(import.meta.glob("../src/content/photos/*.webp")).map((f) => f.split("/").pop());
    for (const p of PHOTOS) {
      expect(photoSrc(p.id), p.id).toBe(`photos/${p.id}.webp`);
      expect(files, p.id).toContain(`${p.id}.webp`);
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
    // a laugh, "ok", or a known word with a slipped ending is no new word
    expect(strangeWords("Hahaha, ok! Puellum videō et librom legō.", lex)).toEqual([]);
    // long marks do not make Latin look like English
    expect(notLatin("Salvē, Iūlia! Amīcam habeō.")).toBe(false);
    expect(strangeWords("Salvē, Marce! Quid agis? Ego in silvā ambulō.", lex)).toEqual([]);
  });
  it("leaves out English messages, emoji codes and single letters", () => {
    expect(strangeWords("how do I say heart?", lex)).toEqual([]);
    expect(strangeWords("Salvē :lupa: :laurus: :laurea: ō", lex)).toEqual([]);
  });
});

describe("the phrasebook beside the emoji", () => {
  const marcus = PERSON_BY_ID.get("marcus")!;
  const books = [phrasebook([marcus], false), phrasebook(PEOPLE, true), ...PEOPLE.map((p) => phrasebook([p], false))];
  it("greets the person by name, or everyone in the group", () => {
    const one = phrasebook([marcus], false).flatMap((g) => g.phrases.map((p) => p.la));
    expect(one).toEqual(expect.arrayContaining(["Salvē, Marce!", "Valē, Marce!", "Quid agis?", "Ita.", "Minimē.", "Grātiās!", "Bene dormī!"]));
    const all = phrasebook(PEOPLE, true).flatMap((g) => g.phrases.map((p) => p.la));
    expect(all).toEqual(expect.arrayContaining(["Salvēte, amīcī!", "Valēte, amīcī!", "Quid agitis?", "Marce!", "Gāī!", "Lūcī!", "Iūlia!", "Claudia!"]));
    expect(all).not.toContain("Salvē, Marce!");
  });
  it("uses only words the site knows, but for the one its note names", () => {
    for (const book of books)
      for (const ph of book.flatMap((g) => g.phrases)) {
        const allowed = ph.note ? [ph.note.split(":")[0]] : [];
        expect(strangeWords(ph.la, lex).filter((w) => !allowed.includes(w.toLowerCase())), ph.la).toEqual([]);
        expect(ph.en.length, ph.la).toBeGreaterThan(1);
      }
  });
  it("lists each phrase once", () => {
    for (const book of books) {
      const la = book.flatMap((g) => g.phrases.map((p) => p.la));
      expect(new Set(la).size).toBe(la.length);
    }
  });
});

describe("like a real messenger: quotes, reactions, friends who talk", () => {
  const at = Date.UTC(2026, 9, 12, 11, 0);
  const msgs: Msg[] = [
    { id: "q1", from: "me", la: "Quid legis?", at },
    { id: "q2", from: "iulia", la: "Epistulam legō.", at: at + 60_000 },
    { id: "q3", from: "me", la: "Ego quoque! Et Marcus?", at: at + 120_000, re: "q2" },
  ];
  const t: Thread = { ...newThread("iulia", "dm"), messages: msgs };

  it("answers a message by its number, quoted, and reacts to the learner's last one", async () => {
    const ask = async <T,>(): Promise<T> =>
      ({ messages: [{ from: "iulia", la: "Marcus labōrat.", en: "Marcus is working.", gap: 1, re: 3 }, { from: "iulia", la: "Euge!", en: "Great!", gap: 1, re: 1 }], react: [{ from: "iulia", emoji: "❤" }, { from: "iulia", emoji: "😂" }, { from: "nobody", emoji: "🔥" }] }) as T;
    const reply = await writeReply(t, newMeta(), ctxFor(SEEN, at + 180_000), { ask, opts: {}, lex, r: seeded(3) });
    // a quote of the very last message says nothing: left out; an earlier one is kept
    expect(reply.messages.map((m) => m.re)).toEqual([undefined, "q1"]);
    // one reaction per person, made one of the reactions ("❤" is "❤️"), on the learner's last message, once read
    expect(reply.reactions.map((x) => [x.msg, x.from, x.e])).toEqual([["q3", "iulia", "❤️"]]);
    expect(reply.reactions[0].at).toBeGreaterThan(reply.readAt);
  });

  it("may answer with a reaction alone", async () => {
    const ask = async <T,>(): Promise<T> => ({ messages: [], react: [{ from: "iulia", emoji: "😂" }] }) as T;
    const reply = await writeReply(t, newMeta(), ctxFor(SEEN, at + 180_000), { ask, opts: {}, lex, r: seeded(3) });
    expect(reply.messages).toEqual([]);
    expect(reply.reactions.map((x) => x.e)).toEqual(["😂"]);
  });

  it("shows Claude the numbers, the quotes and the reactions", () => {
    const withReaction: Thread = { ...t, messages: msgs.map((m) => (m.id === "q2" ? { ...m, reactions: { me: { e: "❤️", at: at + 90_000 } } } : m)) };
    const block = conversationBlock(withReaction, newMeta(), ctxFor(SEEN, at + 180_000), "Europe/Rome");
    expect(block).toMatch(/^#1 \[/);
    expect(block).toContain("Epistulam legō.   (Kiril reacted ❤️)");
    expect(block).toContain("Kiril (answering #2 «Epistulam legō.»): Ego quoque!");
    expect(replyPrompt(withReaction, newMeta(), ctxFor(SEEN, at + 180_000), { at: at + 200_000, why: "free" })).toContain('"react"');
  });

  it("keeps the newer reaction of each person, a taken-back one too, and shows only those that have come", () => {
    const merged = mergeReactions({ me: { e: "❤️", at: 1 }, iulia: { e: "😂", at: 5 } }, { me: { e: "", at: 2 } });
    expect(merged).toEqual({ me: { e: "", at: 2 }, iulia: { e: "😂", at: 5 } });
    const m: Msg = { id: "x", from: "me", la: "Salvēte!", at: 0, reactions: { iulia: { e: "😂", at: 5 }, marcus: { e: "😂", at: 6 }, gaius: { e: "👍", at: 99 }, lucius: { e: "", at: 4 } } };
    expect(reactionsOf(m, 10)).toEqual([{ e: "😂", who: ["iulia", "marcus"] }]);
  });

  it("keeps what the learner says in private out of the others' prompts (chat/mind.ts carries what each knows)", () => {
    const ctx = { ...ctxFor(SEEN), minds: { iulia: { id: "iulia", memories: [{ id: "k1", at: ctxFor(SEEN).now - 3600_000, text: "Kiril has a cat named Felix", about: ["me"], kind: "fact" as const, weight: 3, from: "saw", chat: "iulia", updatedAt: 0 }], updatedAt: 0 } } };
    expect(replyPrompt(newThread("marcus", "dm"), newMeta(), ctx, { at: ctx.now, why: "free" })).not.toContain("Felix");
    expect(replyPrompt(newThread("iulia", "dm"), newMeta(), ctx, { at: ctx.now, why: "free" })).toContain("Kiril has a cat named Felix");
    expect(replyPrompt(newThread(GROUP.id, "group"), newMeta(), ctx, { at: ctx.now, why: "free" })).toContain("WHAT IŪLIA REMEMBERS");
  });
});

describe("real relationships: feelings about the learner, trolling, grudges, silence", () => {
  const at = Date.UTC(2026, 9, 12, 12, 0);
  const thread = (id: string, kind: Thread["kind"], la: string): Thread => ({ ...newThread(id, kind), messages: [{ id: "a", from: "me", la, at }] });

  it("give everyone a nature in love and in fights, and a first impression of the learner", () => {
    for (const p of PEOPLE) {
      expect(p.heart.length, p.id).toBeGreaterThan(80);
      expect(p.first.length, p.id).toBeGreaterThan(20);
    }
    const prompt = replyPrompt(thread("gaius", "dm", "Salvē!"), newMeta(), ctxFor(SEEN, at), { at: at + 60_000, why: "free" });
    expect(prompt).toContain("Does not trust the learner yet");
    expect(prompt).toContain("With people they care about:");
    // a person, not a rulebook: no forced niceness, but nothing sexual on the page
    expect(prompt).not.toMatch(/never cruel|friendly and clean|light and sweet/);
    expect(prompt).toContain("Trolling works on them");
    expect(prompt).toContain("no plot to follow");
    expect(prompt).toContain("WHAT THEY CAN DO");
    expect(prompt).toContain("anything sexual stays implied, never described");
    expect(prompt).toContain('"feel"');
    expect(prompt).toContain('"silent"');
  });

  it("keep what a conversation did to them: their feelings, a dated moment, a mood, the silent treatment", async () => {
    const meta = newMeta();
    const ask = async <T,>(): Promise<T> =>
      ({
        messages: [],
        feel: { lucius: "He laughed at my poem. I hate him. A little.", nobody: "x" },
        moment: { lucius: "mocked my poem about the moon" },
        mood: { lucius: "wounded" },
        silent: { lucius: 6 },
      }) as T;
    const reply = await writeReply(thread("lucius", "dm", "Carmen tuum malum est!"), meta, ctxFor(ALL, at), { ask, opts: {}, lex, r: seeded(3) });
    // no answer at all is an answer: he read it and said nothing
    expect(reply.messages).toEqual([]);
    expect(Object.keys(reply.feelings)).toEqual(["lucius"]);
    applyFeelings(meta, reply, at);
    const bond = meta.bonds!.lucius;
    expect(bond.feel).toContain("I hate him");
    // the moment is his memory now (chat/mind.ts)
    expect(reply.memories).toEqual([{ who: "lucius", text: "mocked my poem about the moon", kind: "moment", weight: 3, about: ["me"] }]);
    const minds = Object.fromEntries(applyMinds({}, { memories: reply.memories, chat: "lucius" }, at, (id) => id).map((m) => [m.id, m]));
    expect(silentNow(bond, at + 5 * 3600_000)).toBe(true);
    expect(silentNow(bond, at + 7 * 3600_000)).toBe(false);
    expect(meta.life.lucius.mood).toBe("wounded");
    // the next prompt knows: how he feels, what happened, and that he is ignoring the learner
    const next = replyPrompt(thread("lucius", "dm", "Ignosce!"), meta, { ...ctxFor(ALL, at + 3600_000), minds }, { at: at + 3700_000, why: "free" });
    expect(next).toContain("I hate him. A little.");
    expect(next).toContain("mocked my poem about the moon");
    expect(next).toContain("silent treatment");
    // making up ends the silence, and the feeling moves on
    applyFeelings(meta, { feelings: { lucius: { feel: "Fine. I forgive him. Poets must.", silent: 0 } }, moods: {} }, at + 3600_000);
    expect(silentNow(meta.bonds!.lucius, at + 2 * 3600_000)).toBe(false);
    expect(meta.bonds!.lucius.feel).toContain("I forgive him");
  });

  it("let someone giving the silent treatment write nothing to the learner in private, but still talk in the group", async () => {
    const meta = newMeta();
    applyFeelings(meta, { feelings: { iulia: { feel: "Furious.", silent: 10 } }, moods: {} }, at);
    const ask = async <T,>(): Promise<T> =>
      ({ messages: [{ chat: "iulia", from: "iulia", la: "Hmm.", en: "Hmm.", in: 1 }, { chat: GROUP.id, from: "iulia", la: "Salvēte!", en: "Hi all!", in: 2 }] }) as T;
    const threads = [...PEOPLE.map((p) => newThread(p.id, "dm")), newThread(GROUP.id, "group")];
    const own = await writeOwn(threads, meta, ctxFor(SEEN, at), { ask, opts: {}, lex, r: seeded(4) });
    expect(own.messages.map((o) => o.chat)).toEqual([GROUP.id]);
  });

  it("let feelings move while the learner is away", async () => {
    const meta = newMeta();
    const ask = async <T,>(): Promise<T> => ({ messages: [], feel: { claudia: "Kiril has not written for days. I worry." }, moment: { claudia: "noticed Kiril's silence" } }) as T;
    const threads = [...PEOPLE.map((p) => newThread(p.id, "dm")), newThread(GROUP.id, "group")];
    const own = await writeOwn(threads, meta, ctxFor(SEEN, at), { ask, opts: {}, lex, r: seeded(4) });
    expect(meta.bonds!.claudia.feel).toContain("I worry");
    // a moment is a memory now (chat/mind.ts); what began in their lives meanwhile is remembered too (chat/lives.ts)
    expect(own.memories).toContainEqual({ who: "claudia", text: "noticed Kiril's silence", kind: "moment", weight: 3, about: ["me"] });
  });

  it("keep each one's feelings their own (the others learn them only if told), the newer from two devices, and tell the phone routine", () => {
    const meta = newMeta();
    applyFeelings(meta, { feelings: { iulia: { feel: "I think I have a crush on Kiril." } }, moods: {} }, at);
    const p = replyPrompt(thread("marcus", "dm", "Salvē!"), meta, ctxFor(SEEN, at), { at: at + 60_000, why: "free" });
    expect(p).not.toContain("crush on Kiril");
    expect(replyPrompt(thread("iulia", "dm", "Salvē!"), meta, ctxFor(SEEN, at), { at: at + 60_000, why: "free" })).toContain("crush on Kiril");
    const older = { iulia: { feel: "old", moments: [], updatedAt: 1 } };
    expect(mergeBonds(older, meta.bonds).iulia.feel).toContain("crush");
    expect(mergeBonds(meta.bonds, older).iulia.feel).toContain("crush");
    const brief = makeBrief(meta, ctxFor(SEEN, at), [], seeded(8));
    expect(brief.people.find((x) => x.id === "iulia")!.sheet).toContain("crush on Kiril");
    expect(brief.people.find((x) => x.id === "gaius")!.sheet).toContain("Does not trust the learner yet");
  });
});

describe("people with freedom: what they do besides writing", () => {
  const at = Date.UTC(2026, 9, 12, 12, 0);
  const everyone = new Set(PEOPLE.map((p) => p.id));
  const threads = (): Record<string, Thread> => Object.fromEntries([...PEOPLE.map((p) => newThread(p.id, "dm")), newThread(GROUP.id, "group")].map((t) => [t.id, t]));

  it("check what Claude says they do: known kinds, real people, their own messages only", () => {
    const shown: Msg[] = [{ id: "x", from: "marcus", la: "Hahae", at }, { id: "y", from: "me", la: "Salvē", at }];
    const d = deedsOf(
      {
        acts: [
          { who: "marcus", do: "delete", msg: 1 },
          { who: "marcus", do: "delete", msg: 2 },
          { who: "nobody", do: "block" },
          { who: "iulia", do: "fly" },
          { who: "lucius", do: "rename" },
          { who: "lucius", do: "rename", text: "Poētae et cēterī" },
          { who: "gaius", do: "away", text: "the market in Rome" },
        ],
        drama: [{ id: "Love Triangle", en: "Lūcius loves Iūlia; Marcus knows", who: ["lucius", "iulia", "nobody"] }],
        newPerson: [{ name: "Quīntus", g: "m", age: 30, job: "rival poet", city: "Rome", about: "Lūcius's rival.", link: { to: "lucius", how: "rival" }, joinGroup: true }, { name: "not a name!", g: "m" }],
      },
      everyone,
      everyone,
      shown,
    );
    expect(d.acts.map((a) => `${a.who}:${a.do}`)).toEqual(["marcus:delete", "lucius:rename", "gaius:away"]);
    expect(d.acts[0].msg).toBe("x");
    expect(d.acts[2].hours).toBe(48);
    expect(d.dramas).toEqual([{ id: "love-triangle", en: "Lūcius loves Iūlia; Marcus knows", who: ["lucius", "iulia"], over: false }]);
    expect(d.newPeople.map((p) => p.name)).toEqual(["Quīntus"]);
  });

  it("change the messenger itself: leaving, joining, adding someone new, renaming, blocking, travelling, deleting, storylines", () => {
    const meta = newMeta();
    const ts = threads();
    ts.marcus = { ...ts.marcus, messages: [{ id: "x", from: "marcus", la: "Hahae", at }] };
    const deeds = deedsOf(
      {
        acts: [
          { who: "lucius", do: "leave" },
          { who: "iulia", do: "rename", text: "Sine Lūciō" },
          { who: "marcus", do: "block" },
          { who: "gaius", do: "away", hours: 72, text: "Pompōnia's sister in Tibur" },
          { who: "claudia", do: "status", text: "Fessa sum." },
          { who: "marcus", do: "delete", msg: 1 },
        ],
        drama: [{ id: "feud", en: "Lūcius and Gāius are not speaking", who: ["lucius", "gaius"] }],
        newPerson: [{ name: "Quīntus", g: "m", age: 30, job: "rival poet", city: "Rome", about: "Lūcius's rival.", link: { to: "lucius", how: "his rival" }, joinGroup: true }],
      },
      everyone,
      everyone,
      ts.marcus.messages,
    );
    const born = welcome(meta, deeds.newPeople, seeded(5), at);
    expect(born[0].name).toBe("Quīntus");
    expect(born[0].invented).toBe(true);
    const changed = applyDeeds(meta, ts, deeds, at, GROUP.id, born);
    const group = changed.find((t) => t.id === GROUP.id)!;
    expect(group.messages.filter((m) => m.from === SYS).map((m) => m.en)).toEqual(["Lūcius left the group.", "Iūlia renamed the group «Sine Lūciō».", "Lūcius added Quīntus."]);
    expect(groupMembers(meta)).not.toContain("lucius");
    expect(groupMembers(meta)).toContain(born[0].id);
    expect(groupName(meta)).toBe("Sine Lūciō");
    expect(isBlocked(meta, "marcus")).toBe(true);
    expect(meta.world!.away!.gaius.until).toBe(at + 72 * 3600_000);
    expect(meta.world!.status!.claudia.text).toBe("Fessa sum.");
    expect(deletedNow(changed.find((t) => t.id === "marcus")!.messages[0], at)).toBe(true);
    expect(meta.world!.dramas!.map((d) => d.id)).toEqual(["feud"]);
    // the prompts know it all: the group now, who blocked the learner, who is away, the storylines
    const p = replyPrompt(newThread(GROUP.id, "group"), meta, ctxFor(SEEN, at), { at: at + 60_000, why: "free" });
    expect(p).toContain("«Sine Lūciō»");
    expect(p).toContain("Quīntus");
    expect(p).not.toMatch(/You write as the people in the group chat[^\n]*Lūcius/);
    expect(p).toContain("Lūcius and Gāius are not speaking");
    const dm = replyPrompt(newThread("marcus", "dm"), meta, ctxFor(SEEN, at), { at: at + 60_000, why: "free" });
    expect(dm).toContain("has blocked the learner");
    expect(dm).toContain("WHAT THEY CAN DO");
    // and the brief for the phone routine too
    const brief = makeBrief(meta, ctxFor(SEEN, at), [], seeded(8));
    expect(brief.world).toContain("Sine Lūciō");
    expect(brief.people.find((x) => x.id === "gaius")!.sheet).toContain("is away (Pompōnia's sister in Tibur)");
    // the newer world wins on another device, keeping the storylines of both
    const other = { updatedAt: 1, dramas: [{ id: "old", en: "an old story", who: [], since: 1, updatedAt: 1 }] };
    const merged = mergeWorld(other, meta.world)!;
    expect(merged.group!.name).toBe("Sine Lūciō");
    expect(merged.dramas!.map((d) => d.id).sort()).toEqual(["feud", "old"]);
  });

  it("let a strong moment carry a new word with its meaning, take a message back, and nothing reach someone who blocked the learner", async () => {
    const meta = newMeta();
    const ask = async <T,>(prompt: string): Promise<T> => {
      if (prompt.includes("break the learner's limits")) return { messages: [{ la: "Heu!", en: "Alas!" }] } as T;
      return { messages: [{ from: "iulia", la: "Basium tibi!", en: "A kiss for you!", gloss: { basium: "a kiss" }, gap: 1 }, { from: "iulia", la: "Ō…", en: "Oh…", unsend: 5, gap: 1 }] } as T;
    };
    const t = { ...newThread("iulia", "dm"), messages: [{ id: "a", from: "me", la: "Salvē!", at }] };
    const reply = await writeReply(t, meta, ctxFor(ALL, at), { ask, opts: {}, lex, r: seeded(3) });
    // "tibi" is not one of the learner's words and is not glossed: that message is written again
    expect(reply.messages[0].la).toBe("Heu!");
    const ask2 = async <T,>(): Promise<T> => ({ messages: [{ from: "iulia", la: "Basium!", en: "A kiss!", gloss: { basium: "a kiss" }, gap: 1 }, { from: "iulia", la: "Ō…", en: "Oh…", unsend: 5, gap: 1 }] }) as T;
    const r2 = await writeReply(t, meta, ctxFor(ALL, at), { ask: ask2, opts: {}, lex, r: seeded(3) });
    expect(r2.messages[0].la).toBe("Basium!");
    expect(r2.messages[0].gloss).toEqual({ basium: "a kiss" });
    expect(r2.messages[0].newWords).toEqual(["Basium"]);
    expect(r2.messages[1].deletedAt).toBe(r2.messages[1].at + 5000);
    expect(preview(r2.messages[1], r2.messages[1].at + 6000)).toBe("🚫 Message deleted");
    // blocked: whoever blocked the learner writes nothing to them in private, unless they unblock them now
    applyDeeds(meta, threads(), { acts: [{ who: "marcus", do: "block" }], dramas: [], newPeople: [], tells: [] }, at, GROUP.id);
    const own = async <T,>(): Promise<T> => ({ messages: [{ chat: "marcus", from: "marcus", la: "Salvē.", en: "Hi.", in: 1 }] }) as T;
    const ts = [...PEOPLE.map((p) => newThread(p.id, "dm")), newThread(GROUP.id, "group")];
    expect((await writeOwn(ts, meta, ctxFor(SEEN, at), { ask: own, opts: {}, lex, r: seeded(4) })).messages).toEqual([]);
    const unblock = async <T,>(): Promise<T> => ({ messages: [{ chat: "marcus", from: "marcus", la: "Salvē.", en: "Hi.", in: 1 }], acts: [{ who: "marcus", do: "unblock" }] }) as T;
    const back = await writeOwn(ts, meta, ctxFor(SEEN, at), { ask: unblock, opts: {}, lex, r: seeded(4) });
    expect(back.messages.length).toBe(1);
    expect(back.deeds.acts).toEqual([{ who: "marcus", do: "unblock" }]);
  });
});

describe("the learner's own abilities: groups, blocking, muting, deleting, photos, anyone from the story", () => {
  const at = Date.UTC(2026, 9, 12, 12, 0);
  const everyone = new Set(PEOPLE.map((p) => p.id));
  const threads = (): Record<string, Thread> => Object.fromEntries([...PEOPLE.map((p) => newThread(p.id, "dm")), newThread(GROUP.id, "group")].map((t) => [t.id, t]));

  it("keeps groups besides the friends' own: members, names, who started them, merged across devices", () => {
    const meta = newMeta();
    meta.world = { updatedAt: at, groups: { "g-cena": { name: "Cēna", members: ["iulia", "marcus"], by: "me", at, updatedAt: at } } };
    expect(isGroupId("g-cena", meta)).toBe(true);
    expect(isGroupId("marcus", meta)).toBe(false);
    expect(groupIds(meta)).toEqual([GROUP.id, "g-cena"]);
    expect(groupName(meta, "g-cena")).toBe("Cēna");
    expect(membersOf("g-cena", meta).map((w) => w.id)).toEqual(["iulia", "marcus"]);
    expect(groupMembers(meta)).toEqual(PEOPLE.map((p) => p.id));
    // the people know which groups they share with the learner, and who made one
    expect(worldLine({ ...PERSON_BY_ID.get("iulia")!, stranger: false }, meta, at)).toContain("«Cēna»");
    const p = replyPrompt(newThread("g-cena", "group"), meta, ctxFor(SEEN, at), { at: at + 60_000, why: "free" });
    expect(p).toContain("group chat «Cēna»");
    expect(p).toContain("a group the learner made");
    expect(p).not.toMatch(/You write as the people in the group chat[^\n]*Gāius/);
    // another device's copy: each group the newer
    const other = { updatedAt: at + 5, groups: { "g-cena": { name: "Cēna magna", members: ["iulia"], by: "me", at, updatedAt: at + 5 }, "g-x": { name: "X", members: ["gaius"], by: "gaius", at, updatedAt: at } } };
    const merged = mergeWorld(meta.world, other)!;
    expect(merged.groups!["g-cena"].name).toBe("Cēna magna");
    expect(Object.keys(merged.groups!).sort()).toEqual(["g-cena", "g-x"]);
    // the learner's choices: the newer copy
    expect(mergeMine({ blocked: ["marcus"], muted: [], updatedAt: 2 }, { blocked: [], muted: ["amici"], updatedAt: 1 })!.blocked).toEqual(["marcus"]);
  });

  it("lets the people start a group of their own with the learner, throw someone out, rename any group", () => {
    const meta = newMeta();
    meta.world = { updatedAt: at, groups: { "g-cena": { name: "Cēna", members: ["iulia", "marcus", "gaius"], by: "me", at, updatedAt: at } } };
    const groups = new Set(groupIds(meta));
    const deeds = deedsOf(
      {
        acts: [
          { who: "marcus", do: "newGroup", text: "Sine Iūliā", with: ["me", "lucius", "nobody"], messages: [{ from: "marcus", la: "Salvēte!", en: "Hi all!" }, { from: "iulia", la: "Hahae", en: "Haha" }] },
          { who: "iulia", do: "remove", whom: "gaius", group: "g-cena" },
          { who: "marcus", do: "rename", text: "Cēna optima", group: "g-cena" },
          { who: "marcus", do: "leave", group: "g-nowhere" },
          { who: "lucius", do: "newGroup", text: "Sōlus", with: [] },
        ],
      },
      everyone,
      everyone,
      [],
      groups,
    );
    expect(deeds.acts.map((a) => `${a.who}:${a.do}`)).toEqual(["marcus:newGroup", "iulia:remove", "marcus:rename"]);
    expect(deeds.acts[0].with).toEqual(["me", "lucius"]);
    // a message from someone not in the new group is dropped
    expect(deeds.acts[0].messages!.map((m) => m.from)).toEqual(["marcus"]);
    const changed = applyDeeds(meta, threads(), deeds, at, GROUP.id);
    const made = Object.entries(meta.world!.groups!).find(([, g]) => g.name === "Sine Iūliā")!;
    expect(made[1].members).toEqual(["marcus", "lucius"]);
    expect(made[1].by).toBe("marcus");
    const fresh = changed.find((t) => t.id === made[0])!;
    expect(fresh.kind).toBe("group");
    expect(fresh.messages.map((m) => m.en)).toEqual(["Marcus created the group «Sine Iūliā» and added you.", "Hi all!"]);
    expect(groupMembers(meta, "g-cena")).toEqual(["iulia", "marcus"]);
    expect(groupName(meta, "g-cena")).toBe("Cēna optima");
    const cena = changed.find((t) => t.id === "g-cena")!;
    expect(cena.messages.map((m) => m.en)).toEqual(["Iūlia removed Gāius.", "Marcus renamed the group «Cēna optima»."]);
    expect(groupIds(meta)).toContain(made[0]);
  });

  it("tells the people who the learner blocked, and nothing they send in private arrives", async () => {
    const meta = newMeta();
    meta.mine = { blocked: ["lucius"], muted: ["amici"], updatedAt: at };
    expect(iBlocked(meta, "lucius")).toBe(true);
    expect(worldLine({ ...PERSON_BY_ID.get("lucius")!, stranger: false }, meta, at)).toContain("THE LEARNER HAS BLOCKED LŪCIUS");
    const ts = [...PEOPLE.map((p) => newThread(p.id, "dm")), newThread(GROUP.id, "group")];
    expect(ownPrompt(ts, meta, ctxFor(SEEN, at), 1)).toContain("the learner has blocked them");
    const own = async <T,>(): Promise<T> => ({ messages: [{ chat: "lucius", from: "lucius", la: "Salvē.", en: "Hi.", in: 1 }, { chat: GROUP.id, from: "lucius", la: "Salvēte.", en: "Hi all.", in: 2 }] }) as T;
    const out = await writeOwn(ts, meta, ctxFor(SEEN, at), { ask: own, opts: {}, lex, r: seeded(4) });
    // in the group they still talk
    expect(out.messages.map((m) => m.chat)).toEqual([GROUP.id]);
    const brief = makeBrief(meta, ctxFor(SEEN, at), [], seeded(8));
    expect(brief.blocked).toEqual(["lucius"]);
    expect(brief.muted).toEqual(["amici"]);
  });

  it("shows the people what the learner deleted, and whether they had read it first", () => {
    const meta = newMeta();
    const t: Thread = {
      ...newThread("iulia", "dm"),
      messages: [
        { id: "a", from: "me", la: "Tē amō", at, readAt: at + 1000, deletedAt: at + 5000 },
        { id: "b", from: "me", la: "Ō nōn", at: at + 6000, deletedAt: at + 7000 },
      ],
    };
    const c = conversationBlock(t, meta, ctxFor(SEEN, at + 60_000), "Europe/Rome");
    expect(c).toContain("Tē amō (the learner deleted this after it was read: they saw it)");
    expect(c).toContain("only «message deleted» shows");
  });

  it("makes fresh pictures only when they may be made, and lets the people see the learner's photos", async () => {
    let opts: Record<string, unknown> = {};
    const ask = async <T,>(_p: string, o: Record<string, unknown>): Promise<T> => {
      opts = o;
      return { messages: [{ from: "iulia", la: "Ecce!", en: "Look!", gap: 1, picture: "a selfie of Iūlia with a stolen fig cake, laughing" }], saw: "a grey cat on a sofa" } as T;
    };
    const t: Thread = { ...newThread("iulia", "dm"), messages: [{ id: "a", from: "me", la: "Fēlēs mea!", at, pic: "p1" }] };
    const ctx = { ...ctxFor(ALL, at), canMake: true };
    const prompt = replyPrompt(t, newMeta(), ctx, { at: at + 60_000, why: "free" });
    expect(prompt).toContain('"picture"');
    expect(prompt).toContain("[a photo the learner sent: it is attached to this prompt, look at it]");
    const blob = { fake: true };
    const reply = await writeReply(t, newMeta(), ctx, { ask, opts: {}, lex, r: seeded(3) }, undefined, [blob]);
    expect(opts.images).toEqual([blob]);
    expect(reply.saw).toBe("a grey cat on a sofa");
    expect(reply.made.length).toBe(1);
    expect(reply.messages[0].pic).toBe(reply.made[0].id);
    expect(reply.messages[0].picEn).toContain("fig cake");
    expect(reply.made[0]).toMatchObject({ by: "iulia", status: "wanted" });
    expect(preview(reply.messages[0])).toBe("📷 Ecce!");
    // a few a day: past that, no picture (the message stays)
    const none = await writeReply(t, newMeta(), { ...ctx, canMake: false }, { ask, opts: {}, lex, r: seeded(3) });
    expect(none.made).toEqual([]);
    expect(none.messages[0].pic).toBeUndefined();
    expect(none.messages[0].la).toBe("Ecce!");
    expect(replyPrompt(t, newMeta(), { ...ctx, canMake: false }, { at: at + 60_000, why: "free" })).not.toContain('"picture": "<what the photo shows');
    // once seen, the people remember what the photo showed
    const seen = { ...t, messages: [{ ...t.messages[0], picEn: "a grey cat on a sofa" }] };
    expect(conversationBlock(seen, newMeta(), ctx, "Europe/Rome")).toContain("[a photo the learner sent: a grey cat on a sofa]");
  });

  it("gives both routines the same helper as scripts/nuntii-routine.py, which skips muted chats and makes pictures", () => {
    const code = routinePy.slice(routinePy.indexOf("import ")).trim();
    for (const md of [routineMd, picturesMd]) expect(md.split("```python\n")[1].split("```")[0].trim()).toBe(code);
    expect(code).toContain("def pictures(");
    expect(code).toContain("cid in muted");
    expect(routineMd).toContain("data/users/me/messenger/pics");
    expect(picturesMd).toContain('"status", "==", "wanted"');
  });

  it("makes anyone from the story real when the learner wants to write to them", async () => {
    const meta = newMeta();
    const prompts: string[] = [];
    const ask = async <T,>(prompt: string): Promise<T> => {
      prompts.push(prompt);
      return { name: "Tertia", g: "f", age: 19, job: "Iūlia's younger sister", city: "Rome", about: "Nosy, clever, reads everyone's letters.", link: { to: "iulia", how: "her sister" }, first: "Who is this foreigner my sister talks about?", secret: "She read Iūlia's poems.", happenings: [{ en: "caught reading letters", mood: "guilty", hours: [2, 6] }] } as T;
    };
    const res = await meetFromStory("Tertia, Iūlia's sister", meta, ctxFor(SEEN, at), { ask, opts: {}, lex, r: seeded(2) });
    expect(prompts[0]).toContain("«Tertia, Iūlia's sister»");
    expect(prompts[0]).toContain("Iūlia [id \"iulia\"]");
    if (!("stranger" in res)) throw new Error("no one made");
    expect(res.stranger).toMatchObject({ name: "Tertia", g: "f", story: true, invented: true, link: { to: "iulia", how: "her sister" } });
    expect(res.stranger.happenings[0].en).toBe("caught reading letters");
    expect(res.life.mood).toBeTruthy();
    // someone who is already there is found, not made again
    meta.strangers[res.stranger.id] = res.stranger;
    expect(await meetFromStory("Tertia", meta, ctxFor(SEEN, at), { ask, opts: {}, lex, r: seeded(2) })).toEqual({ existing: res.stranger.id });
    const known = async <T,>(): Promise<T> => ({ existing: "marcus" }) as T;
    expect(await meetFromStory("Marcus", meta, ctxFor(SEEN, at), { ask: known, opts: {}, lex, r: seeded(2) })).toEqual({ existing: "marcus" });
  });
});
