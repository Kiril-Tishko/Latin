// The recorded voice, as the learner chose: the fixed Latin texts (the videos'
// sentences and stories, the stories of Lectiōnēs, the rules' examples, the
// sayings, the open questions and every word) read once by a neural voice with
// the classical respelling (scripts/audio/record.py), so they sound the same on
// every device. The clips sit in a few packs beside the page, loaded the first
// time one is needed (a pack is a small script, loaded the way the page's own
// code is) and played with Web Audio. Anything else is read by the device's voice.
import INDEX from "./recorded-index.json";
import { audioKey } from "./key";

type Clip = [pack: string, startMs: number, lengthMs: number];
const clips = INDEX.clips as unknown as Record<string, Clip>;
const packs = INDEX.packs as Record<string, string>;

declare global {
  interface Window {
    __tabulaAudio?: Record<string, string>;
    webkitAudioContext?: typeof AudioContext;
  }
}

/** Whether this Latin text has a recording. */
export const hasRecording = (latin: string) => audioKey(latin) in clips;

let ctx: AudioContext | null = null;
function audioContext(): AudioContext | null {
  if (ctx) return ctx;
  const AC = typeof window !== "undefined" ? window.AudioContext ?? window.webkitAudioContext : undefined;
  if (!AC) return null;
  // an iPhone mutes Web Audio with its silent switch (the device's speech plays on): play it like media
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = "playback";
  ctx = new AC();
  return ctx;
}

/** The audio running, or false when it would not start (then the device's voice reads instead). */
function running(ac: AudioContext): Promise<boolean> {
  if (ac.state === "running") return Promise.resolve(true);
  return Promise.race([ac.resume().then(() => (ac.state as string) === "running", () => false), new Promise<boolean>((r) => setTimeout(() => r(false), 600))]);
}

const buffers = new Map<string, Promise<AudioBuffer>>();

/** A pack's audio, decoded (once; a failed load is tried again next time). */
function loadPack(pack: string, ac: AudioContext): Promise<AudioBuffer> {
  const have = buffers.get(pack);
  if (have) return have;
  const p = new Promise<string>((resolve, reject) => {
    const ready = window.__tabulaAudio?.[pack];
    if (ready) return resolve(ready);
    const s = document.createElement("script");
    s.src = `audio/${packs[pack]}`;
    s.onload = () => (window.__tabulaAudio?.[pack] ? resolve(window.__tabulaAudio[pack]) : reject(new Error("empty pack")));
    s.onerror = () => reject(new Error(`no pack ${pack}`));
    document.head.appendChild(s);
  }).then((b64) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    // the callback form: older Safari has no promise from decodeAudioData
    return new Promise<AudioBuffer>((res, rej) => void ac.decodeAudioData(bytes.buffer, res, rej));
  });
  buffers.set(pack, p);
  p.catch(() => buffers.delete(pack));
  return p;
}

let current: AudioBufferSourceNode | null = null;
let generation = 0;

/**
 * Plays the recording of a Latin text. Resolves true when it played to the
 * end, false when it was stopped, and null when there is no recording or it
 * could not play (then the device's voice reads it). Call it from a tap: the
 * audio is unlocked before anything is awaited.
 */
export function playRecorded(latin: string, rate = 1): Promise<boolean | null> {
  const clip = clips[audioKey(latin)];
  const ac = clip ? audioContext() : null;
  if (!clip || !ac) return Promise.resolve(null);
  // still inside the tap: phones allow sound only from a gesture
  const ok = running(ac);
  stopRecorded();
  const mine = generation;
  return Promise.all([loadPack(clip[0], ac), ok]).then(
    ([buf, on]) =>
      new Promise<boolean | null>((resolve) => {
        if (mine !== generation) return resolve(false);
        if (!on) return resolve(null);
        const src = ac.createBufferSource();
        src.buffer = buf;
        // the voice is already at a learner's pace; slower or faster only a little (it changes the pitch)
        const speed = Math.max(0.8, Math.min(1.2, rate));
        src.playbackRate.value = speed;
        src.connect(ac.destination);
        const length = clip[2] / 1000 + 0.08;
        let settled = false;
        const end = (v: boolean | null) => {
          if (settled) return;
          settled = true;
          clearTimeout(guard);
          if (current === src) current = null;
          resolve(v);
        };
        src.onended = () => end(mine === generation);
        // an end that never comes (a sleeping tab) does not hold up Listen & repeat
        const guard = setTimeout(() => end(mine === generation), (length / speed) * 1000 + 1500);
        current = src;
        try {
          src.start(0, Math.max(0, clip[1] / 1000 - 0.03), length);
        } catch {
          end(null);
        }
      }),
    () => null,
  );
}

/** Stops a recording that is playing. */
export function stopRecorded() {
  generation++;
  const src = current;
  current = null;
  try {
    src?.stop();
  } catch {
    /* already ended */
  }
}

/** The name of the recorded voice, for Settings. */
export const recordedVoice = INDEX.voice;
/** How many texts are recorded. */
export const recordedCount = Object.keys(clips).length;
