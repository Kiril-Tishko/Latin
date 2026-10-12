// Reading Claude's answers and the learner's questions for words: plain
// functions, no page, so the tests can run them.

/** Just a word (or a dictionary entry such as "gladius, gladiī"), perhaps with a question mark: the learner wants its word card. */
export const bareWord = (q: string) => {
  const t = q.trim();
  return t.length <= 48 && /^[\p{L}\p{M}'’-]+(?:\s*,\s*[\p{L}\p{M}'’.-]+){0,3}\s*[?!.]?$/u.test(t);
};

/** The Latin word a word card is about: the first word of its bold headline ("gladius" from "**gladius, gladiī (m) · sword**"). */
export function cardWord(answer: string): string | null {
  const m = answer.match(/^\s*\*\*([^*]+)\*\*/);
  if (!m) return null;
  const w = m[1].split(/[·—(]/)[0].split(/[,\s]+/).find(Boolean)?.replace(/[«»]/g, "");
  return w && /^[\p{L}\p{M}]+$/u.test(w) ? w : null;
}

/** The words an answer marks as new: «timeō, timēre» (new) → timeō; «amīcī#voc.pl» (new) → amīcī. */
export function newWordsIn(answer: string): string[] {
  const words = [...answer.matchAll(/«([^»]+)»\s*\(new\b/g)].map((m) => m[1].replace(/#[\w.]+/g, "").split(/[,\s]+/)[0].replace(/[^\p{L}\p{M}]/gu, ""));
  return [...new Set(words.filter((w) => w.length > 1))];
}
