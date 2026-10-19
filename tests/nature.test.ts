import { describe, expect, it } from "vitest";
import { natureOf, strangerNature } from "../src/chat/nature";
import { writeReply } from "../src/chat/engine";
import { languageBlock, personBlock, replyPrompt } from "../src/chat/prompts";
import { makeBrief } from "../src/chat/brief";
import { newMeta, newThread, Thread } from "../src/chat/model";
import { rollStranger } from "../src/chat/strangers";
import { GROUP, PEOPLE } from "../src/content/people";
import { allowedWords, chatEntries, chatLexicon, nameEntry } from "../src/chat/words";
import { LESSONS } from "../src/content/lessons";
import { PARTS } from "../src/content/parts";
import { seeded } from "../src/latin/generate";

const entries = chatEntries(LESSONS.flatMap((l) => l.words), [nameEntry("Kiril", "Kiril (your name)", "m")]);
const seen = new Set(PARTS.flatMap((p) => p.skills));
const T0 = Date.UTC(2026, 9, 19, 11, 0);
const ctx = { now: T0, me: { name: "Kiril", g: "m" as const }, tz: "Europe/Kyiv", words: allowedWords(entries, seen), seen };

describe("each person's nature, as data the code uses", () => {
  it("makes the five different in everything that counts", () => {
    const n = PEOPLE.map((p) => p.nature);
    for (const key of ["talk", "burst", "open", "discretion"] as const) expect(new Set(n.map((x) => x[key])).size, key).toBeGreaterThan(2);
    expect(new Set(n.map((x) => x.photos.rate)).size).toBe(3);
    // a chatterbox, a man of few words
    expect(PEOPLE.find((p) => p.id === "marcus")!.nature.talk).toBeGreaterThan(PEOPLE.find((p) => p.id === "gaius")!.nature.talk + 0.5);
    for (const p of PEOPLE) {
      expect(p.nature.look.length, p.id).toBeGreaterThan(60);
      expect(p.nature.interests.length, p.id).toBeGreaterThanOrEqual(5);
      expect(p.nature.romance, p.id).toBeTruthy();
    }
  });

  it("puts it into the prompts and the routine's sheets", () => {
    const p = personBlock({ ...PEOPLE.find((x) => x.id === "gaius")!, stranger: false }, undefined, T0, newMeta());
    expect(p).toContain("one to three words");
    expect(p).toContain("rarely says anything in a group");
    expect(p).toContain("keeps a secret to the grave");
    expect(p).toContain("his goats");
    expect(languageBlock(ctx)).toContain("each in their own way");
    const brief = makeBrief(newMeta(), ctx, [], seeded(1));
    expect(brief.people.find((x) => x.id === "marcus")!.sheet).toContain("machine-gun bursts");
    expect(brief.people.find((x) => x.id === "gaius")!.burst).toBe(2);
  });

  it("lets each say only as many messages as is theirs (Gāius two at most)", async () => {
    // named, so the quiet Gāius may say more than a word (chat/group.ts); his burst is still two at most
    const t: Thread = { ...newThread(GROUP.id, "group"), messages: [{ id: "a", from: "me", la: "Salvēte! Gāī, quid agis?", at: T0 - 1000 }] };
    const ask = async <T,>(): Promise<T> =>
      ({
        messages: [
          { from: "gaius", la: "Salvē.", en: "Hi." },
          { from: "gaius", la: "Labōrō.", en: "I'm working." },
          { from: "gaius", la: "Dormiō.", en: "I'm sleeping." },
          { from: "marcus", la: "Salvē!", en: "Hi!" },
        ],
      }) as T;
    const reply = await writeReply(t, newMeta(), ctx, { ask, opts: {}, lex: chatLexicon(entries), r: seeded(5) });
    expect(reply.messages.map((m) => m.from)).toEqual(["gaius", "gaius", "marcus"]);
  });

  it("gives strangers a steady nature of their own, with Claude's look and loves when given", () => {
    const s = rollStranger(seeded(11), { names: [], portraits: [] }, T0);
    const a = strangerNature(s);
    expect(strangerNature(s)).toEqual(a);
    expect(a.burst).toBeGreaterThanOrEqual(2);
    const meta = newMeta();
    meta.strangers[s.id] = { ...s, look: "a tall baker with flour in his beard", interests: ["bread", "dice"] };
    expect(natureOf(s.id, meta)!.look).toContain("flour");
    expect(replyPrompt({ ...newThread(s.id, "stranger"), messages: [] }, meta, ctx, { at: T0, why: "they are free" })).toContain("bread; dice");
  });
});
