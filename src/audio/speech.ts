// Speaking Latin with the device's own voices (Web Speech API). A Spanish
// voice reads the respelled text best (it follows the stress marks); Italian
// is the fallback.
import { useEffect, useState } from "preact/hooks";
import { respell } from "./pronounce";

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

const QUALITY = /(natural|neural|premium|enhanced|online|google|siri)/i;
/** Apple's playful and robotic voices (they come in every language): no good for Latin. */
const NOVELTY = /^(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|pipe organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical|princess|ralph|fred|junior|kathy)\b/i;

function score(v: SpeechSynthesisVoice): number {
  const lang = v.lang.toLowerCase().replace("_", "-");
  let s = lang.startsWith("es") ? 100 : lang.startsWith("it") ? 60 : 0;
  if (!s || NOVELTY.test(v.name.trim())) return 0;
  if (QUALITY.test(v.name)) s += 10;
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

/**
 * Only Latin words and plain punctuation reach the voice: reading hints go,
 * and separators (the · of a word list, slashes, arrows) become a short pause,
 * so a voice never reads them out as extra words ("punto", "barra").
 */
export function speakable(latin: string): string {
  return latin
    .replace(/#[a-z0-9]+(?:\.[a-z0-9]+)*/g, "")
    .replace(/\s*(?:[·•|/→←+=]|\.\.\.|…)\s*/g, ", ")
    .replace(/[()[\]{}«»"“”‘’*_]/g, "")
    .replace(/(?:,\s*)+/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/^[,\s]+|[,\s]+$/g, "");
}

/** What the voice will actually read for this Latin text. */
export function spokenText(latin: string, voice: SpeechSynthesisVoice | null): string {
  const lang = voice?.lang.toLowerCase() ?? "";
  const text = speakable(latin);
  if (lang.startsWith("it")) return respell(text, "it");
  if (lang.startsWith("es")) return respell(text, "es");
  return text;
}

let generation = 0;

/** Reads Latin aloud. Resolves when it ends (or is stopped); `false` when it could not play. */
export function speak(latin: string, opts: { id?: string; rate?: number } = {}): Promise<boolean> {
  if (!audioSupported()) return Promise.resolve(false);
  const voice = pickVoice(prefs.voice);
  const mine = ++generation;
  speechSynthesis.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(spokenText(latin, voice));
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else u.lang = "es-ES";
    u.rate = opts.rate ?? prefs.rate;
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
