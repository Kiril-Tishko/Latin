// Speaking Latin with the device's own voices (Web Speech API). A Spanish
// voice reads the respelled text best (it follows the stress marks); Italian
// is the fallback.
import { useEffect, useState } from "preact/hooks";
import { respell } from "./pronounce";
import { speakable } from "./speakable";
import { hasRecording, playRecorded, stopRecorded } from "./recorded";

export const audioSupported = () => typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

let voices: SpeechSynthesisVoice[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function loadVoices() {
  if (!audioSupported()) return;
  voices = speechSynthesis.getVoices();
  notify();
}

if (audioSupported()) {
  loadVoices();
  speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
  // some browsers fill the list late and never fire the event
  setTimeout(loadVoices, 600);
  setTimeout(loadVoices, 2500);
}

/** Better voices say so in their names: Apple's Premium and Enhanced, Microsoft's Natural (online), Google's. */
const QUALITY: [RegExp, number][] = [[/premium/i, 16], [/enhanced|verbessert|mejorad/i, 13], [/natural|neural|online/i, 11], [/google/i, 7], [/siri/i, 5]];
/** Apple's playful and robotic voices (they come in every language): no good for Latin. */
const NOVELTY = /^(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|pipe organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical|princess|ralph|fred|junior|kathy)\b/i;

function score(v: SpeechSynthesisVoice): number {
  const lang = v.lang.toLowerCase().replace("_", "-");
  let s = lang.startsWith("es") ? 100 : lang.startsWith("it") ? 60 : 0;
  if (!s || NOVELTY.test(v.name.trim())) return 0;
  s += QUALITY.find(([re]) => re.test(v.name))?.[1] ?? 0;
  if (lang === "es-es" || lang === "it-it") s += 2;
  return s;
}

/** The voices that can read Latin: Spanish and Italian ones, best first (no novelty voices). */
export function latinVoices(): SpeechSynthesisVoice[] {
  return voices.filter((v) => score(v) > 0).sort((a, b) => score(b) - score(a));
}

/** The chosen voice if it is one of the suitable ones, else the best of them; never a voice of another language. */
export function pickVoice(preferred?: string): SpeechSynthesisVoice | null {
  const ok = latinVoices();
  return (preferred && ok.find((x) => x.voiceURI === preferred)) || ok[0] || null;
}

/** Voices whose names say they are a man's or a woman's (Apple, Microsoft and Google name theirs). */
const MALE = /\b(jorge|juan|diego|carlos|enrique|pablo|álvaro|alvaro|raúl|raul|luca|cosimo|paolo|giorgio|andrés|andres|gonzalo|tomás|tomas|alonso|darío|dario|jordi|pau|emilio|lorenzo|alessandro|antonio|miguel|manuel|francisco|javier|sergio|roberto|marco|riccardo|giuseppe|male)\b/i;
const FEMALE = /\b(mónica|monica|paulina|marisol|laura|helena|elsa|alice|federica|paola|isabela|isabel|lucía|lucia|sabina|angélica|angelica|elvira|esperanza|dalia|carla|elena|ximena|valeria|camila|sofía|sofia|maría|maria|carmen|lola|nuria|silvia|chiara|giulia|francesca|bianca|female)\b/i;

/** A Latin voice that sounds like a man or a woman, if the device has one; else the usual voice. */
export function voiceFor(g: "m" | "f"): SpeechSynthesisVoice | null {
  const match = latinVoices().find((v) => (g === "m" ? MALE : FEMALE).test(v.name));
  return match ?? pickVoice(prefs.voice);
}

/** Whether a voice is known to be a man's or a woman's. */
const genderOf = (v: SpeechSynthesisVoice | null): "m" | "f" | undefined => (v && MALE.test(v.name) ? "m" : v && FEMALE.test(v.name) ? "f" : undefined);

/** True when a voice that can read Latin reasonably is installed. */
export function hasLatinVoice(): boolean {
  return latinVoices().length > 0;
}

export function useVoices(): SpeechSynthesisVoice[] {
  const [, setT] = useState(0);
  useEffect(() => {
    const l = () => setT((t) => t + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return voices;
}

// ---------------------------------------------------------------- speaking

export interface SpeechPrefs {
  voice?: string;
  rate: number;
  /** Play the recorded voice where a text has one (default on). */
  recorded?: boolean;
}

let prefs: SpeechPrefs = { rate: 0.85 };
export function setSpeechPrefs(p: SpeechPrefs) {
  prefs = p;
}

let speakingId: string | null = null;
const speakListeners = new Set<() => void>();
const setSpeaking = (id: string | null) => {
  speakingId = id;
  speakListeners.forEach((l) => l());
};

export function useSpeaking(): string | null {
  const [, setT] = useState(0);
  useEffect(() => {
    const l = () => setT((t) => t + 1);
    speakListeners.add(l);
    return () => void speakListeners.delete(l);
  }, []);
  return speakingId;
}

export { speakable };

/** What the voice will actually read for this Latin text. */
export function spokenText(latin: string, voice: SpeechSynthesisVoice | null): string {
  const lang = voice?.lang.toLowerCase() ?? "";
  const text = speakable(latin);
  if (lang.startsWith("it")) return respell(text, "it");
  if (lang.startsWith("es")) return respell(text, "es");
  return text;
}

let generation = 0;

type SpeakOpts = { id?: string; rate?: number; pitch?: number; g?: "m" | "f" };

/** Whether a text will be read by the recorded voice (a person's own voice in the messenger never is). */
export const recordedFor = (latin: string, opts: SpeakOpts = {}) => prefs.recorded !== false && !opts.g && opts.pitch === undefined && hasRecording(latin);

/**
 * Reads Latin aloud: the recorded voice where the text has one (the same on
 * every device), else the device's voice. Resolves when it ends (or is
 * stopped); `false` when it could not play.
 */
export function speak(latin: string, opts: SpeakOpts = {}): Promise<boolean> {
  if (recordedFor(latin, opts)) {
    const mine = ++generation;
    if (audioSupported()) speechSynthesis.cancel();
    setSpeaking(opts.id ?? latin);
    // the recordings are at a learner's pace already: the usual rate (0.85) plays them as they are
    return playRecorded(latin, (opts.rate ?? prefs.rate) / 0.85).then((ok) => {
      if (generation !== mine) return false;
      // no recording could play (no Web Audio, the pack did not load): the device's voice reads it
      if (ok === null) return speakDevice(latin, opts);
      setSpeaking(null);
      return ok;
    });
  }
  return speakDevice(latin, opts);
}

/** Reads Latin with the device's own voice. */
function speakDevice(latin: string, opts: SpeakOpts): Promise<boolean> {
  if (!audioSupported()) {
    setSpeaking(null);
    return Promise.resolve(false);
  }
  // a voice message: a man's or a woman's voice if there is one, else the pitch moved towards it
  const voice = opts.g ? voiceFor(opts.g) : pickVoice(prefs.voice);
  const mine = ++generation;
  stopRecorded();
  speechSynthesis.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(spokenText(latin, voice));
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else u.lang = "es-ES";
    u.rate = opts.rate ?? prefs.rate;
    if (opts.pitch !== undefined || opts.g) {
      const own = genderOf(voice);
      const shift = !opts.g || own === opts.g ? 1 : opts.g === "m" ? 0.75 : own === "m" ? 1.3 : 1.1;
      u.pitch = Math.max(0.1, Math.min(2, (opts.pitch ?? 1) * shift));
    }
    // an utterance cut short by another one counts as stopped, so a sequence
    // (Listen & repeat, a story) never carries on reading after a tap elsewhere
    const done = (ok: boolean) => {
      if (generation === mine) setSpeaking(null);
      resolve(ok && generation === mine);
    };
    u.onend = () => done(true);
    u.onerror = (e) => done(e.error === "interrupted" || e.error === "canceled");
    setSpeaking(opts.id ?? latin);
    // Chrome sometimes drops an utterance queued in the same tick as cancel()
    setTimeout(() => {
      if (generation === mine) speechSynthesis.speak(u);
    }, 40);
  });
}

export function stopSpeaking() {
  generation++;
  stopRecorded();
  if (audioSupported()) speechSynthesis.cancel();
  setSpeaking(null);
}

/**
 * Listen & repeat: reads each line, then waits long enough to say it back
 * (the pause in the videos). Returns a function that stops the sequence.
 */
export function speakSequence(lines: string[], opts: { repeatPause: boolean; onLine: (i: number | null) => void }): () => void {
  let stopped = false;
  const run = async () => {
    for (let i = 0; i < lines.length && !stopped; i++) {
      opts.onLine(i);
      const t0 = performance.now();
      const ok = await speak(lines[i], { id: `seq-${i}` });
      if (!ok || stopped) break;
      const spoken = performance.now() - t0;
      const mine = generation;
      await new Promise((r) => setTimeout(r, opts.repeatPause ? Math.max(1200, spoken * 1.3) : 450));
      // something else was read during the pause (a tap on one word): the sequence ends
      if (generation !== mine) break;
    }
    if (!stopped) opts.onLine(null);
  };
  void run();
  return () => {
    stopped = true;
    stopSpeaking();
    opts.onLine(null);
  };
}
