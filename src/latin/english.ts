// Just enough English morphology to translate generated sentences and to
// accept the many ways a learner may phrase the same English answer.
import { EnVerb } from "./types";

const VOWEL = /[aeiou]/;

export function enPlural(noun: string, override?: string): string {
  if (override) return override;
  if (/(s|x|z|ch|sh)$/.test(noun)) return noun + "es";
  if (/[^aeiou]y$/.test(noun)) return noun.slice(0, -1) + "ies";
  return noun + "s";
}

export function en3s(v: EnVerb): string {
  if (v.s) return v.s;
  const b = v.base;
  if (b === "have") return "has";
  if (b === "be") return "is";
  if (b === "do") return "does";
  if (b === "go") return "goes";
  if (/(s|x|z|ch|sh|o)$/.test(b)) return b + "es";
  if (/[^aeiou]y$/.test(b)) return b.slice(0, -1) + "ies";
  return b + "s";
}

export function enIng(v: EnVerb): string {
  if (v.ing) return v.ing;
  const b = v.base;
  if (b.endsWith("ie")) return b.slice(0, -2) + "ying";
  if (b.endsWith("e") && !/(ee|ye|oe)$/.test(b)) return b.slice(0, -1) + "ing";
  // one-syllable consonant-vowel-consonant words double the last letter: run -> running
  const syll = b.match(/[aeiouy]+/g)?.length ?? 1;
  if (syll === 1 && /[^aeiou][aeiou][^aeiouwxy]$/.test(b)) return b + b.at(-1) + "ing";
  return b + "ing";
}

export function withParticle(v: EnVerb, form: string): string {
  return v.particle ? `${form} ${v.particle}` : form;
}

/** "a" or "an" for the word that follows. */
export function article(next: string): string {
  return VOWEL.test(next[0] ?? "") && !/^(uni|eu|one)/.test(next) ? "an" : "a";
}

/** Escapes a phrase for use inside a RegExp. */
export const reEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A regex alternation group of phrases, longest first. */
export function alt(options: string[]): string {
  const uniq = [...new Set(options.filter((o) => o !== undefined))].sort((a, b) => b.length - a.length);
  if (uniq.length === 1) return uniq[0];
  return `(?:${uniq.join("|")})`;
}

const CONTRACTIONS: [RegExp, string][] = [
  [/\bcan't\b/g, "cannot"],
  [/\bwon't\b/g, "will not"],
  [/\b(\w+)n't\b/g, "$1 not"],
  [/\bi'm\b/g, "i am"],
  [/\byou're\b/g, "you are"],
  [/\bthey're\b/g, "they are"],
  [/\bwe're\b/g, "we are"],
  [/\b(he|she|it|that|there|who)'s\b/g, "$1 is"],
];

/** Lowercase, no punctuation (apostrophes kept), contractions expanded, single spaces. */
export function normalizeEnglish(s: string): string {
  let t = s.toLowerCase().replace(/[’‘`]/g, "'");
  for (const [re, rep] of CONTRACTIONS) t = t.replace(re, rep);
  t = t.replace(/can not/g, "cannot");
  return t
    .replace(/[^a-z' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
