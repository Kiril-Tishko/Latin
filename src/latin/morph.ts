// Latin morphology: builds dictionary entries and generates every form of a
// word, each split into stem + ending so the ending can be colored.
import { stripMarks } from "./text";
import {
  AdjEntry,
  Case,
  CASES,
  Conj,
  Decl,
  EnVerb,
  Entry,
  FixedEntry,
  Form,
  Gender,
  Irregular,
  NounEntry,
  NounKey,
  Num,
  NUMS,
  PN,
  PNS,
  Tense,
  VerbEntry,
  VerbKey,
} from "./types";

type Source = NounEntry["source"];

const cut = (s: string, n: number) => s.slice(0, s.length - n);
const endsPlain = (s: string, suffix: string) =>
  stripMarks(s).toLowerCase().endsWith(stripMarks(suffix).toLowerCase());
const idOf = (s: string) => stripMarks(s).toLowerCase().replace(/[^a-z]/g, "");

/** Splits a known full form against a stem: "puellam" vs "puell" -> puell|am. */
export function splitForm(form: string, stem: string): Form {
  if (form.includes("|")) {
    const [s, e] = form.split("|");
    return { stem: s, ending: e };
  }
  if (stem && form.startsWith(stem)) return { stem, ending: form.slice(stem.length) };
  return { stem: form, ending: "" };
}

// ---------------------------------------------------------------- nouns

type Endings = Partial<Record<NounKey, string>>;

const N1: Endings = {
  "nom.sg": "a", "gen.sg": "ae", "dat.sg": "ae", "acc.sg": "am", "abl.sg": "ā", "voc.sg": "a",
  "nom.pl": "ae", "gen.pl": "ārum", "dat.pl": "īs", "acc.pl": "ās", "abl.pl": "īs", "voc.pl": "ae",
};
const N2: Endings = {
  "nom.sg": "us", "gen.sg": "ī", "dat.sg": "ō", "acc.sg": "um", "abl.sg": "ō", "voc.sg": "e",
  "nom.pl": "ī", "gen.pl": "ōrum", "dat.pl": "īs", "acc.pl": "ōs", "abl.pl": "īs", "voc.pl": "ī",
};
const N2N: Endings = {
  "nom.sg": "um", "gen.sg": "ī", "dat.sg": "ō", "acc.sg": "um", "abl.sg": "ō", "voc.sg": "um",
  "nom.pl": "a", "gen.pl": "ōrum", "dat.pl": "īs", "acc.pl": "a", "abl.pl": "īs", "voc.pl": "a",
};
// 3rd declension: the nominative (and neuter accusative / vocative) singular is the lemma itself.
const N3: Endings = {
  "gen.sg": "is", "dat.sg": "ī", "acc.sg": "em", "abl.sg": "e",
  "nom.pl": "ēs", "gen.pl": "um", "dat.pl": "ibus", "acc.pl": "ēs", "abl.pl": "ibus", "voc.pl": "ēs",
};
const N3N: Endings = {
  "gen.sg": "is", "dat.sg": "ī", "abl.sg": "e",
  "nom.pl": "a", "gen.pl": "um", "dat.pl": "ibus", "acc.pl": "a", "abl.pl": "ibus", "voc.pl": "a",
};
const N4: Endings = {
  "nom.sg": "us", "gen.sg": "ūs", "dat.sg": "uī", "acc.sg": "um", "abl.sg": "ū", "voc.sg": "us",
  "nom.pl": "ūs", "gen.pl": "uum", "dat.pl": "ibus", "acc.pl": "ūs", "abl.pl": "ibus", "voc.pl": "ūs",
};
const N4N: Endings = {
  "nom.sg": "ū", "gen.sg": "ūs", "dat.sg": "ū", "acc.sg": "ū", "abl.sg": "ū", "voc.sg": "ū",
  "nom.pl": "ua", "gen.pl": "uum", "dat.pl": "ibus", "acc.pl": "ua", "abl.pl": "ibus", "voc.pl": "ua",
};
const N5: Endings = {
  "nom.sg": "ēs", "gen.sg": "eī", "dat.sg": "eī", "acc.sg": "em", "abl.sg": "ē", "voc.sg": "ēs",
  "nom.pl": "ēs", "gen.pl": "ērum", "dat.pl": "ēbus", "acc.pl": "ēs", "abl.pl": "ēbus", "voc.pl": "ēs",
};

const VOWELS = /[aeiouy]/;

/** Counts syllables: every vowel is one, except diphthongs (ae, oe, au), the u of qu, and consonantal i. */
export function syllables(word: string): number {
  const w = stripMarks(word)
    .toLowerCase()
    .replace(/qu|ngu(?=[aeiou])/g, "q")
    .replace(/^i(?=[aeiou])/, "j")
    .replace(/ae|oe|au/g, "a");
  let n = 0;
  for (const ch of w) if (VOWELS.test(ch)) n++;
  return n;
}

function detectIStem(lemma: string, gen: string, stem: string, decl: Decl): boolean {
  if (decl === "3n") return /(e|al|ar)$/.test(stripMarks(lemma));
  if (decl !== "3") return false;
  const nom = stripMarks(lemma).toLowerCase();
  if ((nom.endsWith("is") || nom.endsWith("es")) && syllables(lemma) === syllables(gen)) return true;
  const s = stripMarks(stem).toLowerCase();
  return syllables(lemma) === 1 && s.length >= 2 && !VOWELS.test(s.at(-1)!) && !VOWELS.test(s.at(-2)!);
}

export interface NounSpec {
  id?: string;
  en: string;
  enPl?: string;
  alt?: string[];
  tags?: string[];
  only?: Num;
  proper?: boolean;
  iStem?: boolean;
  forms?: Partial<Record<NounKey, string>>;
  note?: string;
}

/** noun("puella", "puellae", "f", { en: "girl" }) */
export function noun(lemma: string, gen: string, gender: Gender, spec: NounSpec, source: Source): NounEntry {
  let decl: Decl;
  let stem: string;
  if (endsPlain(gen, "ae")) {
    decl = "1";
    stem = cut(gen, 2);
  } else if (endsPlain(gen, "ei") && endsPlain(lemma, "es")) {
    decl = "5";
    stem = cut(gen, 2);
  } else if (endsPlain(gen, "i")) {
    decl = gender === "n" ? "2n" : "2";
    stem = cut(gen, 1);
  } else if (endsPlain(gen, "us")) {
    decl = gender === "n" ? "4n" : "4";
    stem = cut(gen, 2);
  } else if (endsPlain(gen, "is")) {
    decl = gender === "n" ? "3n" : "3";
    stem = cut(gen, 2);
  } else {
    throw new Error(`Cannot tell the declension of ${lemma}, ${gen}`);
  }
  const proper = spec.proper ?? /^[A-ZĀĒĪŌŪ]/.test(lemma);
  return {
    kind: "noun",
    id: spec.id ?? idOf(lemma),
    lemma,
    gen,
    gender,
    decl,
    stem,
    iStem: spec.iStem ?? detectIStem(lemma, gen, stem, decl),
    en: spec.en,
    enPl: spec.enPl,
    alt: spec.alt,
    tags: spec.tags ?? [],
    only: spec.only ?? (proper ? "sg" : undefined),
    proper,
    forms: spec.forms,
    note: spec.note,
    source,
  };
}

const nounCache = new Map<NounEntry, Partial<Record<NounKey, Form>>>();

/** Every form of a noun, keyed "acc.sg". Numbers the noun lacks are absent. */
export function declineNoun(e: NounEntry): Partial<Record<NounKey, Form>> {
  const cached = nounCache.get(e);
  if (cached) return cached;
  const out: Partial<Record<NounKey, Form>> = {};
  const table: Endings =
    e.decl === "1" ? N1
    : e.decl === "2" ? N2
    : e.decl === "2n" ? N2N
    : e.decl === "3" ? N3
    : e.decl === "3n" ? N3N
    : e.decl === "4" ? N4
    : e.decl === "4n" ? N4N
    : N5;
  for (const num of NUMS) {
    if (e.only && e.only !== num) continue;
    for (const c of CASES) {
      const key = `${c}.${num}` as NounKey;
      let ending = table[key];
      if (e.decl === "3" || e.decl === "3n") {
        if (e.iStem && key === "gen.pl") ending = "ium";
        if (e.iStem && e.decl === "3n") {
          if (key === "abl.sg") ending = "ī";
          if (num === "pl" && (c === "nom" || c === "acc" || c === "voc")) ending = "ia";
        }
      }
      if (e.decl === "5" && (key === "gen.sg" || key === "dat.sg") && VOWELS.test(stripMarks(e.stem).at(-1) ?? "")) {
        ending = "ēī";
      }
      let form: Form;
      const lemmaSlot =
        num === "sg" &&
        (c === "nom" || c === "voc" || ((e.decl === "3n" || e.decl === "2n") && c === "acc"));
      if (lemmaSlot && (e.decl === "3" || e.decl === "3n" || (e.decl === "2" && !endsPlain(e.lemma, "us")))) {
        // puer, ager, rēx, nōmen: the nominative is the dictionary form itself
        form = splitForm(e.lemma, e.stem);
      } else if (e.decl === "2" && key === "voc.sg" && endsPlain(e.lemma, "ius")) {
        form = { stem: cut(e.stem, 1), ending: "ī" }; // fīlius -> fīlī, Lūcius -> Lūcī
      } else {
        form = { stem: e.stem, ending: ending ?? "" };
      }
      const override = e.forms?.[key];
      if (override) form = splitForm(override, e.stem);
      out[key] = form;
    }
  }
  nounCache.set(e, out);
  return out;
}

// ----------------------------------------------------------- adjectives

export interface AdjSpec {
  id?: string;
  en: string;
  alt?: string[];
  tags?: string[];
  note?: string;
}

/** adj("magnus", "magna", "magnum", { en: "big" }) and adj("pulcher", "pulchra", "pulchrum", …) */
export function adj(m: string, f: string, n: string, spec: AdjSpec, source: Source): AdjEntry {
  return {
    kind: "adj",
    id: spec.id ?? idOf(m),
    lemma: m,
    fem: f,
    neut: n,
    cls: "12",
    stem: cut(f, 1),
    en: spec.en,
    alt: spec.alt,
    tags: spec.tags ?? [],
    note: spec.note,
    source,
  };
}

/**
 * Third-declension adjectives:
 *   adj3(["fēlīx"], "fēlīcis")            one ending
 *   adj3(["omnis", "omne"])               two endings
 *   adj3(["ācer", "ācris", "ācre"])       three endings
 */
export function adj3(nominatives: string[], gen: string | null, spec: AdjSpec, source: Source): AdjEntry {
  let m: string, f: string, n: string, stem: string;
  if (nominatives.length === 1) {
    [m] = nominatives;
    f = n = m;
    stem = cut(gen!, 2);
  } else if (nominatives.length === 2) {
    [m, n] = nominatives;
    f = m;
    stem = cut(n, 1);
  } else {
    [m, f, n] = nominatives;
    stem = cut(n, 1);
  }
  return {
    kind: "adj",
    id: spec.id ?? idOf(m),
    lemma: m,
    fem: f,
    neut: n,
    cls: "3",
    stem,
    en: spec.en,
    alt: spec.alt,
    tags: spec.tags ?? [],
    note: spec.note,
    source,
  };
}

const A3: Endings = {
  "gen.sg": "is", "dat.sg": "ī", "acc.sg": "em", "abl.sg": "ī",
  "nom.pl": "ēs", "gen.pl": "ium", "dat.pl": "ibus", "acc.pl": "ēs", "abl.pl": "ibus", "voc.pl": "ēs",
};
const A3N: Endings = {
  "gen.sg": "is", "dat.sg": "ī", "abl.sg": "ī",
  "nom.pl": "ia", "gen.pl": "ium", "dat.pl": "ibus", "acc.pl": "ia", "abl.pl": "ibus", "voc.pl": "ia",
};

const adjCache = new Map<AdjEntry, Record<Gender, Record<NounKey, Form>>>();

/** Every form of an adjective for one gender, keyed "acc.sg". */
export function declineAdj(e: AdjEntry, g: Gender): Record<NounKey, Form> {
  let byGender = adjCache.get(e);
  if (!byGender) {
    byGender = { m: buildAdj(e, "m"), f: buildAdj(e, "f"), n: buildAdj(e, "n") };
    adjCache.set(e, byGender);
  }
  return byGender[g];
}

function buildAdj(e: AdjEntry, g: Gender): Record<NounKey, Form> {
  const out = {} as Record<NounKey, Form>;
  for (const num of NUMS) {
    for (const c of CASES) {
      const key = `${c}.${num}` as NounKey;
      let form: Form;
      if (e.cls === "12") {
        if (g === "f") form = { stem: e.stem, ending: N1[key]! };
        else if (g === "n") form = { stem: e.stem, ending: N2N[key]! };
        else if (num === "sg" && (c === "nom" || c === "voc") && !endsPlain(e.lemma, "us")) {
          form = splitForm(e.lemma, e.stem); // pulcher, miser
        } else form = { stem: e.stem, ending: N2[key]! };
      } else {
        const nomSg = g === "f" ? e.fem : g === "n" ? e.neut : e.lemma;
        const lemmaSlot = num === "sg" && (c === "nom" || c === "voc" || (g === "n" && c === "acc"));
        if (lemmaSlot) form = splitForm(nomSg, e.stem);
        else form = { stem: e.stem, ending: (g === "n" ? A3N : A3)[key]! };
      }
      out[key] = form;
    }
  }
  return out;
}

// ---------------------------------------------------------------- verbs

export interface VerbSpec {
  id?: string;
  /** English: "love" or { base: "carry", s: "carries", … } */
  en: string | EnVerb;
  alt?: (string | EnVerb)[];
  tags?: string[];
  /** Takes an accusative object (default: true for most verbs listed as transitive). */
  trans?: boolean;
  /** Can stand without an object. */
  intrans?: boolean;
  irregular?: Irregular;
  shortImp?: boolean;
  note?: string;
}

const toEnVerb = (v: string | EnVerb): EnVerb => (typeof v === "string" ? { base: v } : v);

/** verb("amō, amāre, amāvī, amātum", { en: "love", trans: true }) */
export function verb(principalParts: string, spec: VerbSpec, source: Source): VerbEntry {
  const pp = principalParts.split(",").map((s) => s.trim()).filter(Boolean);
  const inf = pp[1] ?? "";
  let conj: Conj;
  if (spec.irregular) conj = "irr";
  else if (endsPlain(inf, "are")) conj = "1";
  else if (endsPlain(inf, "ire")) conj = "4";
  else if (endsPlain(inf, "ere")) {
    if (inf.endsWith("ēre") || endsPlain(pp[0], "eo")) conj = "2";
    else if (endsPlain(pp[0], "io")) conj = "3io";
    else conj = "3";
  } else throw new Error(`Cannot tell the conjugation of ${principalParts}`);
  const trans = spec.trans ?? false;
  return {
    kind: "verb",
    id: spec.id ?? idOf(pp[0]),
    pp,
    conj,
    irregular: spec.irregular,
    trans,
    intrans: spec.intrans ?? !trans,
    env: toEnVerb(spec.en),
    altv: spec.alt?.map(toEnVerb),
    en: toEnVerb(spec.en).base,
    alt: spec.alt?.map((a) => toEnVerb(a).base),
    tags: spec.tags ?? [],
    shortImp: spec.shortImp,
    note: spec.note,
    source,
  };
}

type Pairs = [string, string][]; // [stem, ending] for 1sg … 3pl

const sixFrom = (pairs: Pairs, tense: Tense, out: Partial<Record<VerbKey, Form>>) =>
  pairs.forEach(([stem, ending], i) => {
    out[`${tense}.${PNS[i]}` as VerbKey] = { stem, ending };
  });

const PERSONAL = ["m", "s", "t", "mus", "tis", "nt"];
const PERFECT = ["ī", "istī", "it", "imus", "istis", "ērunt"];

/** -ba- tense: short a before m / t / nt, long before s / mus / tis. */
function imperfect(stemBefore: string): Pairs {
  return PERSONAL.map((p) => [stemBefore + (p === "s" || p === "mus" || p === "tis" ? "bā" : "ba"), p]);
}

function futureB(stemBefore: string): Pairs {
  return [
    [stemBefore + "b", "ō"],
    [stemBefore + "bi", "s"],
    [stemBefore + "bi", "t"],
    [stemBefore + "bi", "mus"],
    [stemBefore + "bi", "tis"],
    [stemBefore + "bu", "nt"],
  ];
}

function futureE(stem: string): Pairs {
  return [
    [stem + "a", "m"],
    [stem + "ē", "s"],
    [stem + "e", "t"],
    [stem + "ē", "mus"],
    [stem + "ē", "tis"],
    [stem + "e", "nt"],
  ];
}

function perfect(perfStem: string): Pairs {
  return PERFECT.map((p) => [perfStem, p]);
}

const IRREGULAR: Record<Irregular, Partial<Record<VerbKey, string>>> = {
  sum: {
    "pres.1sg": "su|m", "pres.2sg": "e|s", "pres.3sg": "es|t", "pres.1pl": "su|mus", "pres.2pl": "es|tis", "pres.3pl": "su|nt",
    "impf.1sg": "era|m", "impf.2sg": "erā|s", "impf.3sg": "era|t", "impf.1pl": "erā|mus", "impf.2pl": "erā|tis", "impf.3pl": "era|nt",
    "fut.1sg": "er|ō", "fut.2sg": "eri|s", "fut.3sg": "eri|t", "fut.1pl": "eri|mus", "fut.2pl": "eri|tis", "fut.3pl": "eru|nt",
    "perf.1sg": "fu|ī", "perf.2sg": "fu|istī", "perf.3sg": "fu|it", "perf.1pl": "fu|imus", "perf.2pl": "fu|istis", "perf.3pl": "fu|ērunt",
    "imp.2sg": "es|", "imp.2pl": "es|te", inf: "es|se",
  },
  possum: {
    "pres.1sg": "possu|m", "pres.2sg": "pote|s", "pres.3sg": "potes|t", "pres.1pl": "possu|mus", "pres.2pl": "potes|tis", "pres.3pl": "possu|nt",
    "impf.1sg": "potera|m", "impf.2sg": "poterā|s", "impf.3sg": "potera|t", "impf.1pl": "poterā|mus", "impf.2pl": "poterā|tis", "impf.3pl": "potera|nt",
    "fut.1sg": "poter|ō", "fut.2sg": "poteri|s", "fut.3sg": "poteri|t", "fut.1pl": "poteri|mus", "fut.2pl": "poteri|tis", "fut.3pl": "poteru|nt",
    "perf.1sg": "potu|ī", "perf.2sg": "potu|istī", "perf.3sg": "potu|it", "perf.1pl": "potu|imus", "perf.2pl": "potu|istis", "perf.3pl": "potu|ērunt",
    inf: "pos|se",
  },
  eo: {
    "pres.1sg": "e|ō", "pres.2sg": "ī|s", "pres.3sg": "i|t", "pres.1pl": "ī|mus", "pres.2pl": "ī|tis", "pres.3pl": "eu|nt",
    "impf.1sg": "ība|m", "impf.2sg": "ībā|s", "impf.3sg": "ība|t", "impf.1pl": "ībā|mus", "impf.2pl": "ībā|tis", "impf.3pl": "ība|nt",
    "fut.1sg": "īb|ō", "fut.2sg": "ībi|s", "fut.3sg": "ībi|t", "fut.1pl": "ībi|mus", "fut.2pl": "ībi|tis", "fut.3pl": "ību|nt",
    "perf.1sg": "i|ī", "perf.2sg": "ī|stī", "perf.3sg": "i|it", "perf.1pl": "i|imus", "perf.2pl": "ī|stis", "perf.3pl": "i|ērunt",
    "imp.2sg": "ī|", "imp.2pl": "ī|te", inf: "ī|re",
  },
  volo: {
    "pres.1sg": "vol|ō", "pres.2sg": "vī|s", "pres.3sg": "vul|t", "pres.1pl": "volu|mus", "pres.2pl": "vul|tis", "pres.3pl": "volu|nt",
    "impf.1sg": "volēba|m", "impf.2sg": "volēbā|s", "impf.3sg": "volēba|t", "impf.1pl": "volēbā|mus", "impf.2pl": "volēbā|tis", "impf.3pl": "volēba|nt",
    "fut.1sg": "vola|m", "fut.2sg": "volē|s", "fut.3sg": "vole|t", "fut.1pl": "volē|mus", "fut.2pl": "volē|tis", "fut.3pl": "vole|nt",
    "perf.1sg": "volu|ī", "perf.2sg": "volu|istī", "perf.3sg": "volu|it", "perf.1pl": "volu|imus", "perf.2pl": "volu|istis", "perf.3pl": "volu|ērunt",
    inf: "vel|le",
  },
  fero: {
    "pres.1sg": "fer|ō", "pres.2sg": "fer|s", "pres.3sg": "fer|t", "pres.1pl": "feri|mus", "pres.2pl": "fer|tis", "pres.3pl": "feru|nt",
    "impf.1sg": "ferēba|m", "impf.2sg": "ferēbā|s", "impf.3sg": "ferēba|t", "impf.1pl": "ferēbā|mus", "impf.2pl": "ferēbā|tis", "impf.3pl": "ferēba|nt",
    "fut.1sg": "fera|m", "fut.2sg": "ferē|s", "fut.3sg": "fere|t", "fut.1pl": "ferē|mus", "fut.2pl": "ferē|tis", "fut.3pl": "fere|nt",
    "perf.1sg": "tul|ī", "perf.2sg": "tul|istī", "perf.3sg": "tul|it", "perf.1pl": "tul|imus", "perf.2pl": "tul|istis", "perf.3pl": "tul|ērunt",
    "imp.2sg": "fer|", "imp.2pl": "fer|te", inf: "fer|re",
  },
};

const verbCache = new Map<VerbEntry, Partial<Record<VerbKey, Form>>>();

/** Every form of a verb, keyed "pres.3sg", "imp.2pl", "inf". */
export function conjugate(e: VerbEntry): Partial<Record<VerbKey, Form>> {
  const cached = verbCache.get(e);
  if (cached) return cached;
  const out: Partial<Record<VerbKey, Form>> = {};
  if (e.irregular) {
    // compounds of an irregular verb (absum, adsum) carry a prefix before the irregular forms
    const prefix = prefixOf(e);
    for (const [k, v] of Object.entries(IRREGULAR[e.irregular])) {
      const f = splitForm(v!, "");
      out[k as VerbKey] = { stem: prefix + f.stem, ending: f.ending };
    }
    verbCache.set(e, out);
    return out;
  }
  const inf = e.pp[1];
  const base = cut(inf, 3); // am-āre, vid-ēre, dūc-ere, cap-ere, aud-īre
  const perfStem = e.pp[2] ? cut(e.pp[2], 1) : null;
  switch (e.conj) {
    case "1": {
      // dō, dare has a short a everywhere but dās and dā (damus, datis, dabam): its infinitive shows it
      const a = endsPlain(inf, "are") && !inf.endsWith("āre") ? "a" : "ā";
      sixFrom([[base, "ō"], [base + "ā", "s"], [base + "a", "t"], [base + a, "mus"], [base + a, "tis"], [base + "a", "nt"]], "pres", out);
      sixFrom(imperfect(base + a), "impf", out);
      sixFrom(futureB(base + a), "fut", out);
      out["imp.2sg"] = { stem: base, ending: "ā" };
      out["imp.2pl"] = { stem: base + a, ending: "te" };
      break;
    }
    case "2":
      sixFrom([[base + "e", "ō"], [base + "ē", "s"], [base + "e", "t"], [base + "ē", "mus"], [base + "ē", "tis"], [base + "e", "nt"]], "pres", out);
      sixFrom(imperfect(base + "ē"), "impf", out);
      sixFrom(futureB(base + "ē"), "fut", out);
      out["imp.2sg"] = { stem: base, ending: "ē" };
      out["imp.2pl"] = { stem: base + "ē", ending: "te" };
      break;
    case "3":
      sixFrom([[base, "ō"], [base + "i", "s"], [base + "i", "t"], [base + "i", "mus"], [base + "i", "tis"], [base + "u", "nt"]], "pres", out);
      sixFrom(imperfect(base + "ē"), "impf", out);
      sixFrom(futureE(base), "fut", out);
      out["imp.2sg"] = e.shortImp ? { stem: base, ending: "" } : { stem: base, ending: "e" };
      out["imp.2pl"] = { stem: base + "i", ending: "te" };
      break;
    case "3io":
      sixFrom([[base + "i", "ō"], [base + "i", "s"], [base + "i", "t"], [base + "i", "mus"], [base + "i", "tis"], [base + "iu", "nt"]], "pres", out);
      sixFrom(imperfect(base + "iē"), "impf", out);
      sixFrom(futureE(base + "i"), "fut", out);
      out["imp.2sg"] = e.shortImp ? { stem: base, ending: "" } : { stem: base, ending: "e" };
      out["imp.2pl"] = { stem: base + "i", ending: "te" };
      break;
    case "4":
      sixFrom([[base + "i", "ō"], [base + "ī", "s"], [base + "i", "t"], [base + "ī", "mus"], [base + "ī", "tis"], [base + "iu", "nt"]], "pres", out);
      sixFrom(imperfect(base + "iē"), "impf", out);
      sixFrom(futureE(base + "i"), "fut", out);
      out["imp.2sg"] = { stem: base, ending: "ī" };
      out["imp.2pl"] = { stem: base + "ī", ending: "te" };
      break;
  }
  if (perfStem) sixFrom(perfect(perfStem), "perf", out);
  out.inf = { stem: cut(inf, 2), ending: "re" };
  verbCache.set(e, out);
  return out;
}

function prefixOf(e: VerbEntry): string {
  const first = stripMarks(e.pp[0]).toLowerCase();
  const canonical: Record<Irregular, string> = { sum: "sum", possum: "possum", eo: "eo", volo: "volo", fero: "fero" };
  const root = canonical[e.irregular!];
  return first.endsWith(root) ? e.pp[0].slice(0, e.pp[0].length - root.length) : "";
}

// ---------------------------------------------------------- fixed words

export interface FixedSpec {
  id?: string;
  en: string;
  alt?: string[];
  tags?: string[];
  governs?: Case;
  note?: string;
}

export function fixed(lemma: string, role: FixedEntry["role"], spec: FixedSpec, source: Source): FixedEntry {
  return {
    kind: "fixed",
    id: spec.id ?? idOf(lemma) + (role === "prep" ? "-prep" : ""),
    lemma,
    role,
    governs: spec.governs,
    en: spec.en,
    alt: spec.alt,
    tags: spec.tags ?? [],
    note: spec.note,
    source,
  };
}

// --------------------------------------------------------------- lookup

/** The word itself, as it is said on its own: nominative, first person, or masculine form. */
export function headword(e: Entry): string {
  return e.kind === "verb" ? e.pp[0] : e.lemma;
}

export function dictionaryForm(e: Entry): string {
  switch (e.kind) {
    case "noun":
      return e.proper ? e.lemma : `${e.lemma}, ${e.gen}, ${e.gender}.`;
    case "adj":
      return e.cls === "12" || e.lemma !== e.fem || e.fem !== e.neut
        ? [...new Set([e.lemma, e.fem, e.neut])].join(", ")
        : `${e.lemma}, ${e.stem}is`;
    case "verb":
      return e.pp.join(", ");
    case "fixed":
      return e.lemma;
  }
}

export function pnOf(person: 1 | 2 | 3, n: Num): PN {
  return `${person}${n}` as PN;
}
