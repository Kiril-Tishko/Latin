// Questions in Latin about the learner, answered in Latin with their own words
// (the "Answer in Latin" practice, trainer/answers.ts). The question words are
// new (the videos have not taught them yet), so each comes with its meaning.
//
//   la:       the question (only lesson words besides the question word)
//   verb:     the verb the answer uses, as the learner's own (-ō), when it must be that one
//   slot:     what the answer has to give (a thing, a place, where to, who, to …, why)
//   needs:    the rules to read the question and answer it (all must have been seen)
//   example:  a good answer (tests check that it passes the page's own check)

export type Slot = "obj" | "place" | "goal" | "pred" | "inf" | "reason";

export interface YouQuestion {
  id: string;
  la: string;
  en: string;
  verb?: string;
  slot: Slot;
  needs: string[];
  example: string;
}

/** The question words, with their meanings. */
export const QUESTION_WORDS: Record<string, string> = {
  quid: "quid = what",
  quis: "quis = who",
  ubi: "ubi = where",
  quō: "quō = where to",
  cūr: "cūr = why",
};

const YOU = ["v.2sg", "v.1sg"];

export const YOU_QUESTIONS: YouQuestion[] = [
  { id: "legis", la: "Quid legis?", en: "What do you read?", verb: "lego", slot: "obj", needs: [...YOU, "s.svo", "n1.acc.sg"], example: "Epistulam legō." },
  { id: "scribis", la: "Quid scrībis?", en: "What do you write?", verb: "scribo", slot: "obj", needs: [...YOU, "s.svo", "n1.acc.sg"], example: "Epistulam scrībō." },
  { id: "bibis", la: "Quid bibis?", en: "What do you drink?", verb: "bibo", slot: "obj", needs: [...YOU, "s.svo", "n1.acc.sg"], example: "Aquam bibō." },
  { id: "vides", la: "Quid vidēs?", en: "What do you see?", verb: "video", slot: "obj", needs: [...YOU, "s.svo", "n1.acc.sg"], example: "Silvam videō." },
  { id: "habes", la: "Quid habēs?", en: "What do you have?", verb: "habeo", slot: "obj", needs: [...YOU, "s.svo", "n2.acc.sg"], example: "Librum habeō." },
  { id: "spectas", la: "Quid spectās?", en: "What are you looking at?", verb: "specto", slot: "obj", needs: [...YOU, "s.svo", "n1.acc.sg"], example: "Silvam spectō." },
  { id: "portas", la: "Quid portās?", en: "What are you carrying?", verb: "porto", slot: "obj", needs: [...YOU, "s.svo", "n1.acc.sg"], example: "Aquam portō." },
  { id: "desideras", la: "Quid dēsīderās?", en: "What do you miss?", verb: "desidero", slot: "obj", needs: [...YOU, "s.svo", "n1.acc.sg"], example: "Amīcam dēsīderō." },
  { id: "discis", la: "Quid discis?", en: "What are you learning (to do)?", verb: "disco", slot: "inf", needs: [...YOU, "s.inf", "v.inf"], example: "Scrībere discō." },
  { id: "potes", la: "Quid potes?", en: "What can you do?", verb: "possum", slot: "inf", needs: ["v.possum", "s.inf", "v.inf"], example: "Legere possum." },
  { id: "es", la: "Quis es?", en: "Who are you?", verb: "sum", slot: "pred", needs: ["v.sum", "s.est"], example: "Discipulus sum." },
  { id: "laboras-ubi", la: "Ubi labōrās?", en: "Where do you work?", verb: "laboro", slot: "place", needs: [...YOU, "s.loc", "n1.abl.sg"], example: "In scholā labōrō." },
  { id: "studes", la: "Ubi studēs?", en: "Where do you study?", verb: "studeo", slot: "place", needs: [...YOU, "s.loc", "n1.abl.sg"], example: "In scholā studeō." },
  { id: "habitas", la: "Ubi habitās?", en: "Where do you live?", verb: "habito", slot: "place", needs: [...YOU, "s.loc", "n1.abl.sg"], example: "In terrā habitō." },
  { id: "ambulas", la: "Quō ambulās?", en: "Where are you walking to?", verb: "ambulo", slot: "goal", needs: [...YOU, "s.ad", "n1.acc.sg"], example: "Ad scholam ambulō." },
  { id: "laboras-cur", la: "Cūr labōrās?", en: "Why do you work?", verb: "laboro", slot: "reason", needs: [...YOU, "s.conn"], example: "Labōrō quod discō." },
  { id: "bibis-cur", la: "Cūr aquam bibis?", en: "Why do you drink water?", verb: "bibo", slot: "reason", needs: [...YOU, "s.conn", "s.svo", "n1.acc.sg"], example: "Aquam bibō quod labōrō." },
];

/** The meanings of the question words in a question ("quid = what"). */
export const glossesOf = (la: string): string[] =>
  Object.entries(QUESTION_WORDS)
    .filter(([w]) => new RegExp(`(^|[^\\p{L}])${w}([^\\p{L}]|$)`, "iu").test(la))
    .map(([, g]) => g);
