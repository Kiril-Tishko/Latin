import { useState } from "preact/hooks";
import { LESSONS } from "../../content/lessons";
import { SKILL_BY_ID } from "../../latin/skills";
import { roman } from "../../latin/text";
import { nextCard } from "../../trainer/discover";
import { currentPart, lessonProgress, partState } from "../../trainer/path";
import { mastery, streak, todayDone } from "../../trainer/progress";
import { mistakesToFix } from "../../trainer/session";
import { dueWords } from "../../trainer/srs";
import { nextStory } from "../../trainer/stories";
import { videoLines } from "../../trainer/video";
import { openAsk } from "../ask";
import { CardBack, Icon, Laurel, Mosaic } from "../components";
import { LatinText } from "../latin";
import { Inline } from "../markup";
import { go } from "../nav";
import { Speak } from "../speak";
import { derived, getProgress, useProgress } from "../store";
import { useScreen } from "../screen";
import { openCardOnArrival } from "./discover";
import { PartDots, partName, PartsStrip, rightWords } from "./learn";
import { startSession } from "./train";

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

/** One short sentence a day from the videos, with only the rules learned. */
function sentenceOfTheDay() {
  const d = derived();
  const pool = videoLines(getProgress().lessonsDone, d.lexicon, d.seenKnowledge).filter((x) => /^[^.?!]+[.!]$/.test(x.la) && x.tokens.length >= 2 && x.tokens.length <= 5);
  return pool.length ? pool[Math.floor(Date.now() / 86_400_000) % pool.length] : undefined;
}

/** Sentence of the day, written on a wax tablet: one short sentence from the videos, with rules already learned. */
function HeroTablet() {
  const [english, setEnglish] = useState(false);
  const s = sentenceOfTheDay();
  if (!s) return null;
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
  const part = currentPart(p);
  const state = part ? partState(p, part) : undefined;
  // weak spots among the rules learned so far, the current part's first
  const known = [...d.seenKnowledge.skills].filter((id) => SKILL_BY_ID.has(id));
  const focusSet = new Set(part?.skills ?? []);
  const weak = known
    .sort((a, b) => mastery(p.skills[a]) - (focusSet.has(a) ? 0.15 : 0) - (mastery(p.skills[b]) - (focusSet.has(b) ? 0.15 : 0)))
    .slice(0, 4);
  const vocab = d.words.filter((w) => w.kind !== "fixed").map((w) => w.id);
  const due = dueWords(p, vocab).length;
  const card = nextCard(p.revealed, d.knowledge, new Set(d.words.map((w) => w.id)));
  const openedNotAdded = p.revealed.filter((id) => !p.added.includes(id)).length;
  const toFix = mistakesToFix(p, d.seenKnowledge).length;
  const train = (mode: Parameters<typeof startSession>[0]) => startSession(mode) && go({ page: "train" });
  useScreen("page", "Home", () => {
    const sentence = sentenceOfTheDay();
    return [
      `The home page. Today: ${done} of ${goal} exercises done; ${days > 0 ? `a ${days}-day streak` : "no streak yet"}.`,
      part ? `The rule the learner is on: ${partName(part)} of Lesson ${part.lesson}, "${part.title}" (${state === "new" ? "new: to read and answer two questions about before practising" : `in practice: ${rightWords(p, part)}, ten make it learned`}).` : "Every rule of the lessons watched is learned.",
      weak.length ? `Weak spots listed: ${weak.map((id) => `${SKILL_BY_ID.get(id)!.title} (${Math.round(mastery(p.skills[id]) * 100)}%)`).join("; ")}.` : "",
      `Words due for review: ${due}.`,
      sentence ? `Sentence of the day, on the wax tablet: ${sentence.la} (${sentence.en})` : "",
      card ? "A new mystery card is waiting." : "",
    ]
      .filter(Boolean)
      .join("\n");
  }, { share: false });

  return (
    <div class="stack-lg">
      <section class="panel frame hero">
        <div class="stack hero-text">
          <div class="stack" style={{ gap: "6px" }}>
            <span class="eyebrow">Salvē!</span>
            <h1 class="hero-title">
              {done >= goal ? "Today's goal is done." : !part ? "Every rule you watched is learned." : state === "new" ? "Today: a new rule." : done > 0 ? "Keep going: the rule is sinking in." : `Today: ${partName(part).toLowerCase()}, step by step.`}
            </h1>
            {part && (
              <p class="muted prose">
                Lesson {roman(part.lesson)} · {partName(part)}: {part.title}
                {state === "practising" ? ` · ${rightWords(p, part)}` : ""}
              </p>
            )}
            {part && state === "practising" ? <PartDots part={part} big /> : part ? <PartsStrip lesson={part.lesson} /> : null}
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
            {part && state === "new" ? (
              <button class="btn big" onClick={() => go({ page: "learn", id: part.id })}>
                <Icon.scroll /> Learn {partName(part).toLowerCase()}
              </button>
            ) : part ? (
              <button class="btn big" onClick={() => train({ kind: "part", id: part.id })}>
                <Icon.play /> Practise {partName(part).toLowerCase()}
              </button>
            ) : (
              <button class="btn big" onClick={() => train({ kind: "mixed" })}>
                <Icon.play /> Everything you've learned
              </button>
            )}
            {part && state === "practising" && <button class="linkish" onClick={() => go({ page: "learn", id: part.id })}>Read the rule again</button>}
          </div>
        </div>
        <HeroTablet />
      </section>

      <div class="grid-2 home-grid">
        <section class="panel stack">
          <div class="spread">
            <h3>Weak spots</h3>
            <span class="small muted ui">{weak.length ? "practise these next" : "none yet"}</span>
          </div>
          {!weak.length && <p class="muted small">Your weak spots show here once you have learned your first rule and practised it.</p>}
          {weak.map((id) => {
            const s = SKILL_BY_ID.get(id)!;
            return (
              <div key={id} class="spread">
                <button class="linkish" style={{ color: "var(--ink)", textAlign: "left" }} onClick={() => train({ kind: "skills", skills: [id], label: s.title })}>
                  {s.title}
                </button>
                <Mosaic value={mastery(p.skills[id])} thin label={`${Math.round(mastery(p.skills[id]) * 100)}% mastered`} />
              </div>
            );
          })}
          {(weak.length > 1 || toFix > 0) && (
            <div class="row">
              {weak.length > 1 && (
                <button class="btn ghost small" onClick={() => train({ kind: "skills", skills: weak, label: "Weak spots" })}>
                  Practise all {weak.length === 4 ? "four" : weak.length === 3 ? "three" : "two"}
                </button>
              )}
              {toFix > 0 && (
                <button class="btn small" onClick={() => train({ kind: "mistakes" })}>
                  Fix {toFix} mistake{toFix === 1 ? "" : "s"}
                </button>
              )}
            </div>
          )}
        </section>

        <section class="panel stack">
          <h3>Words</h3>
          <p class="muted small">
            {due > 0 ? `${due} word${due === 1 ? "" : "s"} ready for review.` : "Nothing due right now. Words come back just before you'd forget them."}
          </p>
          <div class="row">
            <button class="btn small" disabled={!due} onClick={() => train({ kind: "words" })}>Review words</button>
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
              <Mosaic value={lessonProgress(p, l.n)} thin label={`${Math.round(lessonProgress(p, l.n) * 100)}% of its rules learned`} />
            </div>
          ))}
          <div class="row">
            <button class="linkish" onClick={() => go({ page: "stories" })}>Short stories</button>
            <button class="linkish" onClick={() => go({ page: "english" })}>Latin in English</button>
          </div>
        </section>

        <StoryPanel />
      </div>

      <section class="row">
        <button class="btn ghost" onClick={() => openAsk(null, "Look at my progress. What should I practise today, and why?")}>
          <Icon.quill /> Ask Claude what to practise today
        </button>
      </section>
    </div>
  );
}

/** The next story of the step, to read today. */
function StoryPanel() {
  const p = useProgress();
  const story = nextStory(p);
  return (
    <section class="panel story-panel span-2" data-ask="A story to read">
      <div class="stack" style={{ gap: "4px" }}>
        <span class="eyebrow">Fābula{story ? ` · Gradus ${roman(story.step)}` : ""}</span>
        {story ? (
          <>
            <span>
              <LatinText text={story.title} cls="latin-lg" /> <span class="muted" style={{ marginLeft: "6px" }}>{story.en}</span>
            </span>
            <span class="small"><Inline text={story.notice} /></span>
          </>
        ) : (
          <span class="muted">No new story yet: stories open as you learn the rules they use. Read one again, or practise their lines.</span>
        )}
      </div>
      <div class="row">
        {story && (
          <button class="btn small" onClick={() => go({ page: "story", id: story.id })}>
            <Icon.scroll /> Read the story
          </button>
        )}
        <button class={story ? "linkish" : "btn small"} onClick={() => go({ page: "stories" })}>All stories</button>
      </div>
    </section>
  );
}
