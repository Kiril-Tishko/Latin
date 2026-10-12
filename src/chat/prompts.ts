// What Claude reads to write as the people in the messenger: who they are,
// their day and mood right now, the learner, the conversation, and the strict
// limits of the learner's Latin. Plain functions of plain data, so the same
// text serves the page and the brief the phone routine reads.
import { emojiList } from "./emoji";
import { photosFor } from "../content/photos";
import { GROUP, PEOPLE } from "../content/people";
import { SKILLS } from "../latin/skills";
import type { Me } from "../trainer/progress";
import { Life, localTime, moodText, partOfDay, statusAt } from "./life";
import { CoachTurn, Meta, Msg, Thread, Who, membersOf, whoOf } from "./model";
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
    notYet.length ? `Not learned yet, so never use: ${notYet.join("; ")}.` : "",
    "Questions are plain sentences with a question mark («Labōrās?»), or start with quid, quis, ubi, quō or cūr. The present tense only.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function languageBlock(ctx: PromptCtx): string {
  return `LANGUAGE: strict, because the learner is a beginner and must understand every word.
- Write in Latin with long marks (ā ē ī ō ū) exactly as in the lists.
- Use ONLY the words and forms listed here. Nothing else, not even small common words (est, sunt, cum, mihi, tibi, hic, iam, sī, ut, valdē…) unless they are listed. Names from the list are fine; other names only if a person's own.
- If you cannot say something with these words, say something simpler, leave it out, or let an emoji say it. Emoji are welcome and carry feelings the words cannot.
- Roman emoji drawn for this tabula, written as codes exactly like this, never inside a word: ${emojiList()}. Use them now and then, when they fit, like any emoji.
- Real texting: short messages, usually 1-8 words; sometimes one word, an interjection or only an emoji.

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

/** Who someone is, for Claude to write as them. */
export function personBlock(who: Who, life: Life | undefined, now: number, meta?: Meta): string {
  const lines = [
    `${who.name} (${who.age}, ${gender(who.g)}; called «${who.voc}»), ${who.city}. ${who.job[0].toUpperCase()}${who.job.slice(1)}.`,
    `Character: ${who.about}`,
    who.traits?.length ? `Temper: ${who.traits.join(", ")}.` : "",
    who.quirk ? `Quirk: ${who.quirk}.` : "",
    who.why ? `Why they wrote to the learner in the first place: ${who.why}.` : "",
    who.secret ? `Keeps to themselves at first: ${who.secret}.` : "",
    `How they text: ${who.style}`,
    who.ties ? `With the others: ${Object.entries(who.ties).map(([id, t]) => `${PEOPLE.find((p) => p.id === id)?.name ?? id}: ${t}`).join("; ")}.` : "",
    knownPeople(who, meta),
    `Right now: ${dayNow(who, now)}; ${lifeLine(life)}.`,
  ];
  return lines.filter(Boolean).join("\n");
}

export function learnerBlock(ctx: PromptCtx): string {
  const t = localTime(ctx.now, ctx.tz);
  const endings = ctx.me.g === "m" ? "amīcus, discipulus" : "amīca, discipula";
  return `THE LEARNER: ${ctx.me.name} (called «${ctx.me.name}»), a ${gender(ctx.me.g)} (words about them take the endings of ${endings}). Lives far away, in Kyiv, beyond the Black Sea, and is learning Latin, which is why everyone writes to them simply. For ${ctx.me.name} it is ${t.weekday} ${t.hm} (${partOfDay(t.h)}).`;
}

// -------------------------------------------------------- conversation

const nameOf = (id: string, meta: Meta, me: Me) => (id === "me" ? me.name : whoOf(id, meta)?.name ?? id);

/** The conversation so far, oldest first, in the given time zone. */
export function conversationBlock(thread: Thread, meta: Meta, ctx: PromptCtx, tz: string, max = 30): string {
  const shown = thread.messages.filter((m) => m.at <= ctx.now).slice(-max);
  if (!shown.length) return "(no messages yet)";
  return shown
    .map((m: Msg) => {
      const t = localTime(m.at, tz);
      return `[${t.weekday.slice(0, 3)} ${t.hm}] ${nameOf(m.from, meta, ctx.me)}: ${m.la}`;
    })
    .join("\n");
}

const HOW_TO_BE_REAL = `HOW TO BE REAL:
- You are real people with lives of your own, not teachers or assistants. Never correct the learner's Latin, never explain words or grammar. If you do not understand them, react as a friend would («Quid? 😅») or guess.
- Answer what the learner actually said. Sometimes ask something back, often not; change the subject now and then, as people do. Do not end every message with a question, do not greet again in the middle of a conversation, and never repeat something already said.
- Moods are real and may be extreme: let them change what and how you write (length, emoji, capitals, «...», sighs, silence). A bad mood can make someone short or grumpy, but never cruel to the learner. Something going on in your life comes up on its own, when it fits.
- The hour and the people change moods too: sleepy at dawn, hungry before dinner, tired or tender late at night, as fits each person; a kind word cheers someone up, teasing or jealousy stings, news from a friend can turn a day around. Moods may shift within a conversation.
- Never mention AI, phones, the site, lessons, word lists or rules. You live in the Roman world around 100 AD; you write on a «tabula» that carries messages.
- Keep it friendly and clean: no sexual content; romance stays light and sweet.`;

/** For a reply: everyone in the thread, with their state now. */
function peopleOf(thread: Thread, meta: Meta, now: number): string {
  return membersOf(thread.id, meta)
    .map((w) => personBlock(w, meta.life[w.id], now, meta))
    .join("\n\n");
}

/** Voice messages and photos: what a message may carry besides its text. */
const EXTRAS = `- "voice": true (optional) makes it a short voice message: they say it aloud and "la" is what they say (3 to 14 words, spoken style). Now and then, about one message in eight, when it fits the moment (walking, cooking, in a hurry, lazy to type, excited, sleepy, singing); never two in a row.
- "photo": "<photo id>" (optional) sends one of the photos listed with the message, "la" being its caption (a few words, or only an emoji): rarely, when it fits the moment or the talk.`;

const OUTPUT = `Reply with only JSON:
{"messages": [{"from": "<person id>", "la": "<Latin>", "en": "<English translation, emoji kept>", "gap": <seconds of pause before it>, "voice": true, "photo": "<photo id>"}], "remember": ["<new fact about the learner>"]}
- 1 to 4 messages; one is often right. "gap": 1-40 (typing time is added by the page; a long gap is a pause to think).
${EXTRAS}
- "remember": 0-2 short facts about the learner worth remembering later (English), or [].`;

/** The photos the people of a chat could send now (none sent lately in this chat). */
export function photosBlock(people: Who[], recent: string[]): string {
  const lines = people
    .map((w) => ({ w, ps: photosFor(w.id, w.stranger, recent) }))
    .filter((x) => x.ps.length)
    .map((x) => `${x.w.name}: ${x.ps.map((p) => `"${p.id}" (${p.en})`).join("; ")}`);
  return lines.length ? `PHOTOS THEY COULD SEND (their own world, as they see it):\n${lines.join("\n")}` : "";
}

/** Photos sent lately in a chat, not to be sent again soon. */
const recentPhotos = (t: Thread) => t.messages.slice(-60).flatMap((m) => (m.photo ? [m.photo] : []));

/** What is going on with the friends now: for a private chat (friends hear each other's news). */
export function friendsNews(thread: Thread, meta: Meta, now: number): string {
  if (thread.kind === "group") return "";
  const who = membersOf(thread.id, meta)[0];
  if (!who) return "";
  const ids = who.stranger ? (who.link ? [who.link.to] : []) : PEOPLE.map((p) => p.id).filter((id) => id !== who.id);
  const lines = ids.flatMap((id) => {
    const p = PEOPLE.find((x) => x.id === id);
    return p ? [`- ${p.name}: ${dayNow({ ...p, stranger: false }, now)}; ${lifeLine(meta.life[id])}`] : [];
  });
  if (!lines.length) return "";
  return `${who.stranger ? `${who.name.toUpperCase()}'S FRIEND AMONG THE LEARNER'S FRIENDS` : "THE OTHER FRIENDS"}, RIGHT NOW (friends hear each other's news; it may come up when it fits, as gossip, worry or a laugh):\n${lines.join("\n")}`;
}

/** What was said lately in the group chat, for a private chat with one of the friends. */
export function groupLately(thread: Thread, meta: Meta, ctx: PromptCtx): string {
  if (thread.kind !== "dm" || !ctx.group) return "";
  const last = ctx.group.messages.filter((m) => m.at <= ctx.now && ctx.now - m.at < 3 * 86400000).slice(-6);
  if (!last.length) return "";
  return `LATELY IN THE GROUP «${GROUP.name}» (the friends and the learner together):\n${last.map((m) => `  ${nameOf(m.from, meta, ctx.me)}: ${m.la}`).join("\n")}`;
}

/** The learner's last message as the grammar engine reads it, and how to take a mistake: literally, as a Roman would. */
export function literalBlock(literal: string): string {
  if (!literal) return "";
  return `HOW THE LEARNER'S LAST MESSAGE READS, word by word (the site's grammar engine; it is certain):
${literal}
Read it LITERALLY, as a Roman would. If a mistake makes it say something other than they meant (a wrong ending makes the water drink them, a wrong person makes someone else do it, a wrong word means something else), react to what it literally says, in character: amused, puzzled, alarmed or teasing («Aqua tē bibit?! 😂»), and then maybe go on with what they meant. Never explain the grammar or correct them like a teacher. When a slip changes nothing (a missing long mark, a small spelling slip), simply answer.`;
}

/** The prompt for an answer to what the learner wrote. */
export function replyPrompt(thread: Thread, meta: Meta, ctx: PromptCtx, timing: { at: number; why: string }, literal = ""): string {
  const group = thread.kind === "group";
  const members = membersOf(thread.id, meta);
  const tz = members[0]?.tz ?? "Europe/Rome";
  const deliver = localTime(timing.at, tz);
  const ids = members.map((w) => `"${w.id}" (${w.name})`).join(", ");
  return [
    group
      ? `You write as the friends in the group chat «${GROUP.name}» of a Latin messenger: ${PEOPLE.map((p) => p.name).join(", ")} and the learner. Decide who answers: usually one or two of them, sometimes three, never all; they may answer each other, tease, agree or argue.`
      : `You write as ${members[0]?.name} in a Latin messenger, texting with the learner.`,
    learnerBlock(ctx),
    `WHO ${group ? "THEY ARE" : "YOU ARE"}:\n${peopleOf(thread, meta, ctx.now)}`,
    friendsNews(thread, meta, ctx.now),
    ctx.calendar ?? "",
    thread.memory.length ? `What ${group ? "they remember" : `${members[0]?.name} remembers`} about ${ctx.me.name}: ${thread.memory.join("; ")}.` : "",
    groupLately(thread, meta, ctx),
    `THE CONVERSATION (oldest first; times where ${group ? "they are" : `${members[0]?.name} is`}). The learner's Latin may have mistakes.\n${conversationBlock(thread, meta, ctx, tz)}`,
    literalBlock(literal),
    `The answer arrives at ${deliver.weekday} ${deliver.hm} their time (${timing.why}); write for that moment.`,
    HOW_TO_BE_REAL,
    languageBlock(ctx),
    photosBlock(members, recentPhotos(thread)),
    `${OUTPUT}\nPerson ids: ${ids}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The prompt for messages the people write on their own (on opening the messenger, or from the phone routine). */
export function ownPrompt(threads: Thread[], meta: Meta, ctx: PromptCtx, hours: number): string {
  const friends = PEOPLE.map((p) => personBlock({ ...p, stranger: false }, meta.life[p.id], ctx.now, meta)).join("\n\n");
  const met = Object.values(meta.strangers).filter((s) => threads.some((t) => t.id === s.id && !t.gone && t.messages.length));
  const strangers = met.map((s) => personBlock(whoOf(s.id, meta)!, meta.life[s.id], ctx.now, meta)).join("\n\n");
  const everyone = [...PEOPLE.map((p) => ({ ...p, stranger: false })), ...met.map((s) => whoOf(s.id, meta)!)] as Who[];
  const sent = threads.flatMap(recentPhotos);
  const recent = threads
    .filter((t) => !t.gone)
    .map((t) => {
      const last = t.messages.filter((m) => m.at <= ctx.now).slice(-6);
      const title = t.kind === "group" ? `«${GROUP.name}» (group)` : whoOf(t.id, meta)?.name ?? t.id;
      const lastMine = [...t.messages].reverse().find((m) => m.from === "me" && m.at <= ctx.now);
      const waiting = t.messages.some((m) => m.from !== "me" && m.at > ctx.now);
      return `${title} [chat id "${t.id}"]${waiting ? " (has messages still on their way)" : ""}${lastMine ? `, learner last wrote ${ago(ctx.now - lastMine.at)} ago` : ""}:\n${last.length ? last.map((m) => `  ${nameOf(m.from, meta, ctx.me)}: ${m.la}`).join("\n") : "  (nothing yet)"}`;
    })
    .join("\n");
  return [
    `You decide what the people of a Latin messenger write to the learner ON THEIR OWN in the next ${hours} hours, as real friends would: the five friends (each in a private chat, and together in the group «${GROUP.name}») and any strangers the learner has met.`,
    learnerBlock(ctx),
    `THE FRIENDS:\n${friends}`,
    strangers ? `STRANGERS THE LEARNER HAS MET:\n${strangers}` : "",
    ctx.calendar ?? "",
    `THE CHATS NOW (last messages):\n${recent}`,
    `DECIDE like life: sometimes nobody writes; often one person writes one to three messages; now and then a short exchange happens in the group (friends talking to each other and to the learner). Someone writes only when awake and when there is a reason: news, their mood or what is going on, a question, a follow-up to an earlier talk, a greeting at a fitting hour, missing the learner. Do not write into a chat that has messages still on their way. In all, at most two private chats plus one group exchange of up to six messages.`,
    HOW_TO_BE_REAL,
    languageBlock(ctx),
    photosBlock(everyone, sent),
    `Reply with only JSON:
{"messages": [{"chat": "<chat id>", "from": "<person id>", "la": "<Latin>", "en": "<English>", "in": <minutes from now, 0-${hours * 60}>, "voice": true, "photo": "<photo id>"}]}
Messages of one chat in time order; a burst of messages is a minute or less apart. {"messages": []} when nobody writes.
${EXTRAS}
Person ids: ${PEOPLE.map((p) => `"${p.id}"`).join(", ")}${Object.keys(meta.strangers).length ? `, strangers by their chat id` : ""}.`,
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
{"about": "<two or three vivid sentences in English: who they are>", "secret": "<one thing they will not say at first>", "happenings": [{"en": "<something that could happen in their life>", "mood": "<the mood it brings>", "hours": [<shortest>, <longest>]}], "first": [{"la": "<Latin>", "en": "<English>", "gap": <seconds>}]}
- "happenings": 4 to 6 things, everyday ones and odd ones.
- "first": ${s.writesFirst ? "1 to 3 messages" : "[]"}.`,
  ].join("\n\n");
}

/** Asks for messages that broke the limits to be written again. */
export function repairPrompt(bad: { la: string; en: string; issues: string[] }[], ctx: PromptCtx): string {
  return [
    `These messages for a Latin messenger break the learner's limits. Rewrite each one to say the same thing (or something close, or simpler) with ONLY the allowed words, forms and grammar below. Keep the person's voice, mood and emoji.`,
    bad.map((b, i) => `${i + 1}. «${b.la}» (${b.en}). Problems: ${b.issues.join("; ")}`).join("\n"),
    languageBlock(ctx),
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
    `Decide: "good" (correct Latin that says what they mean; missing long marks are fine), "almost" (one small slip), or "wrong". If they wrote English or a mix, give the Latin they could send. In a correction keep their own words and change only what is wrong.
Reply with only JSON: {"verdict": "good" | "almost" | "wrong", "better": "<the corrected Latin with long marks; empty when good>", "note": "<one or two short, friendly sentences in English about what was wrong or right; Latin inside «»>"}`,
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
