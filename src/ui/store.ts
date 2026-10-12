// App state: the learner's progress (saved to the claude.ai account when
// available, and to this browser), plus derived knowledge for the engine.
import { useEffect, useState } from "preact/hooks";
import { CARD_BY_ID, DECK_CARDS } from "../content/deck";
import { CHAT_WORDS, FIXED_NAMES } from "../chat/words";
import { Lexicon } from "../latin/analyze";
import { Knowledge } from "../latin/generate";
import { Entry } from "../latin/types";
import { buildKnowledge, fullLexicon, lessonWords } from "../trainer/knowledge";
import { seenSkills } from "../trainer/path";
import { migrate, newProgress, Progress } from "../trainer/progress";
import { DocRef, progressDoc, storage } from "./platform";

const LOCAL_KEY = "tabula-latina-progress-v1";

let progress: Progress = loadLocal();
const listeners = new Set<() => void>();
let doc: DocRef | null = null;
let dirty = false;
let writing = false;
let timer: ReturnType<typeof setTimeout> | undefined;

export type SyncState = "local" | "connecting" | "synced" | "saving" | "error";
let sync: SyncState = "connecting";

function loadLocal(): Progress {
  const raw = storage.get(LOCAL_KEY);
  if (!raw) return newProgress();
  try {
    return migrate(JSON.parse(raw));
  } catch {
    return newProgress();
  }
}

function emit() {
  derivedCache = null;
  listeners.forEach((l) => l());
}

export function getProgress(): Progress {
  return progress;
}

export function getSync(): SyncState {
  return sync;
}

/** Applies a change and schedules a save. */
export function update(fn: (p: Progress) => void) {
  const next = structuredClone(progress);
  fn(next);
  next.updatedAt = Date.now();
  progress = next;
  storage.set(LOCAL_KEY, JSON.stringify(progress));
  dirty = true;
  emit();
  schedule();
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(flush, 1500);
}

function trimmed(p: Progress): Progress {
  const days = Object.keys(p.days).sort().slice(-120);
  return { ...p, days: Object.fromEntries(days.map((d) => [d, p.days[d]])), mistakes: p.mistakes.slice(0, 40) };
}

async function flush() {
  if (!doc || !dirty) return;
  if (writing) {
    schedule();
    return;
  }
  writing = true;
  dirty = false;
  sync = "saving";
  emit();
  try {
    await doc.set(trimmed(progress) as unknown as Record<string, unknown>);
    sync = "synced";
  } catch {
    sync = "error";
    dirty = true;
  } finally {
    writing = false;
    emit();
  }
}

/** Connects to the account store: the newer of the two copies wins. */
export async function connect() {
  doc = await progressDoc();
  if (!doc) {
    sync = "local";
    emit();
    return;
  }
  try {
    const snap = await doc.get();
    const remote = snap.exists ? migrate(snap.data()) : null;
    if (remote && remote.updatedAt > progress.updatedAt) {
      progress = remote;
      storage.set(LOCAL_KEY, JSON.stringify(progress));
      sync = "synced";
    } else if (progress.updatedAt > (remote?.updatedAt ?? 0)) {
      dirty = true;
      sync = "saving";
      void flush();
    } else sync = "synced";
  } catch {
    sync = "error";
  }
  emit();
}

window.addEventListener("pagehide", () => void flush());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") void flush();
});

// ------------------------------------------------------------- derived

interface Derived {
  /** Every word and rule of the lessons watched. */
  knowledge: Knowledge;
  /** Every word, but only the rules of the parts the learner has seen: what practice uses. */
  seenKnowledge: Knowledge;
  lexicon: Lexicon;
  /** Words in the learner's dictionary: lesson words plus added cards. */
  words: Entry[];
  added: Entry[];
}

let derivedCache: Derived | null = null;

export function derived(): Derived {
  if (derivedCache) return derivedCache;
  const p = progress;
  const added = p.added.map((id) => CARD_BY_ID.get(id)?.entry).filter(Boolean) as Entry[];
  derivedCache = {
    knowledge: buildKnowledge(p.lessonsDone, added, p.settings.silly),
    seenKnowledge: buildKnowledge(p.lessonsDone, added, p.settings.silly, seenSkills(p)),
    // the chat words and the messenger's names too, so they are read (and colored) everywhere
    lexicon: fullLexicon([...DECK_CARDS.map((c) => c.entry), ...CHAT_WORDS, ...FIXED_NAMES]),
    words: [...lessonWords(p.lessonsDone), ...added],
    added,
  };
  return derivedCache;
}

/** Re-renders the calling component whenever progress changes. */
export function useProgress(): Progress {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return progress;
}

export function resetProgress() {
  progress = newProgress();
  progress.updatedAt = Date.now();
  storage.set(LOCAL_KEY, JSON.stringify(progress));
  dirty = true;
  emit();
  schedule();
}
