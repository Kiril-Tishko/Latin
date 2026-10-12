// The fixed Latin texts the site reads aloud, which the recorded voice reads
// (scripts/audio/record.py records them; src/audio/recorded.ts plays them): the
// videos' sentences, phrases and stories, the stories of Lectiōnēs, the rules'
// examples, the famous sayings, the open questions, and every word's headword.
// Each with its key, the Spanish respelling the voice reads, and its pack.
import { CHAT_WORD_LIST } from "../chat/words";
import { DECK_CARDS } from "../content/deck";
import { LESSONS } from "../content/lessons";
import { PARTS } from "../content/parts";
import { YOU_QUESTIONS } from "../content/questions";
import { SAYINGS } from "../content/sayings";
import { STORIES } from "../content/stories";
import { headword } from "../latin/morph";
import { audioKey } from "./key";
import { respell } from "./pronounce";
import { speakable } from "./speakable";

export interface FixedText {
  key: string;
  latin: string;
  say: string;
  /** The pack it goes in: one per lesson, the stories of each step, the rules, the words. */
  pack: string;
}

export function fixedTexts(): FixedText[] {
  const out = new Map<string, FixedText>();
  const add = (latin: string, pack: string) => {
    const key = audioKey(latin);
    if (key && !out.has(key)) out.set(key, { key, latin: speakable(latin), say: respell(speakable(latin), "es"), pack });
  };
  for (const l of LESSONS) {
    for (const s of l.sentences) add(s.la, `lesson-${l.n}`);
    for (const s of l.phrases) add(s.la, `lesson-${l.n}`);
    for (const s of l.story?.lines ?? []) add(s.la, `lesson-${l.n}`);
  }
  for (const st of STORIES) for (const line of st.lines) add(line.la, `stories-${st.step}`);
  for (const part of PARTS) for (const e of part.examples) add(e.la, "rules");
  for (const s of SAYINGS) add(s.la, "rules");
  for (const q of YOU_QUESTIONS) add(q.la, "rules");
  for (const l of LESSONS) for (const w of l.words) add(headword(w), "words");
  for (const c of DECK_CARDS) add(headword(c.entry), "words");
  for (const w of CHAT_WORD_LIST) add(headword(w), "words");
  return [...out.values()];
}

/**
 * A fingerprint of what is to be recorded and how it is said (FNV-1a of the
 * keys and respellings): the index keeps the one it was recorded with, and a
 * test says when the texts or the pronunciation have moved on.
 */
export function fingerprint(texts: FixedText[]): string {
  const s = [...texts].sort((a, b) => (a.key < b.key ? -1 : 1)).map((t) => `${t.key}\t${t.say}\t${t.pack}`).join("\n");
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(s)) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}
