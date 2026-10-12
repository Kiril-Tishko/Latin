// Checks a message the people in the messenger wrote, before the learner sees
// it: every word one the learner knows, in a form of a rule they have seen, the
// sentence built only with constructions they have met, and the grammar right
// (the engine's own checks). Also puts back long marks Claude left out.
import { splitCodes, withoutEmoji } from "./emoji";
import { annotate, Lexicon } from "../latin/analyze";
import { checkAnswer } from "../latin/facts";
import { capitalize, plain } from "../latin/text";
import { full } from "../latin/types";
import { lineSkills, readLine, skillOf } from "../trainer/lines";

export interface Vet {
  ok: boolean;
  /** What is wrong, in plain words (for the repair request). */
  issues: string[];
  /** Words not in the learner's vocabulary at all. */
  unknown: string[];
}

/** Laughter is fine in any spelling: haha, hahae, hahahae. */
const LAUGH = /^(ha)+e?$/i;

/** The sentences of a message (a name followed by a comma stays with its sentence). */
const sentences = (text: string) =>
  text
    .split(/[.!?;…]+/)
    .map((s) => s.trim())
    .filter((s) => /\p{L}/u.test(s));

/** May this reading be used: its ending's rule seen (names may always be said and called)? */
function readingAllowed(a: NonNullable<ReturnType<Lexicon["analyze"]>[number]>, seen: Set<string>): boolean {
  const skill = skillOf(a);
  if (!skill) return true;
  if (a.entry.kind === "noun" && a.entry.tags.includes("name") && (a.key === "nom.sg" || a.key === "voc.sg")) return true;
  if (a.entry.kind === "verb" && a.key !== "inf" && !/^pres\.(1sg|2sg|3sg|3pl)$/.test(a.key)) return false;
  if (skill === "v.sum" || skill === "v.possum") return seen.has(skill) && (!a.key.endsWith("3pl") || seen.has("v.3pl"));
  return seen.has(skill);
}

/**
 * Vets one message against the learner's words (`lex`: the messenger's lexicon,
 * only words the learner knows plus chat words and names) and the rules seen.
 */
export function vetMessage(message: string, lex: Lexicon, seen: Set<string>): Vet {
  // the Roman emoji are not words
  const text = withoutEmoji(message);
  const issues: string[] = [];
  const unknown: string[] = [];
  for (const s of sentences(text)) {
    const tokens = annotate(s, lex).filter((t) => t.isWord);
    for (const t of tokens) {
      if (LAUGH.test(t.text)) continue;
      if (!t.readings?.length) {
        unknown.push(t.text);
        continue;
      }
      if (!t.readings.some((r) => readingAllowed(r, seen))) issues.push(`«${t.text}»: the learner has not met this form yet`);
    }
    if (unknown.length) continue;
    // constructions the learner has not met (an object, "of", X est Y, in + a place, a plural subject…)
    const line = readLine(s.replace(/\b(ha)+e?\b/gi, "").trim() || s, lex);
    if (line) {
      for (const skill of lineSkills(line)) {
        if (/\.voc\./.test(skill) || seen.has(skill)) continue;
        if (!/^(s|adj)\./.test(skill)) continue; // endings were checked word by word
        issues.push(`"${s}" needs a rule the learner has not met yet (${skill})`);
      }
    }
    for (const f of checkAnswer(`«${s}»`, lex)) if (f.kind !== "spelling") issues.push(f.message.replace(/«|»/g, ""));
  }
  if (unknown.length) issues.unshift(`words the learner does not know: ${[...new Set(unknown)].join(", ")}`);
  return { ok: issues.length === 0, issues, unknown: [...new Set(unknown)] };
}

const ORDER = ["nom.sg", "voc.sg", "acc.sg", "gen.sg", "nom.pl", "acc.pl", "abl.sg"];
const rankOf = (key: string) => (ORDER.includes(key) ? ORDER.indexOf(key) : key.startsWith("pres") || key === "" ? -1 : 50);

/**
 * The text with its long marks: each word spelled as the word it is (salve →
 * salvē, scribo → scrībō); where the long mark decides the case, after in the
 * place (in silva → in silvā) and after ad the goal; otherwise as written.
 */
export function withMacrons(text: string, lex: Lexicon): string {
  // the codes of the Roman emoji (":lupa:") stay exactly as they are
  const parts = splitCodes(text);
  if (parts.length > 1) return parts.map((p, i) => (i % 2 ? p : withMacrons(p, lex))).join("");
  const tokens = annotate(text, lex);
  const words = tokens.filter((t) => t.isWord);
  return tokens
    .map((t) => {
      if (!t.isWord) return t.text;
      const loose = lex.analyzeLoose(t.text);
      if (!loose.length) return t.text;
      const forms = [...new Set(loose.map((a) => full(a.form)))];
      let f = forms[0];
      if (forms.length > 1) {
        const prev = plain(words[words.indexOf(t) - 1]?.text ?? "");
        const pick = prev === "in" ? loose.find((a) => a.key.startsWith("abl")) ?? loose.find((a) => a.key.startsWith("acc")) : prev === "ad" ? loose.find((a) => a.key.startsWith("acc")) : undefined;
        // written with its long marks already: as written; else the likeliest reading (the subject before the rest)
        const asWritten = forms.find((x) => x.toLowerCase() === t.text.toLowerCase());
        const likeliest = [...loose].sort((a, b) => rankOf(a.key) - rankOf(b.key))[0];
        f = pick ? full(pick.form) : asWritten ?? full(likeliest.form);
      }
      // keep the writer's capitals (a name, the start of a sentence, a shout)
      if (t.text.length > 1 && t.text === t.text.toUpperCase()) return f.toUpperCase();
      return t.text[0] === t.text[0].toUpperCase() && t.text[0] !== t.text[0].toLowerCase() ? capitalize(f) : f;
    })
    .join("");
}
