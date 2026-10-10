// Classical Latin through a modern voice. Browsers have no Latin voice, so the
// text is respelled for a Spanish (or Italian) voice in a way that keeps the
// classical sounds the videos teach: c and g always hard, v as w, ae as "eye".
// Spanish spelling marks stress with an acute accent anywhere in a word, so a
// Spanish voice gets the Latin stress exactly. Italian voices spell out an
// accent in the middle of a word ("i accento grave"), so Italian gets no marks.

const LONG = /[āēīōūȳ]/;
const VOWEL = /[aeiouyāēīōūȳ]/;
const STOP_LIQUID = /^(p|b|t|d|c|g|f)(r|l)$/; // pr, tr, cl…: usually leave the syllable short

export interface Syllable {
  /** Letters of the nucleus (one vowel or a diphthong). */
  nucleus: string;
  start: number;
  end: number;
  long: boolean;
}

/** Vowel nuclei of a Latin word (lowercase, with long marks). */
export function nuclei(word: string): Syllable[] {
  const w = word.toLowerCase();
  const out: Syllable[] = [];
  let i = 0;
  while (i < w.length) {
    const ch = w[i];
    const prev = w[i - 1] ?? "";
    const next = w[i + 1] ?? "";
    const isVowel = VOWEL.test(ch);
    // consonantal i (iam, Iuppiter) and u (after q, in ngu + vowel)
    const consonantalI = ch === "i" && i === 0 && VOWEL.test(next);
    const consonantalU = ch === "u" && (prev === "q" || (prev === "g" && w[i - 2] === "n")) && VOWEL.test(next);
    if (!isVowel || consonantalI || consonantalU) {
      i++;
      continue;
    }
    const pair = ch + next;
    if (pair === "ae" || pair === "oe" || pair === "au" || (pair === "eu" && i === 0)) {
      out.push({ nucleus: pair, start: i, end: i + 2, long: true });
      i += 2;
      continue;
    }
    out.push({ nucleus: ch, start: i, end: i + 1, long: LONG.test(ch) });
    i++;
  }
  // long by position: two consonants (x and z count double) before the next vowel
  for (let k = 0; k < out.length - 1; k++) {
    if (out[k].long) continue;
    const between = w
      .slice(out[k].end, out[k + 1].start)
      .replace(/qu$/, "q")
      .replace(/(ch|ph|th|rh)/g, (m) => m[0]);
    if (/[xz]/.test(between)) out[k].long = true;
    else if (between.length >= 2 && !STOP_LIQUID.test(between)) out[k].long = true;
  }
  return out;
}

/** Index of the stressed nucleus: penult if long, else antepenult; two syllables: the first. */
export function stressIndex(word: string): number | null {
  const n = nuclei(word);
  if (n.length < 2) return null;
  if (n.length === 2) return 0;
  return n[n.length - 2].long ? n.length - 2 : n.length - 3;
}

const ACUTE: Record<string, string> = { a: "á", e: "é", i: "í", o: "ó", u: "ú" };
const PLAIN: Record<string, string> = { ā: "a", ē: "e", ī: "i", ō: "o", ū: "u", ȳ: "i", y: "i" };

type Target = "it" | "es";

/** One Latin word respelled for a Spanish or Italian voice. */
export function respellWord(word: string, target: Target): string {
  const lower = word.toLowerCase();
  const stress = target === "es" ? stressIndex(lower) : null;
  const syl = nuclei(lower);
  // 1. letters (with the stress for Spanish), macrons dropped; diphthongs from
  //    the syllable analysis (po-ē-ta is not "oe")
  const byStart = new Map(syl.map((x, idx) => [x.start, { ...x, idx }]));
  let s = "";
  for (let i = 0; i < lower.length; ) {
    const nuc = byStart.get(i);
    if (nuc) {
      let letters = [...nuc.nucleus].map((ch) => PLAIN[ch] ?? ch).join("");
      if (letters === "ae") letters = "ai";
      else if (letters === "oe") letters = "oi";
      if (nuc.idx === stress) letters = (ACUTE[letters[0]] ?? letters[0]) + letters.slice(1);
      s += letters;
      i = nuc.end;
    } else {
      s += PLAIN[lower[i]] ?? lower[i];
      i++;
    }
  }
  // 2. sounds
  s = s
    .replace(/j/g, "i")
    .replace(/ph/g, "f")
    .replace(/th/g, "t")
    .replace(/rh/g, "r")
    .replace(/ch/g, "c")
    .replace(/x/g, "cs")
    .replace(/v/g, "u");
  const soft = /[eiéí]/;
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const next = s[i + 1] ?? "";
    if (ch === "c" && soft.test(next)) out += target === "it" ? "ch" : "qu";
    else if (ch === "g" && soft.test(next)) out += target === "it" ? "gh" : "gu";
    else if (ch === "g" && next === "n") out += "ng"; // magnus: ng-n, not Italian gn
    else if (target === "es" && ch === "q" && next === "u") {
      out += "cu"; // Spanish qu is a plain k: aqua → ácua, quī → cui
      i++;
    } else if (target === "es" && ch === "g" && next === "u" && soft.test(s[i + 2] ?? "") && out.endsWith("n")) {
      out += "gü"; // sanguis: the u is heard
      i++;
    } else if (target === "es" && ch === "l" && next === "l") {
      out += "l"; // Spanish ll is a different sound
      i++;
    } else out += ch;
  }
  return out;
}

/** A Latin sentence respelled word by word, punctuation kept for pauses. */
export function respell(text: string, target: Target): string {
  return text
    .replace(/#[a-z0-9.]+/g, "")
    .replace(/[\p{L}]+/gu, (w) => respellWord(w, target));
}
