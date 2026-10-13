// A story (Fābula): made only of the words of the videos, with the rules of its
// step. Read it (tap a line for its English, a word for its meaning), listen to
// it, answer two questions, then practise its lines. The list of stories is on
// the Lectiōnēs page.
import { useEffect, useMemo, useState } from "preact/hooks";
import { speakSequence } from "../../audio/speech";
import { STORIES, Story, STORY_BY_ID } from "../../content/stories";
import { seeded, shuffle } from "../../latin/generate";
import { roman } from "../../latin/text";
import { seenSkills } from "../../trainer/path";
import { partsBefore, storyOpen } from "../../trainer/stories";
import { storyRead } from "../../trainer/today";
import { Hedera, Icon, Laurel } from "../components";
import { LatinText } from "../latin";
import { Inline } from "../markup";
import { backToLessons, go } from "../nav";
import { useScreen } from "../screen";
import { audioReady, Speak } from "../speak";
import { getProgress, update, useProgress } from "../store";
import { partName } from "./learn";
import { continueLearning } from "./train";

/** One comprehension question: three answers, shuffled once per story. */
function Question({ q, seed, onRight }: { q: Story["questions"][number]; seed: number; onRight: () => void }) {
  const options = useMemo(() => shuffle(seeded(seed), q.options.map((o, i) => ({ o, right: i === 0 }))), [q, seed]);
  const [picked, setPicked] = useState<number | null>(null);
  const [tried, setTried] = useState<number[]>([]);
  const solved = picked !== null && options[picked].right;
  return (
    <div class="panel tight stack story-q" style={{ gap: "8px" }}>
      <span><Inline text={q.q} /></span>
      <div class="row" style={{ gap: "8px" }}>
        {options.map((x, i) => (
          <button
            key={i}
            class={`btn ghost small${picked === i ? (x.right ? " q-right" : " q-wrong") : ""}${tried.includes(i) && !x.right ? " q-tried" : ""}`}
            disabled={solved}
            aria-pressed={picked === i}
            onClick={() => {
              setPicked(i);
              setTried([...tried, i]);
              if (x.right) onRight();
            }}
          >
            <Inline text={x.o} />
          </button>
        ))}
      </div>
      {picked !== null && (
        <span class={`small ui ${solved ? "q-note-right" : "q-note-wrong"}`}>
          {solved ? "Rēctē! That's it." : "Not quite. Read the story again and try another answer."}
        </span>
      )}
    </div>
  );
}

export function StoryPage({ id }: { id: string }) {
  const story = STORY_BY_ID.get(id);
  const p = useProgress();
  const [showEn, setShowEn] = useState(false);
  const [open, setOpen] = useState<number[]>([]);
  const [gloss, setGloss] = useState<{ line: number; word: string; text: string } | null>(null);
  const [right, setRight] = useState<number[]>([]);
  const [playing, setPlaying] = useState<number | null>(null);
  const [stopFn, setStopFn] = useState<(() => void) | null>(null);
  useEffect(() => () => stopFn?.(), [stopFn]);
  // a new story starts closed again
  useEffect(() => {
    setShowEn(false);
    setOpen([]);
    setGloss(null);
    setRight([]);
  }, [id]);
  useScreen("page", story ? `Story: ${story.title}` : "Story", () =>
    story
      ? [
          `The story "${story.title}" (${story.en}), for step ${story.step}. Notice: ${story.notice}`,
          ...story.lines.map((l, i) => `${i + 1}. ${l.who ? `${l.who.la}: ` : ""}${l.la.replace(/#[\w.]+/g, "")} = ${l.en}`),
          `English is ${showEn ? "shown for every line" : open.length ? `shown for lines ${open.map((i) => i + 1).join(", ")}` : "hidden (the learner is reading the Latin)"}.`,
          `Questions: ${story.questions.map((q, i) => `"${q.q}" (${right.includes(i) ? "answered" : "not answered yet"})`).join("; ")}. Don't give the answers away unless asked.`,
        ].join("\n")
      : "",
  );
  if (!story) return <p>That story isn't here.</p>;
  const read = !!p.stories[story.id];
  const allRight = right.length === story.questions.length;
  const index = STORIES.indexOf(story);
  const seen = seenSkills(p);
  const practisable = storyOpen(story, seen);
  const play = () => {
    stopFn?.();
    const stop = speakSequence(story.lines.map((l) => l.la), { repeatPause: false, onLine: (line) => setPlaying(line) });
    setStopFn(() => stop);
  };
  const stopPlaying = () => {
    stopFn?.();
    setStopFn(null);
    setPlaying(null);
  };
  // read to the end (or left with Continue): Continue goes on to the next thing, and the next story waits for a round
  const markRead = () => {
    if (!getProgress().stories[story.id] && practisable)
      update((q) => {
        q.stories[story.id] = Date.now();
        storyRead(q);
      });
  };
  const toggleLine = (i: number) => setOpen(open.includes(i) ? open.filter((x) => x !== i) : [...open, i]);
  /** A tap on a word shows what it is; a tap elsewhere on the line shows its English. */
  const onLine = (i: number, e: MouseEvent) => {
    const w = (e.target as HTMLElement).closest<HTMLElement>(".w");
    if (w?.title) {
      setGloss(gloss?.line === i && gloss.word === w.textContent ? null : { line: i, word: w.textContent ?? "", text: w.title });
      return;
    }
    toggleLine(i);
  };
  return (
    <div class="stack-lg story-page">
      <div class="stack" style={{ gap: "8px" }} data-ask="Story: title">
        <button class="linkish" style={{ alignSelf: "flex-start" }} onClick={() => backToLessons(story.step, `story-row-${story.id}`)}>← Lectiōnēs</button>
        <span class="eyebrow">Fābula · Gradus {roman(story.step)}</span>
        <h1 class="story-title"><LatinText text={story.title} /></h1>
        <p class="muted story-en">{story.en}</p>
        <p class="ansata story-notice small">
          <span class="eyebrow" style={{ marginRight: "8px" }}>Notice</span>
          <Inline text={story.notice} />
        </p>
      </div>

      <section class="stack" data-ask={`Story: ${story.title}`}>
        <div class="spread">
          <span class="small ui muted">Tap a line for its English, a word for its meaning.</span>
          <div class="row">
            {audioReady() &&
              (playing !== null ? (
                <button class="btn small" onClick={stopPlaying}><Icon.stop /> Stop</button>
              ) : (
                <button class="btn ghost small" onClick={play}><Icon.speaker /> Listen</button>
              ))}
            <button class="linkish" onClick={() => { setShowEn(!showEn); setOpen([]); }}>{showEn ? "Hide English" : "Show English"}</button>
          </div>
        </div>
        <div class="panel frame story-text">
          {story.lines.map((l, i) => {
            const en = showEn || open.includes(i);
            return (
              <div key={i} class={`ex-line story-line${playing === i ? " playing" : ""}`} onClick={(e) => onLine(i, e as unknown as MouseEvent)}>
                <span>
                  {l.who && <span class="story-who" lang="la">{l.who.la}</span>}
                  <LatinText text={l.la} cls="story-la" />
                  <Speak text={l.la} id={`story-${story.id}-${i}`} />
                </span>
                {gloss?.line === i && (
                  <span class="story-gloss small ui" role="note">
                    <strong lang="la">{gloss.word}</strong> = {gloss.text}
                  </span>
                )}
                <span class="muted story-tr">{en ? `${l.who ? `${l.who.en}: ` : ""}${l.en}` : ""}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section class="stack" data-ask={`Story: ${story.title}, questions`}>
        <span class="eyebrow">Did you understand?</span>
        {story.questions.map((q, i) => (
          <Question
            key={`${story.id}-${i}`}
            q={q}
            seed={index * 31 + i}
            onRight={() => {
              const now = right.includes(i) ? right : [...right, i];
              setRight(now);
              if (now.length === story.questions.length) markRead();
            }}
          />
        ))}
        {(allRight || read) && (
          <div class="ansata story-done">
            <Laurel cls="laurel-mini" />
            <span class="stack" style={{ gap: "0" }}>
              <span lang="la">Fābula lēcta!</span>
              <span class="small ui">The story is read.</span>
            </span>
          </div>
        )}
      </section>

      <section class="row" data-ask="Story: what next">
        <button id="story-continue" class="btn big" onClick={() => { markRead(); continueLearning(); }}>
          <Icon.play /> Continue
        </button>
        {!practisable && (
          <span class="small ui muted story-locked">
            It uses rules you meet soon:{" "}
            {partsBefore(story, seen).map((x, i) => (
              <span key={x.id}>
                {i > 0 && ", "}
                <button class="linkish" onClick={() => go({ page: "learn", id: x.id })}>{partName(x).toLowerCase()} ({x.title})</button>
              </span>
            ))}
            .
          </span>
        )}
        <span class="story-mark" aria-hidden="true"><Hedera /></span>
      </section>
    </div>
  );
}
