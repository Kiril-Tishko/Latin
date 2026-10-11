// The trainer: one exercise at a time, written answers on a wax tablet,
// detailed feedback with colored endings, and Claude on hand for "why?".
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { LESSON_BY_N } from "../../content/lessons";
import { STORY_ONLY } from "../../content/words";
import { Knowledge, latinText, seeded } from "../../latin/generate";
import { SKILL_BY_ID } from "../../latin/skills";
import { roman } from "../../latin/text";
import { Exercise, ExerciseKind, KIND_LABEL, plainText, Result } from "../../trainer/exercises";
import { buildKnowledge } from "../../trainer/knowledge";
import { dayKey, mastery } from "../../trainer/progress";
import { applyResult, buildSession, mistakesSession, mistakesToFix, nextExercise, placementSession, readiness, SessionOpts } from "../../trainer/session";
import { videoSession } from "../../trainer/video";
import { openAsk, judge } from "../ask";
import { CaseChip, Icon, Laurel, Mosaic, toast } from "../components";
import { LatinTokens } from "../latin";
import { Inline, Markup } from "../markup";
import { go } from "../nav";
import { lessonOfSkill, RuleBox, RuleIntro, rulesFor } from "../rulecard";
import { fitToWindow } from "../fit";
import { derived, getProgress, update, useProgress } from "../store";
import { speak, stopSpeaking } from "../../audio/speech";
import { audioReady, Speak } from "../speak";
import { useScreen } from "../screen";

export type Mode =
  | { kind: "step" }
  | { kind: "mixed" }
  | { kind: "lesson"; n: number }
  | { kind: "skills"; skills: string[]; label: string }
  | { kind: "placement" }
  | { kind: "writing" }
  | { kind: "endings" }
  | { kind: "words" }
  | { kind: "listening" }
  | { kind: "english" }
  | { kind: "video"; n?: number }
  | { kind: "mistakes" };

interface Attempt {
  ex: Exercise;
  answer: string;
  res: Result;
}

interface Session {
  mode: Mode;
  items: Exercise[];
  index: number;
  attempts: Attempt[];
  size: number;
  /** Highest lesson whose rules the exercises use. */
  level: number;
  /** Show the step's rules before the first exercise. */
  showRules?: boolean;
}

let session: Session | null = null;
const sessionListeners = new Set<() => void>();
const setSession = (s: Session | null) => {
  session = s;
  sessionListeners.forEach((l) => l());
};

const SIZE = 15;

export function modeLabel(m: Mode): string {
  switch (m.kind) {
    case "step":
      return `Step ${roman(getProgress().focusLesson)} · ${LESSON_BY_N.get(getProgress().focusLesson)?.title ?? ""}`;
    case "mixed":
      return "All lessons mixed";
    case "lesson":
      return `Lesson ${roman(m.n)}`;
    case "skills":
      return m.label;
    case "placement":
      return "Check-up";
    case "writing":
      return "Writing Latin";
    case "endings":
      return "Endings drill";
    case "words":
      return "Word recall";
    case "listening":
      return "Listening";
    case "english":
      return "Latin in English";
    case "video":
      return m.n ? `Lesson ${roman(m.n)}: sentences from the video` : "Sentences from the videos";
    case "mistakes":
      return "Fix my mistakes";
  }
}

/**
 * The highest lesson whose rules a mode uses. Practice goes step by step: every
 * word the learner knows, but only the rules up to the current step (or up to
 * the lesson / rule chosen). "All lessons mixed" and the check-up use them all.
 */
function levelOf(mode: Mode): number {
  const p = getProgress();
  const top = Math.max(1, ...p.lessonsDone);
  switch (mode.kind) {
    case "mixed":
    case "placement":
      return top;
    case "lesson":
      return mode.n;
    case "video":
      return mode.n ?? p.focusLesson;
    case "skills":
      return Math.max(p.focusLesson, ...mode.skills.map((id) => lessonOfSkill(id) ?? 1));
    default:
      return p.focusLesson;
  }
}

function knowledgeFor(level: number): Knowledge {
  const p = getProgress();
  const d = derived();
  if (level >= Math.max(...p.lessonsDone)) return d.knowledge;
  if (level === p.focusLesson) return d.stepKnowledge;
  return buildKnowledge(p.lessonsDone, d.added, p.settings.silly, p.lessonsDone.filter((n) => n <= level));
}

function ctx(level: number) {
  return { k: knowledgeFor(level), lex: derived().lexicon, r: seeded(Date.now() % 2147483647), audio: audioReady() };
}

/** Starts a new session (from anywhere in the app). */
export function startSession(mode: Mode) {
  const p = getProgress();
  const level = levelOf(mode);
  const c = ctx(level);
  const vocab = derived().words.filter((w) => w.kind !== "fixed");
  // a step meets a rule in single forms and endings first, whole sentences later
  const stepwise: Partial<SessionOpts> = { adaptive: true, focusLesson: level, kinds: ["en2la", "la2en", "ending", "choose", "form", "transform", "identify", "listen", "tiles", "meaning"] };
  let items: Exercise[];
  switch (mode.kind) {
    case "step":
      items = buildSession(p, c, { size: 12, ...stepwise });
      break;
    case "placement":
      items = placementSession(p, c);
      break;
    case "lesson":
      items = buildSession(p, c, { size: 12, ...stepwise, skills: LESSON_BY_N.get(mode.n)?.skills });
      break;
    case "skills":
      items = buildSession(p, c, { size: 10, ...stepwise, skills: mode.skills, kinds: ["en2la", "ending", "choose", "form", "transform", "la2en", "tiles", "meaning"] });
      break;
    case "writing":
      items = buildSession(p, c, { size: SIZE, kinds: ["en2la", "transform"], focusLesson: level });
      break;
    case "endings":
      items = buildSession(p, c, { size: 20, kinds: ["ending", "choose", "form"], focusLesson: level });
      break;
    case "words":
      items = buildSession(p, c, { size: 20, kinds: ["vocab"], vocab });
      break;
    case "listening":
      items = buildSession(p, c, { size: 12, kinds: ["listen"], focusLesson: level });
      break;
    case "english":
      items = buildSession(p, c, { size: 10, kinds: ["derive"], vocab: derived().words.filter((w) => !STORY_ONLY.has(w.id)) });
      break;
    case "video":
      items = videoSession(p, c, mode.n ? [mode.n] : p.lessonsDone.filter((n) => n <= level));
      break;
    case "mistakes":
      items = mistakesSession(p, c, vocab);
      break;
    default:
      items = buildSession(p, c, { size: SIZE, vocab });
  }
  if (!items.length) {
    toast("Nothing to practise there yet.");
    return;
  }
  const showRules = mode.kind === "step" && p.rulesShown[level] !== dayKey();
  setSession({ mode, items, index: 0, attempts: [], size: items.length, level, showRules });
}

function useSession() {
  const [, setT] = useState(0);
  useEffect(() => {
    const l = () => setT((t) => t + 1);
    sessionListeners.add(l);
    return () => void sessionListeners.delete(l);
  }, []);
  return session;
}

// ------------------------------------------------------------- page

export function Train() {
  const s = useSession();
  useProgress();
  if (!s) return <Chooser />;
  if (s.showRules) {
    const start = () => {
      update((p) => void (p.rulesShown[s.level] = dayKey()));
      setSession({ ...s, showRules: false });
    };
    return <RuleIntro lesson={s.level} k={knowledgeFor(s.level)} onStart={start} />;
  }
  if (s.index >= s.items.length) return <Summary s={s} />;
  return <Runner s={s} key={s.items[s.index].id} />;
}

function Chooser() {
  const p = useProgress();
  const level = p.focusLesson;
  const lesson = LESSON_BY_N.get(level);
  const ready = readiness(p, level);
  const nextLesson = p.lessonsDone.filter((n) => n > level).sort()[0];
  const upTo = level === 1 ? "the rules of Lesson I" : `the rules of Lessons I-${roman(level)}`;
  const toFix = mistakesToFix(p, derived().stepKnowledge).length;
  const modes: { mode: Mode; title: string; text: string }[] = [
    ...(toFix ? [{ mode: { kind: "mistakes" } as Mode, title: `Fix my mistakes (${toFix})`, text: "Your mistakes come back as new exercises on the same rules and words." }] : []),
    { mode: { kind: "video" }, title: "Sentences from the videos", text: `The sentences you heard, up to Lesson ${roman(level)}: choose, build, write.` },
    { mode: { kind: "writing" }, title: "Write Latin", text: `Whole sentences into Latin, with ${upTo}.` },
    { mode: { kind: "endings" }, title: "Endings drill", text: "Quick: choose and fill in endings." },
    { mode: { kind: "words" }, title: "Word recall", text: "Your words, both ways, just before you would forget them." },
    { mode: { kind: "english" }, title: "Latin in English", text: "Find the Latin word inside an English one: dormitory, aquarium…" },
    ...(audioReady() ? [{ mode: { kind: "listening" } as Mode, title: "Listening", text: "Hear a sentence, write it down." }] : []),
    { mode: { kind: "mixed" }, title: "All lessons mixed", text: "Every rule at once. The hardest." },
    ...(!p.placementDone ? [{ mode: { kind: "placement" } as Mode, title: "Check-up (3 min)", text: "Twelve questions across Lessons I-IV." }] : []),
  ];
  useScreen("page", "Practice: choosing", () =>
    [
      `The practice page, choosing what to practise. Current step: Lesson ${level} "${lesson?.title ?? ""}", ${Math.round(ready.value * 100)}% ready for the next step (it opens at 80%).`,
      `On offer: Practise Lesson ${level} step by step; ${modes.map((m) => `${m.title} (${m.text})`).join("; ")}.`,
    ].join("\n"),
  );
  return (
    <div class="stack-lg">
      <section class="panel frame step-panel">
        <div class="stack" style={{ gap: "10px" }}>
          <span class="eyebrow">Step by step · Lesson {roman(level)}</span>
          <h2>{lesson?.title}</h2>
          <p class="muted small">Only {upTo}, with all your words. Easy first; harder as it sticks.</p>
          <div class="row">
            <button class="btn big" onClick={() => startSession({ kind: "step" })}>
              <Icon.play /> Practise Lesson {roman(level)}
            </button>
            <button class="linkish" onClick={() => go({ page: "lesson", n: level })}>Read the lesson</button>
          </div>
        </div>
        <div class="stack step-side" style={{ gap: "8px" }}>
          <div class="seg" role="group" aria-label="Step">
            {p.lessonsDone.map((n) => (
              <button key={n} aria-pressed={n === level} title={LESSON_BY_N.get(n)?.title} onClick={() => update((x) => void (x.focusLesson = n))}>
                Lesson {roman(n)}
                {readiness(p, n).ready ? " ✓" : ""}
              </button>
            ))}
          </div>
          <div class="spread small ui">
            <span>Ready for the next step</span>
            <strong>{Math.round(ready.value * 100)}%</strong>
          </div>
          <div style={{ maxWidth: "360px" }}>
            <Mosaic value={ready.value} tiles={10} label={`${Math.round(ready.value * 100)}% ready`} />
          </div>
          {ready.ready && nextLesson ? (
            <button class="btn gold small" style={{ alignSelf: "flex-start" }} onClick={() => update((x) => void (x.focusLesson = nextLesson))}>
              Lesson {roman(level)} is solid: go to Lesson {roman(nextLesson)} <Icon.arrow />
            </button>
          ) : (
            <span class="small muted">{ready.ready ? "Every lesson you watched is solid." : `The next lesson opens up at 80%.`}</span>
          )}
        </div>
      </section>
      <div class="mode-grid">
        {modes.map((m) => (
          <button key={m.title} class="panel frame mode-card" onClick={() => startSession(m.mode)}>
            <span class="mode-icon"><Icon.play /></span>
            <h3>{m.title}</h3>
            <p class="muted small">{m.text}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

const VERDICT = {
  correct: { la: "Rēctē!", en: "Correct" },
  almost: { la: "Paene!", en: "Almost: small slip" },
  wrong: { la: "Errās…", en: "Not quite" },
};

interface RunnerState {
  answer: string;
  res: Result | null;
  showHints: boolean;
  showRule: boolean;
  showEnglish: boolean;
  judgement: string | null;
}

/** The exercise's Latin as shown, with the gap where a word or ending is asked for. */
function shownLatin(ex: Exercise, answered: boolean): string {
  const words = (ex.latin ?? []).map((t, i) => {
    if (answered || i !== ex.blank) return t.text;
    if (ex.kind === "choose") return "___";
    return `${t.analysis?.form.stem ?? ""}___`;
  });
  const text = words.join(" ");
  return text ? `${text[0].toUpperCase()}${text.slice(1)}.` : "";
}

/** The answer given, as the learner sees it (a choice is shown by its word). */
function givenAnswer(ex: Exercise, answer: string): string {
  if (ex.kind === "choose" || ex.kind === "meaning") return ex.choices?.find((c) => c.id === answer)?.label ?? answer;
  if (ex.kind === "identify") return ex.latin?.[Number(answer)]?.text ?? answer;
  return answer;
}

const stop = (t: string) => (/[.!?…]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);

/** What Claude should know about the exercise on screen, as it stands right now. */
function describeExercise(s: Session, ex: Exercise, st: RunnerState): string {
  const answered = !!st.res;
  const english = ex.english && (ex.kind === "ending" || ex.kind === "transform" || ex.kind === "choose") && !answered
    ? st.showEnglish ? ` Its English, shown: "${ex.english}".` : " Its English is hidden behind a Translate button."
    : "";
  const shown: Record<ExerciseKind, string> = {
    en2la: `the English sentence "${ex.english}", to write in Latin.`,
    la2en: `the Latin sentence "${shownLatin(ex, true)}", to translate into English.`,
    listen: answered ? `the sentence that was read aloud: "${shownLatin(ex, true)}"` : "a Latin sentence read aloud, not shown in writing until the answer is checked.",
    ending: `"${shownLatin(ex, answered)}"${answered ? "" : ", with one ending left out (___)."}${english}`,
    transform: `"${shownLatin(ex, true)}".${english}`,
    choose: `"${shownLatin(ex, answered)}"; options: ${ex.choices?.map((c) => c.label).join(" / ")}.${english}`,
    form: plainText(ex.ask ?? ""),
    identify: `the sentence "${shownLatin(ex, true)}"; the learner taps the word asked for.`,
    vocab: ex.ask ?? "",
    derive: `the English word "${ex.ask}"; the learner names the Latin word it comes from.`,
    tiles: `the English sentence "${ex.english}", to build in Latin from word tiles: ${ex.tiles?.join(" / ")}.`,
    meaning: `the Latin sentence "${shownLatin(ex, true)}", with English meanings to choose from: ${ex.choices?.map((c) => c.label).join(" / ")}.`,
  };
  const lines = [
    `Practising: ${modeLabel(s.mode)} (only the rules up to Lesson ${s.level}). Exercise ${s.index + 1} of ${s.items.length}, "${ex.instruction}".`,
    ex.video ? `A sentence from the video of Lesson ${ex.video}.` : "",
    ex.fixes !== undefined ? "This exercise brings back one of the learner's earlier mistakes." : "",
    `On screen: ${shown[ex.kind]}`,
    `The exercise with its answer: ${plainText(ex.context)}`,
  ];
  if (!st.res) {
    lines.push(`Not answered yet${st.answer.trim() ? `; typed so far: "${givenAnswer(ex, st.answer.trim())}"` : ""}. Do not give the answer away unless the learner asks for it.`);
    if (st.showHints) lines.push(`Hint open: ${ex.hints.filter(Boolean).map(plainText).join("; ")}`);
    if (st.showRule) lines.push(`Rule box open: ${rulesFor(ex.skills, s.level).slice(0, 2).map((r) => r.title).join("; ") || ex.skills.map((id) => SKILL_BY_ID.get(id)?.title).join("; ")}`);
  } else {
    const given = st.answer === "—" ? "skipped it (\"I don't know\")" : `answered "${givenAnswer(ex, st.answer)}"`;
    lines.push(`The learner ${given}. Verdict: ${st.res.verdict}. Correct answer: ${stop(plainText(st.res.expected))}`);
    const notes = st.res.issues.map((i) => plainText(i.message)).filter(Boolean);
    if (notes.length) lines.push(`The checker's notes: ${notes.join(" ")}`);
    if (st.judgement) lines.push(`Claude's earlier check of the answer: ${plainText(st.judgement)}`);
  }
  return lines.filter(Boolean).join("\n");
}

function Runner({ s }: { s: Session }) {
  const ex = s.items[s.index];
  const [answer, setAnswer] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [showHints, setShowHints] = useState(false);
  const [showRule, setShowRule] = useState(false);
  // a rule that is still new is shown with its colors from the start
  const [showColors, setShowColors] = useState(!!ex.easy);
  const [showEnglish, setShowEnglish] = useState(false);
  const [judging, setJudging] = useState(false);
  const [judgement, setJudgement] = useState<string | null>(null);
  // word tiles placed so far (indices into ex.tiles); the answer is their words
  const [picked, setPicked] = useState<number[]>([]);
  const pickTiles = (next: number[]) => {
    setPicked(next);
    setAnswer(next.map((i) => ex.tiles![i]).join(" "));
  };
  const inputRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const sideRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useScreen("page", `Exercise ${s.index + 1} of ${s.items.length}: ${KIND_LABEL[ex.kind]}`, () =>
    describeExercise(s, ex, { answer, res, showHints, showRule, showEnglish, judgement }),
  );

  // the exercise always fits the window: shrink it (never below a readable size) when it would scroll
  useLayoutEffect(() => fitToWindow(panelRef.current, !!res), [ex.id, res, showHints, showRule, showEnglish, judgement, judging]);

  useEffect(() => {
    if (!res) inputRef.current?.focus();
    else {
      nextRef.current?.focus({ preventScroll: true });
      // on narrow screens the result sits below the sentence: bring it into view
      if (window.innerWidth < 980) sideRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [res]);

  // listening exercises play at once; other Latin prompts only when auto-read is on
  useEffect(() => {
    const auto = ex.kind === "listen" || (getProgress().settings.autoplay && (ex.kind === "la2en" || ex.kind === "transform"));
    if (ex.audio && auto && audioReady()) void speak(ex.audio, { id: `prompt-${ex.id}` });
    return () => stopSpeaking();
  }, [ex.id]);

  // 1, 2, 3 pick an option in a choice exercise
  useEffect(() => {
    if (ex.answer !== "choice" || res || !ex.choices) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if ((e.target as HTMLElement).closest?.("input, textarea, select, [contenteditable]")) return;
      if (n >= 1 && n <= ex.choices!.length) {
        setAnswer(String(n - 1));
        check(String(n - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ex.id, res]);

  // tiles: 1-9 place a word, Backspace takes the last one back, Enter checks
  useEffect(() => {
    if (ex.answer !== "tiles" || res || !ex.tiles) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.("input, textarea, select, [contenteditable]")) return;
      const n = Number(e.key);
      if (n >= 1 && n <= ex.tiles!.length && !picked.includes(n - 1)) pickTiles([...picked, n - 1]);
      else if (e.key === "Backspace" && picked.length) {
        e.preventDefault();
        pickTiles(picked.slice(0, -1));
      } else if (e.key === "Enter" && picked.length) {
        e.preventDefault();
        check();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ex.id, res, picked, answer]);

  function check(given = answer) {
    if (res) return;
    if (!given.trim() && ex.answer !== "choice") return;
    setRes(ex.check(given));
  }

  function giveUp() {
    const r = ex.check("—");
    setRes({ ...r, verdict: "wrong", issues: [{ kind: "missing", message: "Skipped. Here is the answer; it will come back later." }] });
  }

  function next() {
    if (!res) return;
    update((p) => {
      applyResult(p, ex, res, answer);
      if (s.mode.kind === "placement" && s.index === s.items.length - 1) p.placementDone = true;
    });
    const attempts = [...s.attempts, { ex, answer, res }];
    let items = s.items;
    // a wrong sentence comes back once more at the end of the round
    if (res.verdict === "wrong" && ex.kind !== "identify" && s.items.length < s.size + 4) {
      const again = ex.retry ? ex.retry() : nextExercise(getProgress(), ctx(s.level), { size: 1, skills: Object.keys(res.credit).filter((k) => res.credit[k] < 0.5), kinds: [ex.kind === "vocab" ? "vocab" : ex.kind], vocab: derived().words.filter((w) => ex.words.includes(w.id)) }, new Set(s.items.map((e) => e.context)));
      if (again && ex.fixes !== undefined) again.fixes = ex.fixes;
      if (again) items = [...items, again];
    }
    setSession({ ...s, items, attempts, index: s.index + 1 });
  }

  async function dispute() {
    if (!res) return;
    setJudging(true);
    const j = await judge(ex, answer, res);
    setJudging(false);
    if ("error" in j) {
      setJudgement(j.error);
      return;
    }
    setJudgement(j.explanation);
    if (j.correct) {
      setRes({ ...res, verdict: "correct", issues: [], credit: Object.fromEntries(Object.keys(res.credit).map((k) => [k, 1])), wordCredit: Object.fromEntries(Object.keys(res.wordCredit).map((k) => [k, true])) });
      toast("Claude agrees: your answer counts as correct.");
    }
  }

  const askWhy = () =>
    openAsk(
      {
        label: `Exercise: ${KIND_LABEL[ex.kind]}`,
        detail: `${ex.instruction}. ${ex.context}. The learner answered: "${answer || "(nothing)"}". Checker verdict: ${res?.verdict ?? "not checked yet"}. ${res?.issues.map((i) => i.message).join(" ") ?? ""}`,
      },
      res && res.verdict !== "correct" ? "Why is my answer wrong, and how do I get it right next time?" : res ? "Why is this the right form here?" : "Which rule do I need here? Give me a hint, not the answer.",
    );

  const progress = s.index / s.items.length;
  const isLatinAnswer = ex.answer === "la";

  return (
    <div class="trainer">
      <div class="trainer-top">
        <span class="eyebrow">{modeLabel(s.mode)}</span>
        {/* the session as a strip of tesserae: gold when right, pale when almost, dark when wrong */}
        <div class="session-mosaic" role="img" aria-label={`${Math.round(progress * 100)}% of the round done`}>
          {s.items.map((item, i) => (
            <i key={item.id} class={s.attempts[i] ? s.attempts[i].res.verdict : i === s.index ? "current" : ""} />
          ))}
        </div>
        <span class="counter" title={`${s.index + 1} of ${s.items.length}`}>
          {roman(s.index + 1)} / {roman(s.items.length)}
        </span>
        <button class="linkish" onClick={() => setSession({ ...s, index: s.items.length })}>End</button>
      </div>

      <div class={`panel frame exercise${res ? " answered" : ""}`} ref={panelRef}>
        <div class="ex-main">
          <span class="eyebrow ex-instruction">
            {ex.instruction}
            {ex.video ? <span class="ex-source"> · from the video of Lesson {roman(ex.video)}</span> : null}
            {ex.fixes !== undefined ? <span class="ex-source"> · an earlier mistake</span> : null}
          </span>
          <div class="prompt">
            <Prompt
              ex={ex}
              showColors={showColors || !!res}
              res={res}
              chosen={answer}
              onChoose={(id) => { setAnswer(id); check(id); }}
              english={showEnglish}
              onEnglish={() => setShowEnglish(true)}
            />
          </div>

          {ex.answer === "tiles" && ex.tiles && <TileBoard tiles={ex.tiles} picked={picked} onPick={pickTiles} done={!!res} />}

          {ex.answer !== "choice" && ex.answer !== "tiles" && (
            <div class={`tablet ${res ? "done" : ""}`}>
              {ex.answer === "ending" ? (
                <input
                  id="answer-input"
                  ref={inputRef}
                  value={answer}
                  disabled={!!res}
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck={false}
                  placeholder="the ending, e.g. am"
                  onInput={(e) => setAnswer((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), res ? next() : check())}
                />
              ) : (
                <textarea
                  id="answer-input"
                  ref={inputRef}
                  rows={2}
                  value={answer}
                  disabled={!!res}
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck={false}
                  lang={isLatinAnswer ? "la" : "en"}
                  placeholder={ex.kind === "listen" ? "Write what you hear, in Latin…" : ex.kind === "derive" ? "The Latin word, any form (aqua, dormiō…)" : isLatinAnswer ? "Scrībe Latīnē… (long marks not needed)" : "Write it in English…"}
                  onInput={(e) => setAnswer((e.target as HTMLTextAreaElement).value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      res ? next() : check();
                    }
                  }}
                />
              )}
            </div>
          )}

          {!res && (
            <div class="spread ex-actions">
              <div class="row">
                {ex.skills.length > 0 && (
                  <button class="btn ghost" aria-pressed={showRule} onClick={() => { setShowRule(!showRule); setShowHints(false); }}>
                    {showRule ? "Hide rule" : "Rule"}
                  </button>
                )}
                {ex.hints.filter(Boolean).length > 0 && (
                  <button class="btn ghost" aria-pressed={showHints} onClick={() => { setShowHints(!showHints); setShowRule(false); }}>
                    {showHints ? "Hide hint" : "Hint"}
                  </button>
                )}
                {ex.latin && ex.kind !== "identify" && ex.kind !== "listen" && !ex.easy && (
                  <button class="btn ghost" onClick={() => setShowColors(!showColors)}>{showColors ? "Hide colors" : "Show colors"}</button>
                )}
                <button class="linkish" onClick={giveUp}>I don't know</button>
              </div>
              {ex.answer !== "choice" && (
                <button class="btn big" onClick={() => check()} disabled={!answer.trim()}>
                  Check <span class="kbd" style={{ color: "inherit", borderColor: "currentColor" }}>Enter</span>
                </button>
              )}
            </div>
          )}

          {showHints && !res && (
            <div class="well stack ex-hints" style={{ gap: "4px" }}>
              {ex.hints.filter(Boolean).map((h, i) => <div key={i}><Inline text={h} /></div>)}
            </div>
          )}
          {showRule && !res && <RuleBox skills={ex.skills} lesson={s.level} />}
        </div>

        {res && (
          <div class="ex-side" ref={sideRef}>
            <Feedback ex={ex} res={res} answer={answer} />
            {judgement && <div class="well"><Markup text={judgement} /></div>}
            <div class="spread ex-next">
              <div class="row">
                <button class="btn ghost" onClick={askWhy}><Icon.quill /> Why?</button>
                {res.verdict !== "correct" && ex.answer !== "choice" && answer.trim() && answer !== "—" && (
                  <button class="btn ghost" onClick={dispute} disabled={judging} title="Ask Claude to check whether your answer is also correct">
                    {judging ? "Asking…" : (
                      <>
                        <span class="wide-only">I think mine is right</span>
                        <span class="narrow-only">I'm right?</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <button class="btn big" ref={nextRef} onClick={next}>
                Next <Icon.arrow />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Word tiles: tap them in order to build the sentence; tap a placed word to put it back. */
function TileBoard({ tiles, picked, onPick, done }: { tiles: string[]; picked: number[]; onPick: (next: number[]) => void; done: boolean }) {
  return (
    <div class={`tile-board${done ? " done" : ""}`}>
      <div class="tile-line" aria-label="Your sentence">
        {picked.length ? (
          picked.map((i, k) => (
            <button key={`${i}-${k}`} class="tile placed latin" lang="la" disabled={done} onClick={() => onPick(picked.filter((_, j) => j !== k))}>
              {tiles[i]}
            </button>
          ))
        ) : (
          <span class="muted ui tile-hint">Tap the words in order…</span>
        )}
      </div>
      <div class="tile-tray" role="group" aria-label="Words">
        {tiles.map((t, i) => (
          <button key={i} class="tile latin" lang="la" disabled={done || picked.includes(i)} onClick={() => onPick([...picked, i])}>
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The English of a Latin prompt, hidden behind a button so the meaning is worked out first. */
function Translation({ text, shown, onShow }: { text?: string; shown: boolean; onShow: () => void }) {
  if (!text) return null;
  if (shown) return <p class="muted ex-english">{text}</p>;
  return (
    <button class="linkish ex-english" onClick={onShow} title="Show the English meaning">
      Translate
    </button>
  );
}

function Prompt(props: {
  ex: Exercise;
  showColors: boolean;
  res: Result | null;
  chosen: string;
  onChoose: (id: string) => void;
  english: boolean;
  onEnglish: () => void;
}) {
  const { ex, showColors, res, chosen, onChoose } = props;
  // once answered, the translation of the correct answer is in the feedback
  const translation = !res && <Translation text={ex.english} shown={props.english} onShow={props.onEnglish} />;
  switch (ex.kind) {
    case "en2la":
    case "tiles":
      return <p class="latin-lg" style={{ fontFamily: "var(--f-text)" }}>{ex.english}</p>;
    case "meaning":
      return (
        <div class="stack" style={{ gap: "8px" }}>
          <p class="latin-lg">
            <LatinTokens tokens={ex.latin!} plain={!showColors} />
            {ex.audio && <Speak text={ex.audio} id={`prompt-${ex.id}`} />}
          </p>
          <div class="choices meaning-choices" role="group" aria-label="Meanings">
            {ex.choices!.map((c, i) => {
              const state = !res ? "" : c.id === ex.correctChoice ? "chosen-good" : c.id === chosen ? "chosen-bad" : "";
              return (
                <button key={c.id} class={`word-btn choice meaning ${state}`} disabled={!!res} onClick={() => onChoose(c.id)}>
                  <span class="kbd">{i + 1}</span> <span>{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    case "la2en":
      return (
        <p class="latin-lg">
          <LatinTokens tokens={ex.latin!} plain={!showColors} />
          {ex.audio && <Speak text={ex.audio} id={`prompt-${ex.id}`} />}
        </p>
      );
    case "listen":
      return (
        <div class="stack" style={{ gap: "8px" }}>
          <div class="listen-stage">
            {ex.audio && <Speak text={ex.audio} id={`prompt-${ex.id}`} big label="Play the sentence" />}
            {ex.audio && (
              <button class="btn ghost small" onClick={() => void speak(ex.audio!, { id: `slow-${ex.id}`, rate: 0.6 })}>
                Slower
              </button>
            )}
            {!res && <span class="muted small ui">Listen as often as you like, then write it down.</span>}
          </div>
          {res && (
            <div class="stack" style={{ gap: "4px" }}>
              <p class="latin-lg"><LatinTokens tokens={ex.latin!} /></p>
              <p class="muted">{ex.english}</p>
            </div>
          )}
        </div>
      );
    case "ending":
      return (
        <div class="stack" style={{ gap: "6px" }}>
          <p class="latin-lg"><LatinTokens tokens={ex.latin!} blank={res ? undefined : ex.blank} plain={!showColors} /></p>
          {translation}
        </div>
      );
    case "transform":
      return (
        <div class="stack" style={{ gap: "6px" }}>
          <p class="latin-lg">
            <LatinTokens tokens={ex.latin!} plain={!showColors} />
            {ex.audio && <Speak text={ex.audio} id={`prompt-${ex.id}`} />}
          </p>
          {translation}
        </div>
      );
    case "choose":
      return (
        <div class="stack" style={{ gap: "6px" }}>
          <p class="latin-lg"><LatinTokens tokens={ex.latin!} blank={res ? undefined : ex.blank} whole plain={!showColors} /></p>
          {translation}
          <div class="choices" role="group" aria-label="Options">
            {ex.choices!.map((c, i) => {
              const state = !res ? "" : c.id === ex.correctChoice ? "chosen-good" : c.id === chosen ? "chosen-bad" : "";
              return (
                <button key={c.id} class={`word-btn choice ${state}`} disabled={!!res} onClick={() => onChoose(c.id)}>
                  <span class="kbd">{i + 1}</span> <span class="latin">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    case "form":
      return (
        <div class="row">
          <p class="latin-lg"><Inline text={ex.ask!.replace(/^([^→]+)→/, "«$1» →")} /></p>
          {ex.askCase && <CaseChip c={ex.askCase} />}
        </div>
      );
    case "identify":
      return (
        <p class="latin-lg">
          {ex.latin!.map((t, i) => {
            const state = !res ? "" : String(i) === ex.correctChoice ? "chosen-good" : String(i) === chosen ? "chosen-bad" : "";
            return (
              <button key={i} class={`word-btn ${state}`} disabled={!!res} onClick={() => onChoose(String(i))}>
                {res ? <LatinTokens tokens={[{ ...t, text: i === 0 ? t.text[0].toUpperCase() + t.text.slice(1) : t.text }]} period={false} /> : i === 0 ? t.text[0].toUpperCase() + t.text.slice(1) : t.text}
              </button>
            );
          })}
        </p>
      );
    case "vocab":
      return <p class="latin-lg">{ex.answer === "en" ? <Inline text={`«${ex.ask}»`} /> : ex.ask}</p>;
    case "derive":
      return (
        <div class="stack" style={{ gap: "4px" }}>
          <p class="latin-lg" style={{ fontFamily: "var(--f-text)" }} lang="en">{ex.ask}</p>
          <span class="muted ui" style={{ fontSize: "0.95rem" }}>an English word</span>
        </div>
      );
  }
}

function Feedback({ ex, res, answer }: { ex: Exercise; res: Result; answer: string }) {
  const v = VERDICT[res.verdict];
  const latinAnswer = (ex.answer === "la" || ex.answer === "tiles") && res.tokens;
  const meaning = ex.kind === "transform" || ex.kind === "derive" ? ex.answerEnglish : ex.kind === "ending" || ex.kind === "choose" ? ex.english : undefined;
  // after a mistake: the one-line rule for each skill it was about
  const blamed = res.verdict === "correct" ? [] : [...new Set(res.issues.filter((i) => i.kind !== "tip" && i.kind !== "typo").map((i) => i.skill).filter(Boolean) as string[])];
  const ruleHints = blamed.map((id) => SKILL_BY_ID.get(id)?.hint).filter(Boolean).slice(0, 2) as string[];
  return (
    <div class="stack" style={{ gap: "12px" }}>
      <div class={`verdict ansata ${res.verdict}`} role="status">
        <span class="la">{v.la}</span>
        <span class="en">{v.en}</span>
      </div>
      {latinAnswer && res.verdict !== "correct" && answer !== "—" && (
        <div class="ui you-wrote">
          <span class="muted">You wrote: </span>
          <span class="mine latin">
            {res.tokens!.map((t, i) => (
              <span key={i}>
                {i > 0 && " "}
                <span class={`t-${t.status}`}>{t.text}</span>
              </span>
            ))}
          </span>
        </div>
      )}
      <div class="stack answer" style={{ gap: "4px" }}>
        <span class="eyebrow" style={{ color: "var(--ink-2)" }}>{res.verdict === "correct" ? "Model answer" : "Correct answer"}</span>
        {ex.kind === "meaning" ? (
          <p class="latin-lg" style={{ fontFamily: "var(--f-text)" }}>{res.expected}</p>
        ) : ex.answer === "en" ? (
          <div class="stack" style={{ gap: "4px" }}>
            <p class="latin-lg">{res.expected}</p>
            {res.expectedTokens && (
              <p>
                <LatinTokens tokens={res.expectedTokens} />
                <Speak text={latinText(res.expectedTokens)} id={`answer-${ex.id}`} />
              </p>
            )}
          </div>
        ) : res.expectedTokens && ex.kind !== "identify" ? (
          <p class="latin-lg">
            <LatinTokens tokens={res.expectedTokens} period={ex.kind !== "form"} cap={ex.kind !== "form"} />
            <Speak text={latinText(res.expectedTokens)} id={`answer-${ex.id}`} />
          </p>
        ) : (
          <p class="latin-lg"><Inline text={`«${res.expected}»`} /></p>
        )}
        {meaning && <p class="muted small">{meaning}</p>}
      </div>
      {res.issues.some((i) => i.message) && (
        <ul class="issues">
          {res.issues.filter((i) => i.message).map((i, k) => <li key={k}><Inline text={i.message} /></li>)}
        </ul>
      )}
      {ruleHints.length > 0 && (
        <div class="rule-hint">
          <span class="eyebrow">Rule</span>
          {ruleHints.map((h, i) => <p key={i}><Inline text={h} /></p>)}
        </div>
      )}
    </div>
  );
}

/** After a step session: how close the step is to done, and the way to the next one. */
function StepProgress({ level }: { level: number }) {
  const p = useProgress();
  const r = readiness(p, level);
  const nextLesson = p.lessonsDone.filter((n) => n > level).sort()[0];
  return (
    <div class="panel stack" style={{ gap: "8px" }}>
      <div class="spread">
        <h3>Lesson {roman(level)}: ready for the next step</h3>
        <strong class="ui">{Math.round(r.value * 100)}%</strong>
      </div>
      <div style={{ maxWidth: "360px" }}>
        <Mosaic value={r.value} tiles={10} />
      </div>
      {r.ready && nextLesson && p.focusLesson === level ? (
        <div class="row">
          <span class="small">These rules are solid now.</span>
          <button class="btn gold small" onClick={() => { update((x) => void (x.focusLesson = nextLesson)); setSession(null); }}>
            Go to Lesson {roman(nextLesson)} <Icon.arrow />
          </button>
        </div>
      ) : (
        <span class="small muted">{r.ready ? "These rules are solid." : "The next lesson opens up at 80%. Another round brings it closer."}</span>
      )}
    </div>
  );
}

function Summary({ s }: { s: Session }) {
  const p = useProgress();
  const right = s.attempts.filter((a) => a.res.verdict === "correct").length;
  const almost = s.attempts.filter((a) => a.res.verdict === "almost").length;
  const wrong = s.attempts.filter((a) => a.res.verdict === "wrong");
  const touched = [...new Set(s.attempts.flatMap((a) => Object.keys(a.res.credit)))].filter((id) => SKILL_BY_ID.has(id));
  touched.sort((a, b) => mastery(p.skills[a]) - mastery(p.skills[b]));
  useScreen("page", "End of the round", () =>
    [
      `The end of a practice round (${modeLabel(s.mode)}): ${right} correct, ${almost} almost, ${wrong.length} wrong, out of ${s.attempts.length}.`,
      touched.length ? `Skills practised: ${touched.slice(0, 8).map((id) => `${SKILL_BY_ID.get(id)!.title} (${Math.round(mastery(p.skills[id]) * 100)}%)`).join("; ")}.` : "",
      wrong.length ? `To review:\n${wrong.map((a) => `- ${plainText(a.ex.context)} | wrote: ${givenAnswer(a.ex, a.answer)}`).join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return (
    <div class="stack-lg" style={{ maxWidth: "980px", margin: "0 auto" }}>
      <div class="summary-head">
        {/* a victor's wreath round the number of right answers */}
        <div class="wreath" title={`${right} right`}>
          <Laurel />
          <span>{right ? roman(right) : "–"}</span>
        </div>
        <div class="stack" style={{ gap: "6px" }}>
          <span class="eyebrow">{modeLabel(s.mode)}</span>
          <h1>{right + almost === s.attempts.length && s.attempts.length ? "Optimē!" : "Bene labōrāvistī!"}</h1>
          <p class="muted">
            {right} correct, {almost} almost, {wrong.length} to review, out of {s.attempts.length}.
          </p>
        </div>
      </div>
      {(s.mode.kind === "step" || s.mode.kind === "lesson") && <StepProgress level={s.level} />}
      {touched.length > 0 && (
        <div class="panel stack">
          <h3>Skills practised</h3>
          {touched.slice(0, 8).map((id) => (
            <div key={id} class="spread">
              <span class="ui">{SKILL_BY_ID.get(id)!.title}</span>
              <Mosaic value={mastery(p.skills[id])} thin />
            </div>
          ))}
        </div>
      )}
      {wrong.length > 0 && (
        <div class="panel stack">
          <h3>To review</h3>
          <p class="small muted">They come back later in Fix my mistakes, as new exercises on the same rules.</p>
          {wrong.map((a, i) => (
            <div key={i} class="stack" style={{ gap: "2px", borderBottom: "1px dashed var(--rule)", paddingBottom: "8px" }}>
              <span class="small muted ui">{a.ex.kind === "meaning" && a.ex.latin ? latinText(a.ex.latin) : a.ex.english ?? a.ex.ask ?? a.ex.instruction}</span>
              {a.res.expectedTokens && a.ex.kind !== "identify" ? <LatinTokens tokens={a.res.expectedTokens} period={a.ex.kind !== "form"} /> : <span>{a.res.expected}</span>}
              {a.answer && a.answer !== "—" && <span class="small muted ui">{a.ex.answer === "choice" ? "You chose" : "You wrote"}: {givenAnswer(a.ex, a.answer)}</span>}
            </div>
          ))}
          <div>
            <button
              class="btn ghost small"
              onClick={() =>
                openAsk(
                  { label: "Session review", detail: `Mistakes in this session: ${wrong.map((a) => `[${a.ex.context} | wrote: ${a.answer}]`).join(" ")}` },
                  "Look at my mistakes in this session. What pattern do you see, and what should I focus on?",
                )
              }
            >
              <Icon.quill /> Ask Claude about these mistakes
            </button>
          </div>
        </div>
      )}
      <div class="row">
        <button class="btn big" onClick={() => startSession(s.mode)}>Another round</button>
        <button class="btn ghost big" onClick={() => setSession(null)}>Choose another practice</button>
      </div>
    </div>
  );
}

export function endSession() {
  setSession(null);
}

export type { ExerciseKind };
