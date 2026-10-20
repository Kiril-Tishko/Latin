// Ask Claude: a chat drawer that always knows where the learner is (lessons,
// skills with mastery, known words, recent mistakes) and what is on screen
// when a question is asked (see screen.ts), so "here" and "this" make sense.
// Conversations are saved (see chats.ts) and can be continued on any device;
// what is typed in the box survives a reload.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { relativesFact } from "../content/english";
import { LESSONS } from "../content/lessons";
import { Part, PartQuestion, PARTS } from "../content/parts";
import { annotate } from "../latin/analyze";
import { checkAnswer, engineFacts, Finding } from "../latin/facts";
import { dictionaryForm } from "../latin/morph";
import { SKILL_BY_ID, SKILLS } from "../latin/skills";
import { Exercise, Result } from "../trainer/exercises";
import { PART_GOAL, partRight, partState } from "../trainer/path";
import { mastery } from "../trainer/progress";
import { Chat, ChatTurn, deleteChat, getChat, newChatId, saveChat, useChats } from "./chats";
import { enterSends, Icon, toast } from "./components";
import { Inline, Markup } from "./markup";
import { SampleFn, sampleErrorText, sampler, storage } from "./platform";
import { currentScreen, Screen, sharedByDefault, useScreenLabel, wordInView } from "./screen";
import { coachOpts, tierName } from "./models";
import { derived, getProgress, useProgress } from "./store";
import { knownWord, openAddWord } from "./addword";
import { CHAT_WORD_LIST } from "../chat/words";
import { bareWord, cardWord, latinToSend, newWordsIn } from "./answer-words";
import { useRoute } from "./nav";
import { NO_CORRECTION } from "./keyboard";

export interface AskContext {
  /** Short label shown in the drawer: "Exercise: Translate into Latin". */
  label: string;
  /** Everything Claude should know about the current screen. */
  detail: string;
}

interface AskState {
  open: boolean;
  /** The conversation on screen; null for a new one that has not been sent yet. */
  chatId: string | null;
  /** What a new conversation is about (a saved one carries its own). */
  context: AskContext | null;
  /** A suggested question for the box (never sent by itself). */
  draft?: string;
  /** Showing the list of saved conversations. */
  history: boolean;
  /** For a conversation not sent yet: whether Claude sees the screen (null: the page decides). */
  share: boolean | null;
}

// the drawer comes back as it was after a reload: open or closed, on the same conversation
const UI_KEY = "tabula-latina-ask-ui";
const DRAFTS_KEY = "tabula-latina-ask-drafts";

function loadUi(): Pick<AskState, "open" | "chatId"> {
  try {
    const raw = JSON.parse(storage.get(UI_KEY) ?? "{}");
    return { open: !!raw.open, chatId: typeof raw.chatId === "string" ? raw.chatId : null };
  } catch {
    return { open: false, chatId: null };
  }
}

let state: AskState = { ...loadUi(), context: null, history: false, share: null };
const listeners = new Set<() => void>();
const set = (s: Partial<AskState>) => {
  state = { ...state, ...s };
  storage.set(UI_KEY, JSON.stringify({ open: state.open, chatId: state.chatId }));
  listeners.forEach((l) => l());
};

/** Unsent text in the box, per conversation ("new" for one not started), kept in this browser. */
let drafts: Record<string, string> = (() => {
  try {
    const d = JSON.parse(storage.get(DRAFTS_KEY) ?? "{}");
    return d && typeof d === "object" ? d : {};
  } catch {
    return {};
  }
})();
let draftTimer: ReturnType<typeof setTimeout> | undefined;
function keepDraft(key: string, text: string) {
  if (text) drafts[key] = text;
  else delete drafts[key];
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => storage.set(DRAFTS_KEY, JSON.stringify(drafts)), 250);
}
window.addEventListener("pagehide", () => storage.set(DRAFTS_KEY, JSON.stringify(drafts)));

let practiceHandler: ((skills: string[]) => void) | null = null;
export function onPractice(fn: (skills: string[]) => void) {
  practiceHandler = fn;
}

/**
 * Opens the drawer. From a screen with its own context (an exercise, a word)
 * that differs from the conversation on screen, a new conversation starts;
 * otherwise the current one continues. A suggestion goes into the box.
 */
export function openAsk(context: AskContext | null, suggestion?: string) {
  const current = getChat(state.chatId);
  const about = current ? current.context : state.context;
  // asking about a thing on screen (Why?, a word, a card) lets Claude see it
  if (context && about?.detail !== context.detail) set({ open: true, chatId: null, context, draft: suggestion, history: false, share: true });
  else {
    if (context && current && current.share === false) saveChat({ ...current, share: true, updatedAt: Date.now() });
    set({ open: true, draft: suggestion, history: false, ...(context && !current ? { share: true } : {}) });
  }
}

/** Whether Claude sees the screen in a conversation: the learner's choice, else the page's default (off on the home page). */
function sharing(chat: Chat | null): boolean {
  return (chat ? chat.share : state.share) ?? sharedByDefault();
}

// ------------------------------------------------------------- prompts

const INSTRUCTIONS = `You are a friendly Latin tutor inside "Tabula Latina", a practice site that follows the YouTube course "Easy Latin Lessons" (classical pronunciation; long vowels marked with macrons).

The learner speaks English, Russian and Ukrainian natively. Explain in English. When it really helps, compare with Russian or Ukrainian grammar (cases, word order); they know both well.

How to answer:
- Short by default, about 30-90 words, but shaped by the question, not by a template. Choose what reads best each time: one or two plain sentences for a simple question; the key point in **bold** followed by 2-4 short bullets when there really are several points (a rule, why it applies here, an example); a short paragraph for a story, a comparison or a word's history; a few lines of forms when forms are compared. Do not start every answer the same way and do not force bullets onto something one sentence says well. No greeting, no preamble, no closing summary, no offers of more help.
- A yes/no or one-word question gets one or two lines.
- Give a longer, more open answer only when the learner asks for one ("tell me more", "explain in detail", "tell me about…") or wants to chat generally (history, culture, how a word came into English). Keep even that in short paragraphs or bullets, under about 250 words.
- Stay inside what the learner knows (lessons, words and skills below). If you must use a word or form they have not learned, mark it "(new)" the first time it appears in the conversation (not again), and keep such words to a minimum.
- "How do I say …?" asks for that very thing in Latin, to write to someone (often a friend in the site's messenger): give it first, in bold «», then a line on how it is built. Answer it directly, even when an exercise or a chat is on screen: the screen is not the question.
- Write every Latin word, form or sentence inside «guillemets», for example «puellam». For a form that could be read two ways, add #case.number inside the guillemets: «puellae#gen.sg», «discipulī#nom.pl». The page colors the endings. Use «» for Latin only: quote English, Russian and Ukrainian words with "double quotes".
- Use **bold** only for the key point (and for the labels of a word card). No tables and no headings.
- If the question is about a mistake, first name the wrong ending and the right one, then the rule that decides it.
- Be exact. The rules under "Skills met" are this site's rules and they are correct: follow them. Check every Latin form before you write it. Never invent a grammar rule or pattern, and give only memory tricks that are true (an English relative, a real pattern). When there is no reliable way to tell (which infinitive a verb has, for example), say so plainly and suggest learning the pair («discō, discere»).
- A question may end with [Facts from the site's grammar engine]: every Latin word in it, what each form can be, and its word's gender, group and forms. These facts are certain. Build your answer on them, never contradict them, and don't mention the note.
- Words and their stories: the learner loves etymology and history. Whenever a question is about a word (what it means, a form of it, how to use it), also say briefly where the word comes from and one interesting bit of history about it or about what it names: a sentence or two, after answering the question itself. Leave it out only for a quick question about an ending in an exercise.
- Hidden links: look actively for a surprising connection the learner may have missed and would love to discover: a first name, a modern word, a term of science or medicine, a brand, a place, a saying, in English, Russian or Ukrainian. For «euge»: Greek "eu" (well) → the name Eugene, "Евгений", "Євген" (well-born) → "eugenics", and "euphoria", "euphemism". The learner was delighted by exactly this; add one such link whenever a real one exists, plainly marked as the surprise, and never stretch for a false one (a look-alike is not a link).
- A message that is just a word (Latin, English, Russian or Ukrainian, perhaps with a question mark) asks for its word card. Answer with exactly these lines, each on its own line, about 70-140 words in all:
  **<the dictionary form, e.g. gladius, gladiī (m)> · <meaning>**
  **Origin:** where the word comes from: its root, the language it was borrowed from, how its meaning grew.
  **History:** one interesting historical fact about the word or about what it names.
  **Family:** related words: Latin relatives first, then English, Russian and Ukrainian ones, saying which are borrowed and which are cousins of the same ancient root.
  **Hidden link:** one surprising, real connection the learner may have missed (a name, a modern word, a scientific term, a brand, a place), e.g. «euge» → Eugene, "Євген" → "eugenics". Leave this line out only when there is truly none.
  **Use:** two short example sentences in «», each with its English, with the learner's words and rules where possible.
  For an English, Russian or Ukrainian word, the card is about the Latin word for it (name it in the first line); if the word itself comes from Latin, the Origin line tells how.
- Where a word comes from and what it is related to: use the relatives in the facts, which are checked. Say which kind each is: borrowed (English, Russian or Ukrainian took it from Latin) or same ancient root (cousins from the common Indo-European ancestor, not borrowed). Never call a look-alike related. For words without checked relatives, use only what you know well and say "probably" where scholars are not sure. Never invent an etymology, a relative or a historical story; tell a legend as a legend.
- Easy to get wrong: an adjective agrees with its noun in gender, case and number, not in the look of the ending. «agricola» and «poēta» are masculine, so «agricola timidus», «poēta pulcher», «agricolam timidum».
- If the learner says they are just curious, or asks about something other than the exercise, answer that alone and do not lead back to the exercise.
- If a short drill would help, end with one final line exactly like: PRACTICE: skill-id, skill-id (1-3 ids from the skill list below). Otherwise leave that line out.

Where the learner is: each question starts with a note in [square brackets] describing what was on their screen when they asked: the page or exercise, an open dialog, the part of a long page in view, and the last line or word they tapped. "Here", "this", "this sentence", "this word" or "this exercise" mean what the newest note describes; earlier questions may have been asked elsewhere. Use the note quietly: do not repeat it back. When the exercise on screen has not been answered yet, help with the rule and hints, and do not give the answer away unless the learner asks for it.

On the page, endings are colored by case: nominative blue, accusative red, genitive purple, ablative amber, dative green, vocative pink; verb endings teal. A plural is underlined.`;

function profile(): string {
  const p = getProgress();
  const d = derived();
  const lessons = LESSONS.filter((l) => p.lessonsDone.includes(l.n)).map((l) => `Lesson ${l.n}: ${l.title}`);
  // only the rules the learner has met: exercises never use the others
  const skills = SKILLS.filter((s) => d.seenKnowledge.skills.has(s.id)).map((s) => {
    const st = p.skills[s.id];
    return `- ${s.id}: ${s.title}. ${s.hint} (mastery ${Math.round(mastery(st) * 100)}% after ${st?.seen ?? 0} tries)`;
  });
  const path = PARTS.filter((x) => p.lessonsDone.includes(x.lesson));
  const named = (state: string) =>
    path
      .filter((x) => partState(p, x) === state)
      .map((x) => `${x.id} ${x.title}${state === "practising" ? ` (${partRight(p, x)} of ${PART_GOAL} right answers)` : ""}`)
      .join("; ") || "none";
  const words = d.words.map((w) => `${dictionaryForm(w)} = ${w.en}`).join("; ");
  const chat = CHAT_WORD_LIST.map((w) => `${dictionaryForm(w)} = ${w.en}`).join("; ");
  const mistakes = p.mistakes.slice(0, 8).map((m) => `- "${m.prompt}" | wrote: ${m.answer} | expected: ${m.expected}${m.notes.length ? ` | ${m.notes.join(" ")}` : ""}`);
  return [
    `Lessons watched: ${lessons.join("; ")}. The learner remembers the words of these lessons but had forgotten most of the rules, so they learn the rules again in small parts, one at a time: a very simple explanation, two open questions, then exercises from simple to harder: each right answer on the rule adds one, and ten make it learned. Exercises use only the rules of the parts seen.`,
    `Rules learned: ${named("learned")}.\nBeing practised now: ${named("practising")}.\nNot met yet: ${named("new")}.`,
    "Explain with the rules met so far unless the learner asks about later ones, and remind them of a rule plainly rather than assuming they remember it.",
    `Skills met, with the rule as this site teaches it (ids for PRACTICE):\n${skills.join("\n") || "none yet"}`,
    `Words known: ${words}`,
    `Words for chatting, which the site teaches for the messenger (when the learner asks how to say yes, no, hello, goodbye, thanks, why, where…, give these first): ${chat}`,
    mistakes.length ? `Recent mistakes:\n${mistakes.join("\n")}` : "No recent mistakes recorded.",
  ].join("\n\n");
}

const NOT_SHARED =
  "[Screen not shared: the learner switched this off to talk generally. Answer the question in general, and do not bring the conversation back to the screen, the exercise or earlier screens unless they ask.]";

/** A question as Claude reads it: where the learner was, in full for the newest question. */
function questionText(t: Pick<ChatTurn, "content" | "screen" | "noScreen">, latest: boolean, general = false): string {
  if (latest && t.noScreen) return `${NOT_SHARED}\n\n${t.content}`;
  const s = t.screen;
  if (!s || general) return t.content;
  if (latest && s.detail) return `[Where the learner is: ${s.label}\n${s.detail}]\n\n${t.content}`;
  return `[Asked on: ${s.label}]\n${t.content}`;
}

/** What a conversation opened from a button (an exercise's Why?, a word, a rule) is about. */
function openedFrom(context: AskContext | null, firstHasScreen: boolean): string {
  if (!context) return "";
  // conversations saved before questions carried their screen keep the whole description here
  return firstHasScreen ? `This conversation was opened from: ${context.label}.` : `Screen when this conversation started: ${context.label}. ${context.detail}`;
}

/** One message with everything: for pasting into a Claude chat when the page cannot ask. */
export function fullPrompt(question: string, screen: Screen | null, context: AskContext | null): string {
  const q = screen ? questionText({ content: question, screen }, true) : questionText({ content: question, noScreen: true }, true);
  return [INSTRUCTIONS, profile(), screen ? openedFrom(context, true) : "", q].filter(Boolean).join("\n\n");
}

function splitPractice(text: string): { body: string; practice: string[] } {
  const m = text.match(/\n?\s*PRACTICE:\s*([^\n]+)\s*$/);
  if (!m) return { body: text, practice: [] };
  const ids = m[1].split(/[,\s]+/).map((s) => s.trim()).filter((s) => SKILL_BY_ID.has(s));
  return { body: text.slice(0, m.index).trim(), practice: ids.slice(0, 3) };
}

// ------------------------------------------------------------ judging

export interface Judgement {
  correct: boolean;
  explanation: string;
}

/** Asks Claude whether a rejected answer is in fact acceptable. */
export async function judge(ex: Exercise, answer: string, res: Result): Promise<Judgement | { error: string }> {
  const sample = await sampler();
  if (!sample) return { error: "Asking Claude works when this page is open on claude.ai." };
  const prompt = `You check answers in a Latin practice app for a beginner (Easy Latin Lessons 1-4: present tense, nominative, accusative, genitive and ablative singular, first plurals).

Exercise: ${ex.instruction}. ${ex.context}
Learner's answer: "${answer}"
The automatic checker said "${res.verdict}" because: ${res.issues.map((i) => i.message.replace(/«|»/g, "").replace(/#[a-z0-9]+(?:\.[a-z0-9]+)*/g, "")).join(" ") || "it did not match the accepted answers."}

Decide whether the learner's answer is a correct answer. Accept any Latin word order, missing long marks, and natural English variants (articles, progressive tense, synonyms). Reject wrong endings, wrong person or number, and missing or extra meaning.${ex.kind === "answer" ? "\nThis is an open question: any correct, sensible Latin answer in the learner's own words counts, and the example is only one possibility. Judge the answer itself: is it correct Latin, does it answer the question, and (for a question about a story) does it say what the story says?" : ""}
Reply with only JSON: {"correct": true or false, "explanation": "one or two sentences; put Latin inside «guillemets»"}

${engineFacts([{ text: answer, mixed: true }, { text: ex.context, mixed: true }], derived().lexicon, derived().seenKnowledge.skills)}`;
  try {
    const out = await sample.json<Judgement>(prompt, coachOpts());
    if (typeof out?.correct !== "boolean") return { error: "Claude's reply could not be read. Try again." };
    return { correct: out.correct, explanation: String(out.explanation ?? "") };
  } catch (e) {
    const code = (e as { code?: string }).code;
    return { error: sampleErrorText(code) || "Stopped." };
  }
}

export interface Understanding {
  verdict: "right" | "partly" | "wrong";
  feedback: string;
}

const unhinted = (s: string) => s.replace(/#[a-z0-9]+(?:\.[a-z0-9]+)*/g, "");

/** Asks Claude whether an answer to a rule's open question shows the idea. */
export async function checkUnderstanding(part: Part, q: PartQuestion, answer: string): Promise<Understanding | { error: string }> {
  const sample = await sampler();
  if (!sample) return { error: "Asking Claude works when this page is open on claude.ai." };
  const prompt = `You check a beginner's answer to an open question in a Latin course (Easy Latin Lessons). The learner has just read this very simple explanation of one rule:

Rule ${part.id}: ${part.title}
${unhinted(part.explain.join("\n"))}
Examples: ${part.examples.map((e) => `${unhinted(e.la)} = ${e.en}`).join("; ")}

Question: ${unhinted(q.q)}
A good answer: ${unhinted(q.answer)}
The learner's answer (English, Russian or Ukrainian; long marks are never needed): "${answer}"

Decide whether the answer shows the idea of the good answer. "right": the idea is there, in any words (articles, a progressive tense, small typos and missing long marks are fine). "partly": on the way, but something the question asks for is missing or slightly off. "wrong": a different idea, a wrong ending or a wrong meaning.
Reply with only JSON: {"verdict": "right" or "partly" or "wrong", "feedback": "one or two short, friendly sentences in plain English, written to the learner: what is right, and what to look at again if something is missing. Put Latin inside «guillemets». Use only the rules of this explanation."}

${engineFacts([{ text: answer, mixed: true }, { text: `${q.q} ${q.answer}`, mixed: true }], derived().lexicon, derived().seenKnowledge.skills)}`;
  try {
    const out = await sample.json<Understanding>(prompt, coachOpts());
    if (!out || !["right", "partly", "wrong"].includes(out.verdict)) return { error: "Claude's reply could not be read. Try again." };
    return { verdict: out.verdict, feedback: String(out.feedback ?? "") };
  } catch (e) {
    const code = (e as { code?: string }).code;
    return { error: sampleErrorText(code) || "Stopped." };
  }
}

// ------------------------------------------------------------- drawer

/** Quick questions for a new conversation: about the word in view, or (with no word in view) general starters. */
function quickQuestions(word: string, aboutAWord: boolean): string[] {
  if (word) return [`Where does «${word}» come from?`, `Which words are related to «${word}»?`, `Give me a memory trick for «${word}»`, `Compare «${word}» with Russian or Ukrainian`];
  if (aboutAWord) return ["Where does this word come from?", "Which words are related to it?", "Give me a memory trick", "Compare it with Russian or Ukrainian"];
  return ["How do I say this in Latin:", "Explain the rule I am learning, simply", "Tell me something surprising about Roman life", "Which English words come from Latin words I know?"];
}

/** A suggested question joins what is already in the box (it never replaces the learner's words). */
export function withQuestion(box: string, q: string): string {
  const now = box.trim();
  if (!now) return q;
  if (now.includes(q)) return now;
  return `${now} ${q}`;
}

/** The last suggestion put in each conversation's box, so a new one replaces it rather than piling up. */
const lastSuggestion: Record<string, string> = {};


/**
 * The turns Claude reads: the conversation so far (last few), the first carrying
 * the instructions and the learner's profile, each question saying where it was
 * asked, and the newest one describing the screen in full.
 */
function toMessages(chat: Chat): { role: "user" | "assistant"; content: string }[] {
  let hist = chat.turns.filter((t) => t.content.trim());
  while (hist.length > 9) hist = hist.slice(2);
  while (hist.length && hist[0].role !== "user") hist = hist.slice(1);
  if (!hist.length) return [];
  const latest = hist.map((t) => t.role).lastIndexOf("user");
  // with sharing switched off, nothing points back at screens: no "asked on" notes, no "opened from"
  const general = !!hist[latest]?.noScreen;
  const msgs = hist.map((t, i) => ({ role: t.role, content: t.role === "user" ? questionText(t, i === latest, general) : t.content }));
  // the grammar engine's facts about every Latin word in play: the question, the screen, the last answer
  const facts = factsFor(hist[latest], general ? null : chat.context, hist.slice(0, latest).reverse().find((t) => t.role === "assistant"));
  if (facts) msgs[latest] = { ...msgs[latest], content: `${msgs[latest].content}\n\n${facts}` };
  if (bareWord(hist[latest].content)) msgs[latest] = { ...msgs[latest], content: `${msgs[latest].content}\n\n[Just a word: answer with its word card.]` };
  msgs[0] = { role: "user", content: [INSTRUCTIONS, profile(), general ? "" : openedFrom(chat.context, !!hist[0].screen), msgs[0].content].filter(Boolean).join("\n\n") };
  return msgs;
}

/** A question about where a word comes from or what it is related to. */
const ORIGIN = /etymolog|\bcomes? from|origin|relat(ed|ive)|\broots?\b|cognate|borrow|deriv|english|russian|ukrainian|kin\b/i;


function factsFor(question: ChatTurn, context: AskContext | null, lastAnswer?: ChatTurn): string {
  const d = derived();
  // the words the question names get their checked relatives (every word question gets its story);
  // a question about origins gets them for every word in play
  const named = new Set(annotate(question.content, d.lexicon).flatMap((t) => t.readings?.map((r) => r.entry.id) ?? []));
  const origins = ORIGIN.test(question.content);
  return engineFacts(
    [
      // a word sent alone is the Latin word, even one that is also English ("aqua")
      { text: question.content, mixed: !bareWord(question.content) },
      ...(lastAnswer ? [{ text: lastAnswer.content, quoted: true }] : []),
      ...(question.screen?.detail ? [{ text: question.screen.detail, mixed: true }] : []),
      ...(context?.detail ? [{ text: context.detail, mixed: true }] : []),
    ],
    d.lexicon,
    d.seenKnowledge.skills,
    10,
    (e) => (origins || named.has(e.id) ? relativesFact(e) : undefined),
  );
}

/** A request to put right what the grammar check found in the last answer. */
export function fixRequest(found: Finding[]): string {
  return `The site's grammar engine found a mistake in your last answer:\n${found.map((f) => `- ${f.message}`).join("\n")}\nPlease give the corrected answer, short, without apologising at length.`;
}

function when(t: number): string {
  const d = new Date(t);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `today, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `yesterday, ${time}`;
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

interface Failure {
  text: string;
  detail?: string;
}

export function AskDrawer() {
  const [, setTick] = useState(0);
  const chats = useChats();
  const [input, setInputState] = useState("");
  const [suggested, setSuggested] = useState("");
  const [busyChat, setBusyChat] = useState<string | null>(null);
  const [streaming, setStreaming] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [sample, setSample] = useState<SampleFn | null | undefined>(undefined);
  const ctl = useRef<AbortController | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const shownKey = useRef<string | null>(null);

  const chat = getChat(state.chatId);
  const key = state.chatId ?? "new";
  const busy = busyChat !== null;
  const seeing = useScreenLabel(state.open);
  const shared = sharing(chat);
  const toggleShare = () => {
    if (chat) saveChat({ ...chat, share: !shared, updatedAt: Date.now() });
    else set({ share: !shared });
  };
  const setInput = (text: string) => {
    setInputState(text);
    keepDraft(key, text);
  };

  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);

  useEffect(() => {
    // (a function given to a state setter is called as an updater, so wrap it)
    if (state.open && sample === undefined) void sampler().then((fn) => setSample(() => fn));
  }, [state.open, sample]);

  // switching conversations brings back what was being typed there; a suggestion goes into the box
  useEffect(() => {
    if (!state.open) return;
    if (state.draft !== undefined) {
      const draft = state.draft;
      set({ draft: undefined });
      if (draft) {
        // what the learner typed stays; only an earlier, untouched suggestion is replaced
        const typed = (drafts[key] ?? "").trim();
        const text = typed && typed !== lastSuggestion[key] ? withQuestion(typed, draft) : draft;
        lastSuggestion[key] = text;
        setInputState(text);
        keepDraft(key, text);
        setSuggested(text === draft ? draft : "");
      } else if (shownKey.current !== key) setInputState(drafts[key] ?? "");
      shownKey.current = key;
      setTimeout(() => {
        const el = inputRef.current;
        el?.focus();
        el?.setSelectionRange(el.value.length, el.value.length);
      }, 30);
    } else if (shownKey.current !== key) {
      shownKey.current = key;
      setInputState(drafts[key] ?? "");
      setSuggested("");
      setFailure(null);
    }
  });

  // The conversation never moves by itself while you read or type. It opens at
  // the latest message; a question you send glides up to the top, with room
  // below it that its answer fills. A new message (or an answer arriving) that
  // starts below what is on screen shows a "New message" button; nothing else does.
  const [unseen, setUnseen] = useState(false);
  const spaceRef = useRef<HTMLDivElement>(null);
  const lastEnd = useRef(0);
  const lastCount = useRef(0);
  const glideTo = useRef<string | null>(null);
  /** Where the last message ends, measured in the scrolled content. */
  const contentEnd = (b: HTMLElement) => {
    const last = spaceRef.current?.previousElementSibling;
    return last ? last.getBoundingClientRect().bottom - b.getBoundingClientRect().top + b.scrollTop : 0;
  };
  /** How far the newest message starts below the top of what is on screen. */
  const newestTop = (b: HTMLElement) => {
    const el = [...b.querySelectorAll<HTMLElement>(".msg")].pop();
    return el ? el.getBoundingClientRect().top - b.getBoundingClientRect().top : null;
  };
  const outOfSight = (b: HTMLElement) => {
    const top = newestTop(b);
    return top !== null && top > b.clientHeight - 16;
  };
  const space = (px: number) => {
    if (spaceRef.current) spaceRef.current.style.height = `${Math.max(0, px)}px`;
  };

  useLayoutEffect(() => {
    const b = bodyRef.current;
    if (!state.open || state.history || !b || glideTo.current === key) return;
    space(0);
    b.scrollTop = b.scrollHeight;
    lastEnd.current = contentEnd(b);
    lastCount.current = b.querySelectorAll(".msg").length;
    setUnseen(false);
  }, [state.open, state.history, key]);

  useLayoutEffect(() => {
    const b = bodyRef.current;
    if (!state.open || state.history || !b) return;
    const end = contentEnd(b);
    const count = b.querySelectorAll(".msg").length;
    if (glideTo.current) {
      glideTo.current = null;
      const asked = [...b.querySelectorAll<HTMLElement>(".msg.user, .msg-fix")].pop();
      if (asked) {
        space(0);
        const top = asked.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop - 12;
        space(top + b.clientHeight - b.scrollHeight);
        b.scrollTo({ top, behavior: motion() });
      }
      setUnseen(false);
    } else if (end !== lastEnd.current || count !== lastCount.current) {
      // the room under a question shrinks as the answer fills it (and grows back if it shrinks), so nothing moves
      space((parseFloat(spaceRef.current?.style.height ?? "") || 0) - (end - lastEnd.current));
      if (outOfSight(b)) setUnseen(true);
    }
    lastEnd.current = end;
    lastCount.current = count;
  });

  const onScroll = () => {
    const b = bodyRef.current;
    if (b && unseen && !outOfSight(b)) setUnseen(false);
  };
  /** Down to the start of the newest message. */
  const toLatest = () => {
    const b = bodyRef.current;
    const top = b && newestTop(b);
    if (b && top !== null) b.scrollTo({ top: b.scrollTop + top - 12, behavior: motion() });
  };

  // with the drawer open, a dialog behind it moves aside (wide screens) and Escape closes the drawer first
  useEffect(() => {
    document.body.classList.toggle("ask-open", state.open);
    if (!state.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      set({ open: false });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [state.open]);

  if (!state.open) return null;

  async function answer(c: Chat) {
    setFailure(null);
    if (!sample) {
      setFailure({ text: "Asking Claude works when this page is open on claude.ai. You can copy the question with your progress and paste it into a Claude chat." });
      return;
    }
    const messages = toMessages(c);
    if (!messages.length || messages[messages.length - 1].role !== "user") return;
    setBusyChat(c.id);
    setStreaming("");
    ctl.current = new AbortController();
    try {
      const res = await sample(messages, {
        cache: false,
        signal: ctl.current.signal,
        onText: ({ text }: { text: string }) => setStreaming(text),
        // the coach's model, as chosen in Settings
        ...coachOpts(),
      });
      const { body, practice } = splitPractice(res.text);
      const latest = getChat(c.id) ?? c;
      saveChat({
        ...latest,
        turns: [...latest.turns, { role: "assistant", content: body || res.text, practice, tier: (res as { modelTierApplied?: string }).modelTierApplied, at: Date.now() }],
        updatedAt: Date.now(),
      });
    } catch (e) {
      const err = (e ?? {}) as { code?: string; text?: string; message?: string };
      if (err.code === "cancelled" && !err.text) return;
      const kept = err.text ? splitPractice(err.text).body : "";
      if (kept) {
        // part of an answer arrived before the failure: keep it in the conversation
        const latest = getChat(c.id) ?? c;
        saveChat({ ...latest, turns: [...latest.turns, { role: "assistant", content: `${kept}\n\n*(The answer was cut off.)*`, at: Date.now() }], updatedAt: Date.now() });
      } else {
        setFailure({ text: sampleErrorText(err.code) || "Stopped.", detail: `${err.code ?? "no code"}${err.message ? `: ${err.message}` : ""}` });
      }
    } finally {
      setBusyChat(null);
      setStreaming("");
      ctl.current = null;
    }
  }

  /** Asks Claude to put right what the grammar check found in its last answer. */
  async function fix(found: Finding[]) {
    if (!chat || busy) return;
    const now = Date.now();
    const next: Chat = { ...chat, turns: [...chat.turns, { role: "user", content: fixRequest(found), at: now, kind: "fix" }], updatedAt: now };
    glideTo.current = next.id;
    saveChat(next);
    await answer(next);
  }

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const now = Date.now();
    const base: Chat = chat ?? { id: newChatId(), title: q.slice(0, 80), context: state.context, turns: [], createdAt: now, updatedAt: now };
    // what is on screen goes with the question (unless sharing is off); earlier questions keep only its name
    const screen = shared ? currentScreen() : null;
    const earlier = base.turns.map((t) => (t.screen?.detail ? { ...t, screen: { label: t.screen.label } } : t));
    const asked: ChatTurn = { role: "user", content: q, at: now, ...(screen ? { screen } : shared ? {} : { noScreen: true }) };
    const next: Chat = { ...base, ...(chat ? {} : { share: state.share ?? undefined }), turns: [...earlier, asked], updatedAt: now };
    // the question is saved before Claude answers, so a reload or another device never loses it
    glideTo.current = next.id;
    saveChat(next);
    keepDraft(key, "");
    setInputState("");
    setSuggested("");
    shownKey.current = next.id;
    set({ chatId: next.id });
    await answer(next);
  }

  async function copyPrompt() {
    const q = input.trim() || chat?.turns.filter((t) => t.role === "user").at(-1)?.content || "Explain where I am and what to practise next.";
    const text = fullPrompt(q, shared ? currentScreen() : null, chat?.context ?? state.context);
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied. Paste it into a Claude chat.");
    } catch {
      toast("Copying is blocked here. Select the text in the box and copy it.");
      setInputState(text);
    }
  }

  // closing keeps a running answer going: it is saved when it arrives
  const close = () => set({ open: false });
  const startNew = () => {
    set({ chatId: null, context: null, history: false, share: null });
  };

  const turns = chat?.turns ?? [];
  const last = turns[turns.length - 1];
  const thisBusy = busyChat !== null && busyChat === chat?.id;
  // a question with no answer: one still on its way on another device, or one whose answer was lost
  const unanswered = !thisBusy && !failure && last?.role === "user";
  const fresh = unanswered && Date.now() - last.at < 3 * 60_000;

  return (
    <>
      <div class="scrim" onClick={close} />
      <aside class="drawer" role="dialog" aria-label="Ask Claude">
        <div class="drawer-head">
          <span style={{ color: "var(--gold)", width: "22px", display: "inline-flex" }}><Icon.quill /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontFamily: "var(--f-display)", letterSpacing: "0.06em" }}>Ask Claude</h3>
            {(state.history || !seeing) && (
              <div class="small muted ui drawer-sub">{state.history ? "Your conversations, on every device" : "Knows your lessons, words and weak spots"}</div>
            )}
          </div>
          <button class="btn ghost small" aria-pressed={state.history} onClick={() => set({ history: !state.history })} title="Saved conversations">
            <Icon.scroll /> <span class="wide-only">Conversations</span>
          </button>
          <button class="btn ghost small" onClick={startNew} title="New conversation" aria-label="New conversation">
            <Icon.quill /> <span class="wide-only">New</span>
          </button>
          <button class="btn ghost small" onClick={close} aria-label="Close"><Icon.close /></button>
        </div>

        {/* (null, not "", when hidden: an empty text node here would make Preact rebuild the input box below) */}
        {!state.history && seeing ? (
          <button
            class={`drawer-sees small ui${shared ? "" : " off"}`}
            aria-pressed={shared}
            onClick={toggleShare}
            title={shared ? "Each question goes with what is on your screen, so “here” and “this” point at it. Click to stop sharing it." : "Click to let Claude see what is on your screen. It knows your lessons and progress either way."}
          >
            {shared ? <Icon.eye /> : <Icon.eyeOff />}
            <span>
              {shared ? (
                <>
                  Claude sees: <strong>{seeing}</strong>
                </>
              ) : (
                <>
                  Claude doesn't see your screen <span class="muted">· tap to share it</span>
                </>
              )}
            </span>
          </button>
        ) : null}

        {state.history ? (
          <div class="drawer-body">
            {chats.length === 0 && <p class="muted ui small">No conversations yet. They are saved here as you ask, and appear on your phone and computer alike.</p>}
            {chats.map((c) => (
              <div key={c.id} class={`chat-row${c.id === state.chatId ? " current" : ""}`}>
                <button class="chat-open" onClick={() => set({ chatId: c.id, history: false })}>
                  <span class="chat-title">{c.title}</span>
                  <span class="small muted ui">
                    {when(c.updatedAt)} · {c.turns.filter((t) => t.role === "user").length} question{c.turns.filter((t) => t.role === "user").length === 1 ? "" : "s"}
                    {c.context ? ` · ${c.context.label}` : ""}
                  </span>
                </button>
                {confirmDelete === c.id ? (
                  <span class="row" style={{ gap: "6px" }}>
                    <button class="btn small" onClick={() => { deleteChat(c.id); setConfirmDelete(null); if (state.chatId === c.id) set({ chatId: null }); }}>Delete</button>
                    <button class="linkish" onClick={() => setConfirmDelete(null)}>Keep</button>
                  </span>
                ) : (
                  <button class="btn ghost small" onClick={() => setConfirmDelete(c.id)} aria-label={`Delete "${c.title}"`} title="Delete"><Icon.close /></button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div class="drawer-scroll">
          <div class="drawer-body" ref={bodyRef} onScroll={onScroll}>
            {turns.length === 0 && !thisBusy && (
              <div class="stack small">
                <div class="row" style={{ gap: "6px" }}>
                  {quickQuestions(wordInView(), !!(chat?.context ?? state.context)).map((q) => (
                    <button
                      key={q}
                      class="btn ghost small"
                      disabled={busy}
                      onClick={() => {
                        // added to what is already written, never in its place
                        const text = withQuestion(input, q);
                        setInput(text);
                        setSuggested(text === q ? q : "");
                        const el = inputRef.current;
                        el?.focus();
                        setTimeout(() => el?.setSelectionRange(el.value.length, el.value.length), 0);
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {turns.map((t, i) =>
              t.kind === "fix" ? (
                <div key={i} class="msg-fix ui small muted" role="note">
                  <Icon.repeat /> Asked Claude to correct the answer
                </div>
              ) : (
              <div key={i} class={`msg ${t.role}`}>
                {t.role === "assistant" ? <Markup text={t.content} /> : <span class="msg-text">{t.content}</span>}
                {t.role === "assistant" && (
                  <GrammarCheck text={t.content} canFix={i === turns.length - 1 && !busy} onFix={(found) => void fix(found)} />
                )}
                {t.role === "assistant" && <AddFromAnswer question={turns[i - 1]?.role === "user" ? turns[i - 1].content : ""} answer={t.content} />}
                {t.role === "assistant" && <PutInMessage question={turns[i - 1]?.role === "user" ? turns[i - 1].content : ""} answer={t.content} onDone={close} />}
                {t.role === "assistant" && t.tier && <div class="msg-meta">{tierName(t.tier)}</div>}
                {t.role === "user" && t.screen && <div class="msg-meta" title="What was on your screen when you asked">on {t.screen.label}</div>}
                {t.role === "user" && t.noScreen && <div class="msg-meta" title="Asked with screen sharing switched off">screen not shared</div>}
                {t.practice && t.practice.length > 0 && (
                  <div class="row" style={{ marginTop: "10px" }}>
                    <button
                      class="btn gold small"
                      onClick={() => {
                        close();
                        practiceHandler?.(t.practice!);
                      }}
                    >
                      <Icon.stylus /> Practice: {t.practice.map((s) => SKILL_BY_ID.get(s)?.title).join(", ")}
                    </button>
                  </div>
                )}
              </div>
            ))}
            {thisBusy && (
              <div class="msg assistant">
                {streaming ? <Markup text={streaming} /> : <span class="thinking" role="status" aria-label="Thinking"><i /><i /><i /></span>}
              </div>
            )}
            {unanswered && (
              <div class="msg assistant">
                {fresh ? (
                  <span class="muted ui small">Waiting for the answer…</span>
                ) : (
                  <div class="stack" style={{ gap: "6px" }}>
                    <span class="muted ui small">No answer was saved for this question.</span>
                    <div>
                      <button class="btn ghost small" disabled={busy} onClick={() => chat && void answer(chat)}>Ask again</button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {failure && chat && (
              <div class="msg assistant">
                <p>{failure.text}</p>
                <div class="stack" style={{ gap: "6px", marginTop: "8px" }}>
                  <div class="row" style={{ gap: "8px" }}>
                    {failure.detail && (
                      <button class="btn ghost small" disabled={busy} onClick={() => void answer(chat)}>
                        Try again
                      </button>
                    )}
                    <button class="linkish" onClick={copyPrompt}>Copy the question for a Claude chat</button>
                  </div>
                  {failure.detail && <span class="small muted ui">Details: {failure.detail}</span>}
                </div>
              </div>
            )}
            <div ref={spaceRef} class="chat-space" aria-hidden="true" />
          </div>
          {unseen ? (
            <button class="to-latest" onClick={toLatest} aria-label="New message: go down to it">
              <Icon.arrow />
              New message
            </button>
          ) : null}
          </div>
        )}

        {!state.history && (
          <div class="drawer-foot">
            <form
              class="ask-input"
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
            >
              <textarea
                id="ask-input"
                ref={inputRef}
                rows={2}
                value={input}
                placeholder="Why… / How… / What does…"
                {...NO_CORRECTION}
                onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
                enterkeyhint={enterSends() ? "send" : "enter"}
                onKeyDown={(e) => {
                  // on a phone Enter is a new line and Ask sends
                  if (e.key === "Enter" && !e.shiftKey && enterSends()) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
              />
              {thisBusy ? (
                <button type="button" class="btn ghost" onClick={() => ctl.current?.abort()}>Stop</button>
              ) : (
                <button type="submit" class="btn" disabled={!input.trim() || busy}>Ask</button>
              )}
            </form>
            {suggested && input === suggested && !busy && (
              <span class="small muted ui">A suggested question: change it or press Ask.</span>
            )}
            {sample === null && (
              <div class="row small">
                <span class="muted ui">Claude answers here when this page is open on claude.ai.</span>
                <button class="linkish" onClick={copyPrompt}>Copy question with my progress</button>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}

/**
 * The grammar engine's reading of an answer: what it finds wrong (an adjective
 * that does not match its noun, a verb that does not match its subject…), with
 * the right forms, and a button that asks Claude to correct the answer.
 */
export function GrammarCheck({ text, canFix, onFix }: { text: string; canFix: boolean; onFix: (found: Finding[]) => void }) {
  const found = useMemo(() => checkAnswer(text, derived().lexicon), [text]);
  if (!found.length) return null;
  // a long mark alone is worth a note, not a new answer
  const serious = found.some((f) => f.kind !== "spelling");
  return (
    <div class={`grammar-note${serious ? "" : " minor"}`} role="note">
      <span class="eyebrow">Grammar check</span>
      {found.map((f, i) => (
        <p key={i}>
          <Inline text={f.message} />
        </p>
      ))}
      {canFix && serious && (
        <button class="btn small" onClick={() => onFix(found)}>
          <Icon.repeat /> Fix this answer
        </button>
      )}
    </div>
  );
}

/**
 * Under an answer: the words it brings that the learner does not have yet,
 * one tap from their dictionary. A word card offers its own word; any other
 * answer the words it marks as new (the Latin for "how do I say…").
 */
/**
 * Over a chat in the messenger: the answer's Latin, one tap into the message
 * being written there (the learner asks "how do I say…" and then types it).
 */
function PutInMessage({ question, answer, onDone }: { question: string; answer: string; onDone: () => void }) {
  const route = useRoute();
  const chat = route.page === "messenger" ? route.thread : undefined;
  const latin = latinToSend(answer);
  // for a question about saying or writing something, or an answer with its Latin in bold
  const asked = /\b(say|write|tell|reply|answer|respond)\b|in latin|скаж|напис|відпов|ответ/i.test(question) || /\*\*[^*]*«/.test(answer);
  if (!chat || chat === "acta" || chat === "sibylla" || !latin || !asked) return null;
  return (
    <button
      class="btn small put-in-message"
      onClick={() => {
        window.dispatchEvent(new CustomEvent("tabula:compose", { detail: { chat, text: latin } }));
        onDone();
      }}
      title="Put it in the message you are writing"
    >
      <Icon.letter /> Put «{latin.length > 40 ? `${latin.slice(0, 38)}…` : latin}» in my message
    </button>
  );
}

function AddFromAnswer({ question, answer }: { question: string; answer: string }) {
  useProgress();
  if (bareWord(question)) {
    const word = cardWord(answer) ?? question.trim().replace(/[?!.]$/, "").split(/\s*,/)[0];
    if (!word || knownWord(word)) return null;
    return (
      <button class="btn small add-from-answer" onClick={() => openAddWord(word, "ask")}>
        <Icon.plus /> Add «{word}» to my words
      </button>
    );
  }
  const fresh = newWordsIn(answer).filter((w) => !knownWord(w)).slice(0, 3);
  if (!fresh.length) return null;
  return (
    <div class="new-words" role="note">
      <span class="small muted">New words here:</span>
      {fresh.map((w) => (
        <button key={w} class="chip new-word" lang="la" onClick={() => openAddWord(w, "ask")} title={`Add «${w}» to your words`}>
          <Icon.plus /> {w}
        </button>
      ))}
    </div>
  );
}

/** Smooth scrolling, unless the device asks for less motion. */
function motion(): ScrollBehavior {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
