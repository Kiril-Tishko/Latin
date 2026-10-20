// One part of a lesson's rules, learned before it is practised: a very simple
// explanation with examples, then two open questions answered in the learner's
// own words (checked by their key words, by Claude when it is there, or by the
// learner against a good answer). Only then do its exercises open, simple ones
// first (trainer/path.ts).
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { Rule } from "../../content/lessons";
import { Part, PART_BY_ID, PartQuestion, PARTS, partsOf, rulesOfPart } from "../../content/parts";
import { roman } from "../../latin/text";
import { currentPart, markSeen, meetsKeys, PART_GOAL, PART_PHASES, partProgress, partRight, partState } from "../../trainer/path";
import { Progress } from "../../trainer/progress";
import { checkUnderstanding, openAsk } from "../ask";
import { Hedera, Icon, joinEndings, Laurel } from "../components";
import { fitToWindow } from "../fit";
import { LatinText } from "../latin";
import { Inline } from "../markup";
import { backToLessons, go } from "../nav";
import { sampler } from "../platform";
import { useScreen } from "../screen";
import { Speak } from "../speak";
import { update, useProgress } from "../store";
import { startSession } from "./train";
import { NO_CORRECTION } from "../keyboard";

/** "Rule 2.1", the way the site names a part. */
export const partName = (part: Part) => `Rule ${part.id}`;

const plain = (s: string) => s.replace(/«|»|\*\*/g, "").replace(/#[a-z0-9]+(?:\.[a-z0-9]+)*/g, "");

/** "3 of 10 right answers": a part's exact progress in words. */
export const rightWords = (p: Progress, part: Part) => `${partRight(p, part)} of ${PART_GOAL} right answers`;

/**
 * A part's exact progress: one dot per right answer, ten to learn it, with a
 * small gap where the harder exercises begin. `plus` marks the dot an answer
 * on screen is about to add.
 */
export function PartDots({ part, plus, big }: { part: Part; plus?: boolean; big?: boolean }) {
  const p = useProgress();
  const right = partRight(p, part);
  return (
    <span class={`part-dots${big ? " big" : ""}`} role="img" aria-label={`${right} of ${PART_GOAL} right answers`}>
      {Array.from({ length: PART_GOAL }, (_, i) => (
        <i key={i} class={`${i < right ? "on" : plus && i === right ? "plus" : ""}${i === PART_PHASES.mixedFrom ? " step" : ""}`} />
      ))}
    </span>
  );
}

/** The parts of a lesson as small tiles: gold when learned, half when in practice, the current one marked. */
export function PartsStrip({ lesson, here }: { lesson: number; here?: string }) {
  const p = useProgress();
  const current = currentPart(p)?.id;
  return (
    <div class="parts-strip" role="list" aria-label={`The rules of Lesson ${roman(lesson)}`}>
      {partsOf(lesson).map((part) => {
        const state = partState(p, part);
        const value = partProgress(p, part);
        return (
          <button
            key={part.id}
            role="listitem"
            class={`part-tile ${state}${part.id === current ? " current" : ""}${part.id === here ? " here" : ""}`}
            style={{ "--fill": `${Math.round(value * 100)}%` }}
            title={`${partName(part)}: ${part.title} (${state === "learned" ? "learned" : state === "practising" ? `practising, ${Math.round(value * 100)}%` : "not learned yet"})`}
            aria-label={`${partName(part)}: ${part.title}`}
            aria-current={part.id === here ? "page" : undefined}
            onClick={() => go({ page: "learn", id: part.id })}
          >
            {state === "learned" ? <Icon.check /> : part.id.split(".")[1]}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A lesson's rules, one line each: tap a line to read the rule and practise it.
 * Each line says where the learner is with it: learned, its right answers so
 * far, or new; the rule to work on now is marked.
 */
export function RuleList({ lesson }: { lesson: number }) {
  const p = useProgress();
  const current = currentPart(p)?.id;
  return (
    <div class="rule-list" role="list" aria-label={`The rules of Lesson ${roman(lesson)}`}>
      {partsOf(lesson).map((part) => {
        const state = partState(p, part);
        const here = part.id === current;
        return (
          <button key={part.id} id={`rule-row-${part.id}`} role="listitem" class={`rule-row ${state}${here ? " current" : ""}`} onClick={() => go({ page: "learn", id: part.id })}>
            <span class="rule-row-id">{part.id}</span>
            <span class="rule-row-title">
              {joinEndings(part.title)}
              {here && <span class="rule-row-now">{state === "new" ? "next to learn" : "you are here"}</span>}
            </span>
            <span class="rule-row-state">
              {state === "learned" ? (
                <span class="story-read"><Icon.check /> learned</span>
              ) : state === "practising" ? (
                <>
                  <PartDots part={part} /> <span class="ui">{partRight(p, part)}/{PART_GOAL}</span>
                </>
              ) : (
                <span class="muted ui">new</span>
              )}
            </span>
            <span class="rule-row-go" aria-hidden="true">›</span>
          </button>
        );
      })}
    </div>
  );
}

/** One of the lesson's full rules: what, how, when, with examples. */
function RuleDetail({ r }: { r: Rule }) {
  return (
    <article class="stack rule-detail">
      <h3>{r.title}</h3>
      <dl class="rule-block">
        <dt>What</dt>
        <dd><Inline text={r.what} /></dd>
        <dt>How</dt>
        <dd><Inline text={r.how} /></dd>
        <dt>When</dt>
        <dd><Inline text={r.when} /></dd>
      </dl>
      {r.examples.length > 0 && (
        <div class="well" style={{ paddingBlock: "6px" }}>
          {r.examples.map((e, i) => (
            <div key={i} class="ex-line">
              <span>
                <LatinText text={e.la} />
                <Speak text={e.la} id={`${r.id}-${i}`} />
              </span>
              <span class="muted">{e.en}</span>
            </div>
          ))}
        </div>
      )}
      {r.slavic && (
        <p class="small"><span class="eyebrow" style={{ marginRight: "8px" }}>RU · UA</span><Inline text={r.slavic} /></p>
      )}
    </article>
  );
}

/** The explanation and examples of a part (also the recap before practice). */
function Explanation({ part, compact }: { part: Part; compact?: boolean }) {
  const examples = compact ? part.examples.slice(0, 2) : part.examples;
  return (
    <div class="stack learn-explain">
      {part.explain.map((line, i) => (
        <p key={i} class="learn-line">
          <Inline text={line} />
        </p>
      ))}
      <div class="learn-examples">
        {examples.map((e, i) => (
          <div key={i} class="ex-line">
            <span>
              <LatinText text={e.la} cls="latin-lg" />
              <Speak text={e.la} id={`part-${part.id}-${i}`} />
            </span>
            <span class="muted">{e.en}</span>
          </div>
        ))}
      </div>
      {part.slavic && !compact && (
        <p class="small learn-slavic">
          <span class="eyebrow" style={{ marginRight: "8px" }}>RU · UA</span>
          <Inline text={part.slavic} />
        </p>
      )}
    </div>
  );
}

type Verdict = "right" | "partly" | "wrong" | "shown";

interface Answered {
  text: string;
  verdict: Verdict;
  feedback?: string;
}

const VERDICT: Record<Verdict, { la: string; en: string; cls: string }> = {
  right: { la: "Rēctē!", en: "That's the idea.", cls: "correct" },
  partly: { la: "Paene!", en: "Nearly there.", cls: "almost" },
  wrong: { la: "Nōndum…", en: "Not yet: read the good answer.", cls: "wrong" },
  shown: { la: "Ecce!", en: "Here is a good answer.", cls: "almost" },
};

/** A question already answered, as it stays on the page. */
function AnsweredQuestion({ q, n, a }: { q: PartQuestion; n: number; a: Answered }) {
  const v = VERDICT[a.verdict];
  return (
    <div class="panel tight stack learn-q answered" style={{ gap: "6px" }}>
      <div class="spread">
        <span class="eyebrow">Question {roman(n)}</span>
        <span class={`learn-chip ${v.cls}`}>{a.verdict === "shown" ? "answer shown" : a.verdict === "right" ? "right" : a.verdict === "partly" ? "nearly" : "not yet"}</span>
      </div>
      <p class="learn-q-text"><Inline text={q.q} /></p>
      {a.text && <p class="small ui"><span class="muted">You wrote: </span>{a.text}</p>}
      <p class="small"><span class="muted ui">A good answer: </span><Inline text={q.answer} /></p>
    </div>
  );
}

/** One open question: the learner writes, the page checks, a good answer is shown. */
function Question({ part, q, n, onNext, last, autoFocus }: { part: Part; q: PartQuestion; n: number; onNext: (a: Answered) => void; last: boolean; autoFocus: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Answered | null>(null);
  // without Claude: the learner compares their answer with a good one
  const [compare, setCompare] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  // the first question waits until the explanation is read (no keyboard popping up on a phone)
  useEffect(() => {
    if (autoFocus) box.current?.focus({ preventScroll: true });
  }, []);
  // the way forward comes into view (above a phone's tab bar) once there is a verdict or a good answer to compare with
  const compareRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!result) return;
    next.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    next.current?.focus({ preventScroll: true });
  }, [result]);
  useEffect(() => {
    if (compare !== null) compareRow.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [compare]);

  async function check() {
    const answer = text.trim();
    if (!answer || busy) return;
    if (meetsKeys(answer, q.keys)) {
      setResult({ text: answer, verdict: "right" });
      return;
    }
    setBusy(true);
    const sample = await sampler();
    if (!sample) {
      setBusy(false);
      setCompare("");
      return;
    }
    const out = await checkUnderstanding(part, q, answer);
    setBusy(false);
    if ("error" in out) setCompare(out.error);
    else setResult({ text: answer, verdict: out.verdict, feedback: out.feedback });
  }

  const v = result && VERDICT[result.verdict];
  return (
    <div class="panel stack learn-q" data-ask={`Question ${n} of rule ${part.id}`}>
      <span class="eyebrow">Question {roman(n)}</span>
      <p class="learn-q-text"><Inline text={q.q} /></p>
      <div class={`tablet${result ? " done" : ""}`}>
        <textarea
          ref={box}
          rows={2}
          value={text}
          disabled={!!result || busy}
          placeholder="In your own words: English, Russian or Ukrainian…"
          {...NO_CORRECTION}
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (result) onNext(result);
              else void check();
            }
          }}
        />
      </div>
      {!result && compare === null && (
        <div class="spread">
          <button class="linkish" onClick={() => setResult({ text: text.trim(), verdict: "shown" })} disabled={busy}>I don't know</button>
          <button class="btn" onClick={() => void check()} disabled={!text.trim() || busy}>
            {busy ? "Checking…" : "Check"}
          </button>
        </div>
      )}
      {!result && compare !== null && (
        <div class="stack" style={{ gap: "8px" }}>
          {compare && <span class="small muted ui">{compare}</span>}
          <div class="well learn-good">
            <span class="eyebrow">A good answer</span>
            <p><Inline text={q.answer} /></p>
          </div>
          <span class="ui">Did you have the same idea?</span>
          <div class="row" ref={compareRow}>
            <button class="btn" onClick={() => setResult({ text: text.trim(), verdict: "right" })}>Yes, I had it</button>
            <button class="btn ghost" onClick={() => setResult({ text: text.trim(), verdict: "wrong" })}>Not quite</button>
          </div>
        </div>
      )}
      {result && v && (
        <div class="stack" style={{ gap: "10px" }}>
          <div class={`verdict ansata ${v.cls}`} role="status">
            <span class="la">{v.la}</span>
            <span class="en">{v.en}</span>
          </div>
          {result.feedback && <p class="learn-feedback"><Inline text={result.feedback} /></p>}
          <div class="well learn-good">
            <span class="eyebrow">A good answer</span>
            <p><Inline text={q.answer} /></p>
          </div>
          <div class="spread">
            {result.verdict === "partly" || result.verdict === "wrong" ? (
              <button class="linkish" onClick={() => { setResult(null); setCompare(null); box.current?.focus(); }}>Try again</button>
            ) : (
              <span />
            )}
            <button class="btn" ref={next} onClick={() => onNext(result)}>
              {last ? "Done" : "Next question"} <Icon.arrow />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function LearnPage({ id }: { id: string }) {
  const part = PART_BY_ID.get(id);
  const p = useProgress();
  const [answers, setAnswers] = useState<Answered[]>([]);
  // a new part starts with its questions unanswered
  useEffect(() => setAnswers([]), [id]);
  const state = part ? partState(p, part) : "new";
  const finished = !!part && answers.length >= part.questions.length;
  useScreen("page", part ? `${partName(part)}: ${part.title}` : "A rule", () =>
    part
      ? [
          `Learning ${partName(part)} of Lesson ${part.lesson}, "${part.title}" (${state === "learned" ? "learned already" : state === "practising" ? "seen, being practised" : "new: the learner reads it and answers two open questions before any exercise"}).`,
          `The explanation on screen:\n${part.explain.map(plain).join("\n")}`,
          `Examples: ${part.examples.map((e) => `${plain(e.la)} = ${e.en}`).join("; ")}`,
          part.slavic ? `Russian / Ukrainian: ${plain(part.slavic)}` : "",
          ...part.questions.map((q, i) => {
            const a = answers[i];
            return `Open question ${i + 1}: ${plain(q.q)} ${a ? `The learner answered "${a.text || "(nothing)"}" (${a.verdict === "shown" ? "asked to see the answer" : a.verdict}). A good answer: ${plain(q.answer)}` : i === answers.length ? "Not answered yet: do not give the answer away unless the learner asks for it." : "Comes next."}`;
          }),
        ]
          .filter(Boolean)
          .join("\n")
      : "",
  );
  if (!part) return <p>That rule isn't here.</p>;
  const index = PARTS.indexOf(part);
  const prev = PARTS[index - 1];
  const next = PARTS[index + 1];
  const seen = state !== "new";
  const practise = () => {
    if (!seen) update((x) => markSeen(x, part.id));
    if (startSession({ kind: "part", id: part.id })) go({ page: "train" });
  };
  const answer = (a: Answered) => {
    const now = [...answers, a];
    setAnswers(now);
    // the questions are done: the rule is seen and its exercises open
    if (now.length >= part.questions.length && !seen) update((x) => markSeen(x, part.id));
  };
  return (
    <div class="stack-lg learn-page">
      <div class="stack" style={{ gap: "8px" }} data-ask={`${partName(part)}: title`}>
        <button class="linkish" style={{ alignSelf: "flex-start" }} onClick={() => backToLessons(part.lesson, `rule-row-${part.id}`)}>
          ← Lectiōnēs
        </button>
        <span class="eyebrow">
          Lectiō {roman(part.lesson)} · rule {part.id.split(".")[1]} of {partsOf(part.lesson).length}
        </span>
        <h1 class="learn-title">{joinEndings(part.title)}</h1>
        <div class="row learn-status">
          <PartsStrip lesson={part.lesson} here={part.id} />
          {state === "learned" && (
            <span class="story-read"><Laurel cls="laurel-mini" /> learned</span>
          )}
          {state === "practising" && (
            <span class="row small ui" style={{ gap: "8px" }}>
              <PartDots part={part} />
              {rightWords(p, part)}
            </span>
          )}
        </div>
        {seen && (
          <div class="row">
            <button class="btn" onClick={practise}><Icon.play /> Practise {partName(part).toLowerCase()}</button>
          </div>
        )}
      </div>

      <section class="panel frame" data-ask={`${partName(part)}: the explanation`}>
        <Explanation part={part} />
        <div class="row" style={{ marginTop: "12px" }}>
          <button
            class="btn ghost small"
            onClick={() => openAsk({ label: `${partName(part)}: ${part.title}`, detail: `${part.explain.map(plain).join(" ")} Examples: ${part.examples.map((e) => `${plain(e.la)} = ${e.en}`).join("; ")}` }, "Can you give me one more example of this rule?")}
          >
            <Icon.quill /> Ask about this rule
          </button>
        </div>
      </section>

      {rulesOfPart(part).length > 0 && (
        <details class="rule-more" data-ask={`${partName(part)}: more detail`}>
          <summary>More detail <span class="muted small ui">the lesson's full rule{rulesOfPart(part).length > 1 ? "s" : ""}, for later</span></summary>
          <div class="stack" style={{ marginTop: "12px" }}>
            {rulesOfPart(part).map((r) => <RuleDetail key={r.id} r={r} />)}
          </div>
        </details>
      )}

      <section class="stack" data-ask={`${partName(part)}: questions`}>
        <div class="stack" style={{ gap: "2px" }}>
          <span class="eyebrow">Check your understanding</span>
          <span class="small muted ui">
            {seen ? "Answer again whenever you like." : "Two short questions, then the exercises open: simple ones first, harder ones as the rule sinks in."}
          </span>
        </div>
        {part.questions.slice(0, answers.length + 1).map((q, i) =>
          answers[i] ? (
            <AnsweredQuestion key={`${part.id}-${i}-done`} q={q} n={i + 1} a={answers[i]} />
          ) : (
            <Question key={`${part.id}-${i}`} part={part} q={q} n={i + 1} last={i === part.questions.length - 1} onNext={answer} autoFocus={i > 0} />
          ),
        )}
        {finished && (
          <div class="ansata learn-done">
            <Hedera />
            <span class="stack" style={{ gap: "2px" }}>
              <span lang="la">Nunc exercē!</span>
              <span class="small ui">Now practise: simple exercises first, harder ones as the rule sinks in.</span>
            </span>
            <button class="btn big" onClick={practise}>Start practising <Icon.arrow /></button>
          </div>
        )}
      </section>

      <nav class="spread learn-nav" aria-label="Other rules">
        {prev ? (
          <button class="linkish" onClick={() => go({ page: "learn", id: prev.id })}>← {partName(prev)}: {joinEndings(prev.title)}</button>
        ) : (
          <span />
        )}
        {next && (
          <button class="linkish" onClick={() => go({ page: "learn", id: next.id })}>{partName(next)}: {joinEndings(next.title)} →</button>
        )}
      </nav>
    </div>
  );
}

/** Before practising a part on a new day: its explanation again, on one screen. */
export function PartRecap({ part, onStart }: { part: Part; onStart: () => void }) {
  const start = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => start.current?.focus(), []);
  useLayoutEffect(() => fitToWindow(panel.current, false), [part.id]);
  useScreen("page", `${partName(part)}: a reminder`, () => `Before the exercises of ${partName(part)} ("${part.title}"), the rule once more:\n${part.explain.map(plain).join("\n")}\nThe learner presses Start exercises when ready.`);
  return (
    <div class="trainer">
      <section class="panel frame rule-intro" ref={panel} data-ask={`${partName(part)}: reminder`}>
        <div class="stack rule-intro-head" style={{ gap: "4px" }}>
          <span class="eyebrow">{partName(part)} · first, a reminder</span>
          <h2>{joinEndings(part.title)}</h2>
        </div>
        <Explanation part={part} compact />
        <div class="row recap-go">
          <button class="btn big" ref={start} onClick={onStart}>
            Start exercises <Icon.arrow />
          </button>
        </div>
      </section>
    </div>
  );
}
