import { LESSONS } from "../../content/lessons";
import { SKILL_BY_ID } from "../../latin/skills";
import { roman } from "../../latin/text";
import { nextCard } from "../../trainer/discover";
import { mastery, streak, todayDone } from "../../trainer/progress";
import { dueWords } from "../../trainer/srs";
import { openAsk } from "../ask";
import { Icon, Mosaic } from "../components";
import { go } from "../nav";
import { derived, useProgress } from "../store";
import { startSession } from "./train";

export function lessonMastery(n: number, skills: Record<string, Parameters<typeof mastery>[0]>): number {
  const l = LESSONS.find((x) => x.n === n);
  if (!l || !l.skills.length) return 0;
  return l.skills.reduce((s, id) => s + mastery(skills[id]), 0) / l.skills.length;
}

export function Home() {
  const p = useProgress();
  const d = derived();
  const done = todayDone(p);
  const goal = p.settings.dailyGoal;
  const days = streak(p);
  const focus = LESSONS.find((l) => l.n === p.focusLesson);
  const known = [...d.knowledge.skills].filter((id) => SKILL_BY_ID.has(id));
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
      <section class="panel frame stack" style={{ padding: "28px" }}>
        <div class="spread" style={{ alignItems: "flex-start" }}>
          <div class="stack" style={{ gap: "6px", flex: "1 1 320px" }}>
            <span class="eyebrow">Salvē!</span>
            <h1 class="hero-title">
              {done >= goal ? "Today's goal is done." : done > 0 ? "Keep going: the endings are settling in." : `Today: make Lesson ${roman(p.focusLesson)} automatic.`}
            </h1>
            <p class="muted prose">
              {focus ? `Focus: ${focus.title}. ` : ""}
              Exercises use only what the videos taught, plus the words you open in Discover.
            </p>
          </div>
          <div class="stack" style={{ gap: "6px", minWidth: "220px", flex: "0 1 280px" }}>
            <div class="spread small ui">
              <span><strong>{Math.min(done, goal)}</strong> / {goal} today</span>
              <span class="muted">{days > 0 ? `${days}-day streak` : "Start a streak"}</span>
            </div>
            <Mosaic value={done / goal} tiles={Math.min(goal, 20)} label={`${done} of ${goal} exercises today`} />
          </div>
        </div>
        <div class="row">
          <button class="btn big" onClick={() => { startSession({ kind: "mixed" }); go({ page: "train" }); }}>
            <Icon.play /> Start practice
          </button>
          {!p.placementDone && (
            <button class="btn ghost big" onClick={() => { startSession({ kind: "placement" }); go({ page: "train" }); }}>
              3-minute check-up
            </button>
          )}
        </div>
      </section>

      <div class="grid-2">
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

        <section class="panel stack">
          <h3>Mystery card</h3>
          <p class="muted small">
            {card
              ? "A new Latin word with relatives in English, Russian or Ukrainian is waiting."
              : "You've opened every card available for now. New ones arrive with new grammar."}
            {openedNotAdded > 0 ? ` ${openedNotAdded} opened card${openedNotAdded === 1 ? " is" : "s are"} not in your dictionary yet.` : ""}
          </p>
          <div>
            <button class="btn small" onClick={() => go({ page: "discover" })}>
              <Icon.card /> {card ? "Open a card" : "See your cards"}
            </button>
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
