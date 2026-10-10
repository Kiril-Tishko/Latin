// Text helpers shared by the engine and the answer checker.

const COMBINING_MARKS = /[̀-ͯ]/g;

/** "puellā" -> "puella". Removes macrons, breves and other accents. */
export function stripMarks(s: string): string {
  return s.normalize("NFD").replace(COMBINING_MARKS, "").normalize("NFC");
}

/**
 * Canonical spelling for comparing Latin words: lowercase, no long marks,
 * j -> i and v -> u (texts disagree on both, so neither should cost a point).
 */
export function latinKey(s: string): string {
  return stripMarks(s).toLowerCase().replace(/j/g, "i").replace(/v/g, "u");
}

/** Lowercase, no long marks, but keeps v/j as written. For display-insensitive equality. */
export function plain(s: string): string {
  return stripMarks(s).toLowerCase();
}

/** Splits a sentence into word tokens, dropping punctuation. Keeps letters with marks. */
export function words(s: string): string[] {
  return s
    .normalize("NFC")
    .replace(/[’']/g, "'")
    .split(/[^\p{L}']+/u)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter(Boolean);
}

/** Classic Levenshtein distance (small strings only). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

/** 4 -> "IV". Lesson numbers are shown the Roman way. */
export function roman(n: number): string {
  let out = "";
  for (const [v, s] of ROMAN) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}
