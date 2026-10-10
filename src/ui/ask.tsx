// Ask Claude: a chat drawer that always knows where the learner is (lessons,
// skills with mastery, known words, recent mistakes, the current exercise).
import { useEffect, useRef, useState } from "preact/hooks";
import { LESSONS } from "../content/lessons";
import { dictionaryForm } from "../latin/morph";
import { SKILL_BY_ID, SKILLS } from "../latin/skills";
import { Exercise, Result } from "../trainer/exercises";
import { mastery } from "../trainer/progress";
import { Icon, toast } from "./components";
import { Markup } from "./markup";
import { SampleFn, sampleErrorText, sampler } from "./platform";
import { derived, getProgress } from "./store";

export interface AskContext {
  /** Short label shown in the drawer: "Exercise: Translate into Latin". */
  label: string;
  /** Everything Claude should know about the current screen. */
  detail: string;
}

interface Turn {
  role: "user" | "assistant";
  content: string;
  practice?: string[];
  error?: boolean;
  /** For a failed answer: the error code and message, to report if it keeps happening. */
  detail?: string;
}

interface AskState {
  open: boolean;
  context: AskContext | null;
  turns: Turn[];
  /** A suggested question: put in the box for the learner to change or send. Never sent by itself. */
  draft?: string;
}

let state: AskState = { open: false, context: null, turns: [] };
const listeners = new Set<() => void>();
const set = (s: Partial<AskState>) => {
  state = { ...state, ...s };
  listeners.forEach((l) => l());
};

let practiceHandler: ((skills: string[]) => void) | null = null;
export function onPractice(fn: (skills: string[]) => void) {
  practiceHandler = fn;
}

/** Opens the drawer about the current screen, with a suggested question in the box (the learner sends it). */
export function openAsk(context: AskContext | null, suggestion?: string) {
  const sameContext = state.context?.detail === context?.detail;
  set({ open: true, context: context ?? state.context, turns: sameContext ? state.turns : [], draft: suggestion ?? "" });
}

// ------------------------------------------------------------- prompts

const INSTRUCTIONS = `You are a friendly Latin tutor inside "Tabula Latina", a practice site that follows the YouTube course "Easy Latin Lessons" (classical pronunciation; long vowels marked with macrons).

The learner speaks English, Russian and Ukrainian natively. Explain in English. When it really helps, compare with Russian or Ukrainian grammar (cases, word order); they know both well.

How to answer:
- Be concise: usually 60-160 words, short paragraphs or a short list, no preamble.
- Stay inside what the learner knows (lessons, words and skills below). If you must use a word or form they have not learned, mark it "(new)" and keep it to a minimum.
- Write every Latin word, form or sentence inside «guillemets», for example «puellam». For a form that could be read two ways, add #case.number inside the guillemets: «puellae#gen.sg», «discipulī#nom.pl». The page colors the endings.
- Use **bold** for the key point. Do not use tables.
- If the question is about a mistake, say exactly which ending was wrong, why, and the rule that decides it.
- If a short drill would help, end with one final line exactly like: PRACTICE: skill-id, skill-id (1-3 ids from the skill list below). Otherwise leave that line out.`;

function profile(): string {
  const p = getProgress();
  const d = derived();
  const lessons = LESSONS.filter((l) => p.lessonsDone.includes(l.n)).map((l) => `Lesson ${l.n}: ${l.title}`);
  const skills = SKILLS.filter((s) => d.knowledge.skills.has(s.id)).map((s) => {
    const st = p.skills[s.id];
    return `- ${s.id}: ${s.title}, mastery ${Math.round(mastery(st) * 100)}% after ${st?.seen ?? 0} tries`;
  });
  const words = d.words.map((w) => `${dictionaryForm(w)} = ${w.en}`).join("; ");
  const mistakes = p.mistakes.slice(0, 8).map((m) => `- "${m.prompt}" | wrote: ${m.answer} | expected: ${m.expected}${m.notes.length ? ` | ${m.notes.join(" ")}` : ""}`);
  return [
    `Lessons finished: ${lessons.join("; ")}. The learner remembers the words of these lessons but has forgotten most of the rules, so practice restarted step by step from Lesson 1. Current step: Lesson ${p.focusLesson} (exercises use only the rules up to Lesson ${p.focusLesson}). Explain with the rules up to the current step unless the learner asks about later ones, and remind them of a rule plainly rather than assuming they remember it.`,
    `Skills learned (ids for PRACTICE):\n${skills.join("\n")}`,
    `Words known: ${words}`,
    mistakes.length ? `Recent mistakes:\n${mistakes.join("\n")}` : "No recent mistakes recorded.",
  ].join("\n\n");
}

export function fullPrompt(question: string, context: AskContext | null): string {
  return `${INSTRUCTIONS}\n\n${profile()}\n\nCurrent screen: ${context ? `${context.label}. ${context.detail}` : "browsing the site."}\n\nLearner's question: ${question}`;
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

export function AskDrawer() {
  const [, setTick] = useState(0);
  const [input, setInput] = useState("");
  const [suggested, setSuggested] = useState("");
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState<SampleFn | null | undefined>(undefined);
  const ctl = useRef<AbortController | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);

  useEffect(() => {
    // (a function given to a state setter is called as an updater, so wrap it)
    if (state.open && sample === undefined) void sampler().then((fn) => setSample(() => fn));
  }, [state.open, sample]);

  // a suggested question goes into the box, ready to edit or send
  useEffect(() => {
    if (!state.open || state.draft === undefined) return;
    const draft = state.draft;
    set({ draft: undefined });
    if (draft) {
      setInput(draft);
      setSuggested(draft);
    }
    setTimeout(() => {
      const el = inputRef.current;
      el?.focus();
      el?.setSelectionRange(el.value.length, el.value.length);
    }, 30);
  });

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  });

  if (!state.open) return null;

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setSuggested("");
    // earlier turns as context: never a failed or empty one (an empty turn is refused)
    const prior = state.turns.filter((t) => !t.error && t.content.trim());
    const turns: Turn[] = [...state.turns, { role: "user", content: q }];
    set({ turns: [...turns, { role: "assistant", content: "" }] });
    if (!sample) {
      set({ turns: [...turns, { role: "assistant", content: "Asking Claude works when this page is open on claude.ai. You can copy the question with your progress and paste it into a Claude chat.", error: true }] });
      return;
    }
    setBusy(true);
    ctl.current = new AbortController();
    // keep the last few turns; the first kept turn must be the learner's, and it carries the instructions
    let hist = prior.map((t) => ({ role: t.role, content: t.content }));
    while (hist.length > 8) hist = hist.slice(2);
    if (hist.length && hist[0].role !== "user") hist = hist.slice(1);
    // a first question goes as one prompt; a follow-up as the conversation so far
    const ask = hist.length
      ? [{ role: "user" as const, content: fullPrompt(hist[0].content, state.context) }, ...hist.slice(1), { role: "user" as const, content: q }]
      : fullPrompt(q, state.context);
    try {
      const { text } = await sample(ask, {
        cache: false,
        signal: ctl.current.signal,
        onText: ({ text }: { text: string }) => set({ turns: [...turns, { role: "assistant", content: text }] }),
      });
      const { body, practice } = splitPractice(text);
      set({ turns: [...turns, { role: "assistant", content: body, practice }] });
    } catch (e) {
      const err = (e ?? {}) as { code?: string; text?: string; message?: string };
      const msg = sampleErrorText(err.code);
      const kept = err.text ? splitPractice(err.text).body : "";
      const detail = err.code === "cancelled" ? undefined : `${err.code ?? "no code"}${err.message ? `: ${err.message}` : ""}`;
      set({ turns: [...turns, { role: "assistant", content: [kept, msg].filter(Boolean).join("\n\n") || "Stopped.", error: !kept, detail }] });
    } finally {
      setBusy(false);
      ctl.current = null;
    }
  }

  async function copyPrompt() {
    const q = input.trim() || state.turns.filter((t) => t.role === "user").at(-1)?.content || "Explain where I am and what to practise next.";
    const text = fullPrompt(q, state.context);
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied. Paste it into a Claude chat.");
    } catch {
      toast("Copying is blocked here. Select the text in the box and copy it.");
      setInput(text);
    }
  }

  const close = () => {
    ctl.current?.abort();
    set({ open: false });
  };

  return (
    <>
      <div class="scrim" onClick={close} />
      <aside class="drawer" role="dialog" aria-label="Ask Claude">
        <div class="drawer-head">
          <span style={{ color: "var(--gold)", width: "22px", display: "inline-flex" }}><Icon.quill /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontFamily: "var(--f-display)", letterSpacing: "0.06em" }}>Ask Claude</h3>
            <div class="small muted ui" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {state.context ? state.context.label : "Knows your lessons, words and weak spots"}
            </div>
          </div>
          <button class="btn ghost small" onClick={close} aria-label="Close"><Icon.close /></button>
        </div>
        <div class="drawer-body" ref={bodyRef}>
          {state.turns.length === 0 && (
            <div class="stack small">
              <p class="muted ui">Ask anything about the rule, the word or your answer. Claude sees what you have learned, your weak spots and the exercise on screen.</p>
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
          {state.turns.map((t, i) => (
            <div key={i} class={`msg ${t.role}`}>
              {t.role === "assistant" ? (
                t.content ? <Markup text={t.content} /> : <span class="muted ui">Thinking…</span>
              ) : (
                t.content
              )}
              {t.error && t.detail && (
                <div class="stack" style={{ gap: "6px", marginTop: "8px" }}>
                  <div class="row" style={{ gap: "8px" }}>
                    {i === state.turns.length - 1 && i > 0 && state.turns[i - 1].role === "user" && (
                      <button
                        class="btn ghost small"
                        disabled={busy}
                        onClick={() => {
                          const q = state.turns[i - 1].content;
                          set({ turns: state.turns.slice(0, i - 1) });
                          void send(q);
                        }}
                      >
                        Try again
                      </button>
                    )}
                    <button class="linkish" onClick={copyPrompt}>Copy the question for a Claude chat</button>
                  </div>
                  <span class="small muted ui">Details: {t.detail}</span>
                </div>
              )}
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
        </div>
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
            {busy ? (
              <button type="button" class="btn ghost" onClick={() => ctl.current?.abort()}>Stop</button>
            ) : (
              <button type="submit" class="btn" disabled={!input.trim()}>Ask</button>
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
      </aside>
    </>
  );
}
