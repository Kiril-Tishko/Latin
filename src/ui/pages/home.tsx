// Domus: one button. Continue always does the right next thing (todayStep: a
// new rule to read, the rule in hand to practise with the day's review mixed
// in, a story that has opened, the words that are due, or, with everything
// learned, everything at once), and the card says which; the day's goal beside it.
import { roman } from "../../latin/text";
import { PART_GOAL, partRight } from "../../trainer/path";
import { Progress, streak, todayDone } from "../../trainer/progress";
import { todayStep, TodayStep } from "../../trainer/today";
import { Icon, Laurel, Mosaic } from "../components";
import { LatinText } from "../latin";
import { NextLesson } from "../next-lesson";
import { actaUnread, todaysBoard, useMessenger } from "../messenger";
import { useScreen } from "../screen";
import { useProgress } from "../store";
import { PartDots, partName } from "./learn";
import { continueLearning, roundInProgress, vocabIds } from "./train";

/** What Continue does next, in a few words: "rule 3.2 (new)", "a new story", "your words". */
export function stepLabel(step: TodayStep): string {
  switch (step.kind) {
    case "learn":
      return `${partName(step.part).toLowerCase()} (new)`;
    case "practise":
      return partName(step.part).toLowerCase();
    case "story":
      return "a new story";
    case "acta":
      return "today's news";
    case "words":
      return "your words";
    case "review":
      return "everything you know";
    default:
      return "";
  }
}

/** What Continue will do, in a line for Claude. */
function stepText(p: Progress, step: TodayStep): string {
  switch (step.kind) {
    case "learn":
      return `Continue opens the next rule to learn: ${partName(step.part)} of Lesson ${step.part.lesson}, "${step.part.title}" (read it, answer two questions, then practise).`;
    case "practise":
      return `Continue practises ${partName(step.part)}, "${step.part.title}": ${partRight(p, step.part)} of ${PART_GOAL} right answers so far, ten make it learned; the day's mistakes and due words come mixed in.`;
    case "story":
      return `Continue opens a story that has just opened: "${step.story.title}" (${step.story.en}).`;
    case "acta":
      return "Continue opens today's Ācta Diurna, Rome's daily board of news written in the learner's words (in Nūntiī).";
    case "words":
      return `Continue gives a short round of the words that are due (${step.due} due).`;
    case "review":
      return "Every rule of the lessons watched is learned: Continue mixes everything, with the mistakes and words that are due.";
    default:
      return "No lesson is ticked as watched yet.";
  }
}

export function Home() {
  const p = useProgress();
  const done = todayDone(p);
  const goal = p.settings.dailyGoal;
  const days = streak(p);
  useMessenger();
  const step = todayStep(p, vocabIds(), Date.now(), actaUnread());
  const round = roundInProgress();
  const name = p.settings.me?.name;
  useScreen("page", "Home (Domus)", () => `The home page (Domus): one Continue button. Today: ${done} of ${goal} exercises done; ${days > 0 ? `a ${days}-day streak` : "no streak yet"}.\n${stepText(p, step)}`, { share: false });

  return (
    <div class="stack-lg home">
      <section class="panel frame home-hero" data-ask="Continue">
        <span class="eyebrow">Salvē{name ? `, ${name}` : ""}!</span>
        {round ? <RoundCard {...round} /> : <StepCard step={step} />}
        <div class="home-go">
          <button id="continue" class="btn big home-continue" onClick={continueLearning} disabled={step.kind === "none" && !round}>
            <Icon.play /> Continue
          </button>
          <div class="home-goal stack" aria-label={`${done} of ${goal} exercises today`}>
            <div class="spread small ui">
              <span>
                <strong>{Math.min(done, goal)}</strong> / {goal} today
              </span>
              <span class="muted streak">
                {days > 0 && <Laurel cls="laurel-mini" />}
                {days > 0 ? `${days} day${days === 1 ? "" : "s"} in a row` : "start a streak"}
              </span>
            </div>
            <Mosaic value={done / goal} tiles={Math.min(goal, 20)} label={`${done} of ${goal} exercises today`} />
          </div>
        </div>
      </section>
      {step.kind === "review" && <NextLesson note="Watch it, tick it here, and Continue opens its first rule." />}
      {step.kind === "none" && <NextLesson />}
    </div>
  );
}

/** A round left half-way: Continue picks it up where it was. */
function RoundCard({ label, done, total }: { label: string; done: number; total: number }) {
  return (
    <>
      <span class="home-step ui">Your round · {done + 1} / {total}</span>
      <h1 class="home-title">{label}</h1>
      <p class="muted">Continue where you left off.</p>
    </>
  );
}

/** What Continue will do next, as the card's title. */
function StepCard({ step }: { step: TodayStep }) {
  const p = useProgress();
  switch (step.kind) {
    case "learn":
    case "practise":
      return (
        <>
          <span class="home-step ui">
            Lesson {roman(step.part.lesson)} · {partName(step.part)}
            {step.kind === "learn" && <span class="chip home-new">new</span>}
          </span>
          <h1 class="home-title">{step.part.title}</h1>
          {step.kind === "practise" ? (
            <div class="row home-dots">
              <PartDots part={step.part} big />
              <span class="ui small">
                <strong>{partRight(p, step.part)}</strong> of {PART_GOAL} right
              </span>
            </div>
          ) : (
            <p class="muted">Read it, answer two short questions, then practise.</p>
          )}
        </>
      );
    case "story":
      return (
        <>
          <span class="home-step ui">
            Fābula · a story <span class="chip home-new">new</span>
          </span>
          <h1 class="home-title"><LatinText text={step.story.title} /></h1>
          <p class="muted">{step.story.en}. Only words and rules you know.</p>
        </>
      );
    case "acta":
      return (
        <>
          <span class="home-step ui">
            Ācta Diurna · today's news <span class="chip home-new">new</span>
          </span>
          <h1 class="home-title"><LatinText text={todaysBoard()[0]?.title?.la || "Ācta Diurna"} /></h1>
          <p class="muted">Rome's daily board, in your words: the day, the city, your friends, a notice from the walls.</p>
        </>
      );
    case "words":
      return (
        <>
          <span class="home-step ui">Verba</span>
          <h1 class="home-title">Your words</h1>
          <p class="muted">{step.due} to review: a short round, then back to the rule.</p>
        </>
      );
    case "review":
      return (
        <>
          <h1 class="home-title">Every rule you watched is learned.</h1>
          <p class="muted">Continue mixes everything you know, with your mistakes and words.</p>
        </>
      );
    default:
      return (
        <>
          <h1 class="home-title">Watch Lesson I first.</h1>
          <p class="muted">Then tap "I have watched it" below: its first rule opens here.</p>
        </>
      );
  }
}
