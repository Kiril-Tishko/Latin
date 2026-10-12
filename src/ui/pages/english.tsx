// Latin in English, one piece at a time: a short text, a small table or a
// quick question fills the screen, and Next brings the next one. What English
// took from Latin (and how it came), the learner's own words in English, Latin
// verbs and plurals inside English, grammar rules, word parts, spelling,
// grammar terms, abbreviations, phrases, and the same words in Russian and
// Ukrainian. The place reached is kept with the learner's progress.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { wordInEnglish } from "../../content/english";
import { Body, englishSteps } from "../../content/english-steps";
import { dictionaryForm } from "../../latin/morph";
import { Progress } from "../../trainer/progress";
import { Icon, Laurel } from "../components";
import { fitToWindow } from "../fit";
import { LatinText } from "../latin";
import { Inline } from "../markup";
import { go } from "../nav";
import { useScreen } from "../screen";
import { derived, getProgress, update, useProgress } from "../store";

/** Where the learner is in Latin in English, for the card on the lessons page. */
export function englishProgress(p: Progress = getProgress()): string {
  const total = englishSteps(derived().words).length;
  const at = Math.min(p.english ?? 0, total - 1);
  return at <= 0 ? `${total} short screens · start reading` : at >= total - 1 ? "read to the end · read it again" : `screen ${at + 1} of ${total} · go on reading`;
}

export function English() {
  const p = useProgress();
  const steps = useMemo(() => englishSteps(derived().words), [derived().words.length]);
  const at = Math.max(0, Math.min(p.english ?? 0, steps.length - 1));
  const step = steps[at];
  const [chosen, setChosen] = useState<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const nextBtn = useRef<HTMLButtonElement>(null);
  const goTo = (i: number) => {
    setChosen(null);
    update((x) => void (x.english = Math.max(0, Math.min(i, steps.length - 1))));
  };
  const quizOpen = step.body.kind === "quiz" && chosen === null;
  useLayoutEffect(() => fitToWindow(panel.current, false), [at, chosen]);
  useEffect(() => {
    if (!quizOpen) nextBtn.current?.focus({ preventScroll: true });
  }, [at, quizOpen]);
  // Enter or → goes on, ← goes back
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest?.("input, textarea, select, .modal, .drawer")) return;
      if ((e.key === "ArrowRight" || e.key === "Enter") && !quizOpen && at < steps.length - 1) {
        e.preventDefault();
        goTo(at + 1);
      } else if (e.key === "ArrowLeft" && at > 0) goTo(at - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [at, quizOpen]);
  useScreen("page", "Latin in English", () =>
    `Latin in English, read one screen at a time (screen ${at + 1} of ${steps.length}): ${step.part}, "${step.title}". ${
      step.body.kind === "quiz" ? `A quick question: ${step.body.q} Options: ${step.body.options.join(" / ")}.${chosen === null ? " Not answered yet." : ` The learner chose "${step.body.options[chosen]}"; the answer is "${step.body.options[step.body.answer]}".`}` : ""
    }`,
  );

  return (
    <div class="reader">
      <div class="reader-top">
        <button class="linkish" onClick={() => go({ page: "origins" })}>← Orīginēs</button>
        <div class="reader-strip" role="img" aria-label={`Screen ${at + 1} of ${steps.length}`}>
          <i style={{ width: `${((at + 1) / steps.length) * 100}%` }} />
        </div>
        <span class="small ui muted">{at + 1} / {steps.length}</span>
      </div>
      <section class="panel frame reader-card" ref={panel} data-ask={`Latin in English: ${step.title}`}>
        <span class="eyebrow">{step.part}</span>
        <h1 class="reader-title">{step.title}</h1>
        <StepBody body={step.body} chosen={chosen} onChoose={setChosen} />
      </section>
      <div class="reader-nav">
        <button class="btn ghost" onClick={() => goTo(at - 1)} disabled={at === 0}>← Back</button>
        {step.body.kind === "end" ? (
          <button class="btn big" onClick={() => goTo(0)}>Read it again</button>
        ) : (
          <button class="btn big" ref={nextBtn} onClick={() => goTo(at + 1)} disabled={quizOpen}>
            Next <Icon.arrow />
          </button>
        )}
      </div>
    </div>
  );
}

function StepBody({ body, chosen, onChoose }: { body: Body; chosen: number | null; onChoose: (i: number) => void }) {
  switch (body.kind) {
    case "text":
      return (
        <div class="reader-text">
          {body.paras.map((t, i) => <p key={i}><Inline text={t} /></p>)}
        </div>
      );
    case "list":
      return (
        <div class="stack" style={{ gap: "10px" }}>
          {body.intro && <p class="reader-intro"><Inline text={body.intro} /></p>}
          <ul class="reader-list">
            {body.items.map((t, i) => <li key={i}><Inline text={t} /></li>)}
          </ul>
        </div>
      );
    case "table":
      return (
        <div class="stack" style={{ gap: "10px" }}>
          {body.intro && <p class="reader-intro"><Inline text={body.intro} /></p>}
          <div class="table-wrap">
            <table class={`paradigm reader-table${body.head.every((h) => !h) ? " no-head" : ""}`}>
              {body.head.some(Boolean) && (
                <thead>
                  <tr>{body.head.map((h, i) => <th key={i}>{h}</th>)}</tr>
                </thead>
              )}
              <tbody>
                {body.rows.map((r, i) => (
                  <tr key={i}>{r.map((c, j) => (body.head.every((h) => !h) && j === 0 ? <th key={j}>{c}</th> : <td key={j}><Inline text={c} /></td>))}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    case "words":
      return (
        <div class="stack" style={{ gap: "10px" }}>
          {body.intro && <p class="reader-intro"><Inline text={body.intro} /></p>}
          <div class="reader-words">
            {body.entries.map((e) => {
              const rel = wordInEnglish(e.id)!;
              const slavic = [...(rel.from.ru ?? []), ...(rel.from.uk ?? [])];
              return (
                <div key={e.id} class="reader-word">
                  <span><LatinText text={dictionaryForm(e).replace(/, (m|f|n)\.$/, "")} /> <span class="muted small">{e.en}</span></span>
                  <span><strong>{rel.from.en!.join(", ")}</strong>{slavic.length ? <span class="muted small"> · {slavic.join(", ")}</span> : null}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    case "quiz":
      return (
        <div class="stack" style={{ gap: "14px" }}>
          <p class="reader-q"><Inline text={body.q} /></p>
          <div class="reader-options">
            {body.options.map((o, i) => (
              <button
                key={i}
                class={`btn ghost reader-option${chosen !== null && i === body.answer ? " right" : ""}${chosen === i && i !== body.answer ? " wrong" : ""}`}
                disabled={chosen !== null}
                onClick={() => onChoose(i)}
              >
                <Inline text={o} />
              </button>
            ))}
          </div>
          {chosen !== null && (
            <p class={`reader-verdict ${chosen === body.answer ? "right" : "wrong"}`} role="status">
              {chosen === body.answer ? "Rēctē! " : "Not quite. "}
              <Inline text={body.why ?? (chosen === body.answer ? "" : `The answer is *${body.options[body.answer]}*.`)} />
            </p>
          )}
        </div>
      );
    case "end":
      return (
        <div class="stack reader-end" style={{ gap: "12px", alignItems: "center", textAlign: "center" }}>
          <Laurel cls="laurel-big" />
          <p>You have read all of Latin in English. Every word you learn from now on shows up here too: open a word in Verba to see its English relatives.</p>
          <button class="btn ghost" onClick={() => go({ page: "words" })}>Open Verba</button>
        </div>
      );
  }
}
