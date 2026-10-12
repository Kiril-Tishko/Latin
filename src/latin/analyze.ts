// Reverse lookup: which word and which form is this? Used to color endings in
// any Latin text and to explain a learner's wrong answer.
import { conjugate, declineAdj, declineNoun } from "./morph";
import { latinKey, plain } from "./text";
import { Case, Entry, Form, full, Gender, NounKey, Num, VerbKey } from "./types";

export interface Analysis {
  entry: Entry;
  /** "acc.sg" for nouns and adjectives, "pres.3sg" for verbs, "" for fixed words. */
  key: NounKey | VerbKey | "";
  gender?: Gender;
  form: Form;
}

export const caseOf = (a: Analysis): Case | undefined =>
  a.entry.kind === "noun" || a.entry.kind === "adj" ? (a.key.split(".")[0] as Case) : undefined;
export const numOf = (a: Analysis): Num | undefined =>
  a.entry.kind === "noun" || a.entry.kind === "adj"
    ? (a.key.split(".")[1] as Num)
    : a.entry.kind === "verb" && a.key.endsWith("pl")
      ? "pl"
      : a.entry.kind === "verb" && a.key.endsWith("sg")
        ? "sg"
        : undefined;

export class Lexicon {
  readonly entries: Entry[];
  readonly byId = new Map<string, Entry>();
  private exact = new Map<string, Analysis[]>();
  private loose = new Map<string, Analysis[]>();

  constructor(entries: Entry[]) {
    this.entries = entries;
    for (const e of entries) {
      this.byId.set(e.id, e);
      for (const a of formsOf(e)) this.add(a);
    }
  }

  private add(a: Analysis) {
    const f = full(a.form);
    const push = (m: Map<string, Analysis[]>, k: string) => {
      const list = m.get(k);
      if (list) list.push(a);
      else m.set(k, [a]);
    };
    push(this.exact, f.toLowerCase());
    push(this.loose, latinKey(f));
  }

  /** All readings of a word. Exact spelling (long marks included) wins over a loose match. */
  analyze(word: string): Analysis[] {
    return this.exact.get(word.toLowerCase()) ?? this.loose.get(latinKey(word)) ?? [];
  }

  /** Every reading of a word whatever its long marks (silva: silva and silvā). */
  analyzeLoose(word: string): Analysis[] {
    return this.loose.get(latinKey(word)) ?? [];
  }

  /** Readings of a word that belong to one dictionary entry. */
  analyzeAs(word: string, entryId: string): Analysis[] {
    return (this.loose.get(latinKey(word)) ?? []).filter((a) => a.entry.id === entryId);
  }

  get(id: string): Entry | undefined {
    return this.byId.get(id);
  }
}

/** Every form of an entry as analyses. */
export function formsOf(e: Entry): Analysis[] {
  const out: Analysis[] = [];
  switch (e.kind) {
    case "noun":
      for (const [key, form] of Object.entries(declineNoun(e))) out.push({ entry: e, key: key as NounKey, gender: e.gender, form: form! });
      break;
    case "adj":
      for (const g of ["m", "f", "n"] as Gender[])
        for (const [key, form] of Object.entries(declineAdj(e, g))) out.push({ entry: e, key: key as NounKey, gender: g, form });
      break;
    case "verb":
      for (const [key, form] of Object.entries(conjugate(e))) out.push({ entry: e, key: key as VerbKey, form: form! });
      break;
    case "fixed":
      out.push({ entry: e, key: "", form: { stem: e.lemma, ending: "" } });
      break;
  }
  return out;
}

// ------------------------------------------------------------- annotate

export interface Token {
  /** The text exactly as written (without any #hint). */
  text: string;
  /** Punctuation or spaces between words. */
  isWord: boolean;
  analysis?: Analysis;
  /** Every reading, when the word is ambiguous. */
  readings?: Analysis[];
}

const PREF: NounKey[] = ["nom.sg", "acc.sg", "abl.sg", "gen.sg", "nom.pl", "acc.pl", "abl.pl", "gen.pl", "dat.sg", "dat.pl", "voc.sg", "voc.pl"];

/**
 * Splits Latin text into tokens and picks one reading per word.
 * "word#gen.sg" forces a reading; otherwise context decides (after in / ad,
 * plural verbs, adjacent nouns).
 */
export function annotate(text: string, lex: Lexicon): Token[] {
  const raw = text.normalize("NFC").split(/([\p{L}]+(?:#[a-z0-9]+(?:\.[a-z0-9]+)*)?)/u).filter((s) => s !== "");
  const tokens: Token[] = raw.map((piece) => {
    const m = piece.match(/^([\p{L}]+)(?:#([a-z0-9]+(?:\.[a-z0-9]+)*))?$/u);
    if (!m) return { text: piece, isWord: false };
    const [, word, hint] = m;
    // #x: a word that only looks like a known form (fīnis is not fīnīs): leave it plain
    if (hint === "x") return { text: word, isWord: true, readings: [] };
    const readings = lex.analyze(word);
    const chosen = hint ? readings.filter((r) => r.key === hint || r.key.startsWith(hint)) : [];
    return { text: word, isWord: true, readings, analysis: chosen[0] };
  });
  const wordsOnly = tokens.filter((t) => t.isWord);
  const pluralVerb = wordsOnly.some((t) => t.readings?.some((r) => r.entry.kind === "verb" && r.key.endsWith("3pl")));
  wordsOnly.forEach((t, i) => {
    if (t.analysis || !t.readings?.length) return;
    const prev = plain(wordsOnly[i - 1]?.text ?? "");
    let options = t.readings;
    const verbs = options.filter((r) => r.entry.kind === "verb");
    if (verbs.length) options = verbs;
    if (prev === "in") {
      const loc = options.filter((r) => r.key.startsWith("abl") || r.key.startsWith("acc"));
      if (loc.length) options = loc;
    } else if (prev === "ad") {
      const acc = options.filter((r) => r.key.startsWith("acc"));
      if (acc.length) options = acc;
    } else {
      const notPrep = options.filter((r) => !r.key.startsWith("abl"));
      if (notPrep.length) options = notPrep;
    }
    if (pluralVerb && i === 0) {
      const nomPl = options.filter((r) => r.key === "nom.pl");
      if (nomPl.length) options = nomPl;
    }
    // adjectives follow the gender of a neighbouring noun when possible
    const neighbour = [wordsOnly[i - 1], wordsOnly[i + 1]].find((n) => n?.readings?.some((r) => r.entry.kind === "noun"));
    if (options.some((r) => r.entry.kind === "adj") && neighbour) {
      const nounReadings = neighbour.readings!.filter((r) => r.entry.kind === "noun");
      const agreeing = options.filter((r) => nounReadings.some((n) => n.key === r.key && n.gender === r.gender));
      if (agreeing.length) options = agreeing;
    }
    options = [...options].sort((a, b) => rank(a) - rank(b));
    t.analysis = options[0];
  });
  return tokens;
}

function rank(a: Analysis): number {
  if (a.entry.kind !== "noun" && a.entry.kind !== "adj") return 0;
  const i = PREF.indexOf(a.key as NounKey);
  return i < 0 ? 99 : i;
}
