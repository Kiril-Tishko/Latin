// Orīginēs (Verba > Orīginēs): where the learner's words come from. Plain
// functions, so the page and the tests share them: the hidden links Claude has
// found (on the cards of words the learner added, and on word cards in Ask
// Claude), and each word's family in English, Russian and Ukrainian (borrowed
// from it, cousins from the same ancient root, look-alikes that are not related).
import { CARD_BY_ID, Relatives } from "../content/deck";
import { wordInEnglish } from "../content/english";
import { Entry } from "../latin/types";
import { cardWord } from "../ui/answer-words";

export interface HiddenLink {
  /** The Latin word it is about. */
  word: string;
  /** The link as Claude wrote it: «euge» → Eugene, "Євген" → "eugenics". */
  text: string;
  /** Where it was found: a word the learner added, or a word card in Ask Claude. */
  from: "own" | "ask";
  at: number;
}

interface Turn {
  role: string;
  content: string;
  at: number;
}

const LINK = /^\s*(?:[-*]\s*)?\*\*(?:Hidden link|Surprise|Surprising link|Hidden connection):?\*\*:?\s*(.+)$/im;

/**
 * Every hidden link found so far, newest first, each once: from the words the
 * learner added (their card's `link`) and from Ask Claude's word cards (the
 * "**Hidden link:**" line, the word from the card's headline or the question).
 */
export function hiddenLinks(own: { dict: string; added: number; story?: { link?: string } }[], chats: { turns: Turn[] }[]): HiddenLink[] {
  const out: HiddenLink[] = [];
  for (const w of own) {
    const text = w.story?.link?.trim();
    if (text) out.push({ word: w.dict.split(/[,\s]+/)[0], text, from: "own", at: w.added });
  }
  for (const chat of chats) {
    chat.turns.forEach((t, i) => {
      if (t.role !== "assistant") return;
      const m = t.content.match(LINK);
      if (!m) return;
      // the word: the card's headline, else the first Latin in the link, else the question
      const asked = [...chat.turns.slice(0, i)].reverse().find((x) => x.role === "user")?.content.trim() ?? "";
      const quoted = m[1].match(/«([^»#]+)/)?.[1].split(/[\s,]+/)[0];
      // (never the question's first word: "No", "Good", "Why")
      const latinIn = (x: string) => x.match(/«([^»#]+)/)?.[1].split(/[\s,]+/)[0];
      const bare = /^\s*\p{L}+\s*[?!.]?\s*$/u.test(asked) ? asked.trim().replace(/[?!.]$/, "") : undefined;
      const word = cardWord(t.content) ?? quoted ?? latinIn(asked) ?? bare ?? latinIn(t.content) ?? "";
      out.push({ word, text: m[1].trim(), from: "ask", at: t.at });
    });
  }
  const seen = new Set<string>();
  return out
    .sort((a, b) => b.at - a.at)
    .filter((l) => {
      const key = l.text.toLowerCase().replace(/[^\p{L}]/gu, "");
      return key.length > 3 && !seen.has(key) && !!seen.add(key);
    });
}

export interface Family {
  entry: Entry;
  /** Borrowed from it (directly or through French, Italian, Greek…). */
  from: Relatives;
  /** Same ancient root, not borrowed. */
  kin: Relatives;
  /** A look-alike that is not related. */
  trap?: string;
  /** The story behind it, or its hidden link. */
  note?: string;
}

const some = (r?: Relatives) => !!(r?.en?.length || r?.ru?.length || r?.uk?.length);

/** A word's family, from the lesson words' list, its mystery card, or (a word the learner added) its card from Claude. */
export function familyOf(e: Entry): Family | null {
  const lesson = wordInEnglish(e.id);
  if (lesson && (some(lesson.from) || some(lesson.kin))) return { entry: e, from: lesson.from, kin: lesson.kin ?? {}, trap: lesson.trap, note: lesson.note };
  const card = CARD_BY_ID.get(e.id);
  if (card && (some(card.from) || some(card.kin))) return { entry: e, from: card.from, kin: card.kin, note: card.hook };
  const st = e.story;
  if (st && (some(st.from) || some(st.kin))) return { entry: e, from: st.from ?? {}, kin: st.kin ?? {}, note: st.link };
  return null;
}

/** The families of these words, those with relatives only, in the order given. */
export function wordFamilies(words: Entry[]): Family[] {
  return words.map(familyOf).filter((f): f is Family => !!f);
}

/** Does a family match a search (the Latin word, its meaning, or any relative)? */
export function familyMatches(f: Family, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const all = [f.entry.en, ...(f.entry.alt ?? []), f.entry.kind === "verb" ? f.entry.pp[0] : f.entry.lemma, ...Object.values(f.from).flat(), ...Object.values(f.kin).flat(), f.trap ?? ""];
  const plain = (x: string) => x.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return all.some((x) => plain(String(x)).includes(plain(s)));
}
