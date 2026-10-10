// Speaking Latin with the device's own voices (Web Speech API). An Italian
// voice reads the respelled text best; Spanish is the fallback.
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
const KNOWN_IT = /(alice|federica|luca|paola|elsa|isabella|diego|giuseppe|cosimo|emma)/i;

function score(v: SpeechSynthesisVoice): number {
  const lang = v.lang.toLowerCase();
  let s = lang.startsWith("it") ? 100 : lang.startsWith("es") ? 50 : 0;
  if (!s) return 0;
  if (QUALITY.test(v.name)) s += 10;
  if (KNOWN_IT.test(v.name)) s += 3;
  if (lang === "it-it" || lang === "es-es") s += 2;
  return s;
}

/** Italian and Spanish voices, best first. */
export function latinVoices(): SpeechSynthesisVoice[] {
  return voices.filter((v) => score(v) > 0).sort((a, b) => score(b) - score(a));
}

export function allVoices(): SpeechSynthesisVoice[] {
  return voices;
}

export function pickVoice(preferred?: string): SpeechSynthesisVoice | null {
  if (preferred) {
    const v = voices.find((x) => x.voiceURI === preferred);
    if (v) return v;
  }
  return latinVoices()[0] ?? null;
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

/** What the voice will actually read for this Latin text. */
export function spokenText(latin: string, voice: SpeechSynthesisVoice | null): string {
  const lang = voice?.lang.toLowerCase() ?? "";
  if (lang.startsWith("it")) return respell(latin, "it");
  if (lang.startsWith("es")) return respell(latin, "es");
  return latin.replace(/#[a-z0-9.]+/g, "");
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
    } else u.lang = "it-IT";
    u.rate = opts.rate ?? prefs.rate;
    const done = (ok: boolean) => {
      if (generation === mine) setSpeaking(null);
      resolve(ok);
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
      await new Promise((r) => setTimeout(r, opts.repeatPause ? Math.max(1200, spoken * 1.3) : 450));
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
