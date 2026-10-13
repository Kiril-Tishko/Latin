// What the site's grammar engine knows for certain about the Latin in a
// conversation with Claude. The facts go with each question, so Claude builds
// its answer on them instead of on memory (it once called agricola feminine and
// invented rules for guessing an infinitive). Every answer is then read back:
// an adjective that does not match its noun, a verb that does not match its
// subject, a preposition with the wrong case, long marks out of place.
import { Analysis, annotate, caseOf, Lexicon, numOf, Token } from "./analyze";
import { conjugate, declineAdj, declineNoun, dictionaryForm } from "./morph";
import { adjDecl, nounSkill } from "./skills";
import { plain } from "./text";
import { AdjEntry, Case, CASE_NAMES, Entry, Form, full, Gender, NounEntry, NounKey, PN, VerbEntry, VerbKey } from "./types";

const GENDER: Record<Gender, string> = { m: "masculine", f: "feminine", n: "neuter" };
const USE: Record<Case, string> = { nom: "subject", acc: "object; after in / ad: where to", gen: "of / 's", abl: "in / at, after in", dat: "to / for", voc: "calling someone" };
const CONJ: Record<string, string> = {
  "1": "the -āre group (like labōrāre)",
  "2": "the -ēre group, long ē (like docēre)",
  "3": "the -ere group, short e (like legere)",
  "3io": "the -ere group with -iō (like capiō)",
  "4": "the -īre group (like dormīre)",
  irr: "irregular",
};
const WHO: Record<PN, string> = { "1sg": "I (ego)", "2sg": "you (tū)", "3sg": "he / she / it", "1pl": "we", "2pl": "you all", "3pl": "they" };

/** English words that are also Latin forms: in text that mixes the two, they count only with long marks or inside «». */
const LOOKALIKES = new Set(
  "video audio canto credo legit sum est focus circus campus radius locus ovum imperium bonus via aqua terra luna rosa taurus olympus europa forma familia vita placet liber deus dea nemo solus ego".split(" "),
);

const show = (f?: Form) => (f ? full(f) : "");

/** Whether the learner has met a reading's ending (or it comes later). */
function taught(a: Analysis, known: Set<string>): boolean {
  const e = a.entry;
  if (e.kind === "noun") return known.has(nounSkill(e.decl, caseOf(a)!, numOf(a)!));
  if (e.kind === "adj") return known.has(nounSkill(adjDecl(a.gender ?? "m"), caseOf(a)!, numOf(a)!));
  if (e.kind === "verb") {
    if (a.key === "inf") return known.has("v.inf");
    if (e.irregular === "sum") return known.has("v.sum") && a.key.startsWith("pres.") && a.key.endsWith("sg");
    if (e.irregular === "possum") return known.has("v.possum") && a.key.startsWith("pres.") && a.key.endsWith("sg");
    return a.key.startsWith("pres.") && known.has(`v.${a.key.split(".")[1]}`);
  }
  return true;
}

/** "genitive singular (of / 's)", "the form for I (ego)". */
function reading(a: Analysis, known: Set<string>): string {
  const e = a.entry;
  let text = "";
  if (e.kind === "noun" || e.kind === "adj") {
    const c = caseOf(a)!;
    text = `${CASE_NAMES[c]} ${numOf(a) === "pl" ? "plural" : "singular"}${e.kind === "adj" ? `, ${GENDER[a.gender ?? "m"]}` : ""} (${USE[c]})`;
  } else if (e.kind === "verb") {
    text = a.key === "inf" ? "infinitive (to …)" : a.key.startsWith("pres.") ? `the form for ${WHO[a.key.split(".")[1] as PN]}` : a.key;
  }
  return taught(a, known) ? text : `${text}, not taught yet`;
}

function nounFacts(e: NounEntry, known: Set<string>, magnus?: AdjEntry): string {
  const forms = declineNoun(e);
  const keys: NounKey[] = (["nom.sg", "acc.sg", "gen.sg", "abl.sg", "nom.pl"] as NounKey[]).filter(
    (k) => forms[k] && known.has(nounSkill(e.decl, k.split(".")[0] as Case, k.split(".")[1] as "sg" | "pl")) && !(e.proper && k.endsWith("pl")),
  );
  const list = keys.map((k) => `${show(forms[k])} (${USE[k.split(".")[0] as Case].split(";")[0]}${k.endsWith("pl") ? ", plural" : ""})`).join(", ");
  const odd = (e.decl === "1" && e.gender === "m") || (e.decl === "2" && e.gender === "f");
  const g = e.gender;
  const agree = magnus && !e.proper ? ` An adjective with it is ${GENDER[g]}: ${show(forms["nom.sg"])} ${show(declineAdj(magnus, g)["nom.sg"])}, ${show(forms["acc.sg"])} ${show(declineAdj(magnus, g)["acc.sg"])}.` : "";
  return `${dictionaryForm(e)} "${e.en}": noun, ${GENDER[g]}${odd ? ` (it ends like a ${g === "m" ? "feminine" : "masculine"} noun but is ${GENDER[g]})` : ""}. Forms: ${list}.${agree}`;
}

function verbFacts(e: VerbEntry, known: Set<string>): string {
  const c = conjugate(e);
  const pns = (["1sg", "2sg", "3sg", "3pl"] as PN[]).filter((pn) => c[`pres.${pn}` as VerbKey] && (e.irregular ? pn !== "3pl" || known.has("v.3pl") : known.has(`v.${pn}`)));
  const present = pns.map((pn) => `${show(c[`pres.${pn}` as VerbKey])} (${WHO[pn]})`).join(", ");
  return `${dictionaryForm(e)} "${e.en}": verb, ${CONJ[e.irregular ? "irr" : e.conj]}. Present: ${present}; infinitive ${show(c.inf)}.`;
}

function adjFacts(e: AdjEntry): string {
  const m = declineAdj(e, "m");
  const f = declineAdj(e, "f");
  const n = declineAdj(e, "n");
  return `${dictionaryForm(e)} "${e.en}": adjective; it takes the gender, case and number of its noun, whatever the noun's own ending: masculine ${show(m["nom.sg"])} / ${show(m["acc.sg"])} (agricola ${show(m["nom.sg"])}, poēta ${show(m["nom.sg"])}), feminine ${show(f["nom.sg"])} / ${show(f["acc.sg"])}, neuter ${show(n["nom.sg"])}.`;
}

export function entryFacts(e: Entry, known: Set<string>, lex: Lexicon): string {
  if (e.kind === "noun") return nounFacts(e, known, lex.get("magnus") as AdjEntry | undefined);
  if (e.kind === "verb") return verbFacts(e, known);
  if (e.kind === "adj") return adjFacts(e);
  return "";
}

export interface FactSource {
  text: string;
  /** Only the Latin inside «guillemets» (Claude's answers). */
  quoted?: boolean;
  /** Latin mixed with English (a question, a screen): English look-alikes need long marks to count. */
  mixed?: boolean;
}

/**
 * The facts block for a question: every Latin word in the sources (the
 * question first), what each written form can be, and its word's grammar.
 * Empty when there is no Latin.
 */
export function engineFacts(sources: FactSource[], lex: Lexicon, known: Set<string>, max = 10, extra?: (e: Entry) => string | undefined): string {
  const forms = new Map<string, Token>();
  const entries = new Map<string, Entry>();
  for (const s of sources) {
    const text = s.quoted ? [...s.text.matchAll(/«([^»]+)»/g)].map((m) => m[1]).join(" · ") : s.text;
    for (const t of annotate(text, lex)) {
      if (!t.isWord || !t.readings?.length || t.readings.every((r) => r.entry.kind === "fixed")) continue;
      const word = t.text.toLowerCase();
      if (s.mixed && (word.length < 3 || (LOOKALIKES.has(word) && word === plain(word)))) continue;
      const fresh = t.readings.filter((r) => r.entry.kind !== "fixed" && !entries.has(r.entry.id));
      if (entries.size + new Set(fresh.map((r) => r.entry.id)).size > max) continue;
      if (!forms.has(word)) forms.set(word, t);
      for (const r of t.readings) if (r.entry.kind !== "fixed") entries.set(r.entry.id, r.entry);
    }
  }
  if (!entries.size) return "";
  const lines: string[] = [];
  for (const [word, t] of forms) {
    const rs = t.readings!.filter((r) => r.entry.kind !== "fixed");
    const spelled = full(rs[0].form);
    const name = spelled.toLowerCase() === word ? `«${spelled}»` : `«${t.text}» (spelled «${spelled}»)`;
    const what = [...new Set(rs.map((r) => reading(r, known)))];
    const of = [...new Set(rs.map((r) => (r.entry.kind === "verb" ? r.entry.pp[0] : (r.entry as { lemma: string }).lemma)))].join(" / ");
    lines.push(`- ${name}, from ${of}: ${what.length > 1 ? `can be ${what.join("; or ")}` : what[0]}.`);
  }
  for (const e of entries.values()) {
    const more = extra?.(e);
    lines.push(`- ${entryFacts(e, known, lex)}${more ? ` ${more}` : ""}`);
  }
  return `[Facts from the site's grammar engine. They are certain: build your answer on them and never contradict them. Do not mention this note.\n${lines.join("\n")}]`;
}

// ------------------------------------------------------------ the answer check

export interface Finding {
  kind: "agreement" | "verb" | "preposition" | "spelling";
  /** What is wrong and the right form, with Latin in «». */
  message: string;
}

/** Latin quoted as a wrong example or as the learner's own words: "not «puella»", "you wrote «discare»", "your answer «leges»". */
const QUOTED_WRONG = /\b(not|n't|instead of|rather than|wrote|typed|answered|answer|your|you have|you've|you put|you used|wrong|mistake|incorrect|never|avoid)\b[^«»\n]{0,16}$/i;

/** «Latin» closing a sentence, without a second full stop after one inside. */
const closing = (latin: string) => `«${latin}»${/[.!?]$/.test(latin.trim()) ? "" : "."}`;

const replaceWord = (segment: string, word: string, by: string) =>
  segment.replace(new RegExp(`(^|[^\\p{L}])${word}(?![\\p{L}])`, "u"), (_, pre: string) => pre + (word[0] === word[0].toUpperCase() ? by[0].toUpperCase() + by.slice(1) : by));

/**
 * Reads the Latin («…») of an answer with the grammar engine and returns
 * what it finds wrong, with the right forms. Latin given as a wrong example
 * ("not «…»"), word pieces («-am», «fugitā-») and words marked (new) are left alone.
 */
export function checkAnswer(text: string, lex: Lexicon): Finding[] {
  const out: Finding[] = [];
  const spelling = new Set<string>();
  for (const m of text.matchAll(/«([^»]+)»/g)) {
    const raw = m[1];
    const before = text.slice(Math.max(0, m.index! - 48), m.index);
    const after = text.slice(m.index! + m[0].length, m.index! + m[0].length + 10);
    if (QUOTED_WRONG.test(before) || /^\s*\(new\)/.test(after) || /(^|\s)-|-(\s|$)|…|\.\.\./.test(raw)) continue;
    const segment = raw.replace(/#[a-z0-9]+(?:\.[a-z0-9]+)*/g, "");
    const words = annotate(raw, lex).filter((t) => t.isWord);
    if (!words.length) continue;
    const isNoun = (t?: Token) => !!t?.readings?.some((r) => r.entry.kind === "noun");
    const hasSum = words.some((t) => t.readings?.some((r) => r.entry.kind === "verb" && r.entry.irregular === "sum"));

    // long marks in an ending (the -īs of dormīs, the -ā of in silvā): written without them, or wrongly
    for (const t of words) {
      if (!t.readings?.length || t.readings.some((r) => full(r.form).toLowerCase() === t.text.toLowerCase())) continue;
      const r = t.readings[0];
      // the ending and the vowel before it (the long ī of dormīs is part of the rule)
      const tail = r.form.ending.length + 1;
      if (r.form.ending && t.text.slice(-tail).toLowerCase() !== full(r.form).slice(-tail).toLowerCase()) spelling.add(full(r.form));
    }

    // an adjective takes its noun's gender, case and number
    words.forEach((t, i) => {
      const adjs = t.readings?.filter((r) => r.entry.kind === "adj") ?? [];
      if (!adjs.length || adjs.length !== t.readings!.length) return;
      // any noun of the phrase will do (Latin may put them apart); the nearest one names the fix
      const nouns = words.filter(isNoun);
      if (!nouns.length) return;
      const agrees = nouns.some((n) => n.readings!.some((nr) => nr.entry.kind === "noun" && adjs.some((ar) => ar.key === nr.key && ar.gender === nr.gender)));
      if (agrees) return;
      // two subjects or more joined by et («Agricola et taurus timidī sunt»): the adjective is plural, masculine if any of them is
      const nomOf = (n: Token) => n.readings!.find((r) => r.entry.kind === "noun" && caseOf(r) === "nom");
      const subjects = nouns.filter(nomOf);
      if (subjects.length >= 2 && words.some((w) => plain(w.text) === "et")) {
        const genders = new Set(subjects.map((n) => nomOf(n)!.gender));
        const g = genders.has("m") ? "m" : genders.size === 1 ? [...genders][0] : "n";
        if (adjs.some((ar) => ar.key === "nom.pl" && ar.gender === g)) return;
      }
      // after est the adjective goes with the subject; otherwise with the noun beside it
      const beside = [words[i - 1], words[i + 1]].filter(isNoun) as Token[];
      const subject = hasSum ? nouns.find((w) => w.readings!.some((r) => r.entry.kind === "noun" && caseOf(r) === "nom")) : undefined;
      const noun = beside[0] ?? subject;
      if (!noun) return;
      const nr = noun.analysis?.entry.kind === "noun" ? noun.analysis : noun.readings!.find((r) => r.entry.kind === "noun")!;
      const right = show(declineAdj(adjs[0].entry as AdjEntry, nr.gender!)[nr.key as NounKey]);
      if (!right) return;
      out.push({
        kind: "agreement",
        message: `«${noun.text}» is ${GENDER[nr.gender!]}, so the adjective is «${right}»: ${closing(replaceWord(segment, t.text, right))}`,
      });
    });

    // the verb ending follows the subject
    const finite = words.filter((t) => t.readings?.length && t.readings.every((r) => r.entry.kind === "verb") && t.readings.some((r) => r.key.startsWith("pres.")));
    if (finite.length === 1 && !words.some((t) => plain(t.text) === "et")) {
      const v = finite[0];
      const pron = words.find((t) => ["ego", "tu", "nos"].includes(t.readings?.[0]?.entry.id ?? ""));
      let need: PN | null = null;
      let who = "";
      // "Discipulus sum", "Poēta es": with I am / you are, the noun is what one is, not the subject
      const iOrYouAre = v.readings!.some((r) => r.entry.kind === "verb" && r.entry.irregular === "sum" && (r.key === "pres.1sg" || r.key === "pres.2sg"));
      if (pron) {
        need = pron.readings![0].entry.id === "ego" ? "1sg" : pron.readings![0].entry.id === "nos" ? "1pl" : "2sg";
        who = `«${pron.text}»`;
      } else if (!iOrYouAre) {
        // a word that can only be calling someone (Marce, Gāī) is never the subject
        const subjects = words.filter((t) => t !== v && t.readings?.length && t.readings.every((r) => r.entry.kind === "noun" && (caseOf(r) === "nom" || caseOf(r) === "voc")) && t.readings.some((r) => caseOf(r) === "nom"));
        // "Puella, legis?" and "Quid legis, Iūlia?" call someone: a name set off by a comma is not the subject
        const calledOut = subjects.length === 1 && new RegExp(`${subjects[0].text}\\s*,|,\\s*${subjects[0].text}`, "u").test(segment);
        if (subjects.length === 1 && !calledOut) {
          const nums = new Set(subjects[0].readings!.map((r) => numOf(r)));
          if (nums.size === 1) {
            need = nums.has("pl") ? "3pl" : "3sg";
            who = `«${subjects[0].text}»`;
          }
        }
      }
      const verb = v.readings![0].entry as VerbEntry;
      const right = need && show(conjugate(verb)[`pres.${need}` as VerbKey]);
      if (need && right && !v.readings!.some((r) => r.key === `pres.${need}`)) {
        out.push({ kind: "verb", message: `With ${who} the verb is «${right}» (${WHO[need]}): ${closing(replaceWord(segment, v.text, right))}` });
      }
    }

    // in + ablative (where) or accusative (where to); ad + accusative
    words.forEach((t, i) => {
      const id = t.readings?.[0]?.entry.id;
      if (id !== "in-prep" && id !== "ad-prep") return;
      const next = words.slice(i + 1).find(isNoun);
      if (!next) return;
      const ok = next.readings!.some((r) => r.entry.kind === "noun" && (caseOf(r) === "acc" || (id === "in-prep" && caseOf(r) === "abl")));
      if (ok) return;
      const n = next.readings!.find((r) => r.entry.kind === "noun")!;
      const forms = declineNoun(n.entry as NounEntry);
      const num = numOf(n) ?? "sg";
      const acc = show(forms[`acc.${num}`]);
      const abl = show(forms[`abl.${num}`]);
      out.push({
        kind: "preposition",
        message:
          id === "ad-prep"
            ? `«ad» takes the -m form: «ad ${acc}».`
            : `After «in» comes the ablative for where («in ${abl}») or the -m form for where to («in ${acc}»), not «${next.text}».`,
      });
    });
  }
  if (spelling.size) out.push({ kind: "spelling", message: `Long marks: ${[...spelling].map((w) => `«${w}»`).join(", ")}.` });
  return out;
}

/** Every ending counts as taught: a literal reading names each form plainly. */
const EVERY_RULE = { has: () => true } as unknown as Set<string>;

/**
 * How a message reads word by word, as a Roman reads it: what each word can be
 * (its case and use, or who does it), a word the engine does not know, and the
 * slips it finds (an adjective that does not match, a verb that does not match
 * its subject). The people of the messenger take a mistake literally.
 */
export function literalReading(text: string, lex: Lexicon): string {
  const words = annotate(text, lex).filter((t) => t.isWord);
  if (!words.length) return "";
  const lines = words.map((t) => {
    // only the present and the infinitive (all the people write); calling someone only for a name
    const all = t.readings ?? [];
    const rs = all.filter((r) => {
      if (r.entry.kind === "verb") return r.key === "inf" || r.key.startsWith("pres.");
      if (caseOf(r) === "voc") return r.entry.tags.includes("name") || !all.some((o) => o.entry === r.entry && caseOf(o) === "nom");
      return true;
    });
    if (!all.length) return `- «${t.text}»: not a Latin word the engine knows (a typo, or a word it has not met)`;
    if (!rs.length) rs.push(...all);
    const what = [
      ...new Set(
        rs.map((r) => {
          const e = r.entry;
          const head = e.kind === "verb" ? e.pp[0] : (e as { lemma: string }).lemma;
          return e.kind === "fixed" ? `${head} (${e.en})` : `${reading(r, EVERY_RULE)} of ${head} (${e.en})`;
        }),
      ),
    ];
    return `- «${t.text}»: ${what.length > 1 ? `can be ${what.join("; or ")}` : what[0]}`;
  });
  // sentence by sentence: "Salvē Iūlia! Quid agis?" calls Iūlia, it does not make her the subject
  const slips = text
    .split(/(?<=[.!?])\s+/)
    .flatMap((sentence) => checkAnswer(`«${sentence}»`, lex))
    .filter((f) => f.kind !== "spelling")
    .map((f) => `- ${f.message.replace(/«|»/g, "")}`);
  return [...lines, ...(slips.length ? ["The engine also finds:", ...slips] : [])].join("\n");
}
