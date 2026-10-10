// The speaker button that sits next to Latin text.
import { audioSupported, hasLatinVoice, speak, stopSpeaking, useSpeaking, useVoices } from "../audio/speech";
import { Icon } from "./components";
import { getProgress } from "./store";

/** Audio is offered when the device has an Italian or Spanish voice, or the learner picked one. */
export function audioReady(): boolean {
  return audioSupported() && (hasLatinVoice() || !!getProgress().settings.voice);
}

export function Speak({ text, id, big, label = "Listen" }: { text: string; id?: string; big?: boolean; label?: string }) {
  useVoices();
  const speaking = useSpeaking();
  if (!audioReady()) return null;
  const key = id ?? text;
  const on = speaking === key;
  return (
    <button
      type="button"
      class={`speak${on ? " on" : ""}${big ? " big" : ""}`}
      aria-label={on ? "Stop" : label}
      title={on ? "Stop" : label}
      onClick={(e) => {
        e.stopPropagation();
        if (on) stopSpeaking();
        else void speak(text, { id: key });
      }}
    >
      {on ? <Icon.stop /> : <Icon.speaker />}
    </button>
  );
}
