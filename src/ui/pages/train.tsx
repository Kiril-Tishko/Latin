// The trainer: one exercise at a time, written answers on a wax tablet,
// detailed feedback with colored endings, and Claude on hand for "why?".
// Every round uses only the rules of the parts the learner has seen.
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { Part, PART_BY_ID, PARTS } from "../../content/parts";
import { STORY_BY_ID } from "../../content/stories";
import { latinText, seeded } from "../../latin/generate";
import { SKILL_BY_ID } from "../../latin/skills";
import { roman } from "../../latin/text";
import { Exercise, ExerciseKind, KIND_LABEL, plainText, Result } from "../../trainer/exercises";
import { countsFor, currentPart, nextNewPart, nextStep, PART_GOAL, PART_PHASES, partRight, partsInPractice, partState, seenSkills } from "../../trainer/path";
import { dueWords } from "../../trainer/srs";
import { Entry } from "../../latin/types";
import { dayKey, Progress } from "../../trainer/progress";
import { applyResult, buildSession, mistakesSession, nextExercise, partExercise } from "../../trainer/session";
import { Line } from "../../trainer/lines";
import { practiceLines, storySession } from "../../trainer/stories";
import { answersSession, openExercise } from "../../trainer/answers";
import { freshQuestions, judgeOpen, withJudgement } from "../coach";
import { videoSession } from "../../trainer/video";
import { openAsk, judge } from "../ask";
import { CaseChip, Icon, Laurel, toast } from "../components";
import { LatinText, LatinTokens } from "../latin";
import { Inline, Markup } from "../markup";
import { go } from "../nav";
import { partsFor, RuleBox } from "../rulecard";
import { fitToWindow } from "../fit";
import { derived, getProgress, update, useProgress } from "../store";
import { speak, stopSpeaking } from "../../audio/speech";
import { audioReady, Speak } from "../speak";
import { useScreen } from "../screen";
import { PartDots, partName, PartRecap, rightWords } from "./learn";
import { NO_CORRECTION } from "../keyboard";

/** What a round practises: a rule (Continue), everything (Continue, all learned), some rules (Ask Claude's "practise this"), the words due (Verba), a lesson's or a story's sentences, or questions to answer in Latin. */
export type Mode =
  | { kind: "part"; id: string }
  | { kind: "mixed" }
  | { kind: "skills"; skills: string[]; label: string }
  | { kind: "words" }
  | { kind: "video"; n?: number }
  | { kind: "story"; id: string }
  | { kind: "answers"; story?: string };

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
  /** The part practised, if the round is on one. */
  part?: string;
  /** Show the part's explanation once more before the first exercise (once a day). */
  showRecap?: boolean;
  /** Parts that came to hold during the round. */
  learned: string[];
  /**
   * A round on a part grows one exercise at a time, each made for the learner's
   * progress at that moment: `plan` exercises in all, `made` so far.
   */
  plan?: number;
  made?: number;
  /** The fixed sentences a part's round can draw on. */
  lines?: Line[];
  /** The part's right answers when the round began. */
  startRight?: number;
  /** The day's review, mixed into a rule's round every few exercises: mistakes to fix, words that are due. */
  extras?: Exercise[];
}

/** Exercises in the round: those made, and those a part's round will still make. */
const roundSize = (s: Session) => s.items.length + Math.max(0, (s.plan ?? 0) - (s.made ?? 0));
/** Exercises of a round on one part. */
const PART_ROUND = 12;

let session: Session | null = null;
const sessionListeners = new Set<() => void>();
const setSession = (s: Session | null) => {
  session = s;
  sessionListeners.forEach((l) => l());
};

const SIZE = 15;

export function modeLabel(m: Mode): string {
  switch (m.kind) {
    case "part": {
      const part = PART_BY_ID.get(m.id);
      return part ? `${partName(part)} · ${part.title}` : "A rule";
    }
    case "mixed":
      return "Everything you've learned";
    case "skills":
      return m.label;
    case "words":
      return "Your words";
    case "video":
      return m.n ? `Lesson ${roman(m.n)}: sentences from the video` : "Sentences from the videos";
    case "story":
      return `Story: ${STORY_BY_ID.get(m.id)?.title ?? ""}`;
    case "answers":
      return m.story ? `Answer in Latin: ${STORY_BY_ID.get(m.story)?.title ?? ""}` : "Answer in Latin";
  }
}

/** Every word the learner knows, with only the rules of the parts seen. */
function ctx() {
  return { k: derived().seenKnowledge, lex: derived().lexicon, r: seeded(Date.now() % 2147483647), audio: audioReady() };
}

/** Exercise kinds of a round that grows from simple to harder (by mastery, see kindWeights). */
const STEPWISE: ExerciseKind[] = ["en2la", "la2en", "ending", "choose", "form", "transform", "identify", "listen", "tiles", "meaning"];

/** The parts that teach these rules, for a "learn it first" message. */
const partsTeaching = (skills: string[]) => [...new Set(skills.map((s) => [...PART_BY_ID.values()].find((x) => x.skills.includes(s))).filter(Boolean) as Part[])];

/**
 * Starts a new round (from anywhere in the app). Returns false, with a short
 * note, when there is nothing to practise there yet (a rule not learned).
 */
export function startSession(mode: Mode): boolean {
  const p = getProgress();
  const c = ctx();
  const seen = seenSkills(p);
  const vocab = derived().words.filter((w) => w.kind !== "fixed");
  const adaptive = { adaptive: true, focusLesson: p.focusLesson, kinds: STEPWISE };
  const unseen = (skills: string[]) => {
    const parts = partsTeaching(skills.filter((s) => !seen.has(s)));
    toast(parts.length ? `Learn ${parts.map((x) => partName(x).toLowerCase()).join(" and ")} first: its exercises open after its two questions.` : "Nothing to practise there yet.");
    return false;
  };
  let items: Exercise[];
  switch (mode.kind) {
    case "part": {
      const part = PART_BY_ID.get(mode.id);
      if (!part) return false;
      if (!p.parts[part.id]) return unseen(part.skills);
      // one exercise now; the next ones are made as the round goes, for the progress at that moment
      const lines = practiceLines(c.lex, c.k);
      const first = partExercise(p, c, part, lines, STEPWISE, new Set());
      if (!first) return unseen(part.skills);
      const extras = dayReview(p, c, vocab, first, part);
      setSession({ mode, items: [first], index: 0, attempts: [], size: PART_ROUND + extras.length, part: part.id, showRecap: recapDue(p, part.id), learned: [], plan: PART_ROUND, made: 1, lines, startRight: partRight(p, part), extras });
      return true;
    }
    case "skills": {
      const open = mode.skills.filter((s) => seen.has(s));
      if (!open.length) return unseen(mode.skills);
      items = buildSession(p, c, { size: 10, ...adaptive, skills: open });
      break;
    }
    case "video":
      items = videoSession(p, c, mode.n ? [mode.n] : p.lessonsDone);
      break;
    case "story": {
      const story = STORY_BY_ID.get(mode.id);
      items = story ? storySession(p, c, [story]) : [];
      break;
    }
    case "answers":
      items = answersSession(p, c, { story: mode.story });
      break;
    case "words":
      items = buildSession(p, c, { size: 20, kinds: ["vocab"], vocab });
      break;
    default: {
      // everything learned: a mix of all the rules, with the day's mistakes and words between
      items = buildSession(p, c, { size: SIZE, ...adaptive, vocab });
      const review = items.length ? dayReview(p, c, vocab, items[0]) : [];
      review.forEach((e, i) => items.splice(Math.min(items.length, 3 + i * 4), 0, e));
    }
  }
  if (!items.length) {
    toast(seen.size ? "Nothing to practise there yet: its sentences need rules you haven't learned." : "Learn the first rule first: it takes two minutes.");
    return false;
  }
  setSession({ mode, items, index: 0, attempts: [], size: items.length, learned: [] });
  // Answer in Latin: Claude writes fresh questions for this round; they take the places of the ones not reached yet
  if (mode.kind === "answers" && !mode.story) void freshen(session!);
  return true;
}

/** Two of the learner's mistakes to fix and two words that are due: the day's review, for a rule's round. */
function dayReview(p: Progress, c: ReturnType<typeof ctx>, vocab: Entry[], first: Exercise, part?: Part): Exercise[] {
  const mistakes = mistakesSession(p, c, vocab, 2, part?.skills);
  const due = new Set(dueWords(p, vocab.map((w) => w.id)));
  const words = due.size ? buildSession(p, c, { size: 2, kinds: ["vocab"], vocab: vocab.filter((w) => due.has(w.id)) }) : [];
  return [...mistakes, ...words].filter((e) => e.context !== first.context).map((e) => ({ ...e, aside: true }));
}

/** Puts Claude's fresh questions into a round of Answer in Latin, after the exercise on screen. */
async function freshen(started: Session) {
  const fresh = await freshQuestions(started.items.length);
  if ("error" in fresh || !fresh.length || !session || session.mode !== started.mode) return;
  const s = session;
  const c = ctx();
  const keep = s.items.slice(0, s.index + 1);
  const made = fresh.map((q) => openExercise(c, q)).filter((e) => !keep.some((k) => k.context === e.context));
  const rest = s.items.slice(s.index + 1);
  const items = [...keep, ...made, ...rest].slice(0, s.items.length);
  setSession({ ...s, items });
}

/** A part learned on an earlier day is recalled once a day before its exercises. */
const recapDue = (p: Progress, id: string) => p.rulesShown[id] !== dayKey() && dayKey(p.parts[id]?.seen) !== dayKey();

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

/** No round running (a reload, an old link): back to Domus, where Continue starts one. */
function NoRound() {
  useEffect(() => go({ page: "home" }), []);
  return null;
}

/**
 * Continue: the one button for the next step. A new rule opens its page (read
 * it, answer two questions); a rule in practice starts its round, with the
 * day's mistakes and words mixed in; with everything learned, a round of
 * everything.
 */
export function continueLearning() {
  const step = nextStep(getProgress());
  if (step.kind === "learn") go({ page: "learn", id: step.part.id });
  else if (step.kind === "practise") startSession({ kind: "part", id: step.part.id }) && go({ page: "train" });
  else if (step.kind === "review") startSession({ kind: "mixed" }) && go({ page: "train" });
  else toast("Tick the lessons you have watched under Settings, and the first rule opens.");
}

export function Train() {
  const s = useSession();
  useProgress();
  if (!s) return <NoRound />;
  const part = s.part ? PART_BY_ID.get(s.part) : undefined;
  if (s.showRecap && part) {
    const start = () => {
      update((p) => void (p.rulesShown[part.id] = dayKey()));
      setSession({ ...s, showRecap: false });
    };
    return <PartRecap part={part} onStart={start} />;
  }
  if (s.index >= s.items.length) return <Summary s={s} />;
  return <Runner s={s} key={s.items[s.index].id} />;
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
    answer: `the Latin question "${ex.ask}"${ex.gloss?.length ? ` (${ex.gloss.join("; ")})` : ""}, to answer in Latin with the learner's own words (any correct, sensible answer counts).`,
  };
  const lines = [
    `Practising: ${modeLabel(s.mode)} (only the rules of the parts the learner has seen). Exercise ${s.index + 1} of ${roundSize(s)}, "${ex.instruction}".`,
    s.part && PART_BY_ID.get(s.part) ? `Progress on ${partName(PART_BY_ID.get(s.part)!)}: ${partRight(getProgress(), PART_BY_ID.get(s.part)!)} of ${PART_GOAL} right answers (each right answer on the rule adds one; simple exercises until ${PART_PHASES.mixedFrom}, then harder ones).` : "",
    ex.video ? `A sentence from the video of Lesson ${ex.video}.` : "",
    ex.story ? `A sentence from the story "${ex.story}" (the learner may have read it on the Stories page).` : "",
    ex.fixes !== undefined ? "This exercise brings back one of the learner's earlier mistakes." : "",
    `On screen: ${shown[ex.kind]}`,
    `The exercise with its answer: ${plainText(ex.context)}`,
  ];
  if (!st.res) {
    lines.push(`Not answered yet${st.answer.trim() ? `; typed so far: "${givenAnswer(ex, st.answer.trim())}"` : ""}. Do not give the answer away unless the learner asks for it.`);
    if (st.showHints) lines.push(`Hint open: ${ex.hints.filter(Boolean).map(plainText).join("; ")}`);
    if (st.showRule) lines.push(`Rule box open: ${partsFor(ex.skills, s.part).slice(0, 2).map((x) => `${partName(x)}, ${x.title}`).join("; ") || ex.skills.map((id) => SKILL_BY_ID.get(id)?.title).join("; ")}`);
  } else {
    const given = st.answer === "—" ? "skipped it (\"I don't know\")" : `answered "${givenAnswer(ex, st.answer)}"`;
    lines.push(`The learner ${given}. Verdict: ${st.res.verdict}. Correct answer: ${stop(plainText(st.res.expected))}`);
    const notes = st.res.issues.map((i) => plainText(i.message)).filter(Boolean);
    if (notes.length) lines.push(`The checker's notes: ${notes.join(" ")}`);
    if (st.judgement) lines.push(`Claude's earlier check of the answer: ${plainText(st.judgement)}`);
  }
  return lines.filter(Boolean).join("\n");
}

/** What to do, in a few plain words, and how: write, tap, type in the gap, listen, change. */
type How = "write" | "tap" | "gap" | "listen" | "change";
function taskOf(ex: Exercise): { how: How; text: string; dir?: string } {
  const label = ex.ask?.split("→")[1]?.trim() ?? "";
  switch (ex.kind) {
    case "en2la":
      return { how: "write", text: "Write this sentence in Latin", dir: "English → Latin" };
    case "la2en":
      return { how: "write", text: "Write it in English", dir: "Latin → English" };
    case "ending":
      return { how: "gap", text: "Type the missing ending in the gap" };
    case "choose":
      return { how: "tap", text: "Tap the word that fits the gap" };
    case "form":
      return { how: "gap", text: label ? `Write the form for ${label}` : "Write the form" };
    case "transform":
      return { how: "change", text: `Change the Latin: ${ex.instruction.charAt(0).toLowerCase()}${ex.instruction.slice(1).replace(/\.$/, "")}` };
    case "identify":
      return { how: "tap", text: ex.instruction.replace(/^Which word (is|says) (.*)\?$/, "Tap the word that $1 $2") };
    case "listen":
      return { how: "listen", text: "Listen, then write what you hear" };
    case "tiles":
      return { how: "tap", text: "Tap the words in order to build the sentence" };
    case "meaning":
      return { how: "tap", text: "Tap what it means" };
    case "vocab":
      return ex.answer === "en" ? { how: "write", text: "Write what it means", dir: "Latin → English" } : { how: "write", text: "Write the Latin word", dir: "English → Latin" };
    case "derive":
      return { how: "write", text: "Write the Latin word inside this English word" };
    case "answer":
      return { how: "write", text: ex.instruction, dir: "your own words" };
  }
}

const HOW_ICON: Record<How, () => preact.JSX.Element> = { write: Icon.stylus, tap: Icon.tap, gap: Icon.gap, listen: Icon.speaker, change: Icon.repeat };

function Runner({ s }: { s: Session }) {
  const ex = s.items[s.index];
  // a sentence to change starts in the box, ready to be edited
  const [answer, setAnswer] = useState(ex.kind === "transform" && ex.latin ? latinText(ex.latin) : "");
  const [res, setRes] = useState<Result | null>(null);
  // Help shows the hint, the rule and the colors at once
  const [help, setHelp] = useState(false);
  const showHints = help;
  const showRule = help;
  // a rule that is still new is shown with its colors from the start
  const showColors = !!ex.easy || help;
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
  useScreen("page", `Exercise ${s.index + 1} of ${roundSize(s)}: ${KIND_LABEL[ex.kind]}`, () =>
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

  // an answer in the learner's own words is read by the coach; meanwhile the box waits
  const [reading, setReading] = useState(false);
  function check(given = answer) {
    if (res || reading) return;
    if (!given.trim() && ex.answer !== "choice") return;
    const engine = ex.check(given);
    if (ex.kind !== "answer") {
      setRes(engine);
      return;
    }
    setReading(true);
    const id = ex.id;
    void judgeOpen(ex, given, engine).then((j) => {
      if (session?.items[session.index]?.id !== id) return;
      setReading(false);
      setRes("error" in j ? engine : withJudgement(ex, engine, j));
      if (!("error" in j)) setJudgement(null);
    });
  }

  function giveUp() {
    const r = ex.check("—");
    setRes({ ...r, verdict: "wrong", issues: [{ kind: "missing", message: "Skipped. Here is the answer; it will come back later." }] });
  }

  function next() {
    if (!res) return;
    let learned: Part[] = [];
    update((p) => {
      learned = applyResult(p, ex, res, answer);
    });
    // a rule that now holds: say so at once, and offer the next one at the end of the round
    if (learned.length) toast(`Rēctē! ${partName(learned[0])} is learned: ${PART_GOAL} right answers.`);
    const attempts = [...s.attempts, { ex, answer, res }];
    const done = [...s.learned, ...learned.map((x) => x.id)];
    // the round's own rule is learned: the round ends here, with the way to the next rule
    if (s.part && done.includes(s.part)) {
      setSession({ ...s, attempts, index: s.items.length, learned: done, plan: s.made });
      return;
    }
    let items = s.items;
    // a wrong sentence comes back once more at the end of the round
    if (res.verdict === "wrong" && ex.kind !== "identify" && s.items.length < s.size + 4) {
      const again = ex.retry ? ex.retry() : nextExercise(getProgress(), ctx(), { size: 1, skills: Object.keys(res.credit).filter((k) => res.credit[k] < 0.5), kinds: [ex.kind === "vocab" ? "vocab" : ex.kind], vocab: derived().words.filter((w) => ex.words.includes(w.id)) }, new Set(s.items.map((e) => e.context)));
      if (again && ex.fixes !== undefined) again.fixes = ex.fixes;
      if (again) items = [...items, again];
    }
    // a part's round: the next exercise is made now, for the progress just reached (before any retries)
    let made = s.made;
    let extras = s.extras;
    const part = s.part ? PART_BY_ID.get(s.part) : undefined;
    if (extras?.length && (s.index + 1) % 4 === 3) {
      // the day's review: a mistake to fix or a word that is due, between the rule's exercises
      items = [...items.slice(0, s.index + 1), extras[0], ...items.slice(s.index + 1)];
      extras = extras.slice(1);
    } else if (part && s.plan !== undefined && (s.made ?? 0) < s.plan) {
      const fresh = partExercise(getProgress(), ctx(), part, s.lines ?? [], STEPWISE, new Set(items.map((e) => e.context)), items.slice(0, s.index + 1));
      if (fresh) {
        items = [...items.slice(0, s.index + 1), fresh, ...items.slice(s.index + 1)];
        made = (made ?? 0) + 1;
      } else made = s.plan;
    }
    setSession({ ...s, items, attempts, index: s.index + 1, learned: done, made, extras });
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

  const total = roundSize(s);
  const progress = s.index / total;
  const isLatinAnswer = ex.answer === "la";
  const roundPart = s.part ? PART_BY_ID.get(s.part) : undefined;
  // the parts this answer adds one to (in any kind of practice)
  const pp = getProgress();
  const counted = res ? partsInPractice(pp).filter((x) => countsFor(x, res)) : [];

  return (
    <div class="trainer">
      <div class="trainer-top">
        <span class="eyebrow trainer-label">{modeLabel(s.mode)}</span>
        <span class="counter" title={`Exercise ${s.index + 1} of ${total}`}>
          <strong>{s.index + 1}</strong> / {total}
        </span>
        <button class="btn ghost small trainer-end" onClick={() => setSession({ ...s, index: s.items.length, plan: s.made })} aria-label="End the round" title="End the round">
          <Icon.close />
        </button>
        {roundPart ? (
          // a rule's round: its ten dots, one per right answer
          <PartCount part={roundPart} plus={counted.some((x) => x.id === roundPart.id)} />
        ) : (
          // any other round: a strip of tesserae, gold when right, pale when almost, dark when wrong
          <div class="session-mosaic" role="img" aria-label={`${Math.round(progress * 100)}% of the round done`}>
            {Array.from({ length: total }, (_, i) => (
              <i key={s.items[i]?.id ?? `next-${i}`} class={s.attempts[i] ? s.attempts[i].res.verdict : i === s.index ? "current" : ""} />
            ))}
          </div>
        )}
      </div>

      <div class={`panel frame exercise${res ? " answered" : ""}`} ref={panelRef}>
        <div class="ex-main">
          {(() => {
            const task = taskOf(ex);
            const Glyph = HOW_ICON[task.how];
            // what an exercise between the rule's own ones is: a mistake back, a word due, an earlier rule
            const sources = [ex.fixes !== undefined ? "an earlier mistake, once more" : "", ex.aside && ex.kind === "vocab" ? "a word to review" : "", ex.earlier ? "an earlier rule" : ""].filter(Boolean);
            return (
              <div class={`task-line how-${task.how}`}>
                <span class="task-glyph" aria-hidden="true"><Glyph /></span>
                <span class="task-text ex-instruction">{task.text}</span>
                {task.dir && <span class="task-dir">{task.dir}</span>}
                {sources.length > 0 && <span class="ex-source">{sources.join(" · ")}</span>}
              </div>
            );
          })()}
          <div class="prompt">
            <Prompt
              ex={ex}
              showColors={showColors || !!res}
              res={res}
              chosen={answer}
              onChoose={(id) => { setAnswer(id); check(id); }}
              english={showEnglish}
              onEnglish={() => setShowEnglish(true)}
              box={{ value: answer, onInput: setAnswer, onEnter: () => (res ? next() : check()), ref: inputRef }}
            />
          </div>

          {ex.answer === "tiles" && ex.tiles && <TileBoard tiles={ex.tiles} picked={picked} onPick={pickTiles} done={!!res} />}

          {ex.answer !== "choice" && ex.answer !== "tiles" && !INLINE.has(ex.kind) && (
            <div class={`tablet ${res ? "done" : ""}`}>
              {(
                <textarea
                  id="answer-input"
                  ref={inputRef}
                  rows={2}
                  value={answer}
                  disabled={!!res}
                  {...NO_CORRECTION}
                  autocapitalize="off"
                  lang={isLatinAnswer ? "la" : "en"}
                  placeholder={
                    ex.kind === "listen" ? "Write what you hear, in Latin…"
                    : ex.kind === "derive" ? "The Latin word, any form (aqua, dormiō…)"
                    : ex.kind === "transform" ? "Change the sentence here…"
                    : ex.kind === "answer" ? "Answer in Latin, with your own words… (no need for long marks)"
                    : isLatinAnswer ? "Write it in Latin… (no need for long marks)"
                    : "Write it in English…"
                  }
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
                {(ex.skills.length > 0 || ex.hints.some(Boolean)) && (
                  <button id="ex-help" class="btn ghost" aria-pressed={help} onClick={() => setHelp(!help)} title="The rule, a hint and the colors of the endings">
                    {help ? "Hide help" : "Help"}
                  </button>
                )}
                <button class="linkish" onClick={giveUp}>Show answer</button>
              </div>
              {ex.answer !== "choice" && (
                <button class="btn big" onClick={() => check()} disabled={!answer.trim() || reading}>
                  {reading ? "The coach is reading…" : <>Check <span class="kbd" style={{ color: "inherit", borderColor: "currentColor" }}>Enter</span></>}
                </button>
              )}
            </div>
          )}

          {showHints && !res && (
            <div class="well stack ex-hints" style={{ gap: "4px" }}>
              {ex.hints.filter(Boolean).map((h, i) => <div key={i}><Inline text={h} /></div>)}
            </div>
          )}
          {showRule && !res && <RuleBox skills={ex.skills} part={s.part} />}
        </div>

        {res && (
          <div class="ex-side" ref={sideRef}>
            <Feedback ex={ex} res={res} answer={answer} />
            {counted.map((x) => (
              <p key={x.id} class="part-plus" role="status">
                <strong>+1</strong> {partName(x)}: {partRight(pp, x) + 1} of {PART_GOAL} right answers
              </p>
            ))}
            {roundPart && !counted.some((x) => x.id === roundPart.id) && partState(pp, roundPart) === "practising" && (
              <p class="part-plus none">{partName(roundPart)} stays at {partRight(pp, roundPart)} of {PART_GOAL}: only a right answer adds one.</p>
            )}
            {judgement && <div class="well"><Markup text={judgement} /></div>}
            <div class="spread ex-next">
              <div class="row">
                <button class="btn ghost" onClick={askWhy}><Icon.quill /> Why?</button>
                {res.verdict !== "correct" && ex.answer !== "choice" && ex.kind !== "answer" && answer.trim() && answer !== "—" && (
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

/**
 * A part's exact progress, in the round's header: one dot per right answer,
 * ten to learn it (a small gap marks where the harder exercises begin).
 */
function PartCount({ part, plus }: { part: Part; plus: boolean }) {
  const p = useProgress();
  const right = partRight(p, part);
  return (
    <div class="part-count" title={`Each right answer on ${partName(part).toLowerCase()} adds one; ${PART_GOAL} make it learned.`}>
      <PartDots part={part} plus={plus} />
      <span class="part-count-num"><strong>{right}</strong> / {PART_GOAL} right</span>
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

/** Exercises whose answer is typed right into the sentence (or after the arrow), not in a separate box. */
const INLINE = new Set<ExerciseKind>(["ending", "form"]);

interface AnswerBox {
  value: string;
  onInput: (v: string) => void;
  onEnter: () => void;
  ref: { current: (HTMLTextAreaElement & HTMLInputElement) | null };
}

/** A small box inside the sentence, as wide as what is typed in it. */
function GapInput({ box, wide, label }: { box: AnswerBox; wide?: boolean; label: string }) {
  return (
    <input
      id="answer-input"
      class={`gap-input${wide ? " wide" : ""}`}
      ref={box.ref as never}
      value={box.value}
      aria-label={label}
      {...NO_CORRECTION}
      autocapitalize="off"
      enterkeyhint="done"
      lang="la"
      placeholder={wide ? "…" : "?"}
      style={{ width: `${Math.max(wide ? 5 : 2.4, box.value.length + 1.2)}ch` }}
      onInput={(e) => box.onInput((e.target as HTMLInputElement).value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          box.onEnter();
        }
      }}
    />
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
  box: AnswerBox;
}) {
  const { ex, showColors, res, chosen, onChoose, box } = props;
  // once answered, the translation of the correct answer is in the feedback
  const translation = !res && <Translation text={ex.english} shown={props.english} onShow={props.onEnglish} />;
  switch (ex.kind) {
    case "en2la":
    case "tiles":
      return <p class="latin-lg" style={{ fontFamily: "var(--f-text)" }}>{ex.english}</p>;
    case "answer":
      return (
        <div class="stack" style={{ gap: "6px" }}>
          <p class="latin-lg answer-q">
            <LatinText text={ex.ask ?? ""} />
            {ex.audio && <Speak text={ex.audio} id={`prompt-${ex.id}`} />}
          </p>
          {ex.gloss && ex.gloss.length > 0 && <p class="answer-gloss ui">{ex.gloss.join(" · ")}</p>}
          {translation}
        </div>
      );
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
          <p class="latin-lg gap-line">
            <LatinTokens tokens={ex.latin!} blank={res ? undefined : ex.blank} plain={!showColors} gap={res ? undefined : <GapInput box={box} label="The missing ending" />} />
          </p>
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
    case "form": {
      const [from, label] = ex.ask!.split("→").map((x) => x.trim());
      return (
        <div class="row form-line">
          <p class="latin-lg">
            <Inline text={`«${from}»`} /> <span class="form-arrow">→</span> <span class="form-label">{label}</span>{" "}
            {res ? null : <GapInput box={box} wide label={`The form for ${label}`} />}
          </p>
          {ex.askCase && <CaseChip c={ex.askCase} />}
        </div>
      );
    }
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
        <span class="eyebrow" style={{ color: "var(--ink-2)" }}>{ex.kind === "answer" ? (res.coached ? "Your idea, corrected" : "For example") : res.verdict === "correct" ? "Model answer" : "Correct answer"}</span>
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

/** After a round: how far the rule is on its way to holding, and the next rule when it holds. */
function PartProgress({ s }: { s: Session }) {
  const p = useProgress();
  const learned = s.learned.map((id) => PART_BY_ID.get(id)).filter(Boolean) as Part[];
  const part = s.part ? PART_BY_ID.get(s.part) : currentPart(p);
  const upcoming = nextNewPart(p);
  if (!part && !learned.length) return null;
  if (learned.length) {
    return (
      <div class="panel stack part-done" style={{ gap: "10px" }}>
        <div class="row">
          <Laurel cls="laurel-mini" />
          <h3>{learned.map((x) => `${partName(x)} holds: ${x.title}`).join(" · ")}</h3>
        </div>
        <span class="small muted">It stays in your practice from now on, mixed with the next rules.</span>
        {upcoming && <span class="small">Next: {partName(upcoming).toLowerCase()} · {upcoming.title}. Continue opens it.</span>}
      </div>
    );
  }
  const now = partRight(p, part!);
  const before = s.part === part!.id ? s.startRight ?? now : now;
  return (
    <div class="panel stack" style={{ gap: "8px" }}>
      <div class="spread">
        <h3>{partName(part!)}: {part!.title}</h3>
        <strong class="ui">{now} / {PART_GOAL}</strong>
      </div>
      <PartDots part={part!} big />
      <span class="small">
        {partState(p, part!) === "learned"
          ? "This rule is learned."
          : now > before
            ? `This round: ${before} → ${now} right answers. ${PART_GOAL - now} more to learn it.`
            : `${PART_GOAL - now} more right answers to learn it. Each right answer on this rule adds one.`}
      </span>
    </div>
  );
}

function Summary({ s }: { s: Session }) {
  const p = useProgress();
  const right = s.attempts.filter((a) => a.res.verdict === "correct").length;
  const almost = s.attempts.filter((a) => a.res.verdict === "almost").length;
  const wrong = s.attempts.filter((a) => a.res.verdict === "wrong");
  // the rules the round practised (besides the round's own, shown above), with the same count of right answers
  const used = new Set(s.attempts.flatMap((a) => Object.keys(a.res.credit)));
  const touched = PARTS.filter((x) => x.id !== s.part && partState(p, x) !== "new" && x.skills.some((sk) => used.has(sk)));
  useScreen("page", "End of the round", () =>
    [
      `The end of a practice round (${modeLabel(s.mode)}): ${right} correct, ${almost} almost, ${wrong.length} wrong, out of ${s.attempts.length}.`,
      touched.length ? `Rules practised: ${touched.slice(-6).map((x) => `${partName(x)} ${x.title} (${partState(p, x) === "learned" ? "learned" : rightWords(p, x)})`).join("; ")}.` : "",
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
      <PartProgress s={s} />
      {touched.length > 0 && (
        <div class="panel stack">
          <h3>Rules practised</h3>
          {touched.slice(-6).map((x) => (
            <div key={x.id} class="spread">
              <button class="linkish part-row-title" onClick={() => { setSession(null); go({ page: "learn", id: x.id }); }}>
                <span class="part-row-id">{x.id}</span> {x.title}
              </button>
              {partState(p, x) === "learned" ? <span class="story-read">learned</span> : <span class="row small ui" style={{ gap: "6px" }}><PartDots part={x} /> {partRight(p, x)}/{PART_GOAL}</span>}
            </div>
          ))}
        </div>
      )}
      {wrong.length > 0 && (
        <div class="panel stack">
          <h3>To review</h3>
          <p class="small muted">They come back in your next rounds, as new exercises on the same rules and words.</p>
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
        <button class="btn big" onClick={() => { setSession(null); continueLearning(); }}>
          <Icon.play /> Continue
        </button>
        <button class="btn ghost big" onClick={() => { setSession(null); go({ page: "home" }); }}>Done for now</button>
      </div>
    </div>
  );
}

export function endSession() {
  setSession(null);
}

export type { ExerciseKind };
