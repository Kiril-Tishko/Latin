import { useState } from "preact/hooks";
import { LESSONS } from "../content/lessons";
import { roman } from "../latin/text";
import { Icon, Modal } from "./components";
import { getSync, resetProgress, update, useProgress } from "./store";
import { updatePath } from "../trainer/path";
import { audioSupported, hasLatinVoice, latinVoices, pickVoice, speak, useVoices } from "../audio/speech";
import { recordedCount } from "../audio/recorded";
import { ModelChoice } from "../trainer/progress";
import { EFFORTS, TIERS } from "./models";
import { NO_CORRECTION } from "./keyboard";

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
              <label key={l.n} class="check ui">
                <input
                  id={`lesson-done-${l.n}`}
                  type="checkbox"
                  checked={p.lessonsDone.includes(l.n)}
                  onChange={(e) =>
                    update((x) => {
                      const on = (e.target as HTMLInputElement).checked;
                      x.lessonsDone = on ? [...new Set([...x.lessonsDone, l.n])].sort((a, b) => a - b) : x.lessonsDone.filter((n) => n !== l.n);
                      // the rules of a lesson not watched leave practice; the path goes on from the first rule not learned
                      updatePath(x);
                    })
                  }
                />
                Lesson {roman(l.n)}
              </label>
            ))}
          </div>
        </div>

        <div class="stack" style={{ gap: "6px" }}>
          <span class="eyebrow">Daily goal: exercises a day</span>
          <div class="seg">
            {[10, 20, 30, 50].map((g) => (
              <button key={g} aria-pressed={p.settings.dailyGoal === g} aria-label={`${g} exercises a day`} onClick={() => update((x) => void (x.settings.dailyGoal = g))}>{g}</button>
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

        <ClaudeSettings />

        {p.settings.me && <MessengerSettings />}

        <label class="check ui">
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

/** How the people in the messenger call the learner, and the endings of words about them. */
function MessengerSettings() {
  const p = useProgress();
  const me = p.settings.me!;
  return (
    <div class="stack" style={{ gap: "6px" }}>
      <span class="eyebrow">Nūntiī (messages)</span>
      <div class="row" style={{ gap: "8px" }}>
        <input
          id="settings-me-name"
          class="input"
          value={me.name}
          maxLength={24}
          aria-label="Your name in the messenger"
          {...NO_CORRECTION}
          onChange={(e) => {
            const name = (e.target as HTMLInputElement).value.trim();
            if (name) update((x) => void (x.settings.me = { ...me, name }));
          }}
        />
        <div class="seg" role="group" aria-label="Words about you end in">
          <button aria-pressed={me.g === "m"} onClick={() => update((x) => void (x.settings.me = { ...me, g: "m" }))}>-us (amīcus)</button>
          <button aria-pressed={me.g === "f"} onClick={() => update((x) => void (x.settings.me = { ...me, g: "f" }))}>-a (amīca)</button>
        </div>
      </div>
      <span class="small muted">Your friends in Nūntiī call you by this name; Latin words about you take these endings.</span>
    </div>
  );
}

/** The model and how hard it thinks, chosen separately for the coach and for the people in the messenger. */
function ClaudeSettings() {
  const p = useProgress();
  const row = (key: "coach" | "chat", title: string, what: string) => {
    const m: ModelChoice = p.settings[key];
    return (
      <div class="stack" style={{ gap: "6px" }}>
        <span class="ui small"><b>{title}</b> <span class="muted">· {what}</span></span>
        <div class="row" style={{ gap: "8px 14px" }}>
          <span class="row" style={{ gap: "6px", flexWrap: "nowrap" }}>
            <span class="small muted">Model</span>
            <div class="seg" role="group" aria-label={`${title}: model`}>
              {TIERS.map((t) => (
                <button key={t.tier} id={`${key}-tier-${t.tier}`} title={t.note} aria-pressed={m.tier === t.tier} onClick={() => update((x) => void (x.settings[key] = { ...x.settings[key], tier: t.tier }))}>{t.label}</button>
              ))}
            </div>
          </span>
          <span class="row" style={{ gap: "6px", flexWrap: "nowrap" }}>
            <span class="small muted">Thinking</span>
            <div class="seg" role="group" aria-label={`${title}: thinking`}>
              {EFFORTS.map((e) => (
                <button key={e.effort} id={`${key}-effort-${e.effort}`} aria-pressed={m.effort === e.effort} onClick={() => update((x) => void (x.settings[key] = { ...x.settings[key], effort: e.effort }))}>{e.label}</button>
              ))}
            </div>
          </span>
        </div>
      </div>
    );
  };
  return (
    <div class="stack" style={{ gap: "10px" }}>
      <span class="eyebrow">Claude</span>
      {row("coach", "Coach", "Ask Claude, checks, questions in Latin")}
      {row("chat", "Chats", "the people in Nūntiī")}
      <span class="small muted">
        Model: Haiku is the fastest, Sonnet is balanced, Opus is the most capable. Thinking: how long it thinks before it answers. Smarter
        and longer thinking means slower answers and more of your Claude usage. If your plan does not include a model, the nearest one answers.
      </span>
    </div>
  );
}

const SPEEDS = [
  [0.7, "Slow"],
  [0.85, "Normal"],
  [1, "Natural"],
] as const;

/** The recorded voice: on or off (the learner chose recordings, the same on every device). */
function RecordedVoice() {
  const p = useProgress();
  return (
    <div class="stack" style={{ gap: "4px" }}>
      <label class="check ui small">
        <input id="recorded" type="checkbox" checked={p.settings.recorded !== false} onChange={(e) => update((x) => void (x.settings.recorded = (e.target as HTMLInputElement).checked))} />
        Recorded voice for the lessons' sentences, the stories, the rules' examples and every word
      </label>
      <span class="small muted">
        {recordedCount} texts read once by a neural voice with the classical sounds: the same voice on every device. Everything else (new
        sentences, messages) is read by this device's voice.
      </span>
      <div>
        <button id="test-recorded" class="btn ghost small" onClick={() => void speak("Discipulus est amīcus meus.", { id: "test-recorded" })}>Hear it</button>
      </div>
    </div>
  );
}

/** How to get a better voice on each kind of device: premium, enhanced and natural voices are free and far better. */
function BetterVoice() {
  return (
    <details class="small better-voice">
      <summary class="ui">Get a better voice on this device (free)</summary>
      <ul>
        <li><strong>iPhone, iPad:</strong> Settings › Accessibility › Spoken Content › Voices › Spanish › download a voice marked Premium or Enhanced (Mónica, Paulina, Jorge…).</li>
        <li><strong>Mac:</strong> System Settings › Accessibility › Spoken Content › System voice › Manage Voices › Spanish › a Premium or Enhanced voice.</li>
        <li><strong>Android:</strong> Settings › Accessibility (or System) › Text-to-speech › Speech Services by Google › Install voice data › Spanish (Spain) › pick a voice.</li>
        <li><strong>Windows:</strong> in Microsoft Edge the Spanish "Online (Natural)" voices appear by themselves and are the best free ones; or Settings › Time &amp; language › Speech › Add voices › Spanish.</li>
      </ul>
      <p class="muted">Then reload the page: the best voice is chosen by itself (Premium first, then Enhanced, then Natural).</p>
    </details>
  );
}

function AudioSettings() {
  const p = useProgress();
  useVoices();
  if (!audioSupported()) {
    return (
      <div class="stack" style={{ gap: "6px" }}>
        <span class="eyebrow">Audio</span>
        <RecordedVoice />
        <p class="small muted">This browser cannot read other text aloud. Try Chrome, Edge or Safari.</p>
      </div>
    );
  }
  // only the voices that read Latin well: Spanish and Italian ones
  const latin = latinVoices();
  const best = pickVoice();
  return (
    <div class="stack" style={{ gap: "8px" }}>
      <span class="eyebrow">Audio</span>
      <RecordedVoice />
      <label class="stack ui small" style={{ gap: "4px" }} for="voice">
        This device's voice
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
      <label class="check ui small">
        <input id="autoplay" type="checkbox" checked={p.settings.autoplay} onChange={(e) => update((x) => void (x.settings.autoplay = (e.target as HTMLInputElement).checked))} />
        Read Latin prompts aloud as soon as they appear
      </label>
      {!hasLatinVoice() && (
        <p class="small well">
          No Spanish or Italian voice was found on this device: only the recorded texts can be heard. Add a Spanish voice (below), then reload the page.
        </p>
      )}
      <BetterVoice />
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
