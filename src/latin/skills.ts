// The grammar points a learner can know. Lessons unlock them; exercises
// practise them; mastery is tracked per skill.
import { Case, Decl, Gender, Num } from "./types";

export type SkillGroup = "verbs" | "nouns" | "adjectives" | "sentences";

export interface Skill {
  id: string;
  group: SkillGroup;
  /** Short label, e.g. "-am: the object". */
  title: string;
  /** The ending(s) involved, for chips: "-am". */
  ending?: string;
  /** Case the ending marks, for its color. */
  case?: Case;
  num?: Num;
  /** "verb" colors personal endings. */
  verb?: boolean;
  /** One-sentence reminder shown in hints and sent to Claude. */
  hint: string;
}

const S = (s: Skill) => s;

export const SKILLS: Skill[] = [
  // verbs
  S({ id: "v.1sg", group: "verbs", title: "ego: -ō (I)", ending: "-ō", verb: true, hint: "With ego (I), the verb ends in -ō: labōrō, doceō, scrībō, dormiō." }),
  S({ id: "v.2sg", group: "verbs", title: "tū: -s (you)", ending: "-s", verb: true, hint: "With tū (you), the verb ends in -s: labōrās, docēs, scrībis, dormīs." }),
  S({ id: "v.3sg", group: "verbs", title: "he / she / it: -t", ending: "-t", verb: true, hint: "For one person or thing (he, she, it, the girl), the verb ends in -t: labōrat, docet, scrībit, dormit." }),
  S({ id: "v.3pl", group: "verbs", title: "they: -nt", ending: "-nt", verb: true, hint: "For several people (they, the girls), the verb ends in -nt: labōrant, docent, scrībunt, dormiunt." }),
  S({ id: "v.inf", group: "verbs", title: "infinitive: -re (to …)", ending: "-re", verb: true, hint: "The infinitive means 'to …' and ends in -re: labōrāre, docēre, scrībere, dormīre." }),
  S({ id: "v.sum", group: "verbs", title: "sum, es, est (to be)", verb: true, hint: "To be is irregular: sum (I am), es (you are), est (he / she / it is)." }),
  S({ id: "v.possum", group: "verbs", title: "possum, potes, potest (can)", verb: true, hint: "Can = pot- + sum: possum, potes, potest, followed by an infinitive (legere potest: he can read)." }),
  S({ id: "v.1pl", group: "verbs", title: "nōs: -mus (we)", ending: "-mus", verb: true, hint: "With nōs (we), the verb ends in -mus, after the vowel of the tū form: ambulās → ambulāmus, vidēs → vidēmus, bibis → bibimus, dormīs → dormīmus." }),
  S({ id: "v.sunt", group: "verbs", title: "sunt (they are)", verb: true, hint: "The plural of est is sunt, and what is said of the subject goes plural too: Via longa est → Viae longae sunt." }),

  // nouns, first declension
  S({ id: "n1.nom.sg", group: "nouns", title: "-a: the subject", ending: "-a", case: "nom", num: "sg", hint: "First-declension subject (nominative): puella, magistra, agricola." }),
  S({ id: "n1.acc.sg", group: "nouns", title: "-am: the object", ending: "-am", case: "acc", num: "sg", hint: "First-declension object (accusative) adds -m: puellam, epistulam." }),
  S({ id: "n1.gen.sg", group: "nouns", title: "-ae: of / 's", ending: "-ae", case: "gen", num: "sg", hint: "First-declension 'of' (genitive) ends in -ae: epistula poētae (the poet's letter)." }),
  S({ id: "n1.abl.sg", group: "nouns", title: "-ā: in / at (place)", ending: "-ā", case: "abl", num: "sg", hint: "First-declension ablative ends in long -ā: in silvā (in the forest)." }),
  S({ id: "n1.nom.pl", group: "nouns", title: "-ae: subjects (plural)", ending: "-ae", case: "nom", num: "pl", hint: "Plural subject of the first declension ends in -ae, the same as 'of': puellae (girls)." }),
  S({ id: "n1.dat.sg", group: "nouns", title: "-ae: to / for (dative)", ending: "-ae", case: "dat", num: "sg", hint: "First-declension dative, the one something is given or told to, ends in -ae: puellae aquam dō (I give water to the girl)." }),

  // nouns, second declension masculine
  S({ id: "n2.nom.sg", group: "nouns", title: "-us / -er: the subject", ending: "-us", case: "nom", num: "sg", hint: "Second-declension subject: discipulus, amīcus; a few end in -er: liber." }),
  S({ id: "n2.acc.sg", group: "nouns", title: "-um: the object", ending: "-um", case: "acc", num: "sg", hint: "Second-declension object ends in -um: discipulum, librum." }),
  S({ id: "n2.gen.sg", group: "nouns", title: "-ī: of / 's", ending: "-ī", case: "gen", num: "sg", hint: "Second-declension 'of' ends in -ī: liber discipulī (the student's book)." }),
  S({ id: "n2.abl.sg", group: "nouns", title: "-ō: in / at (place)", ending: "-ō", case: "abl", num: "sg", hint: "Second-declension ablative ends in long -ō: in Olympō, in librō." }),
  S({ id: "n2.nom.pl", group: "nouns", title: "-ī: subjects (plural)", ending: "-ī", case: "nom", num: "pl", hint: "Plural subject of the second declension ends in -ī, the same as 'of': discipulī (students)." }),
  S({ id: "n2.dat.sg", group: "nouns", title: "-ō: to / for (dative)", ending: "-ō", case: "dat", num: "sg", hint: "Second-declension dative ends in long -ō, like the ablative: discipulō librum dō (I give the student a book)." }),

  // nouns, second declension neuter
  S({ id: "n2n.nom.sg", group: "nouns", title: "neuter -um: the subject", ending: "-um", case: "nom", num: "sg", hint: "Neuter nouns end in -um as the subject: vīnum." }),
  S({ id: "n2n.acc.sg", group: "nouns", title: "neuter -um: the object", ending: "-um", case: "acc", num: "sg", hint: "Neuter nouns look the same as subject and object: vīnum bibō." }),
  S({ id: "n2n.gen.sg", group: "nouns", title: "neuter -ī: of / 's", ending: "-ī", case: "gen", num: "sg", hint: "Neuter 'of' ends in -ī, like amīcī: vīnī." }),
  S({ id: "n2n.abl.sg", group: "nouns", title: "neuter -ō: in / at", ending: "-ō", case: "abl", num: "sg", hint: "Neuter ablative ends in long -ō: in vīnō." }),

  // adjectives
  S({ id: "adj.agree", group: "adjectives", title: "adjective matches its noun", hint: "An adjective takes the same case and number as its noun: longam epistulam, magistra magna." }),
  S({ id: "adj.gender", group: "adjectives", title: "matches the gender, not the ending", hint: "Adjectives follow the noun's gender: poēta pulcher, agricola magnus (both masculine)." }),

  // sentences
  S({ id: "s.sv", group: "sentences", title: "subject + verb", hint: "Latin has no 'a' or 'the': Poēta scrībit = the poet writes / a poet writes." }),
  S({ id: "s.et", group: "sentences", title: "et (and)", hint: "et joins words or sentences: Legit et discit (reads and learns)." }),
  S({ id: "s.svo", group: "sentences", title: "subject, object, verb", hint: "The ending, not the position, shows who does what: Magistra discipulam docet = Discipulam magistra docet." }),
  S({ id: "s.drop", group: "sentences", title: "subject left out", hint: "The verb ending already says who acts, so ego / tū are often dropped: Legō = I read." }),
  S({ id: "s.gen", group: "sentences", title: "possession (whose)", hint: "The genitive says whose: epistula poētae = the poet's letter (the letter of the poet)." }),
  S({ id: "s.non", group: "sentences", title: "nōn (not)", hint: "Put nōn right before the verb: Discipula nōn discit (the student does not learn)." }),
  S({ id: "s.conn", group: "sentences", title: "sed, quod, nēmō, bene", hint: "sed = but, quod = because, nēmō = no one, bene = well." }),
  S({ id: "s.inf", group: "sentences", title: "verb + infinitive", hint: "An infinitive completes a verb: scrībere discit (learns to write), legere potest (can read)." }),
  S({ id: "s.est", group: "sentences", title: "X est Y", hint: "est works like '=': both sides are in the nominative: Agricola poēta est." }),
  S({ id: "s.loc", group: "sentences", title: "in + ablative: where", hint: "in + ablative says where something happens: in silvā ambulō (I walk in the forest)." }),
  S({ id: "s.into", group: "sentences", title: "in + accusative: into", hint: "in + accusative says where to: in silvam ambulō (I walk into the forest)." }),
  S({ id: "s.ad", group: "sentences", title: "ad + accusative: to", hint: "ad + accusative means to / toward: ad scholam ambulō (I walk to school)." }),
  S({ id: "s.pl", group: "sentences", title: "plural subjects", hint: "Several subjects take a plural verb in -nt: Puellae fugitant; Discipulus et discipula student." }),
  S({ id: "s.dat", group: "sentences", title: "the dative: to whom", hint: "The one something is given, sent or read to takes the dative: Discipula discipulō gladium dat (the student gives the student a sword)." }),
  S({ id: "s.city", group: "sentences", title: "Rōmam, Rōmae: a city needs no in", hint: "With the name of a city there is no in / ad: Rōmam ambulō (I walk to Rome); Rōmae habitō (I live in Rome, the locative)." }),
];

export const SKILL_BY_ID = new Map(SKILLS.map((s) => [s.id, s]));

export function skill(id: string): Skill {
  const s = SKILL_BY_ID.get(id);
  if (!s) throw new Error(`Unknown skill ${id}`);
  return s;
}

/** Noun declension group used in skill ids. */
export function declGroup(decl: Decl): string {
  return decl === "1" ? "n1" : decl === "2" ? "n2" : decl === "2n" ? "n2n" : `n${decl}`;
}

/** The skill needed to use a noun (or an adjective agreeing with one of this gender) in a case. */
export function nounSkill(decl: Decl, c: Case, n: Num): string {
  return `${declGroup(decl)}.${c}.${n}`;
}

/** Adjectives of the -us/-a/-um type borrow the endings of these declensions. */
export function adjDecl(g: Gender): Decl {
  return g === "f" ? "1" : g === "n" ? "2n" : "2";
}
