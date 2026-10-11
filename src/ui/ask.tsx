// Ask Claude: a chat drawer that always knows where the learner is (lessons,
// skills with mastery, known words, recent mistakes) and what is on screen
// when a question is asked (see screen.ts), so "here" and "this" make sense.
// Conversations are saved (see chats.ts) and can be continued on any device;
// what is typed in the box survives a reload.
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { LESSONS } from "../content/lessons";
import { dictionaryForm } from "../latin/morph";
import { SKILL_BY_ID, SKILLS } from "../latin/skills";
import { Exercise, Result } from "../trainer/exercises";
import { mastery } from "../trainer/progress";
import { Chat, ChatTurn, deleteChat, getChat, getChats, newChatId, saveChat, useChats } from "./chats";
import { Icon, toast } from "./components";
import { Markup } from "./markup";
import { SampleFn, sampleErrorText, sampler, storage } from "./platform";
import { currentScreen, Screen, sharedByDefault, useScreenLabel } from "./screen";
import { derived, getProgress } from "./store";

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
- Short and structured by default, about 40-90 words: the answer itself in one **bold** line first, then 2-4 short bullets (the rule, why it applies here, one example as «Latin» = English). No greeting, no preamble, no closing summary, no offers of more help.
- A yes/no or one-word question gets one or two lines.
- Give a longer, more open answer only when the learner asks for one ("tell me more", "explain in detail", "tell me about…") or wants to chat generally (history, culture, how a word came into English). Keep even that in short paragraphs or bullets, under about 250 words.
- Stay inside what the learner knows (lessons, words and skills below). If you must use a word or form they have not learned, mark it "(new)" and keep it to a minimum.
- Write every Latin word, form or sentence inside «guillemets», for example «puellam». For a form that could be read two ways, add #case.number inside the guillemets: «puellae#gen.sg», «discipulī#nom.pl». The page colors the endings. Use «» for Latin only: quote English, Russian and Ukrainian words with "double quotes".
- Use **bold** only for the key point. No tables and no headings.
- If the question is about a mistake, the bold line names the wrong ending and the right one; the bullets give the rule that decides it.
- Be exact. The rules under "Skills learned" are this site's rules and they are correct: follow them. Check every Latin form before you write it. Never invent a grammar rule or pattern, and give only memory tricks that are true (an English relative, a real pattern). When there is no reliable way to tell (which infinitive a verb has, for example), say so plainly and suggest learning the pair («discō, discere»).
- Easy to get wrong: an adjective agrees with its noun in gender, case and number, not in the look of the ending. «agricola» and «poēta» are masculine, so «agricola timidus», «poēta pulcher», «agricolam timidum».
- If the learner says they are just curious, or asks about something other than the exercise, answer that alone and do not lead back to the exercise.
- If a short drill would help, end with one final line exactly like: PRACTICE: skill-id, skill-id (1-3 ids from the skill list below). Otherwise leave that line out.

Where the learner is: each question starts with a note in [square brackets] describing what was on their screen when they asked: the page or exercise, an open dialog, the part of a long page in view, and the last line or word they tapped. "Here", "this", "this sentence", "this word" or "this exercise" mean what the newest note describes; earlier questions may have been asked elsewhere. Use the note quietly: do not repeat it back. When the exercise on screen has not been answered yet, help with the rule and hints, and do not give the answer away unless the learner asks for it.

On the page, endings are colored by case: nominative blue, accusative red, genitive purple, ablative amber, dative green, vocative pink; verb endings teal. A plural is underlined.`;

function profile(): string {
  const p = getProgress();
  const d = derived();
  const lessons = LESSONS.filter((l) => p.lessonsDone.includes(l.n)).map((l) => `Lesson ${l.n}: ${l.title}`);
  const skills = SKILLS.filter((s) => d.knowledge.skills.has(s.id)).map((s) => {
    const st = p.skills[s.id];
    return `- ${s.id}: ${s.title}. ${s.hint} (mastery ${Math.round(mastery(st) * 100)}% after ${st?.seen ?? 0} tries)`;
  });
  const words = d.words.map((w) => `${dictionaryForm(w)} = ${w.en}`).join("; ");
  const mistakes = p.mistakes.slice(0, 8).map((m) => `- "${m.prompt}" | wrote: ${m.answer} | expected: ${m.expected}${m.notes.length ? ` | ${m.notes.join(" ")}` : ""}`);
  return [
    `Lessons finished: ${lessons.join("; ")}. The learner remembers the words of these lessons but has forgotten most of the rules, so practice restarted step by step from Lesson 1. Current step: Lesson ${p.focusLesson} (exercises use only the rules up to Lesson ${p.focusLesson}). Explain with the rules up to the current step unless the learner asks about later ones, and remind them of a rule plainly rather than assuming they remember it.`,
    `Skills learned, with the rule as this site teaches it (ids for PRACTICE):\n${skills.join("\n")}`,
    `Words known: ${words}`,
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

Decide whether the learner's answer is a correct answer. Accept any Latin word order, missing long marks, and natural English variants (articles, progressive tense, synonyms). Reject wrong endings, wrong person or number, and missing or extra meaning.
Reply with only JSON: {"correct": true or false, "explanation": "one or two sentences; put Latin inside «guillemets»"}`;
  try {
    const out = await sample.json<Judgement>(prompt, { modelTier: "default" });
    if (typeof out?.correct !== "boolean") return { error: "Claude's reply could not be read. Try again." };
    return { correct: out.correct, explanation: String(out.explanation ?? "") };
  } catch (e) {
    const code = (e as { code?: string }).code;
    return { error: sampleErrorText(code) || "Stopped." };
  }
}

// ------------------------------------------------------------- drawer

const QUICK = ["Why is this the right ending?", "Explain this rule simply", "Give me a memory trick", "Compare it with Russian or Ukrainian"];

const TIER_NAME: Record<string, string> = { quick: "quick model", default: "balanced model", complex: "most capable model" };

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
  msgs[0] = { role: "user", content: [INSTRUCTIONS, profile(), general ? "" : openedFrom(chat.context, !!hist[0].screen), msgs[0].content].filter(Boolean).join("\n\n") };
  return msgs;
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
        setInputState(draft);
        keepDraft(key, draft);
        setSuggested(draft);
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
      const asked = [...b.querySelectorAll<HTMLElement>(".msg.user")].pop();
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
                  {QUICK.map((q) => (
                    <button
                      key={q}
                      class="btn ghost small"
                      disabled={busy}
                      onClick={() => {
                        setInput(q);
                        setSuggested(q);
                        inputRef.current?.focus();
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} class={`msg ${t.role}`}>
                {t.role === "assistant" ? <Markup text={t.content} /> : <span class="msg-text">{t.content}</span>}
                {t.role === "assistant" && t.tier && <div class="msg-meta">{TIER_NAME[t.tier] ?? t.tier}</div>}
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
                onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
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

/** Smooth scrolling, unless the device asks for less motion. */
function motion(): ScrollBehavior {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/** The last conversations, for anything else that wants them. */
export const recentChats = () => getChats().slice(0, 5);
