// Core grammatical vocabulary of the engine.

export type Case = "nom" | "gen" | "dat" | "acc" | "abl" | "voc";
export type Num = "sg" | "pl";
export type Gender = "m" | "f" | "n";

export const CASES: Case[] = ["nom", "gen", "dat", "acc", "abl", "voc"];
export const NUMS: Num[] = ["sg", "pl"];

export const CASE_NAMES: Record<Case, string> = {
  nom: "nominative",
  gen: "genitive",
  dat: "dative",
  acc: "accusative",
  abl: "ablative",
  voc: "vocative",
};

/** The matching Russian / Ukrainian case, for learners who know those systems. */
export const CASE_SLAVIC: Record<Case, { ru: string; uk: string }> = {
  nom: { ru: "именительный", uk: "називний" },
  gen: { ru: "родительный", uk: "родовий" },
  dat: { ru: "дательный", uk: "давальний" },
  acc: { ru: "винительный", uk: "знахідний" },
  abl: { ru: "творительный / предложный", uk: "орудний / місцевий" },
  voc: { ru: "звательная форма", uk: "кличний" },
};

export const CASE_ROLE: Record<Case, string> = {
  nom: "the subject: who or what does the action",
  gen: "of / 's: whose",
  dat: "to / for whom",
  acc: "the direct object: who or what receives the action",
  abl: "by / with / from / in (often after a preposition)",
  voc: "calling someone directly",
};

export type NounKey = `${Case}.${Num}`;

export type Tense = "pres" | "impf" | "fut" | "perf";
export type PN = "1sg" | "2sg" | "3sg" | "1pl" | "2pl" | "3pl";
export const PNS: PN[] = ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"];
export const TENSES: Tense[] = ["pres", "impf", "fut", "perf"];
export type VerbKey = `${Tense}.${PN}` | "imp.2sg" | "imp.2pl" | "inf";

export const TENSE_NAMES: Record<Tense, string> = {
  pres: "present",
  impf: "imperfect",
  fut: "future",
  perf: "perfect",
};

export const PN_NAMES: Record<PN, string> = {
  "1sg": "I",
  "2sg": "you (one person)",
  "3sg": "he / she / it",
  "1pl": "we",
  "2pl": "you (several people)",
  "3pl": "they",
};

/** A word form split into the part that stays and the ending that changes. */
export interface Form {
  stem: string;
  ending: string;
}

export const full = (f: Form): string => f.stem + f.ending;

export type Decl = "1" | "2" | "2n" | "3" | "3n" | "4" | "4n" | "5";
export type Conj = "1" | "2" | "3" | "3io" | "4" | "irr";
export type Irregular = "sum" | "possum" | "eo" | "volo" | "fero";

/** English verb forms. Missing ones are derived by regular rules. */
export interface EnVerb {
  base: string; // love
  s?: string; // loves
  ing?: string; // loving
  past?: string; // loved
  pp?: string; // loved (past participle)
  /** Words that follow the verb in English, e.g. "at" for "look at". */
  particle?: string;
}

interface EntryBase {
  id: string;
  /** English meaning used in prompts. */
  en: string;
  /** Other acceptable English meanings. */
  alt?: string[];
  /** Semantic tags: person, animal, place, thing, food, building, nature, abstract… */
  tags: string[];
  /** Where the word came from: a lesson number or the Discover deck. */
  source: { lesson: number } | { deck: true };
  /** Short note shown on the word card (e.g. "masculine, even though it ends in -a"). */
  note?: string;
}

export interface NounEntry extends EntryBase {
  kind: "noun";
  lemma: string; // nominative singular, with long marks
  gen: string; // genitive singular, with long marks
  gender: Gender;
  decl: Decl;
  stem: string;
  iStem: boolean;
  /** English plural when not regular ("men"). */
  enPl?: string;
  only?: Num;
  proper?: boolean;
  /** Irregular forms that override the generated ones. */
  forms?: Partial<Record<NounKey, string>>;
}

export interface AdjEntry extends EntryBase {
  kind: "adj";
  lemma: string; // masculine nominative singular
  fem: string;
  neut: string;
  cls: "12" | "3";
  stem: string;
}

export interface VerbEntry extends EntryBase {
  kind: "verb";
  /** Principal parts: amō, amāre, amāvī, amātum. */
  pp: string[];
  conj: Conj;
  irregular?: Irregular;
  /** Takes a direct object in the accusative. */
  trans: boolean;
  /** Can be used with no object. */
  intrans: boolean;
  env: EnVerb;
  altv?: EnVerb[];
  /** dūc, dīc, fac, fer: imperative singular without -e. */
  shortImp?: boolean;
}

/** Words that never change: prepositions, conjunctions, adverbs, question words. */
export interface FixedEntry extends EntryBase {
  kind: "fixed";
  lemma: string;
  role: "prep" | "conj" | "adv" | "neg" | "question" | "interj" | "enclitic" | "pron";
  /** Case a preposition takes. */
  governs?: Case;
}

export type Entry = NounEntry | AdjEntry | VerbEntry | FixedEntry;
