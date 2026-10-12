// Domus: one button. Continue always does the right next thing (a new rule to
// read, the rule in hand to practise with the day's review mixed in, or, with
// everything learned, everything at once); the day's goal beside it; and below,
// the few other things worth a tap: Answer in Latin, the next story, the friends'
// messages.
import { GROUP } from "../../content/people";
import { arrived, unreadCount, whoOf } from "../../chat/model";
import { showEmoji } from "../../chat/emoji";
import { roman } from "../../latin/text";
import { nextStep, PART_GOAL, partRight } from "../../trainer/path";
import { streak, todayDone } from "../../trainer/progress";
import { nextStory } from "../../trainer/stories";
import { Icon, Laurel, Mosaic } from "../components";
import { LatinText } from "../latin";
import { allThreads, getMeta, useMessenger } from "../messenger";
import { go } from "../nav";
import { useScreen } from "../screen";
import { useProgress } from "../store";
import { PartDots, partName } from "./learn";
import { continueLearning, startSession } from "./train";

export function Home() {
  const p = useProgress();
  const done = todayDone(p);
  const goal = p.settings.dailyGoal;
  const days = streak(p);
  const step = nextStep(p);
  const name = p.settings.me?.name;
  useScreen(
    "page",
    "Home (Domus)",
    () =>
      [
        `The home page (Domus). Today: ${done} of ${goal} exercises done; ${days > 0 ? `a ${days}-day streak` : "no streak yet"}.`,
        step.kind === "learn"
          ? `Continue opens the next rule to learn: ${partName(step.part)} of Lesson ${step.part.lesson}, "${step.part.title}" (read it, answer two questions, then practise).`
          : step.kind === "practise"
            ? `Continue practises ${partName(step.part)}, "${step.part.title}": ${partRight(p, step.part)} of ${PART_GOAL} right answers so far, ten make it learned; the day's mistakes and due words come mixed in.`
            : step.kind === "review"
              ? "Every rule of the lessons watched is learned: Continue mixes everything, with the mistakes and words that are due."
              : "No lesson is ticked as watched yet.",
        "Below: Answer in Latin, the next story, and the messages from the friends in Nūntiī.",
      ].join("\n"),
    { share: false },
  );

  return (
    <div class="stack-lg home">
      <section class="panel frame home-hero" data-ask="Continue">
        <span class="eyebrow">Salvē{name ? `, ${name}` : ""}!</span>
        {step.kind === "learn" || step.kind === "practise" ? (
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
        ) : (
          <>
            <h1 class="home-title">{step.kind === "review" ? "Every rule you watched is learned." : "Tick the lessons you have watched."}</h1>
            <p class="muted">{step.kind === "review" ? "Continue mixes everything you know, with your mistakes and words." : "Open the settings (the gear, top right) and tick them; the first rule then opens."}</p>
          </>
        )}
        <div class="home-go">
          <button id="continue" class="btn big home-continue" onClick={continueLearning} disabled={step.kind === "none"}>
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

      <section class="home-also" aria-label="Also">
        <AnswerCard />
        <StoryCard />
        <MessagesCard />
      </section>
    </div>
  );
}

/** Questions in Latin, answered in the learner's own words (Claude reads them). */
function AnswerCard() {
  return (
    <button class="panel also-card" onClick={() => startSession({ kind: "answers" }) && go({ page: "train" })}>
      <span class="also-icon"><Icon.quill /></span>
      <span class="stack also-text">
        <strong>Answer in Latin</strong>
        <span class="small muted">Questions about you and your friends, answered in your own words.</span>
      </span>
    </button>
  );
}

/** The next story of the step to read, or the shelf of stories. */
function StoryCard() {
  const p = useProgress();
  const story = nextStory(p);
  return (
    <button class="panel also-card" onClick={() => go(story ? { page: "story", id: story.id } : { page: "stories" })}>
      <span class="also-icon"><Icon.scroll /></span>
      <span class="stack also-text">
        <strong>{story ? "A story to read" : "Stories"}</strong>
        {story ? (
          <span class="small">
            <LatinText text={story.title} /> <span class="muted">· {story.en}</span>
          </span>
        ) : (
          <span class="small muted">Read one again, or wait for the next: they open as you learn.</span>
        )}
      </span>
    </button>
  );
}

/** The friends in Nūntiī: who wrote last, unread. */
function MessagesCard() {
  const now = useMessenger();
  const p = useProgress();
  const unread = allThreads()
    .map((t) => ({ t, n: unreadCount(t, now), last: arrived(t, now).at(-1) }))
    .filter((x) => x.n > 0 && x.last)
    .sort((a, b) => b.last!.at - a.last!.at);
  const total = unread.reduce((n, x) => n + x.n, 0);
  const top = unread[0];
  const from = top ? whoOf(top.last!.from, getMeta())?.name ?? "" : "";
  const where = top && top.t.id === GROUP.id ? ` in ${GROUP.name}` : "";
  return (
    <button class="panel also-card" onClick={() => go(top ? { page: "messenger", thread: top.t.id } : { page: "messenger" })}>
      <span class="also-icon"><Icon.letter /></span>
      <span class="stack also-text">
        <strong>
          {top ? `${from}${where} wrote` : "Nūntiī"}
          {total > 0 && <span class="tab-badge">{roman(total)}</span>}
        </strong>
        {top ? (
          <span class="small also-quote" lang="la">{showEmoji(top.last!.la)}</span>
        ) : (
          <span class="small muted">{p.settings.me ? "Write to your Roman friends." : "Five Roman friends who text you in Latin."}</span>
        )}
      </span>
    </button>
  );
}
