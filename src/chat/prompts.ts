// What Claude reads to write as the people in the messenger: who they are,
// their day and mood right now, the learner, the conversation, and the strict
// limits of the learner's Latin. Plain functions of plain data, so the same
// text serves the page and the brief the phone routine reads.
import { emojiList } from "./emoji";
import { PHOTO_BY_ID, photosFor } from "../content/photos";
import { GROUP, PEOPLE } from "../content/people";
import { SKILLS } from "../latin/skills";
import type { Me } from "../trainer/progress";
import { Life, localTime, moodText, partOfDay, statusAt } from "./life";
import { groupMayWrite, paceLine, paceNow, paceOf } from "./pace";
import { discretionText, natureOf, openText, photoText, talkText } from "./nature";
import { memoryLines, Mind, recall } from "./mind";
import { standingLine, tiesLine } from "./bond";
import { goalsLine, publicNow, quietDays, timelineBlock } from "./lives";
import { photoRoom } from "./pictures";
import { awayNow, Bond, CoachTurn, deletedNow, Drama, groupIds, groupMembers, groupName, groupsOf, iBlocked, isBlocked, isGroupId, Meta, Msg, REACTIONS, SYS, Thread, Who, membersOf, silentNow, whoOf } from "./model";
import type { Stranger } from "./strangers";
import type { AllowedWord } from "./words";

export interface PromptCtx {
  now: number;
  me: Me;
  /** The learner's time zone. */
  tz: string;
  words: AllowedWord[];
  /** Ids of the rules the learner has seen. */
  seen: Set<string>;
  /** The day in Rome: date, festivals, birthdays, news (calendar.ts). */
  calendar?: string;
  /** The group chat, for a private chat: what the friends said there lately. */
  group?: Thread;
  /** Each person's mind: what they remember and how they know it (chat/mind.ts). */
  minds?: Record<string, Mind>;
  /** Fresh pictures may be made now (a few a day). */
  canMake?: boolean;
}

// ------------------------------------------------------------ language

/** The learner's words, each with the forms they can read, grouped for reading. */
export function vocabularyBlock(words: AllowedWord[]): string {
  const line = (w: AllowedWord) => `${w.forms.join(" / ")} = ${w.en}`;
  const names = words.filter((w) => w.name);
  const chat = words.filter((w) => w.chat);
  const rest = words.filter((w) => !w.name && !w.chat);
  return [
    `Words (only these forms): ${rest.map(line).join("; ")}.`,
    `Chat words: ${chat.map(line).join("; ")}.`,
    `Names (the second form is for calling someone): ${names.map((w) => w.forms.join(" / ")).join("; ")}.`,
  ].join("\n");
}

/** The rules the learner has met, and the ones they have not. */
export function rulesBlock(seen: Set<string>): string {
  const met = SKILLS.filter((s) => seen.has(s.id)).map((s) => `- ${s.title}: ${s.hint}`);
  const notYet = SKILLS.filter((s) => !seen.has(s.id)).map((s) => s.title);
  return [
    `Grammar the learner knows (build every sentence with these only):\n${met.join("\n") || "- almost nothing yet: single words and very short sentences"}`,
    notYet.length ? `Not learned yet, so never use these constructions (the words in them may still be listed for other uses): ${notYet.join("; ")}.` : "",
    "Questions are plain sentences with a question mark («Labōrās?»), or start with quid, quis, ubi, quō or cūr. The present tense only.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function languageBlock(ctx: PromptCtx, texting = true): string {
  return `LANGUAGE: strict, because the learner is a beginner and must understand every word.
- Write in Latin with long marks (ā ē ī ō ū) exactly as in the lists.
- Use ONLY the words and forms listed here. Nothing else, not even small common words (est, sunt, cum, mihi, tibi, hic, iam, sī, ut, valdē…) unless they are listed. Names from the list are fine; other names only if a person's own.${texting ? `
- Except in a strong moment (love, rage, an insult, grief, a joke that needs it): then a message may carry one or two other simple Latin words, each given with its meaning in the message's "gloss". Not in every message: rarely, when it matters.` : ""}
- If you cannot say something with these words, say something simpler, leave it out, or let an emoji say it. Emoji are welcome and carry feelings the words cannot.
- Roman emoji drawn for this tabula, written as codes exactly like this, never inside a word: ${emojiList()}. Use them now and then, when they fit, like any emoji.
${texting ? "- Real texting, each in their own way (their Length says how): small talk is short, often a word or two or only an emoji; when something matters (news, a fight, love, grief, a real question) a message may be longer, a few short sentences. Each sentence stays short and plain (the learner is a beginner); never a paragraph." : "- Short, plain sentences: 3 to 9 words each, one thing said in each."}

${vocabularyBlock(ctx.words)}

${rulesBlock(ctx.seen)}`;
}

// ------------------------------------------------------------- people

const gender = (g: "m" | "f") => (g === "m" ? "man" : "woman");

/** Where someone is in their day now. */
export function dayNow(who: Who, now: number): string {
  const t = localTime(now, who.tz);
  const s = statusAt(who.day, who.tz, now);
  const doing = s.state === "asleep" ? "asleep" : s.state === "busy" ? `busy: ${s.what}` : "free";
  return `${t.weekday} ${t.hm} where they are (${partOfDay(t.h)}); ${doing}`;
}

export function lifeLine(life: Life | undefined): string {
  if (!life) return "mood: ordinary; nothing special going on";
  return `mood: ${moodText(life)}; ${life.event ? `going on: ${life.event}` : "nothing special going on"}`;
}

/** Whom someone knows among the people the learner has met (the learner asked for people who are connected). */
export function knownPeople(who: Who, meta?: Meta): string {
  if (who.stranger) {
    const friend = who.link && PEOPLE.find((p) => p.id === who.link!.to);
    return friend ? `Knows ${friend.name}: ${who.link!.how}; may have the learner's name from ${friend.name}, and mentions ${friend.g === "m" ? "him" : "her"} when it fits.` : "";
  }
  const met = Object.values(meta?.strangers ?? {}).filter((s) => s.link?.to === who.id);
  return met.length ? `People the learner has met whom ${who.name} knows: ${met.map((s) => `${s.name} (${s.job}, ${s.city}): ${s.link!.how}`).join("; ")}.` : "";
}

/** How someone feels about the learner now (private: it shows only in how they write). */
export function bondBlock(who: Who, bond: Bond | undefined, now: number, moments = true): string {
  return [
    `How ${who.name} feels about the learner (private; it shows in how they write, never as a report): ${bond?.feel || who.first || "no real opinion yet; first impressions are still forming"}`,
    moments && bond?.moments.length ? `What has happened between them: ${bond.moments.slice(-10).join("; ")}.` : "",
    silentNow(bond, now)
      ? `${who.name} is giving the learner the silent treatment, until ${localTime(bond!.silentUntil!, who.tz).hm} their time: reads, does not answer. They break it only if what the learner writes truly gets to them; in the group they may talk to the others and ignore the learner, or talk about them.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** What someone has done to the messenger: blocked the learner, gone away, a status line, left the group. */
export function worldLine(who: Who, meta: Meta, now: number): string {
  const out: string[] = [];
  if (isBlocked(meta, who.id)) out.push(`${who.name} has blocked the learner: the learner's messages do not reach them; they can unblock them whenever they like.`);
  const away = awayNow(meta, who.id, now);
  if (away) out.push(`${who.name} is away (${away.where}) until ${localTime(away.until, who.tz).weekday} ${localTime(away.until, who.tz).date}: they write rarely and late.`);
  const status = meta.world?.status?.[who.id];
  if (status) out.push(`Their status line: «${status.text}».`);
  if (iBlocked(meta, who.id)) out.push(`THE LEARNER HAS BLOCKED ${who.name.toUpperCase()}: nothing ${who.name} sends in private reaches the learner (one grey tick, never read). They may suspect it, hear it from someone, or find out; in a group they can still talk.`);
  const theirs = groupsOf(meta, who.id).map((g) => `«${groupName(meta, g)}»`);
  if (!who.stranger && !groupMembers(meta).includes(who.id)) out.push(`Not in the friends' group «${groupName(meta)}» now.`);
  if (theirs.length) out.push(`In the group${theirs.length > 1 ? "s" : ""} ${theirs.join(", ")} with the learner.`);
  return out.join(" ");
}

/**
 * The storylines among them (romances, feuds, secrets): what is going on and
 * who knows about it. With `viewers`, only the ones they know about (a
 * private chat does not hear of a storyline its person knows nothing of).
 */
export function dramaBlock(meta: Meta, viewers?: string[]): string {
  const knows = (d: Drama) => d.knows ?? d.who;
  const ds = (meta.world?.dramas ?? []).filter((d) => !viewers || knows(d).some((id: string) => viewers.includes(id)));
  if (!ds.length) return "";
  const names = (ids: string[]) => ids.map((id) => whoOf(id, meta)?.name ?? id).join(", ");
  return `WHAT IS GOING ON AMONG THEM (storylines; give the same id to move one on; only those who know of one can speak of it):\n${ds.map((d) => `- [${d.id}] ${d.en} (known to: ${names(knows(d)) || "nobody else"})`).join("\n")}`;
}

/** What makes someone different (chat/nature.ts), in the words Claude reads. */
export function natureLines(who: Who, meta?: Meta): string[] {
  const n = natureOf(who.id, meta ?? ({ strangers: {} } as unknown as Meta));
  if (!n) return [];
  return [
    `Length: ${n.length} (never more than ${n.burst} messages in a row). When something matters: ${n.deep}.`,
    `In a group: ${talkText(n)}. Feelings: ${openText(n)}. Secrets: ${discretionText(n)}.`,
    n.interests.length ? `Their own life fills their talk: ${n.interests.join("; ")}.` : "",
    `Love: ${n.romance}`,
    `Photos: ${photoText(n)}.`,
  ].filter(Boolean);
}

/** Who someone is, for Claude to write as them. */
export function personBlock(who: Who, life: Life | undefined, now: number, meta?: Meta, minds?: Record<string, Mind>): string {
  const lines = [
    `${who.name} (${who.age}, ${gender(who.g)}; called «${who.voc}»), ${who.city}. ${who.job[0].toUpperCase()}${who.job.slice(1)}.`,
    `Character: ${who.about}`,
    who.traits?.length ? `Temper: ${who.traits.join(", ")}.` : "",
    who.quirk ? `Quirk: ${who.quirk}.` : "",
    who.why ? `Why they wrote to the learner in the first place: ${who.why}.` : "",
    who.secret ? `Keeps to themselves at first: ${who.secret}.` : "",
    `How they text: ${who.style}`,
    ...natureLines(who, meta),
    who.heart ? `With people they care about: ${who.heart}` : "",
    meta ? tiesLine(who, meta, now) : who.ties ? `With the others: ${Object.entries(who.ties).map(([id, t]) => `${PEOPLE.find((p) => p.id === id)?.name ?? id}: ${t}`).join("; ")}.` : "",
    knownPeople(who, meta),
    bondBlock(who, meta?.bonds?.[who.id], now, !minds?.[who.id]?.memories.length),
    meta ? standingLine(who, meta, now) : "",
    meta ? goalsLine(who, meta, now) : "",
    meta ? worldLine(who, meta, now) : "",
    `Right now: ${dayNow(who, now)}; ${lifeLine(life)}.`,
  ];
  return lines.filter(Boolean).join("\n");
}

/** The words of a conversation lately, to recall what it touches. */
const talkOf = (thread: Thread | undefined, now: number) =>
  (thread?.messages ?? [])
    .filter((m) => m.at <= now)
    .slice(-14)
    .map((m) => `${m.la} ${m.en ?? ""} ${m.picEn ?? ""}`)
    .join(" ");

/** What someone remembers that matters now: their own memories, and how they know each (chat/mind.ts). */
export function memoryBlock(who: Who, meta: Meta, ctx: PromptCtx, thread: Thread | undefined, k: number): string {
  const mind = ctx.minds?.[who.id];
  const ms = recall(mind, { now: ctx.now, with: ["me", ...(thread ? membersOf(thread.id, meta).map((w) => w.id) : [])], chat: thread?.id, text: talkOf(thread, ctx.now), k });
  if (!ms.length) return "";
  return `WHAT ${who.name.toUpperCase()} REMEMBERS (theirs alone: they know only what they lived, saw in their chats, or were told; give a memory's id in "settled" or "outdated" when it is done or no longer true):\n${memoryLines(ms, (id: string) => nameOf(id, meta, ctx.me)).join("\n")}`;
}

export function learnerBlock(ctx: PromptCtx): string {
  const t = localTime(ctx.now, ctx.tz);
  const endings = ctx.me.g === "m" ? "amīcus, discipulus" : "amīca, discipula";
  return `THE LEARNER: ${ctx.me.name} (called «${ctx.me.name}»), a ${gender(ctx.me.g)} (words about them take the endings of ${endings}). Lives far away, in Kyiv, beyond the Black Sea, and is learning Latin, which is why everyone writes to them simply. For ${ctx.me.name} it is ${t.weekday} ${t.hm} (${partOfDay(t.h)}).`;
}

// -------------------------------------------------------- conversation

const nameOf = (id: string, meta: Meta, me: Me) => (id === "me" ? me.name : whoOf(id, meta)?.name ?? id);

/** The messages a prompt shows (numbered from 1 in the conversation block, so an answer can quote one). */
export const shownMessages = (thread: Thread, now: number, max = 30): Msg[] => thread.messages.filter((m) => m.at <= now).slice(-max);

/** A message in a few words, for a quote. */
export const snippet = (la: string, words = 6) => {
  const w = la.split(/\s+/);
  return w.length > words ? `${w.slice(0, words).join(" ")}…` : la;
};

/** The conversation so far, oldest first, in the given time zone: numbered, with the messages answered and the reactions. */
export function conversationBlock(thread: Thread, meta: Meta, ctx: PromptCtx, tz: string, max = 30): string {
  const shown = shownMessages(thread, ctx.now, max);
  if (!shown.length) return "(no messages yet)";
  const number = new Map(shown.map((m, i) => [m.id, i + 1]));
  return shown
    .map((m: Msg, i) => {
      const t = localTime(m.at, tz);
      const re = m.re ? thread.messages.find((x) => x.id === m.re) : undefined;
      const quote = re ? ` (answering ${number.has(re.id) ? `#${number.get(re.id)} ` : ""}«${snippet(re.la || "photo")}»)` : "";
      const reacted = Object.entries(m.reactions ?? {})
        .filter(([, r]) => r.e && r.at <= ctx.now)
        .map(([who, r]) => `${nameOf(who, meta, ctx.me)} reacted ${r.e}`);
      if (m.from === SYS) return `#${i + 1} [${t.weekday.slice(0, 3)} ${t.hm}] (${m.en})`;
      const what = m.voice ? `[voice message] ${m.la}` : m.photo ? `[photo: ${PHOTO_BY_ID.get(m.photo)?.en ?? "a photo"}] ${m.la}` : m.pic ? `${picText(m)} ${m.la}`.trim() : m.la;
      const gone = !deletedNow(m, ctx.now)
        ? ""
        : m.from === "me"
          ? m.readAt && m.readAt <= m.deletedAt!
            ? " (the learner deleted this after it was read: they saw it)"
            : thread.kind === "group"
              ? " (the learner deleted this; whoever had read it already saw it)"
              : " (the learner deleted this before it was read: only «message deleted» shows)"
          : ` (deleted by ${nameOf(m.from, meta, ctx.me)}; the learner sees only that a message was deleted)`;
      return `#${i + 1} [${t.weekday.slice(0, 3)} ${t.hm}] ${nameOf(m.from, meta, ctx.me)}${quote}: ${what}${gone}${reacted.length ? `   (${reacted.join(", ")})` : ""}`;
    })
    .join("\n");
}

/** A picture in the conversation, as the people know it. */
function picText(m: Msg): string {
  if (m.from === "me") return m.picEn ? `[a photo the learner sent: ${m.picEn}]` : "[a photo the learner sent: it is attached to this prompt, look at it]";
  return `[photo: ${m.picEn ?? "a photo"}]`;
}

const HOW_TO_BE_REAL = `BE THEM:
These are real people, not characters in a script: pride, moods, desires, opinions, secrets, a history with the learner and with each other. There is no plot to follow; let things happen as they would. Surprise the learner.
Their feelings about the learner grow from what really happens, and show in everything they do. Trolling works on them as on real people: some fall for anything, some see through it and mock it, some troll first, prank, lie, test the learner's loyalty or jealousy. They drag the learner into their lives: secrets to keep, sides to take, favours, gossip, lies to cover.
Adult themes are welcome, as in a Roman comedy or in Catullus: desire, innuendo, wine, insults, scandal, heartbreak; anything sexual stays implied, never described. Anyone under eighteen is never part of anything romantic or sexual, nor talked about that way.
They have lives of their own, and the learner is one part of them, not the centre: they talk about their own days, worries and plans, ask about the learner sometimes, not always, and not all of them care equally. Real people do not keep asking the same questions (how did you sleep, are you working): they move on.
They never correct the learner's Latin. They live in the Roman world around 100 AD and write on a «tabula» that carries messages; they know nothing of AI, phones, sites or lessons. Text the way people text, not the way assistants write.`;

/** What they can do besides writing (the learner discovers it as it happens). */
const CAN_DO = `WHAT THEY CAN DO (only what they would really do now; usually none of it):
- when answering: not answer at all, react, quote a message; any time: send a voice message, a photo from the list, or a picture of anything they would really send
- send a message and take it back a moment later ("unsend": seconds), or delete an earlier message of theirs (act "delete", "msg": its number)
- block the learner (act "block") and unblock them later ("unblock"); blocked, the learner's messages do not reach them
- leave a group ("leave"), come back ("join"), add someone ("add", "whom": a person id or a new person's name), throw someone out ("remove"), rename it ("rename", "text"); "group": its chat id (the chat they are in, or the friends' group, when left out)
- start a group of their own with the learner and whoever they like ("newGroup", "text": its name, "with": ["me", person ids], "messages": its first messages): a party, a plot, a secret, a group about someone without them
- set a status line for themselves ("status", "text": a few Latin words or emoji)
- go away for a while, travelling or vanishing ("away", "hours", "text": where to), and come back ("back")
- bring someone new into their lives: a lover, a rival, a relative, a creditor, a new friend ("newPerson"), who may join the group or write to the learner
- start a storyline among them or move one on: a romance, a feud, a secret, a debt, a scandal, a betrayal ("drama", with who knows of it)
- tell someone else what they know, out of the learner's sight: news, gossip, a secret they cannot keep, a warning, a lie ("tell")
- go after what they want, get it, give it up, or find a new want ("goals")
- something happens in someone's life: a consequence of what went on (fired after a prank, a fight with the landlord after the learner's advice, a gift arriving), or life out of the blue now and then ("happen")
- whatever else a real person would do with a messenger, as far as words, emoji and these can carry it`;

/** The JSON fields for what they do besides writing. */
const DEEDS = `- "acts" (optional): [{"who": "<person id>", "do": "block" | "unblock" | "leave" | "join" | "add" | "remove" | "rename" | "newGroup" | "delete" | "status" | "away" | "back", "text": "...", "whom": "...", "group": "<chat id>", "with": ["me", "<person id>"], "messages": [{"from": "<person id>", "la": "<Latin>", "en": "<English>"}], "msg": <number>, "hours": <number>}]
- "drama" (optional): [{"id": "<short id, new or one shown>", "en": "<what is going on now among them, and who knows what (English)>", "who": ["<person ids in it>"], "knows": ["<person ids who know of it>"], "over": true when it has ended}]
- "newPerson" (optional): [{"name": "<Latin name>", "g": "m" | "f", "age": <years>, "job": "...", "city": "...", "about": "<who they are, two sentences>", "link": {"to": "<friend id>", "how": "<how they know them>"}, "first": "<how they feel about the learner>", "joinGroup": true, "messages": [{"la": "<Latin>", "en": "<English>"}]}]
- "tell" (optional): [{"from": "<person id>", "to": "<person id>", "what": "<what they tell, in English, as they tell it>", "about": ["me", "<person id>"], "weight": <1-5>, "untrue": true, "secret": true}]: someone passes something on to someone else, out of the learner's sight (gossip, news, a warning, a lie). Only what the teller knows (their memories, their chats); a secret only if their nature would spill it; it may come out exaggerated or wrong ("untrue": the one told believes it).
- "goals" (optional): [{"who": "<person id>", "id": "<a goal's id, as shown>", "step": "<what just happened toward it, or away from it>", "status": "open" | "done" | "dropped"}], or a new want: [{"who": "<person id>", "text": "<what they want now, their words>"}]. Goals move slowly, over days and weeks; usually [].
- "happen" (optional): [{"who": "<person id>", "what": "<what is going on in their life now, English>", "mood": "<the mood it brings>", "hours": <how long it lasts, 1-336>, "public": true when the neighbours would know}]: rarely, with a cause; it becomes their life now, and it stays true afterwards.
- A message may also carry "gloss": {"<new word>": "<meaning>"} for a new word in it, and "unsend": <seconds> to take it back that long after sending.`;

/** What everyone around knows of the others' lives now (their public happenings): the people of a chat hear it like neighbours. */
export function neighbourhoodBlock(meta: Meta, now: number, here: string[]): string {
  const others = publicNow(meta, now).filter((line) => !here.some((id) => line.startsWith(`${whoOf(id, meta)?.name ?? id}:`)));
  return others.length ? `WHAT EVERYONE AROUND KNOWS OF THE OTHERS NOW (neighbourhood news; anything else about them they know only if they saw it or were told):\n${others.map((l) => `- ${l}`).join("\n")}` : "";
}

/** For a reply: everyone in the thread, with their state now and what each remembers. */
function peopleOf(thread: Thread, meta: Meta, ctx: PromptCtx): string {
  const members = membersOf(thread.id, meta);
  return members
    .map((w) => [personBlock(w, meta.life[w.id], ctx.now, meta, ctx.minds), memoryBlock(w, meta, ctx, thread, members.length > 1 ? 5 : 12)].filter(Boolean).join("\n"))
    .join("\n\n");
}

/** Voice messages and photos: what a message may carry besides its text. */
const EXTRAS = `- "voice": true (optional) makes it a short voice message: they say it aloud and "la" is what they say (3 to 14 words, spoken style). Now and then, about one message in eight, when it fits the moment (walking, cooking, in a hurry, lazy to type, excited, sleepy, singing); never two in a row.
- "photo": "<photo id>" (optional) sends one of the photos listed with the message, "la" being its caption (a few words, or only an emoji, or ""): now and then, when it fits the moment or the talk.`;

/** A fresh picture: what they would really send, made by an image generator from what Claude says it shows. */
const PICTURE = `- "picture": "<what the photo shows, in English, as their camera would see it: the scene, the people, the light, in one or two sentences>" (optional) instead of "photo", when nothing in the list fits and a picture really is worth it: what they are doing right now, something funny, wild, disgusting, beautiful or absurd in their day, a selfie, proof of something, a picture to tease or tempt. It is made for them, so it can show anything of their world (around AD 100: no modern things), except nudity and gore. A few a day at most.`;

/** How Claude reports what moved between them and the learner, and among themselves (chat/bond.ts). */
const BONDS = `- "bond" (for anyone this moved): how it changed where they stand with the learner, only the levels that moved, by small steps: ±1 for most things, ±2 for something that matters, ±3 for a shock. Real feelings move slowly: a crush grows over many conversations, trust is built slowly and lost at once, a joke at the wrong moment stings; each person moves in their own way (their nature and heart). Hurt heals with time by itself. Usually {}.
- "levels" (only for someone whose standing says NOT SET YET): where they stood with the learner just before this moment (the days that have passed counted in), 0-10 each, read from how they feel and what has happened between them; what this moment does to them goes in "bond", as for anyone.
- "ties" (when something between two of them changed: a fight, a kindness, a betrayal, jealousy, a spark, gossip that stung): who feels it ("from"), about whom ("to"), how they see them now in their own words ("note"), and the levels that moved, by small steps. Feelings among them are as real as toward the learner, and as private. Usually [].`;

const OUTPUT = `Reply with only JSON:
{"messages": [{"from": "<person id>", "la": "<Latin>", "en": "<English translation, emoji kept>", "gap": <seconds of pause before it>, "re": <number>, "voice": true, "photo": "<photo id>", "picture": "<what a new photo shows>"}], "saw": "<what the learner's newest photo shows, a few English words>", "react": [{"from": "<person id>", "emoji": "<emoji>"}], "remember": [{"who": "<person id>", "text": "<what they will remember, in their own words>", "kind": "moment" | "fact" | "promise" | "plan" | "secret" | "joke" | "conflict" | "news", "weight": <1-5>, "about": ["me", "<person id>"], "secret": true, "until": "<YYYY-MM-DD>"}], "settled": ["<memory id>"], "outdated": ["<memory id>"], "feel": {"<person id>": "<how they feel about the learner now>"}, "bond": {"<person id>": {"warmth": <change>, "trust": <change>, "respect": <change>, "desire": <change>, "hurt": <change>, "interest": <change>}}, "levels": {"<person id>": {"warmth": <0-10>, "trust": <0-10>, "respect": <0-10>, "desire": <0-10>, "hurt": <0-10>, "interest": <0-10>}}, "ties": [{"from": "<person id>", "to": "<person id>", "note": "<how they see them now, their own words>", "warmth": <change>, "trust": <change>, "desire": <change>, "hurt": <change>}], "mood": {"<person id>": "<their mood now>"}, "silent": {"<person id>": <hours>}}
- How many messages: as many as the moment and the person need (each person's Length; Gāius one, Marcus a burst of three); one is often right; in a group not everyone answers. No answer at all ("messages": []) is an answer too: they read it and say nothing (hurt, sulking, playing it cool, busy). "gap": 1-40 (typing time is added by the page; a long gap is a pause to think).
- "re" (optional): the number (#) of the message this one answers, shown quoted above it as in any messenger. Only when it answers something that is not simply the last message: one of several things the learner said, an earlier question, a message from someone else in the group. Usually leave it out.
${EXTRAS}
- "react" (optional): a reaction to the learner's last message, as people do in messengers: one emoji per person, from ${REACTIONS.join(" ")}. When it fits (a joke 😂, sweet words ❤️, news 😮, sad news 😢, thanks 🙏); often none. Rarely a reaction is the whole answer, when the message needs no words: then "messages" may be [].
- "remember": 0-3 things worth remembering later, each for the one who remembers it, in their own words ("about": whom it is about besides themselves: "me" for the learner, others by id; "until": the day a promise or plan is for) (in a group each may remember the same thing differently, or only some of them notice): something new about the learner, a promise, a plan, a confession, a fight, a shared joke, a secret ("secret": true when they were asked to keep it, or it is theirs to hide). "weight": 1 a small thing, 3 worth remembering, 5 never forgotten. Small talk is not worth remembering: often [].
- "settled": ids of their memories that are done now (a promise kept, a plan done or dropped, a fight made up); "outdated": ids no longer true (a newer fact replaces them). Usually [].
- "saw" (only when the learner's newest photo is attached): what it shows, a few plain English words, so they remember it.
- "feel" (for anyone whose feelings about the learner moved now): how they feel about the learner after this, in their own words, first person, one or two sentences (English): what they would never say aloud. Feelings move slowly or suddenly, as with real people.
${BONDS}
- "mood" (when this conversation changed someone's mood): their mood now, a word or two.
- "silent" (when someone is hurt or angry enough to ignore the learner): the hours they will ignore them, 1 to 24; 0 when they end a silence.
${DEEDS}`;

/** The photos the people of a chat could send now (none sent lately in this chat), and a fresh picture when it may be made. */
export function photosBlock(people: Who[], recent: string[], canMake = false): string {
  if (!people.length) return "";
  const own = people
    .map((w) => ({ w, ps: photosFor(w.id, w.stranger, recent).filter((p) => p.who !== "any") }))
    .filter((x) => x.ps.length)
    .map((x) => `${x.w.name}'s own: ${x.ps.map((p) => `"${p.id}" (${p.en})`).join("; ")}`);
  const any = photosFor("", true, recent).map((p) => `"${p.id}" (${p.en})`);
  const lines = [...own, ...(any.length ? [`Anyone's: ${any.join("; ")}`] : [])];
  return [
    lines.length ? `PHOTOS THEY HAVE ON THEIR TABULA (photos of their own world, as they took them; the caption is theirs to write):\n${lines.join("\n")}` : "",
    canMake ? PICTURE : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Photos sent lately in a chat, not to be sent again soon. */
// (made pictures are new each time)
const recentPhotos = (t: Thread) => t.messages.slice(-60).flatMap((m) => (m.photo ? [m.photo] : []));

/** What was said lately in the group chat, for a private chat with one of the friends. */
export function groupLately(thread: Thread, meta: Meta, ctx: PromptCtx): string {
  if (thread.kind !== "dm" || !ctx.group || !groupMembers(meta).includes(thread.id)) return "";
  const last = ctx.group.messages.filter((m) => m.at <= ctx.now && ctx.now - m.at < 3 * 86400000).slice(-6);
  if (!last.length) return "";
  return `LATELY IN THE GROUP «${groupName(meta)}» (the friends and the learner together):\n${last.map((m) => `  ${nameOf(m.from, meta, ctx.me)}: ${m.la}`).join("\n")}`;
}

/** The learner's last message as the grammar engine reads it, and how to take a mistake: literally, as a Roman would. */
export function literalBlock(literal: string): string {
  if (!literal) return "";
  return `HOW THE LEARNER'S LAST MESSAGE READS, word by word (the site's grammar engine; it is certain):
${literal}
Read it LITERALLY, as a Roman would. If a mistake makes it say something other than they meant (a wrong ending makes the water drink them, a wrong person makes someone else do it, a wrong word means something else), react to what it literally says, in character: amused, puzzled, alarmed or teasing («Aqua tē bibit?! 😂»), and then maybe go on with what they meant. Never explain the grammar or correct them like a teacher. When a slip changes nothing (a missing long mark, a small spelling slip), simply answer.`;
}

/** Who started a group (the learner or one of the people), for its prompt. */
function groupInfoLine(meta: Meta, id: string): string {
  const g = meta.world?.groups?.[id];
  if (!g) return "";
  return g.by === "me" ? " (a group the learner made and named; the learner decides who is in it)" : ` (a group ${whoOf(g.by, meta)?.name ?? g.by} started)`;
}

/**
 * When the learner comes back to a private chat after leaving someone's
 * messages unanswered: how long, and how many times they wrote meanwhile (as
 * real people do, they notice).
 */
export function returnLine(thread: Thread, who: Who, ctx: PromptCtx): string {
  const msgs = thread.messages.filter((m) => m.at <= ctx.now);
  let i = msgs.length - 1;
  while (i >= 0 && msgs[i].from === "me") i--;
  const back = msgs[i + 1]?.at;
  if (!back || i < 0) return "";
  const p = paceNow(thread, who.id, back - 1);
  if (!p.unanswered) return "";
  const quiet = ago(back - p.lastAt);
  return `${who.name.toUpperCase()} HAD BEEN WAITING: since ${ctx.me.name} last wrote here (${ago(back - p.learnerAt)} ago) ${who.name} wrote ${p.unanswered === 1 ? "once more" : `${p.unanswered} more times`} with no answer, the last ${quiet} ago. Now ${ctx.me.name} writes again: they notice, and react as they would (relieved, cool, hurt, teasing, or they let it go).`;
}

/** The prompt for an answer to what the learner wrote. */
export function replyPrompt(thread: Thread, meta: Meta, ctx: PromptCtx, timing: { at: number; why: string }, literal = "", scene = ""): string {
  const group = thread.kind === "group";
  const members = membersOf(thread.id, meta);
  const tz = members[0]?.tz ?? "Europe/Rome";
  const deliver = localTime(timing.at, tz);
  const ids = members.map((w) => `"${w.id}" (${w.name})`).join(", ");
  return [
    group
      ? `You write as the people in the group chat «${groupName(meta, thread.id)}» of a Latin messenger: ${members.map((p) => p.name).join(", ")} and the learner${groupInfoLine(meta, thread.id)}. Decide who answers, if anyone: often one or two of them, sometimes more; they answer each other too, tease, flirt, agree or fight.`
      : `You write as ${members[0]?.name} in a Latin messenger, texting with the learner.`,
    learnerBlock(ctx),
    `WHO ${group ? "THEY ARE" : "YOU ARE"}:\n${peopleOf(thread, meta, ctx)}`,
    ctx.calendar ?? "",
    dramaBlock(meta, members.map((w) => w.id)),
    timelineBlock(meta, members.map((w) => w.id), ctx.now),
    neighbourhoodBlock(meta, ctx.now, members.map((w) => w.id)),
    groupLately(thread, meta, ctx),
    `THE CONVERSATION (oldest first; times where ${group ? "they are" : `${members[0]?.name} is`}). The learner's Latin may have mistakes.\n${conversationBlock(thread, meta, ctx, tz)}`,
    !group && members[0] ? returnLine(thread, members[0], ctx) : "",
    literalBlock(literal),
    scene,
    `The answer arrives at ${deliver.weekday} ${deliver.hm} their time (${timing.why}); write for that moment.`,
    HOW_TO_BE_REAL,
    CAN_DO,
    languageBlock(ctx),
    // photos only from those whose habit allows one now (chat/pictures.ts)
    photosBlock(members.filter((w) => photoRoom(w.id, meta, [thread, ctx.group], ctx.now) > 0), recentPhotos(thread), ctx.canMake),
    `${OUTPUT}\nPerson ids: ${ids}; everyone else by id (for "about", "tell", "ties", "happen"): ${[...PEOPLE.filter((p) => !members.some((w) => w.id === p.id)).map((p) => `"${p.id}" (${p.name})`), ...Object.values(meta.strangers).filter((x) => !members.some((w) => w.id === x.id)).map((x) => `"${x.id}" (${x.name})`)].join(", ")}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The prompt for messages the people write on their own (on opening the messenger, or from the phone routine). */
export function ownPrompt(threads: Thread[], meta: Meta, ctx: PromptCtx, hours: number): string {
  // each with what they remember that matters now (their private chat's talk tells what it touches)
  const chatOf = (id: string) => threads.find((t) => t.id === id);
  const block = (w: Who) => [personBlock(w, meta.life[w.id], ctx.now, meta, ctx.minds), memoryBlock(w, meta, ctx, chatOf(w.id), 6)].filter(Boolean).join("\n");
  const friends = PEOPLE.map((p) => block({ ...p, stranger: false })).join("\n\n");
  const met = Object.values(meta.strangers).filter((s) => threads.some((t) => t.id === s.id && !t.gone && (t.messages.length || s.invented)));
  const strangers = met.map((s) => `${block(whoOf(s.id, meta)!)}${s.invented && !threads.find((t) => t.id === s.id)?.messages.length ? "\n(Brought into the story by the friends; has not written to the learner yet.)" : ""}`).join("\n\n");
  const everyone = [...PEOPLE.map((p) => ({ ...p, stranger: false })), ...met.map((s) => whoOf(s.id, meta)!)] as Who[];
  const sent = threads.flatMap(recentPhotos);
  const recent = threads
    .filter((t) => !t.gone)
    .map((t) => {
      const last = t.messages.filter((m) => m.at <= ctx.now).slice(-10);
      const group = isGroupId(t.id, meta);
      const title = group ? `«${groupName(meta, t.id)}» (group: ${membersOf(t.id, meta).map((w) => w.name).join(", ")})` : `${whoOf(t.id, meta)?.name ?? t.id}${iBlocked(meta, t.id) ? " (the learner has blocked them: nothing they send here arrives)" : ""}`;
      const lastMine = [...t.messages].reverse().find((m) => m.from === "me" && m.at <= ctx.now);
      const waiting = t.messages.some((m) => m.from !== "me" && m.at > ctx.now);
      // like real people: who may write here now, and who is waiting for an answer
      const who = whoOf(t.id, meta);
      const pace = group ? `  [${groupMayWrite(t, ctx.now).why}]` : who ? `  [${paceLine(who.name, paceOf(who.id, meta, ctx.now), paceNow(t, who.id, ctx.now), ctx.now, who.tz, ctx.me.name)}]` : "";
      return `${title} [chat id "${t.id}"]${waiting ? " (has messages still on their way)" : ""}${lastMine ? `, learner last wrote ${ago(ctx.now - lastMine.at)} ago` : ""}:\n${last.length ? last.map((m) => `  ${nameOf(m.from, meta, ctx.me)}: ${m.la}`).join("\n") : "  (nothing yet)"}\n${pace}`;
    })
    .join("\n");
  return [
    `You decide what the people of a Latin messenger do ON THEIR OWN in the next ${hours} hours, as real people would: the five friends (each in a private chat, and in the group «${groupName(meta)}») and the others in their lives.`,
    learnerBlock(ctx),
    `THE FRIENDS:\n${friends}`,
    strangers ? `STRANGERS THE LEARNER HAS MET:\n${strangers}` : "",
    ctx.calendar ?? "",
    dramaBlock(meta),
    timelineBlock(meta, undefined, ctx.now),
    quietDays(meta, ctx.now) >= 4 ? `Nothing much has happened in their lives for days. Life may bring something now (news, a visitor, trouble, luck), with a cause in their lives; or not.` : "",
    `THE CHATS NOW (last messages):\n${recent}`,
    `DECIDE like life, no script: sometimes nothing happens; sometimes someone writes, double-texts, starts a fight in the group, makes up, disappears, brings someone new, or a storyline among them takes a turn the learner did not see coming. Someone writes only when awake, and for their own reasons. Feelings drive it: someone who misses or fancies the learner writes more, someone hurt waits for an apology or writes something pointed, someone ignoring or blocking the learner does not write to them (but may talk about them in the group). Do not write into a chat that has messages still on their way. Like real people, they do not keep writing to someone who does not answer: each chat says in [brackets] who may write there now and who is waiting for an answer; someone waiting writes nothing there (they may still talk in a group, about other things). Nobody repeats what they already said: every message brings something new (news, a question about something else, a change of mood) or is not sent.
Away from the learner they live and talk to each other too: news and gossip pass between them ("tell"), each knowing only what they lived, saw in their chats or were told, so one may know a secret another does not, hear a rumour wrong, or keep quiet. A storyline moves on only for those in it or told of it.`,
    HOW_TO_BE_REAL,
    CAN_DO,
    languageBlock(ctx),
    photosBlock(everyone.filter((w) => photoRoom(w.id, meta, threads, ctx.now) > 0), sent, ctx.canMake),
    `Reply with only JSON:
{"messages": [{"chat": "<chat id>", "from": "<person id>", "la": "<Latin>", "en": "<English>", "in": <minutes from now, 0-${hours * 60}>, "voice": true, "photo": "<photo id>", "picture": "<what a new photo shows>"}]}
Messages of one chat in time order; a burst of messages is a minute or less apart. {"messages": []} when nobody writes.
Optionally also "feel": {"<person id>": "<how they feel about the learner now, first person, one or two sentences>"} for anyone whose feelings moved while the learner was away (missing them, worrying, cooling off after days of silence, still angry); "remember": [{"who": "<person id>", "text": "<what they will remember, in their own words>", "kind": "moment" | "fact" | "promise" | "plan" | "secret" | "joke" | "conflict" | "news", "weight": <1-5>, "about": ["me", "<person id>"], "secret": true}] for what happened in their lives meanwhile that they will remember; "settled" and "outdated": [<memory ids>] for memories done or no longer true; "bond": {"<person id>": {"<level>": <change>}}, "levels": {"<person id>": {"<level>": <0-10>}} and "ties": [{"from", "to", "note", "<level>": <change>}] as below.
${BONDS}
${EXTRAS}
${DEEDS}
Person ids: ${PEOPLE.map((p) => `"${p.id}"`).join(", ")}${met.length ? `, ${met.map((x) => `"${x.id}" (${x.name})`).join(", ")}` : ""}. A person's private chat has their id; the friends' group is "${GROUP.id}"${groupIds(meta).length > 1 ? `; other groups: ${groupIds(meta).filter((g) => g !== GROUP.id).map((g) => `"${g}" («${groupName(meta, g)}»)`).join(", ")}` : ""}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function ago(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} minutes`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} hours`;
  return `${Math.round(h / 24)} days`;
}

/** The prompt that makes a real person of a stranger's rolled facts. */
export function strangerPrompt(s: Stranger, life: Life | undefined, ctx: PromptCtx): string {
  const t = localTime(ctx.now, s.tz);
  return [
    `Invent a real person from these random facts. They live in the Roman world around 100 AD and have just found the learner in a Latin messenger (a «tabula» that carries messages).`,
    `- Name: ${s.name} (called «${s.voc}»); a ${gender(s.g)} of ${s.age}.
- Lives in: ${s.city}; it is ${t.weekday} ${t.hm} there.
- Does: ${s.job}.
- Temper: ${s.traits.join(", ")} (${s.intensity === "extreme" ? "to an extreme" : s.intensity === "strong" ? "strongly" : "mildly"}).
- Quirk: ${s.quirk ?? "none in particular: a fairly normal person"}.
- Writes because: ${s.why}.
- Texts with: ${s.style}.${s.link ? `\n- Knows ${PEOPLE.find((p) => p.id === s.link!.to)?.name}, one of the learner's friends: ${s.link.how}. Make this part of who they are.` : ""}
- Right now: ${lifeLine(life)}.`,
    `Keep these facts. Add what makes them real and specific (family, a past, a wish, a fear, a voice of their own): surprising, never generic, never a cliché of their job. They need not be nice: they can be strange, rude, sad, funny or wonderful, as the facts say.`,
    learnerBlock(ctx),
    ctx.calendar ?? "",
    s.writesFirst ? `They write first: their first one to three messages to the learner, as they would really open (or not even greet).` : `They wait for the learner to write first: no first messages.`,
    HOW_TO_BE_REAL,
    languageBlock(ctx),
    `Reply with only JSON:
{"about": "<two or three vivid sentences in English: who they are>", "secret": "<one thing they will not say at first>", "feel": "<how they feel about the learner from the start, first person, one sentence>", "look": "<how they look, the same in every photo of them: age, skin, hair, face, build, usual clothes, in one sentence>", "romance": "<love and attraction: who they could fall for, how they flirt, or why they will not>", "interests": ["<three to six things that fill their days and their talk>"], "happenings": [{"en": "<something that could happen in their life>", "mood": "<the mood it brings>", "hours": [<shortest>, <longest>]}], "first": [{"la": "<Latin>", "en": "<English>", "gap": <seconds>}]}
- "happenings": 4 to 6 things, everyday ones and odd ones.
- "first": ${s.writesFirst ? "1 to 3 messages" : "[]"}.`,
  ].join("\n\n");
}

/**
 * The prompt that makes someone from the story real, when the learner wants to
 * write to them: anyone the friends have mentioned, or would know.
 */
export function storyPersonPrompt(text: string, meta: Meta, ctx: PromptCtx): string {
  const friends = PEOPLE.map((p) => `- ${p.name} [id "${p.id}"] (${p.age}, ${p.job}, ${p.city}): ${p.about} Ties: ${Object.entries(p.ties).map(([id, t]) => `${PEOPLE.find((x) => x.id === id)?.name}: ${t}`).join("; ")}. Now: ${lifeLine(meta.life[p.id])}.`).join("\n");
  const others = Object.values(meta.strangers).map((s) => `- ${s.name} [id "${s.id}"] (${s.age}, ${s.job}, ${s.city})${s.link ? `, knows ${PEOPLE.find((p) => p.id === s.link!.to)?.name}: ${s.link.how}` : ""}${s.about ? `: ${s.about}` : ""}`).join("\n");
  return [
    `In a Latin messenger, a learner far away texts with people in the Roman world around 100 AD. The learner wants to write to someone from the story: «${text}». Make this person real, as the story says they are or would be: someone the friends mentioned, a relative, a lover, a rival, a neighbour, the man behind some piece of gossip, anyone. If it is clearly one of the people below, give their id as "existing" and nothing else.`,
    `THE FRIENDS:\n${friends}`,
    others ? `PEOPLE THE LEARNER HAS MET:\n${others}` : "",
    dramaBlock(meta),
    learnerBlock(ctx),
    `Keep what the story already says about them; add what makes them real and specific (a past, a wish, a fear, a voice of their own), never generic. They are grown-ups (18 or older). Whether they have heard of the learner, and what they think of a foreigner writing to them out of nowhere, is theirs: surprised, flattered, suspicious, rude, delighted.`,
    `Reply with only JSON:
{"existing": "<id, only if it is one of the people above>", "name": "<their Latin name with long marks, as they are called>", "g": "m" | "f", "age": <years>, "job": "<what they do>", "city": "<where they live>", "about": "<two or three vivid sentences in English: who they are, and how they fit the story>", "link": {"to": "<the friend's id they are tied to>", "how": "<how>"}, "first": "<how they feel about the learner writing to them, first person, one sentence>", "secret": "<one thing they will not say at first>", "look": "<how they look, the same in every photo of them: age, skin, hair, face, build, usual clothes, in one sentence>", "romance": "<love and attraction: who they could fall for, how they flirt, or why they will not>", "interests": ["<three to six things that fill their days and their talk>"], "happenings": [{"en": "<something that could happen in their life>", "mood": "<the mood it brings>", "hours": [<shortest>, <longest>]}]}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Asks for messages that broke the limits to be written again. */
export function repairPrompt(bad: { la: string; en: string; issues: string[] }[], ctx: PromptCtx, texting = true): string {
  return [
    texting
      ? `These messages for a Latin messenger break the learner's limits. Rewrite each one to say the same thing (or something close, or simpler) with ONLY the allowed words, forms and grammar below. Keep the person's voice, mood and emoji.`
      : `These lines of a daily notice board (Rome's Ācta Diurna, read by a beginner) break the learner's limits. Rewrite each one as a plain sentence of news that says the same thing (or something close, or simpler) with ONLY the allowed words, forms and grammar below: never a single word or an emoji.`,
    bad.map((b, i) => `${i + 1}. «${b.la}» (${b.en}). Problems: ${b.issues.join("; ")}`).join("\n"),
    languageBlock(ctx, texting),
    `Reply with only JSON: {"messages": [{"la": "<Latin>", "en": "<English>"}]} in the same order, one for each.`,
  ].join("\n\n");
}

/** The rules the learner has met, for the coach to explain with. */
function knownRules(seen: Set<string>): string {
  const met = SKILLS.filter((s) => seen.has(s.id)).map((s) => `- ${s.title}: ${s.hint}`);
  return `The rules the learner has met (explain with these; name a later rule plainly when it is needed):\n${met.join("\n") || "- almost nothing yet"}`;
}

/** The coach judges Latin, not vocabulary: any word is welcome. */
const ANY_WORD =
  "The learner may use any Latin word, also words they have not learned yet: that is fine and never a mistake. Judge only whether the Latin is correct and says what they mean. Never point out that a word is new, unknown or not in their words, unless they ask about it.";

/** The coach's check of a message the learner is about to send (or sent). */
export function checkPrompt(draft: string, thread: Thread, meta: Meta, ctx: PromptCtx, engine: string[]): string {
  const members = membersOf(thread.id, meta);
  const tz = members[0]?.tz ?? "Europe/Rome";
  return [
    `You are a kind Latin coach. A beginner is texting in Latin with ${thread.kind === "group" ? "friends in a group chat" : members[0]?.name} and asks you to check this message before or after sending it:`,
    `«${draft}»`,
    `The chat so far (last messages):\n${conversationBlock(thread, meta, ctx, tz, 6)}`,
    engine.length ? `The site's grammar engine found: ${engine.join(" ")}` : "The site's grammar engine found nothing wrong.",
    `The learner: ${ctx.me.name}, a ${gender(ctx.me.g)}. ${ANY_WORD}`,
    knownRules(ctx.seen),
    `Decide: "good" (correct Latin that says what they mean; missing long marks are fine), "almost" (one small slip), or "wrong". In a correction keep their own words and change only what is wrong.
If they wrote it in English, Russian or Ukrainian (or mostly so), they are asking how to say it in Latin: the verdict is "say", "better" is the Latin they could send (simple, with their own words where they have them; a new word is welcome), and the note gives each word they have not learned with its meaning.
Reply with only JSON: {"verdict": "good" | "almost" | "wrong" | "say", "better": "<the corrected Latin, or the Latin for what they wrote, with long marks; empty when good>", "note": "<one or two short, friendly sentences in English about what was wrong or right, or the new words; Latin inside «»>"}`,
  ].join("\n\n");
}

/** The coach's window: what was checked and asked so far, for the next question. */
function coachLog(turns: CoachTurn[]): string {
  return turns
    .slice(-12)
    .map((t) =>
      t.kind === "check"
        ? `- They checked «${t.draft}»: ${t.res.verdict}${t.res.better ? `; better «${t.res.better}»` : ""}. ${t.res.note}`
        : t.kind === "q"
          ? `- They asked: ${t.text}`
          : `- You answered: ${t.text}`,
    )
    .join("\n");
}

/** A question the learner asks the coach in the window beside a chat. */
export function coachPrompt(question: string, turns: CoachTurn[], draft: string, thread: Thread, meta: Meta, ctx: PromptCtx, facts: string): string {
  const members = membersOf(thread.id, meta);
  const tz = members[0]?.tz ?? "Europe/Rome";
  return [
    `You are a kind Latin coach in a small window beside a beginner's chat in a Latin messenger, where they text with ${thread.kind === "group" ? "friends in a group chat" : members[0]?.name}. They ask you about their messages and about Latin. The learner speaks English, Russian and Ukrainian; explain in English.`,
    `How to answer:
- Short: one to four sentences, or a few short lines. Longer only when they ask for more.
- Answer exactly what they ask. If they ask about a word, also give where it comes from and one interesting bit of history about it, and a surprising connection they may have missed when a real one exists (a first name, a modern word, a term of science, in English, Russian or Ukrainian: «euge» → Eugene, "Євген", "eugenics"). Briefly; say "probably" where scholars are not sure, and never invent a relative, a link or a story.
- Write every Latin word or sentence inside «guillemets» («puellam»); quote English, Russian and Ukrainian with "double quotes". Use **bold** only for the key point. No headings, no tables, no greeting.
- Be exact: check every Latin form you write. Never invent a grammar rule.
- ${ANY_WORD}`,
    `The learner: ${ctx.me.name}, a ${gender(ctx.me.g)}.`,
    knownRules(ctx.seen),
    `The chat so far (last messages):\n${conversationBlock(thread, meta, ctx, tz, 8)}`,
    draft.trim() ? `In their message box now: «${draft.trim()}»` : "",
    turns.length ? `This window so far:\n${coachLog(turns)}` : "",
    `Their question: ${question}`,
    facts,
  ]
    .filter(Boolean)
    .join("\n\n");
}
