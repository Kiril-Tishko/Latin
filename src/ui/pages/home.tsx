import { useState } from "preact/hooks";
import { LESSONS } from "../../content/lessons";
import { SKILL_BY_ID } from "../../latin/skills";
import { roman } from "../../latin/text";
import { nextCard } from "../../trainer/discover";
import { mastery, streak, todayDone } from "../../trainer/progress";
import { readiness } from "../../trainer/session";
import { dueWords } from "../../trainer/srs";
import { openAsk } from "../ask";
import { CardBack, Icon, Laurel, Mosaic } from "../components";
import { LatinText } from "../latin";
import { go } from "../nav";
import { Speak } from "../speak";
import { derived, useProgress } from "../store";
import { openCardOnArrival } from "./discover";
import { startSession } from "./train";

export function lessonMastery(n: number, skills: Record<string, Parameters<typeof mastery>[0]>): number {
  const l = LESSONS.find((x) => x.n === n);
  if (!l || !l.skills.length) return 0;
  return l.skills.reduce((s, id) => s + mastery(skills[id]), 0) / l.skills.length;
}

/** A bronze stylus: pointed for writing, flat at the other end for smoothing the wax. */
function Stylus() {
  return (
    <svg class="stylus" viewBox="0 0 240 20" aria-hidden="true">
      <defs>
        <linearGradient id="bronze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f0d590" />
          <stop offset="0.45" stop-color="#b98a3a" />
          <stop offset="1" stop-color="#6a4a17" />
        </linearGradient>
      </defs>
      <path d="M2 4.5 L22 6.5 L22 13.5 L2 15.5 Q0 10 2 4.5 Z" fill="url(#bronze)" />
      <rect x="22" y="7.2" width="8" height="5.6" rx="1.5" fill="url(#bronze)" />
      <path d="M30 8.2 L212 8.8 L238 10 L212 11.2 L30 11.8 Z" fill="url(#bronze)" />
      <rect x="44" y="7.4" width="3" height="5.2" rx="1" fill="#6a4a17" opacity="0.55" />
      <rect x="196" y="7.9" width="3" height="4.2" rx="1" fill="#6a4a17" opacity="0.55" />
    </svg>
  );
}

/** Sentence of the day, written on a wax tablet: one short sentence from the current step or before. */
function HeroTablet({ lessons }: { lessons: number[] }) {
  const [english, setEnglish] = useState(false);
  const pool = LESSONS.filter((l) => lessons.includes(l.n))
    .flatMap((l) => l.sentences)
    .filter((x) => /^[^.?!]+\.$/.test(x.la) && x.la.split(" ").length >= 2 && x.la.split(" ").length <= 5);
  if (!pool.length) return null;
  const s = pool[Math.floor(Date.now() / 86_400_000) % pool.length];
  return (
    <figure class="hero-art">
      <div class="wax-tablet">
        <span class="hinge" />
        <span class="hinge" />
        <div class="wax">
          <span class="wax-label">Sententia diēī</span>
          <p class="wax-text">
            <LatinText text={s.la} />
          </p>
        </div>
      </div>
      <Stylus />
      <figcaption class="row">
        <Speak text={s.la} id="sentence-of-the-day" />
        {english ? <span class="muted small">{s.en}</span> : <button class="linkish" onClick={() => setEnglish(true)}>Translate</button>}
      </figcaption>
    </figure>
  );
}

export function Home() {
  const p = useProgress();
  const d = derived();
  const done = todayDone(p);
  const goal = p.settings.dailyGoal;
  const days = streak(p);
  const focus = LESSONS.find((l) => l.n === p.focusLesson);
  const ready = readiness(p, p.focusLesson);
  // weak spots among the rules of the current step and the ones before it
  const known = [...d.stepKnowledge.skills].filter((id) => SKILL_BY_ID.has(id));
  const focusSet = new Set(focus?.skills ?? []);
  const weak = known
    .sort((a, b) => mastery(p.skills[a]) - (focusSet.has(a) ? 0.15 : 0) - (mastery(p.skills[b]) - (focusSet.has(b) ? 0.15 : 0)))
    .slice(0, 4);
  const vocab = d.words.filter((w) => w.kind !== "fixed").map((w) => w.id);
  const due = dueWords(p, vocab).length;
  const card = nextCard(p.revealed, d.knowledge, new Set(d.words.map((w) => w.id)));
  const openedNotAdded = p.revealed.filter((id) => !p.added.includes(id)).length;

  return (
    <div class="stack-lg">
      <section class="panel frame hero">
        <div class="stack hero-text">
          <div class="stack" style={{ gap: "6px" }}>
            <span class="eyebrow">Salvē!</span>
            <h1 class="hero-title">
              {done >= goal ? "Today's goal is done." : done > 0 ? "Keep going: the endings are settling in." : `Today: Lesson ${roman(p.focusLesson)}, step by step.`}
            </h1>
            {focus && (
              <p class="muted prose">
                Step {roman(p.focusLesson)}: {focus.title} · {Math.round(ready.value * 100)}% ready for the next step
              </p>
            )}
          </div>
          <div class="stack" style={{ gap: "6px", maxWidth: "360px" }}>
            <div class="spread small ui">
              <span><strong>{Math.min(done, goal)}</strong> / {goal} today</span>
              <span class="muted streak">
                {days > 0 && <Laurel cls="laurel-mini" />}
                {days > 0 ? `${days}-day streak` : "Start a streak"}
              </span>
            </div>
            <Mosaic value={done / goal} tiles={Math.min(goal, 20)} label={`${done} of ${goal} exercises today`} />
          </div>
        <div class="row">
          <button class="btn big" onClick={() => { startSession({ kind: "step" }); go({ page: "train" }); }}>
            <Icon.play /> Practise Lesson {roman(p.focusLesson)}
          </button>
          {!p.placementDone && (
            <button class="btn ghost big" onClick={() => { startSession({ kind: "placement" }); go({ page: "train" }); }}>
              3-minute check-up
            </button>
          )}
        </div>
        </div>
        <HeroTablet lessons={p.lessonsDone.filter((n) => n <= p.focusLesson)} />
      </section>

      <div class="grid-2 home-grid">
        <section class="panel stack">
          <div class="spread">
            <h3>Weak spots</h3>
            <span class="small muted ui">practise these next</span>
          </div>
          {weak.map((id) => {
            const s = SKILL_BY_ID.get(id)!;
            return (
              <div key={id} class="spread">
                <button class="linkish" style={{ color: "var(--ink)", textAlign: "left" }} onClick={() => { startSession({ kind: "skills", skills: [id], label: s.title }); go({ page: "train" }); }}>
                  {s.title}
                </button>
                <Mosaic value={mastery(p.skills[id])} thin label={`${Math.round(mastery(p.skills[id]) * 100)}% mastered`} />
              </div>
            );
          })}
          <div>
            <button class="btn ghost small" onClick={() => { startSession({ kind: "skills", skills: weak, label: "Weak spots" }); go({ page: "train" }); }}>
              Practise all four
            </button>
          </div>
        </section>

        <section class="panel stack">
          <h3>Words</h3>
          <p class="muted small">
            {due > 0 ? `${due} word${due === 1 ? "" : "s"} ready for review.` : "Nothing due right now. Words come back just before you'd forget them."}
          </p>
          <div class="row">
            <button class="btn small" disabled={!due} onClick={() => { startSession({ kind: "words" }); go({ page: "train" }); }}>Review words</button>
            <button class="btn ghost small" onClick={() => go({ page: "words" })}>My dictionary ({d.words.filter((w) => w.kind !== "fixed").length})</button>
          </div>
        </section>

        <section class="panel mystery-panel">
          <button
            class="mini-card"
            onClick={() => {
              if (card) openCardOnArrival(card.id);
              go({ page: "discover" });
            }}
            aria-label={card ? "Open a mystery card" : "See your cards"}
          >
            <CardBack />
          </button>
          <div class="stack" style={{ gap: "10px" }}>
            <h3>Mystery card</h3>
            <p class="muted small">
              {card
                ? "A new Latin word with relatives in English, Russian or Ukrainian is waiting."
                : "You've opened every card available for now. New ones arrive with new grammar."}
              {openedNotAdded > 0 ? ` ${openedNotAdded} opened card${openedNotAdded === 1 ? " is" : "s are"} not in your dictionary yet.` : ""}
            </p>
            <div class="row">
              <button
                class="btn small"
                onClick={() => {
                  if (card) openCardOnArrival(card.id);
                  go({ page: "discover" });
                }}
              >
                <Icon.card /> {card ? "Open a card" : "See your cards"}
              </button>
              {card && <button class="linkish" onClick={() => go({ page: "discover" })}>All cards</button>}
            </div>
          </div>
        </section>

        <section class="panel stack">
          <h3>Lessons</h3>
          {LESSONS.filter((l) => p.lessonsDone.includes(l.n)).map((l) => (
            <div key={l.n} class="spread">
              <button class="linkish" style={{ color: "var(--ink)", textAlign: "left" }} onClick={() => go({ page: "lesson", n: l.n })}>
                <span class="numeral" style={{ marginRight: "8px" }}>{roman(l.n)}</span>
                {l.title}
              </button>
              <Mosaic value={lessonMastery(l.n, p.skills)} thin />
            </div>
          ))}
        </section>
      </div>

      <section class="row">
        <button class="btn ghost" onClick={() => openAsk(null, "Look at my progress. What should I practise today, and why?")}>
          <Icon.quill /> Ask Claude what to practise today
        </button>
      </section>
    </div>
  );
}
