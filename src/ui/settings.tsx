import { useState } from "preact/hooks";
import { LESSONS } from "../content/lessons";
import { roman } from "../latin/text";
import { Icon, Modal } from "./components";
import { getSync, resetProgress, update, useProgress } from "./store";
import { audioSupported, hasLatinVoice, latinVoices, pickVoice, speak, useVoices } from "../audio/speech";

export function Settings({ onClose }: { onClose: () => void }) {
  const p = useProgress();
  const [confirmReset, setConfirmReset] = useState(false);
  const sync = getSync();
  return (
    <Modal onClose={onClose} label="Settings">
      <div class="stack">
        <div class="spread">
          <h2>Settings</h2>
          <button class="btn ghost small" onClick={onClose} aria-label="Close"><Icon.close /></button>
        </div>

        <div class="stack" style={{ gap: "6px" }}>
          <span class="eyebrow">Lessons watched</span>
          <div class="row">
            {LESSONS.map((l) => (
              <label key={l.n} class="row ui" style={{ gap: "6px" }}>
                <input
                  id={`lesson-done-${l.n}`}
                  type="checkbox"
                  checked={p.lessonsDone.includes(l.n)}
                  onChange={(e) =>
                    update((x) => {
                      const on = (e.target as HTMLInputElement).checked;
                      x.lessonsDone = on ? [...new Set([...x.lessonsDone, l.n])].sort() : x.lessonsDone.filter((n) => n !== l.n);
                      // the step moves to the nearest watched lesson below it (or the first one)
                      if (!x.lessonsDone.includes(x.focusLesson)) {
                        const below = x.lessonsDone.filter((n) => n < x.focusLesson);
                        x.focusLesson = below.length ? Math.max(...below) : x.lessonsDone.length ? Math.min(...x.lessonsDone) : 1;
                      }
                    })
                  }
                />
                Lesson {roman(l.n)}
              </label>
            ))}
          </div>
        </div>

        <div class="stack" style={{ gap: "6px" }}>
          <span class="eyebrow">Step</span>
          <div class="seg">
            {p.lessonsDone.map((n) => (
              <button key={n} aria-pressed={p.focusLesson === n} onClick={() => update((x) => void (x.focusLesson = n))}>Lesson {roman(n)}</button>
            ))}
          </div>
          <span class="small muted">Practice uses every word you know but only the rules up to this lesson, and concentrates on this lesson.</span>
        </div>

        <div class="stack" style={{ gap: "6px" }}>
          <span class="eyebrow">Daily goal</span>
          <div class="seg">
            {[10, 20, 30, 50].map((g) => (
              <button key={g} aria-pressed={p.settings.dailyGoal === g} onClick={() => update((x) => void (x.settings.dailyGoal = g))}>{g} exercises</button>
            ))}
          </div>
        </div>

        <div class="stack" style={{ gap: "6px" }}>
          <span class="eyebrow">Practice sentences</span>
          <div class="seg">
            {([
              [0, "Sensible"],
              [0.35, "Some silly"],
              [0.8, "Anything goes"],
            ] as const).map(([v, label]) => (
              <button key={label} aria-pressed={Math.abs(p.settings.silly - v) < 0.01} onClick={() => update((x) => void (x.settings.silly = v))}>{label}</button>
            ))}
          </div>
          <span class="small muted">Sensible is the default. Silly sentences ("the bull reads the letter") make you read the endings instead of guessing, but they can be confusing.</span>
        </div>

        <AudioSettings />

        <label class="row ui">
          <input id="macrons" type="checkbox" checked={p.settings.macrons} onChange={(e) => update((x) => void (x.settings.macrons = (e.target as HTMLInputElement).checked))} />
          Show long vowels (ā, ē, ī, ō, ū), as in the videos
        </label>

        <hr class="divider" />
        <p class="small muted ui">
          {sync === "synced" || sync === "saving"
            ? "Progress is saved to your claude.ai account and syncs between your devices."
            : sync === "local"
              ? "Progress is saved in this browser only. Open the page on claude.ai, signed in, to keep it in your account."
              : sync === "error"
                ? "Saving to your account failed; progress is kept in this browser and will be retried."
                : "Connecting to your account…"}
        </p>
        {!confirmReset ? (
          <button class="linkish" style={{ alignSelf: "flex-start" }} onClick={() => setConfirmReset(true)}>Reset all progress…</button>
        ) : (
          <div class="well row">
            <span class="ui small">Erase all progress, words and streaks?</span>
            <button class="btn small" style={{ background: "var(--bad)", borderColor: "var(--bad)" }} onClick={() => { resetProgress(); setConfirmReset(false); }}>Erase</button>
            <button class="btn ghost small" onClick={() => setConfirmReset(false)}>Keep</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

const SPEEDS = [
  [0.7, "Slow"],
  [0.85, "Normal"],
  [1, "Natural"],
] as const;

function AudioSettings() {
  const p = useProgress();
  useVoices();
  if (!audioSupported()) {
    return (
      <div class="stack" style={{ gap: "6px" }}>
        <span class="eyebrow">Audio</span>
        <p class="small muted">This browser cannot read text aloud. Try Chrome, Edge or Safari.</p>
      </div>
    );
  }
  // only the voices that read Latin well: Spanish and Italian ones
  const latin = latinVoices();
  const best = pickVoice();
  return (
    <div class="stack" style={{ gap: "8px" }}>
      <span class="eyebrow">Audio</span>
      <label class="stack ui small" style={{ gap: "4px" }} for="voice">
        Voice
        <select
          id="voice"
          class="select"
          value={latin.some((v) => v.voiceURI === p.settings.voice) ? p.settings.voice : ""}
          onChange={(e) => update((x) => void (x.settings.voice = (e.target as HTMLSelectElement).value || undefined))}
        >
          <option value="">Best available{best ? ` (${best.name})` : ""}</option>
          {latin.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} · {voiceLang(v.lang)}</option>)}
        </select>
        <span class="muted">Only Spanish and Italian voices are listed: they read Latin with classical sounds.</span>
      </label>
      <div class="row">
        <div class="seg" role="group" aria-label="Speed">
          {SPEEDS.map(([rate, label]) => (
            <button key={label} aria-pressed={Math.abs(p.settings.rate - rate) < 0.01} onClick={() => update((x) => void (x.settings.rate = rate))}>{label}</button>
          ))}
        </div>
        <button class="btn ghost small" onClick={() => void speak("Salvē! Puella in silvā ambulat et agricola aquam portat.", { id: "test" })}>Test the voice</button>
      </div>
      <label class="row ui small">
        <input id="autoplay" type="checkbox" checked={p.settings.autoplay} onChange={(e) => update((x) => void (x.settings.autoplay = (e.target as HTMLInputElement).checked))} />
        Read Latin prompts aloud as soon as they appear
      </label>
      {!hasLatinVoice() && (
        <p class="small well">
          No Spanish or Italian voice was found on this device, so audio buttons are hidden. Add a Spanish voice, then reload the page.
          iPhone / iPad: Settings › Accessibility › Spoken Content › Voices › Spanish. Mac: System Settings › Accessibility › Spoken Content ›
          System voice › Manage Voices › Spanish. Windows: Settings › Time &amp; language › Speech › Add voices › Spanish. Android: Settings ›
          Text-to-speech › Google › install Spanish.
        </p>
      )}
      <p class="small muted">
        Latin is read by a Spanish voice with the classical rules applied: hard c and g, v as w, ae as "eye", and the Latin stress. An
        Italian voice works too but guesses the stress. It is close to the videos' pronunciation, not identical.
      </p>
    </div>
  );
}

/** "es-MX" → "Spanish (Mexico)". */
function voiceLang(tag: string): string {
  try {
    const [lang, region] = tag.replace("_", "-").split("-");
    const names = new Intl.DisplayNames(["en"], { type: "language" });
    const regions = new Intl.DisplayNames(["en"], { type: "region" });
    return region ? `${names.of(lang)} (${regions.of(region.toUpperCase())})` : names.of(lang) ?? tag;
  } catch {
    return tag;
  }
}
