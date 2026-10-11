import { useEffect, useState } from "preact/hooks";
import { speakSequence } from "../../audio/speech";
import { audioReady, Speak } from "../speak";
import { Lesson, LESSONS, LESSON_BY_N, Rule, videoUrl } from "../../content/lessons";
import { STORIES } from "../../content/stories";
import { dictionaryForm, headword } from "../../latin/morph";
import { roman } from "../../latin/text";
import { nextCard } from "../../trainer/discover";
import { lessonProgress, PART_GOAL, partRight, partState, seenSkills } from "../../trainer/path";
import { storyOpen } from "../../trainer/stories";
import { Part, partsOf } from "../../content/parts";
import { openAsk } from "../ask";
import { Hedera, Icon, Modal, Mosaic } from "../components";
import { LatinText } from "../latin";
import { Inline } from "../markup";
import { go } from "../nav";
import { derived, useProgress } from "../store";
import { useScreen } from "../screen";
import { CardView } from "./discover";
import { PartDots, partName, PartsStrip } from "./learn";
import { startSession } from "./train";

export function Lessons() {
  const p = useProgress();
  useScreen("page", "Lessons", () =>
    `The list of lessons: ${LESSONS.map((l) => `${l.n}. ${l.title} (${p.lessonsDone.includes(l.n) ? `watched, ${partsOf(l.n).filter((x) => partState(p, x) === "learned").length} of ${partsOf(l.n).length} rules learned` : "not watched yet"})`).join("; ")}.`,
  );
  return (
    <div class="stack-lg">
      <div class="stack">
        {LESSONS.map((l) => {
          const done = p.lessonsDone.includes(l.n);
          return (
            <button key={l.n} class="panel lesson-card" onClick={() => go({ page: "lesson", n: l.n })}>
              <span class="numeral">{roman(l.n)}</span>
              <div class="stack" style={{ gap: "6px" }}>
                <div class="spread">
                  <h2 style={{ fontSize: "1.3rem" }}>{l.title}</h2>
                  {done ? <Mosaic value={lessonProgress(p, l.n)} thin label={`${Math.round(lessonProgress(p, l.n) * 100)}% of its rules learned`} /> : <span class="chip">not watched yet</span>}
                </div>
                <p class="muted small">{l.summary}</p>
                <span class="small ui muted">
                  {l.words.length} words · {partsOf(l.n).length} rules{done ? `, ${partsOf(l.n).filter((x) => partState(p, x) === "learned").length} learned` : ""} · {l.minutes} min video
                </span>
              </div>
            </button>
          );
        })}
        <button class="panel lesson-card" onClick={() => go({ page: "stories" })}>
          <span class="numeral" aria-hidden="true"><Icon.scroll /></span>
          <div class="stack" style={{ gap: "6px" }}>
            <div class="spread">
              <h2 style={{ fontSize: "1.3rem" }}>Fābulae: short stories</h2>
              <span class="chip">{STORIES.filter((s) => storyOpen(s, seenSkills(p)) && !p.stories[s.id]).length} to read</span>
            </div>
            <p class="muted small">Stories made only of the words from the videos. Each opens when you have learned its rules: read, listen, answer, practise.</p>
            <span class="small ui muted">{STORIES.length} stories, three for each step.</span>
          </div>
        </button>
        <button class="panel lesson-card" onClick={() => go({ page: "english" })}>
          <span class="numeral" aria-hidden="true"><Hedera /></span>
          <div class="stack" style={{ gap: "6px" }}>
            <div class="spread">
              <h2 style={{ fontSize: "1.3rem" }}>Latin in English</h2>
              <span class="chip">extra</span>
            </div>
            <p class="muted small">What English took from Latin: your words in English, Latin verbs and plurals hiding in it, grammar rules, abbreviations, and the same words in Russian and Ukrainian.</p>
            <span class="small ui muted">Read it, then practise finding the Latin inside English words.</span>
          </div>
        </button>
      </div>
    </div>
  );
}

function RuleView({ r }: { r: Rule }) {
  const lesson = LESSONS.find((l) => l.rules.includes(r))?.n;
  const seen = seenSkills(useProgress());
  // a rule is practised once its parts are learned; before that, its first part is the way in
  const firstNew = r.skills.some((s) => !seen.has(s)) ? partsOf(lesson ?? 0).find((x) => x.skills.some((s) => r.skills.includes(s) && !seen.has(s))) : undefined;
  return (
    <article class="panel stack" id={r.id} data-ask={`Rule${lesson ? ` of Lesson ${roman(lesson)}` : ""}: ${r.title}`}>
      <div class="spread">
        <h3>{r.title}</h3>
        <div class="row" style={{ gap: "6px" }}>
          {r.skills.length > 0 &&
            (firstNew ? (
              <button class="btn ghost small" onClick={() => go({ page: "learn", id: firstNew.id })} title={`${partName(firstNew)}: ${firstNew.title}`}>
                <Icon.scroll /> Learn it
              </button>
            ) : (
              <button class="btn ghost small" onClick={() => startSession({ kind: "skills", skills: r.skills, label: r.title }) && go({ page: "train" })}>
                <Icon.stylus /> Practise
              </button>
            ))}
          <button class="btn ghost small" aria-label={`Ask Claude about: ${r.title}`} onClick={() => openAsk({ label: `Rule: ${r.title}`, detail: `What: ${r.what} How: ${r.how} When: ${r.when}` }, "Explain this rule simply, with two short examples.")}>
            <Icon.quill />
          </button>
        </div>
      </div>
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
        <p class="small"><span class="eyebrow" style={{ marginRight: "8px" }}>RU · UA</span>{r.slavic}</p>
      )}
    </article>
  );
}

export { RuleView };

/** One part of a lesson's rules: its state, and the way on (learn it, or practise it). */
function PartRow({ part }: { part: Part }) {
  const p = useProgress();
  const state = partState(p, part);
  return (
    <div class={`part-row ${state}`}>
      <button class="linkish part-row-title" onClick={() => go({ page: "learn", id: part.id })}>
        <span class="part-row-id">{part.id}</span> {part.title}
      </button>
      <span class="part-row-state small ui">
        {state === "learned" ? (
          <span class="story-read">learned</span>
        ) : state === "practising" ? (
          <span class="row" style={{ gap: "6px" }}><PartDots part={part} /> {partRight(p, part)}/{PART_GOAL}</span>
        ) : (
          <span class="muted">new</span>
        )}
      </span>
      {state === "new" ? (
        <button class="btn small" onClick={() => go({ page: "learn", id: part.id })}>Learn</button>
      ) : (
        <button class="btn ghost small" onClick={() => startSession({ kind: "part", id: part.id }) && go({ page: "train" })}>Practise</button>
      )}
    </div>
  );
}

export function LessonPage({ n }: { n: number }) {
  const l = LESSON_BY_N.get(n);
  const p = useProgress();
  const [showEn, setShowEn] = useState(true);
  const [card, setCard] = useState(false);
  const [playing, setPlaying] = useState<{ part: "sentences" | "story"; line: number | null } | null>(null);
  const [stopFn, setStopFn] = useState<(() => void) | null>(null);
  useEffect(() => () => stopFn?.(), [stopFn]);
  useScreen("page", `Lesson ${roman(n)}`, () =>
    l
      ? [
          `The page of Lesson ${l.n}, "${l.title}"${p.lessonsDone.includes(l.n) ? "" : " (not watched yet)"}. ${l.summary}`,
          `The page, top to bottom: the rules one at a time (${partsOf(l.n).map((x) => `${x.id} ${x.title}: ${partState(p, x)}`).join("; ")}); the rules in full (${l.rules.map((r) => r.title).join("; ")}); ${l.sentences.length} sentences from the video; ${l.story ? `the story "${l.story.title}" (${l.story.lines.length} lines); ` : ""}${l.phrases.length ? `${l.phrases.length} famous phrases; ` : ""}${l.words.length} new words${l.fixes.length ? "; differences from the video" : ""}.`,
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
  const d = derived();
  const next = nextCard(p.revealed, d.knowledge, new Set(d.words.map((w) => w.id)));
  return (
    <div class="stack-lg">
      <div class="stack" style={{ gap: "8px" }} data-ask={`Lesson ${roman(l.n)}: introduction`}>
        <button class="linkish" style={{ alignSelf: "flex-start" }} onClick={() => go({ page: "lessons" })}>← All lessons</button>
        <span class="eyebrow">Lectiō {roman(l.n)}</span>
        <h1>{l.title}</h1>
        <p class="muted prose dropcap">{l.summary}</p>
        <div class="row small ui">
          <a href={videoUrl(l.videoId)} target="_blank" rel="noopener">▶ Watch the video</a>
          <a href={videoUrl(l.newVideoId)} target="_blank" rel="noopener">▶ 2025 re-recording</a>
          {p.lessonsDone.includes(l.n) && <PartsStrip lesson={l.n} />}
        </div>
        <div class="row">
          {partsOf(l.n).some((x) => partState(p, x) !== "new") ? (
            <button class="btn" onClick={() => startSession({ kind: "lesson", n: l.n }) && go({ page: "train" })}>
              <Icon.play /> Practise this lesson
            </button>
          ) : (
            <button class="btn" onClick={() => go({ page: "learn", id: `${l.n}.1` })}>
              <Icon.scroll /> Learn its first rule
            </button>
          )}
          <button class="btn ghost" onClick={() => setCard(true)} disabled={!next}>
            <Icon.card /> Show one more word
          </button>
        </div>
      </div>

      <section class="stack" data-ask={`Lesson ${roman(l.n)}: the rules, one at a time`}>
        <div class="stack" style={{ gap: "2px" }}>
          <span class="eyebrow">The rules, one at a time</span>
          <span class="small muted ui">Each rule: a short explanation, two questions, then exercises from simple to harder.</span>
        </div>
        <div class="panel parts-list">
          {partsOf(l.n).map((x) => <PartRow key={x.id} part={x} />)}
        </div>
      </section>

      <section class="stack">
        <span class="eyebrow">The rules in full</span>
        {l.rules.map((r) => <RuleView key={r.id} r={r} />)}
      </section>

      <section class="stack" data-ask="Sentences from the video">
        <div class="spread">
          <span class="eyebrow">Sentences from the video</span>
          <div class="row">
            <button class="btn ghost small" onClick={() => startSession({ kind: "video", n: l.n }) && go({ page: "train" })} title="Practise these sentences: choose, build, write">
              <Icon.stylus /> Practise them
            </button>
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

      <section class="stack" data-ask="New words of the lesson">
        <span class="eyebrow">New words</span>
        <div class="grid-3">
          {l.words.map((w) => (
            <div key={w.id} class="panel tight stack" style={{ gap: "2px" }}>
              <span>
                <LatinText text={dictionaryForm(w).replace(/, (m|f|n)\.$/, "")} />
                <Speak text={headword(w)} id={`w-${w.id}`} />
              </span>
              <span class="small muted">
                {w.kind === "noun" ? `${w.gender === "m" ? "masculine" : w.gender === "f" ? "feminine" : "neuter"} · ` : ""}
                {w.en}
              </span>
            </div>
          ))}
        </div>
      </section>

      {l.fixes.length > 0 && (
        <section class="stack" data-ask="Differences from the video">
          <span class="eyebrow">Differences from the video</span>
          {l.fixes.map((f, i) => <p key={i} class="small"><Inline text={f} /></p>)}
        </section>
      )}

      {card && next && (
        <Modal onClose={() => setCard(false)} label="One more word" screen={`Mystery card: ${dictionaryForm(next.entry)}`} wide>
          <CardView card={next} onDone={() => setCard(false)} onClose={() => setCard(false)} />
        </Modal>
      )}
    </div>
  );
}

export type { Lesson };
