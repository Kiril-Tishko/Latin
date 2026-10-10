import { useState } from "preact/hooks";
import { LESSONS } from "../content/lessons";
import { roman } from "../latin/text";
import { Icon, Modal } from "./components";
import { getSync, resetProgress, update, useProgress } from "./store";

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
                      if (!x.lessonsDone.includes(x.focusLesson)) x.focusLesson = Math.max(1, ...x.lessonsDone);
                    })
                  }
                />
                Lesson {roman(l.n)}
              </label>
            ))}
          </div>
        </div>

        <div class="stack" style={{ gap: "6px" }}>
          <span class="eyebrow">Focus lesson</span>
          <div class="seg">
            {p.lessonsDone.map((n) => (
              <button key={n} aria-pressed={p.focusLesson === n} onClick={() => update((x) => void (x.focusLesson = n))}>{roman(n)}</button>
            ))}
          </div>
          <span class="small muted">Mixed practice gives this lesson's rules extra weight.</span>
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
          <span class="small muted">Silly sentences ("the bull reads the letter") force you to read the endings instead of guessing.</span>
        </div>

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
