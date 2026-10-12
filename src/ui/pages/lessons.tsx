import { useEffect, useState } from "preact/hooks";
import { speakSequence } from "../../audio/speech";
import { audioReady, Speak } from "../speak";
import { Lesson, LESSONS, LESSON_BY_N, videoUrl } from "../../content/lessons";
import { STORIES } from "../../content/stories";
import { roman } from "../../latin/text";
import { partState, seenSkills } from "../../trainer/path";
import { todayStep } from "../../trainer/today";
import { storyOpen } from "../../trainer/stories";
import { partsOf } from "../../content/parts";
import { CaseChip, Hedera, Icon } from "../components";
import { LatinText } from "../latin";
import { Inline } from "../markup";
import { go } from "../nav";
import { derived, useProgress } from "../store";
import { useScreen } from "../screen";
import { NounTable, VerbTable } from "../tables";
import { englishProgress } from "./english";
import { RuleList } from "./learn";
import { continueLearning, vocabIds } from "./train";
import { stepLabel } from "./home";

/**
 * Lectiōnēs: the whole path on one page. Each lesson watched with its rules,
 * one line each (a tap opens the rule), and its short stories; then Latin in
 * English, and the endings at a glance for looking things up.
 */
export function Lessons({ focus }: { focus?: "stories" }) {
  const p = useProgress();
  const seen = seenSkills(p);
  const watched = LESSONS.filter((l) => p.lessonsDone.includes(l.n));
  const later = LESSONS.filter((l) => !p.lessonsDone.includes(l.n));
  const step = todayStep(p, vocabIds());
  // #stories: the lesson in hand, with its stories
  useEffect(() => {
    if (focus) document.getElementById(`lesson-block-${p.focusLesson}`)?.scrollIntoView({ block: "start" });
  }, [focus]);
  useScreen("page", "Lessons", () =>
    [
      "The Lectiōnēs page: every rule of the lessons watched, one line each, grouped by lesson with the lesson's short stories under its rules (a tap opens the rule or the story; the line under a lesson opens its page with the video's sentences and story); then Latin in English, and the endings at a glance.",
      ...watched.map((l) => `Lesson ${l.n} (${l.title}): ${partsOf(l.n).map((x) => `${x.id} ${x.title} (${partState(p, x)})`).join("; ")}`),
      `Stories: ${STORIES.map((s) => `"${s.title}"${p.stories[s.id] ? " (read)" : storyOpen(s, seen) ? " (open)" : " (not open yet)"}`).join(", ")}.`,
    ].join("\n"),
  );
  return (
    <div class="stack-lg lessons-page">
      <div class="stack" style={{ gap: "8px" }}>
        <span class="eyebrow">Lectiōnēs</span>
        <h1>Your path</h1>
        <p class="muted">Every rule of the lessons you watched, in order, with their stories. Continue takes you through them.</p>
        {step.kind !== "none" && (
          <div class="row">
            <button class="btn" onClick={continueLearning}>
              <Icon.play /> Continue: {stepLabel(step)}
            </button>
          </div>
        )}
      </div>

      {watched.map((l) => {
        const parts = partsOf(l.n);
        const learned = parts.filter((x) => partState(p, x) === "learned").length;
        const stories = STORIES.filter((x) => x.step === l.n);
        // a lesson learned folds into one line; the one in hand stays open
        return (
          <details key={l.n} id={`lesson-block-${l.n}`} class="lesson-block" open={learned < parts.length} data-ask={`Lesson ${roman(l.n)}: its rules and stories`}>
            <summary class="lesson-head">
              <span class="numeral">{roman(l.n)}</span>
              <span class="lesson-head-title">{l.title}</span>
              <span class="lesson-head-state small ui">
                {learned === parts.length ? <span class="story-read"><Icon.check /> all learned</span> : `${learned} of ${parts.length} learned`}
              </span>
            </summary>
            <div class="stack" style={{ gap: "6px" }}>
              <div class="panel rule-list-panel">
                <RuleList lesson={l.n} />
              </div>
              {stories.length > 0 && (
                <div class="panel rule-list-panel lesson-stories">
                  {stories.map((x) => <StoryRow key={x.id} id={x.id} />)}
                </div>
              )}
              <button class="linkish small lesson-page-link" onClick={() => go({ page: "lesson", n: l.n })}>
                Lesson {roman(l.n)}: the video's sentences and story ›
              </button>
            </div>
          </details>
        );
      })}
      {later.length > 0 && (
        <p class="small muted">
          Not watched yet: {later.map((l) => `${roman(l.n)} ${l.title}`).join(" · ")}. Tick a lesson under Settings when you have watched it.
        </p>
      )}


      <button class="panel lesson-card english-card" onClick={() => go({ page: "english" })}>
        <span class="numeral" aria-hidden="true"><Hedera /></span>
        <span class="stack" style={{ gap: "4px" }}>
          <h2 style={{ fontSize: "1.25rem" }}>Latin in English</h2>
          <span class="muted small">What English took from Latin, a short piece at a time, with a quick question now and then.</span>
          <span class="small ui">{englishProgress()}</span>
        </span>
      </button>

      <details class="rule-more" data-ask="Endings at a glance">
        <summary>Endings at a glance <span class="muted small ui">nouns and verbs; a ? is a form of a rule not learned yet</span></summary>
        <div class="stack" style={{ marginTop: "12px" }}>
          <NounTable k={derived().seenKnowledge} />
          <VerbTable k={derived().seenKnowledge} />
          <div class="row color-key small ui">
            <span>Colors:</span>
            <CaseChip c="nom" label="subject" />
            <CaseChip c="acc" label="object" />
            <CaseChip c="gen" label="of / 's" />
            <CaseChip c="abl" label="in / at" />
            <CaseChip c="verb" label="who does it" />
            <span>An underline marks a plural.</span>
          </div>
        </div>
      </details>
    </div>
  );
}

/** One story on the list: its lesson, title and English, and whether it is read, new or for later. */
function StoryRow({ id }: { id: string }) {
  const p = useProgress();
  const x = STORIES.find((s) => s.id === id)!;
  const open = storyOpen(x, seenSkills(p));
  const read = !!p.stories[x.id];
  return (
    <button class={`rule-row story-row${open ? "" : " locked"}`} onClick={() => go({ page: "story", id: x.id })}>
      <span class="rule-row-id" aria-hidden="true"><Icon.scroll /></span>
      <span class="rule-row-title">
        <LatinText text={x.title} /> <span class="muted small">{x.en}</span>
      </span>
      <span class="rule-row-state">
        {read ? <span class="story-read"><Icon.check /> read</span> : open ? <span class="chip">new</span> : <span class="muted ui small">later</span>}
      </span>
      <span class="rule-row-go" aria-hidden="true">›</span>
    </button>
  );
}

export function LessonPage({ n }: { n: number }) {
  const l = LESSON_BY_N.get(n);
  const p = useProgress();
  const [showEn, setShowEn] = useState(true);
  const [playing, setPlaying] = useState<{ part: "sentences" | "story"; line: number | null } | null>(null);
  const [stopFn, setStopFn] = useState<(() => void) | null>(null);
  useEffect(() => () => stopFn?.(), [stopFn]);
  useScreen("page", `Lesson ${roman(n)}`, () =>
    l
      ? [
          `The page of Lesson ${l.n}, "${l.title}"${p.lessonsDone.includes(l.n) ? "" : " (not watched yet)"}. ${l.summary}`,
          `The page, top to bottom: ${l.sentences.length} sentences from the video; ${l.story ? `the story "${l.story.title}" (${l.story.lines.length} lines); ` : ""}${l.phrases.length ? `${l.phrases.length} famous phrases` : ""}${l.fixes.length ? "; differences from the video" : ""}. Its rules are on the Lectiōnēs page (${partsOf(l.n).map((x) => `${x.id} ${x.title}: ${partState(p, x)}`).join("; ")}); its words on Verba.`,
          `English translations of the sentences are ${showEn ? "shown" : "hidden"}.`,
        ].join("\n")
      : "",
  );
  const play = (part: "sentences" | "story", lines: string[], repeat: boolean) => {
    stopFn?.();
    const stop = speakSequence(lines, {
      repeatPause: repeat,
      onLine: (line) => setPlaying(line === null ? null : { part, line }),
    });
    setStopFn(() => stop);
  };
  const stopPlaying = () => {
    stopFn?.();
    setStopFn(null);
    setPlaying(null);
  };
  if (!l) return <p>That lesson isn't here yet.</p>;
  return (
    <div class="stack-lg">
      <div class="stack" style={{ gap: "8px" }} data-ask={`Lesson ${roman(l.n)}: introduction`}>
        <button class="linkish" style={{ alignSelf: "flex-start" }} onClick={() => go({ page: "lessons" })}>← Lectiōnēs</button>
        <span class="eyebrow">Lectiō {roman(l.n)}</span>
        <h1>{l.title}</h1>
        <p class="muted prose dropcap">{l.summary}</p>
        <div class="row small ui">
          <a href={videoUrl(l.videoId)} target="_blank" rel="noopener">▶ Watch the video</a>
          <a href={videoUrl(l.newVideoId)} target="_blank" rel="noopener">▶ 2025 re-recording</a>
        </div>
      </div>


      <section class="stack" data-ask="Sentences from the video">
        <div class="spread">
          <span class="eyebrow">Sentences from the video</span>
          <div class="row">
            {audioReady() &&
              (playing?.part === "sentences" ? (
                <button class="btn small" onClick={stopPlaying}><Icon.stop /> Stop</button>
              ) : (
                <button class="btn ghost small" onClick={() => play("sentences", l.sentences.map((x) => x.la), true)} title="Each sentence is read, then there is a pause to say it back">
                  <Icon.repeat /> Listen &amp; repeat
                </button>
              ))}
            <button class="linkish" onClick={() => setShowEn(!showEn)}>{showEn ? "Hide English" : "Show English"}</button>
          </div>
        </div>
        <div class="panel" style={{ paddingBlock: "8px" }}>
          {l.sentences.map((s, i) => (
            <div key={i} class={`ex-line${playing?.part === "sentences" && playing.line === i ? " playing" : ""}`}>
              <span>
                <LatinText text={s.la} />
                <Speak text={s.la} id={`l${l.n}-s${i}`} />
              </span>
              <span class="muted">
                {showEn ? s.en : ""}
                {s.note && showEn ? <span class="small" style={{ display: "block" }}><Inline text={s.note} /></span> : null}
              </span>
            </div>
          ))}
        </div>
      </section>

      {l.story && (
        <section class="stack" data-ask={`Story: ${l.story.title}`}>
          <div class="spread">
            <span class="eyebrow">Story · {l.story.title}</span>
            {audioReady() &&
              (playing?.part === "story" ? (
                <button class="btn small" onClick={stopPlaying}><Icon.stop /> Stop</button>
              ) : (
                <button class="btn ghost small" onClick={() => play("story", l.story!.lines.map((x) => x.la), false)}>
                  <Icon.speaker /> Listen to the story
                </button>
              ))}
          </div>
          <div class="panel frame" style={{ paddingBlock: "8px" }}>
            {l.story.lines.map((s, i) => (
              <div key={i} class={`ex-line${playing?.part === "story" && playing.line === i ? " playing" : ""}`}>
                <span>
                  <LatinText text={s.la} />
                  <Speak text={s.la} id={`l${l.n}-st${i}`} />
                  {s.unverified && <> <span class="flag-unverified" title="Rebuilt from the narration; the exact wording in the video may differ.">check</span></>}
                </span>
                <span class="muted">{showEn ? s.en : ""}</span>
              </div>
            ))}
          </div>
          {l.story.lines.some((s) => s.unverified) && (
            <p class="small muted ui">Lines marked "check" were rebuilt from the narration, because the video reads the story without captions. Compare them with the video.</p>
          )}
        </section>
      )}

      {l.phrases.length > 0 && (
        <section class="stack" data-ask="Famous phrases">
          <span class="eyebrow">Famous phrases</span>
          <div class="grid-2">
            {l.phrases.map((ph, i) => (
              <div key={i} class="panel tight stack" style={{ gap: "4px" }}>
                <span>
                  <LatinText text={ph.la} cls="latin-lg" />
                  <Speak text={ph.la} id={`l${l.n}-p${i}`} />
                </span>
                <span>{ph.en}</span>
                {ph.note && <span class="small muted">{ph.note}</span>}
              </div>
            ))}
          </div>
        </section>
      )}


      {l.fixes.length > 0 && (
        <section class="stack" data-ask="Differences from the video">
          <span class="eyebrow">Differences from the video</span>
          {l.fixes.map((f, i) => <p key={i} class="small"><Inline text={f} /></p>)}
        </section>
      )}

    </div>
  );
}

export type { Lesson };
