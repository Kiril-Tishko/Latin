// The trainer: one exercise at a time, written answers on a wax tablet,
// detailed feedback with colored endings, and Claude on hand for "why?".
import { useEffect, useRef, useState } from "preact/hooks";
import { LESSON_BY_N } from "../../content/lessons";
import { seeded } from "../../latin/generate";
import { SKILL_BY_ID } from "../../latin/skills";
import { Exercise, ExerciseKind, KIND_LABEL, Result } from "../../trainer/exercises";
import { mastery } from "../../trainer/progress";
import { applyResult, buildSession, nextExercise, placementSession } from "../../trainer/session";
import { openAsk, judge } from "../ask";
import { CaseChip, Icon, Mosaic, toast } from "../components";
import { LatinTokens } from "../latin";
import { Inline, Markup } from "../markup";
import { derived, getProgress, update, useProgress } from "../store";
import { roman } from "../../latin/text";
import { latinText } from "../../latin/generate";
import { speak, stopSpeaking } from "../../audio/speech";
import { audioReady, Speak } from "../speak";

export type Mode =
  | { kind: "mixed" }
  | { kind: "lesson"; n: number }
  | { kind: "skills"; skills: string[]; label: string }
  | { kind: "placement" }
  | { kind: "writing" }
  | { kind: "endings" }
  | { kind: "words" }
  | { kind: "listening" };

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
    case "mixed":
      return `Mixed practice · Lesson ${roman(getProgress().focusLesson)} focus`;
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
  }
}

function ctx() {
  return { k: derived().knowledge, lex: derived().lexicon, r: seeded(Date.now() % 2147483647), audio: audioReady() };
}

/** Starts a new session (from anywhere in the app). */
export function startSession(mode: Mode) {
  const p = getProgress();
  const c = ctx();
  const vocab = derived().words.filter((w) => w.kind !== "fixed");
  let items: Exercise[];
  switch (mode.kind) {
    case "placement":
      items = placementSession(p, c);
      break;
    case "lesson":
      items = buildSession(p, c, { size: SIZE, skills: LESSON_BY_N.get(mode.n)?.skills, vocab: LESSON_BY_N.get(mode.n)?.words.filter((w) => w.kind !== "fixed") });
      break;
    case "skills":
      items = buildSession(p, c, { size: 10, skills: mode.skills, kinds: ["en2la", "ending", "form", "transform", "la2en"] });
      break;
    case "writing":
      items = buildSession(p, c, { size: SIZE, kinds: ["en2la", "transform"] });
      break;
    case "endings":
      items = buildSession(p, c, { size: 20, kinds: ["ending", "form"] });
      break;
    case "words":
      items = buildSession(p, c, { size: 20, kinds: ["vocab"], vocab });
      break;
    case "listening":
      items = buildSession(p, c, { size: 12, kinds: ["listen"] });
      break;
    default:
      items = buildSession(p, c, { size: SIZE, vocab });
  }
  if (!items.length) {
    toast("Nothing to practise there yet.");
    return;
  }
  setSession({ mode, items, index: 0, attempts: [], size: items.length });
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
  if (s.index >= s.items.length) return <Summary s={s} />;
  return <Runner s={s} key={s.items[s.index].id} />;
}

function Chooser() {
  const p = useProgress();
  const modes: { mode: Mode; title: string; text: string }[] = [
    { mode: { kind: "mixed" }, title: "Mixed practice", text: `All exercise types, aimed at your weakest endings, mostly from Lesson ${roman(p.focusLesson)}.` },
    { mode: { kind: "writing" }, title: "Write Latin", text: "Translate into Latin and transform sentences. The fastest way to make endings automatic." },
    { mode: { kind: "endings" }, title: "Endings drill", text: "Short, quick: fill in endings and build forms." },
    { mode: { kind: "words" }, title: "Word recall", text: "Your dictionary, in both directions, spaced so words come back just before you forget." },
    ...(audioReady() ? [{ mode: { kind: "listening" } as Mode, title: "Listening", text: "Hear a sentence, write it in Latin. Trains your ear for the endings." }] : []),
    ...(!p.placementDone ? [{ mode: { kind: "placement" } as Mode, title: "Check-up (3 min)", text: "Twelve questions across Lessons I-IV to find what is solid and what is shaky." }] : []),
  ];
  return (
    <div class="stack-lg">
      <div class="stack" style={{ gap: "6px" }}>
        <span class="eyebrow">Exercitātiō</span>
        <h1>Train</h1>
        <p class="muted">Every exercise uses only the words and grammar you have learned, plus the words you add from Discover.</p>
      </div>
      <div class="grid-2">
        {modes.map((m) => (
          <button key={m.title} class="panel frame stack" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => startSession(m.mode)}>
            <h3>{m.title}</h3>
            <p class="muted small">{m.text}</p>
            <span class="btn small" style={{ alignSelf: "flex-start" }}><Icon.play /> Start</span>
          </button>
        ))}
      </div>
      <div class="stack">
        <span class="eyebrow">Practise one lesson</span>
        <div class="row">
          {p.lessonsDone.map((n) => (
            <button key={n} class="btn ghost" onClick={() => startSession({ kind: "lesson", n })}>
              Lesson {roman(n)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const VERDICT = {
  correct: { la: "Rēctē!", en: "Correct" },
  almost: { la: "Paene!", en: "Almost: small slip" },
  wrong: { la: "Errās…", en: "Not quite" },
};

function Runner({ s }: { s: Session }) {
  const ex = s.items[s.index];
  const [answer, setAnswer] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [showHints, setShowHints] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [judging, setJudging] = useState(false);
  const [judgement, setJudgement] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!res) inputRef.current?.focus();
    else nextRef.current?.focus();
  }, [res]);

  // listening exercises play at once; other Latin prompts only when auto-read is on
  useEffect(() => {
    const auto = ex.kind === "listen" || (getProgress().settings.autoplay && (ex.kind === "la2en" || ex.kind === "transform"));
    if (ex.audio && auto && audioReady()) void speak(ex.audio, { id: `prompt-${ex.id}` });
    return () => stopSpeaking();
  }, [ex.id]);

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
      const again = nextExercise(getProgress(), ctx(), { size: 1, skills: Object.keys(res.credit).filter((k) => res.credit[k] < 0.5), kinds: [ex.kind === "vocab" ? "vocab" : ex.kind], vocab: derived().words.filter((w) => ex.words.includes(w.id)) }, new Set(s.items.map((e) => e.context)));
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
      res && res.verdict !== "correct" ? "Why is my answer wrong, and how do I get it right next time?" : undefined,
    );

  const progress = s.index / s.items.length;
  const isLatinAnswer = ex.answer === "la";

  return (
    <div class="stack" style={{ maxWidth: "760px", margin: "0 auto" }}>
      <div class="spread">
        <span class="eyebrow">{modeLabel(s.mode)}</span>
        <div class="row">
          <span class="ui small muted">{s.index + 1} / {s.items.length}</span>
          <button class="linkish" onClick={() => setSession({ ...s, index: s.items.length })}>End</button>
        </div>
      </div>
      <div class="progress-line"><i style={{ width: `${progress * 100}%` }} /></div>

      <div class="panel frame stack" style={{ padding: "26px" }}>
        <span class="eyebrow">{ex.instruction}</span>
        <Prompt ex={ex} showColors={showColors || !!res} res={res} chosen={answer} onChoose={(id) => { setAnswer(id); check(id); }} />

        {ex.answer !== "choice" && (
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
                placeholder={ex.kind === "listen" ? "Write what you hear, in Latin…" : isLatinAnswer ? "Scrībe Latīnē… (long marks not needed)" : "Write it in English…"}
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

        {!res ? (
          <div class="spread">
            <div class="row">
              {ex.hints.filter(Boolean).length > 0 && (
                <button class="btn ghost small" onClick={() => setShowHints(!showHints)}>{showHints ? "Hide hint" : "Hint"}</button>
              )}
              {ex.latin && ex.kind !== "identify" && (
                <button class="btn ghost small" onClick={() => setShowColors(!showColors)}>{showColors ? "Hide colors" : "Show colors"}</button>
              )}
              <button class="linkish" onClick={giveUp}>I don't know</button>
            </div>
            {ex.answer !== "choice" && (
              <button class="btn" onClick={() => check()} disabled={!answer.trim()}>
                Check <span class="kbd" style={{ color: "inherit", borderColor: "currentColor" }}>Enter</span>
              </button>
            )}
          </div>
        ) : null}

        {showHints && !res && (
          <div class="well small stack" style={{ gap: "4px" }}>
            {ex.hints.filter(Boolean).map((h, i) => <div key={i}><Inline text={h} /></div>)}
          </div>
        )}

        {res && <Feedback ex={ex} res={res} answer={answer} />}

        {res && judgement && <div class="well small"><Markup text={judgement} /></div>}

        {res && (
          <div class="spread">
            <div class="row">
              <button class="btn ghost small" onClick={askWhy}><Icon.quill /> Why?</button>
              {res.verdict !== "correct" && ex.answer !== "choice" && answer.trim() && answer !== "—" && (
                <button class="btn ghost small" onClick={dispute} disabled={judging}>
                  {judging ? "Asking Claude…" : "I think my answer is right"}
                </button>
              )}
            </div>
            <button class="btn" ref={nextRef} onClick={next}>
              Next <Icon.arrow />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Prompt({ ex, showColors, res, chosen, onChoose }: { ex: Exercise; showColors: boolean; res: Result | null; chosen: string; onChoose: (id: string) => void }) {
  switch (ex.kind) {
    case "en2la":
      return <p class="latin-lg" style={{ fontFamily: "var(--f-text)" }}>{ex.english}</p>;
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
          <p class="muted">{ex.english}</p>
        </div>
      );
    case "transform":
      return (
        <div class="stack" style={{ gap: "6px" }}>
          <p class="latin-lg">
            <LatinTokens tokens={ex.latin!} plain={!showColors} />
            {ex.audio && <Speak text={ex.audio} id={`prompt-${ex.id}`} />}
          </p>
          <p class="muted small">{ex.english}</p>
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
  }
}

function Feedback({ ex, res, answer }: { ex: Exercise; res: Result; answer: string }) {
  const v = VERDICT[res.verdict];
  const latinAnswer = ex.answer === "la" && res.tokens;
  return (
    <div class="stack" style={{ gap: "12px" }}>
      <div class={`verdict ${res.verdict}`} role="status">
        <span class="la">{v.la}</span>
        <span class="en">{v.en}</span>
      </div>
      {latinAnswer && res.verdict !== "correct" && answer !== "—" && (
        <div class="small ui">
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
      <div class="stack" style={{ gap: "4px" }}>
        <span class="eyebrow" style={{ color: "var(--ink-2)" }}>{res.verdict === "correct" ? "Model answer" : "Correct answer"}</span>
        {ex.answer === "en" ? (
          <div class="stack" style={{ gap: "4px" }}>
            <p class="latin-lg" style={{ fontSize: "1.2rem" }}>{res.expected}</p>
            {res.expectedTokens && (
              <p>
                <LatinTokens tokens={res.expectedTokens} />
                <Speak text={latinText(res.expectedTokens)} id={`answer-${ex.id}`} />
              </p>
            )}
          </div>
        ) : res.expectedTokens && ex.kind !== "identify" ? (
          <p class="latin-lg">
            <LatinTokens tokens={res.expectedTokens} period={ex.kind !== "form"} />
            <Speak text={latinText(res.expectedTokens)} id={`answer-${ex.id}`} />
          </p>
        ) : (
          <p class="latin-lg"><Inline text={`«${res.expected}»`} /></p>
        )}
        {(ex.kind === "en2la" || ex.kind === "transform" || ex.kind === "ending") && ex.english && ex.kind !== "en2la" && (
          <p class="muted small">{ex.english}</p>
        )}
      </div>
      {res.issues.some((i) => i.message) && (
        <ul class="issues">
          {res.issues.filter((i) => i.message).map((i, k) => <li key={k}><Inline text={i.message} /></li>)}
        </ul>
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
  return (
    <div class="stack-lg" style={{ maxWidth: "760px", margin: "0 auto" }}>
      <div class="stack" style={{ gap: "6px" }}>
        <span class="eyebrow">{modeLabel(s.mode)}</span>
        <h1>{right + almost === s.attempts.length && s.attempts.length ? "Optimē!" : "Bene labōrāvistī!"}</h1>
        <p class="muted">
          {right} correct, {almost} almost, {wrong.length} to review, out of {s.attempts.length}.
        </p>
      </div>
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
          {wrong.map((a, i) => (
            <div key={i} class="stack" style={{ gap: "2px", borderBottom: "1px dashed var(--rule)", paddingBottom: "8px" }}>
              <span class="small muted ui">{a.ex.english ?? a.ex.ask ?? a.ex.instruction}</span>
              {a.res.expectedTokens && a.ex.kind !== "identify" ? <LatinTokens tokens={a.res.expectedTokens} period={a.ex.kind !== "form"} /> : <span>{a.res.expected}</span>}
              {a.answer && a.answer !== "—" && <span class="small muted ui">You wrote: {a.answer}</span>}
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
