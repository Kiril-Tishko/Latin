// Latin in English as a series of short screens: a text, a small table, a
// list, the learner's own words in English, or a quick question with three
// answers, in the order of the story (how much of English is Latin, how it
// came, your words, verbs, plurals, grammar rules, word parts, spelling,
// grammar terms, abbreviations, phrases, Russian and Ukrainian). Each screen
// is meant to fit a phone without scrolling.
import { seeded, shuffle } from "../latin/generate";
import { headword } from "../latin/morph";
import { roman } from "../latin/text";
import { Entry } from "../latin/types";
import {
  ABBREVIATIONS, ASSIMILATION, ENGLISH_CASES, FROZEN_VERBS, GRAMMAR_RULES, GRAMMAR_TERMS, LATER_PLURALS, LATER_VERBS, PHRASES, PLURALS,
  PLURAL_TRAPS, PREFIXES, quizWords, SPELLINGS, SUFFIXES, TABLE_PAIRS, THREE_LANGUAGES, TRIPLETS, WAVES, wordInEnglish,
} from "./english";

export type Body =
  | { kind: "text"; paras: string[] }
  | { kind: "table"; intro?: string; head: string[]; rows: string[][] }
  | { kind: "list"; intro?: string; items: string[] }
  | { kind: "words"; intro?: string; entries: Entry[] }
  | { kind: "quiz"; q: string; options: string[]; answer: number; why?: string }
  | { kind: "end" };

export interface Step {
  /** Which part of the story it belongs to (the eyebrow). */
  part: string;
  title: string;
  body: Body;
}

const PARTS = [
  "More than half of English",
  "How Latin came to English",
  "Your words in English",
  "Latin verbs inside English",
  "Latin plurals in English",
  "Grammar rules from Latin",
  "Building words with Latin parts",
  "Letters added for Latin",
  "Grammar words are Latin",
  "Latin abbreviations",
  "Latin phrases in English",
  "Russian and Ukrainian",
];

/** Splits a list into screens of at most n rows. */
const chunks = <T,>(xs: T[], n: number): T[][] => {
  const k = Math.ceil(xs.length / n);
  const size = Math.ceil(xs.length / k);
  return Array.from({ length: k }, (_, i) => xs.slice(i * size, (i + 1) * size));
};

/** A question with its right answer first, shuffled the same way every time. */
function quiz(seed: number, q: string, right: string, wrong: string[], why?: string): Body {
  const options = shuffle(seeded(seed), [right, ...wrong.filter((w) => w !== right).slice(0, 2)]);
  return { kind: "quiz", q, options, answer: options.indexOf(right), why };
}

const pick = <T,>(xs: T[], i: number) => xs[((i % xs.length) + xs.length) % xs.length];

/** Every screen, in order (the learner's own words make the third part). */
export function englishSteps(words: Entry[]): Step[] {
  const steps: Step[] = [];
  const add = (part: number, title: string, body: Body) => steps.push({ part: `${roman(part + 1)} · ${PARTS[part]}`, title, body });

  // I: more than half of English
  add(0, "Six in ten", {
    kind: "text",
    paras: [
      "Count the words in a big English dictionary and about **six in ten** come from Latin: half straight from Latin, half through French, Latin's daughter.",
      "Old English and the other Germanic languages give about a quarter, Greek about one word in twenty.",
    ],
  });
  add(0, "But not the everyday words", {
    kind: "text",
    paras: [
      "The words you use most are Old English: *the, and, is, I, you, eat, drink, sleep, water*. Latin gave English its longer, more learned words.",
      "*The teacher teaches* is all Old English; in *the student studies* both words come from «studeō».",
    ],
  });
  add(0, "Three words for one thing", { kind: "table", intro: "The Old English word is plain, the French one a little finer, the Latin one learned.", head: ["Old English", "French", "Latin"], rows: TRIPLETS.map((t) => [...t]) });
  {
    const t = TRIPLETS[1];
    const others = TRIPLETS.filter((x) => x !== t);
    add(0, "Quick question", quiz(1, `Which word for *${t[0]}* is the Latin one?`, t[2], [t[0], t[1], others[0][2]], `*${t[2]}* is the learned, Latin word.`));
  }
  add(0, "On the farm, on the table", {
    kind: "table",
    intro: "After 1066 English peasants kept the animals and Norman lords ate them: the animal kept its English name, the meat got a French one, from Latin.",
    head: ["On the farm", "On the table", "Latin"],
    rows: TABLE_PAIRS.map((t) => [t.animal, t.meat, t.latin]),
  });
  {
    const t = TABLE_PAIRS[0];
    add(0, "Quick question", quiz(2, `Which word did the Norman lords eat: the French one, from Latin?`, t.meat, [t.animal, TABLE_PAIRS[1].animal], `*${t.meat}* came with the Normans; *${t.animal}* is Old English.`));
  }

  // II: the waves
  WAVES.forEach((w, i) => {
    add(1, w.title, { kind: "list", intro: `**${w.when}.** ${w.text}`, items: w.words.slice(0, 6).map(([en, la, gloss]) => `**${en}** ← «${la}»${gloss ? `, ${gloss}` : ""}`) });
    if (i % 2 === 1) {
      const [en, la] = w.words[0];
      const others = WAVES.filter((x) => x !== w).flatMap((x) => x.words.map((y) => y[0]));
      add(1, "Quick question", quiz(10 + i, `Which English word comes from «${la}»?`, en, [pick(others, i * 3), pick(others, i * 3 + 5)]));
    }
  });

  // III: the learner's words
  const mine = words.filter((w) => (wordInEnglish(w.id)?.from.en?.length ?? 0) > 0);
  chunks(mine, 4).forEach((group, i) => {
    add(2, i ? "Your words in English, more" : "Your words in English", { kind: "words", intro: i ? undefined : "Latin words you know, and the English words that grew from them (Russian and Ukrainian too, where they took them).", entries: group });
    const w = group.find((x) => quizWords(x.id).length);
    if (w && i % 3 === 0) {
      const others = mine.filter((x) => x !== w && x.kind === w.kind).map((x) => headword(x));
      add(2, "Quick question", quiz(30 + i, `Which Latin word hides in *${quizWords(w.id)[0]}*?`, headword(w), [pick(others, i), pick(others, i + 2)]));
    }
  });

  // IV: verbs
  add(3, "Whole Latin verbs, endings and all", { kind: "text", paras: ["You know the endings that say who acts: «labōrō», «labōrās», «labōrat», «labōrant».", "English kept some Latin verb forms whole, endings and all. The next screens show them."] });
  FROZEN_VERBS.forEach((g, i) => {
    add(3, `${g.ending}: ${g.who}`, { kind: "list", items: g.items.slice(0, 5).map((v) => `**${v.en}** · ${v.la}: *${v.meaning}*${v.note ? `. ${v.note}` : ""}`) });
    if (i === 0) {
      const v = g.items[0];
      add(3, "Quick question", quiz(40, `English *${v.en}* is a Latin verb. What did it mean?`, v.meaning, [g.items[1]?.meaning ?? "I see", FROZEN_VERBS[1]?.items[0]?.meaning ?? "they work"]));
    }
  });
  add(3, "Forms for later", { kind: "list", items: LATER_VERBS.map((v) => `**${v.en}** · ${v.la}: *${v.meaning}*${v.note ? `. ${v.note}` : ""}`) });

  // V: plurals
  PLURALS.forEach((g, i) => {
    add(4, `-${g.sg} → -${g.pl}`, { kind: "list", intro: g.known ? `Like «${g.known.replace(/«|»/g, "")}» in Latin.` : "The neuter plural, for later.", items: g.pairs.slice(0, 6).map(([sg, pl]) => `${sg} → **${pl}**`) });
    if (i === 0) {
      const [sg, pl] = g.pairs[0];
      const stem = sg.slice(0, sg.length - g.sg.length);
      add(4, "Quick question", quiz(50, `The Latin plural of *${sg}*?`, pl, [`${stem}ae`, `${stem}a`, `${sg}es`].filter((x) => x !== pl)));
    }
  });
  add(4, "Watch out", { kind: "list", intro: `Later declensions: ${LATER_PLURALS.map(([sg, pl]) => `${sg} → ${pl}`).join(", ")}.`, items: PLURAL_TRAPS });

  // VI: grammar rules
  add(5, "Rules made to look Latin", { kind: "text", paras: ["From the 1600s on, English grammarians admired Latin and wrote rules to make English behave more like it. Some stuck, most are now ignored.", "One case is the other way round: English cases are not borrowed at all, but cousins of the Latin ones."] });
  GRAMMAR_RULES.forEach((r) => {
    add(5, r.title, { kind: "table", head: ["", ""], rows: [["Latin", r.latin], ["English", r.english], ["Today", r.today], ...(r.slavic ? [["RU · UA", r.slavic]] : [])] });
    if (r.id === "who-whom") add(5, "English cases, Latin's cousins", { kind: "table", head: ["English", "Latin", "Case"], rows: ENGLISH_CASES.map((x) => [...x]) });
  });

  // VII: word parts
  chunks(PREFIXES, 5).forEach((group, i) =>
    add(6, i ? "Latin prefixes, more" : "Latin prefixes", { kind: "table", intro: i ? undefined : "English builds new words with Latin parts all the time: *postwar, supermarket, rewrite*.", head: ["Prefix", "Means", "In English"], rows: group.map((x) => [`**${x.prefix}**`, x.meaning, x.examples]) }),
  );
  {
    const x = PREFIXES[2];
    add(6, "Quick question", quiz(60, `What does the prefix **${x.prefix}** mean?`, x.meaning, [PREFIXES[5].meaning, PREFIXES[8].meaning]));
  }
  chunks(ASSIMILATION, 7).forEach((group, i) =>
    add(6, i ? "The sound rule, more" : "The sound rule English kept", {
      kind: "list",
      intro: i ? undefined : "A Latin prefix changes its last sound to suit the next one: *impossible*, *illegal*, but *inactive*.",
      items: group.map((x) => `${x.parts} → **${x.word}** (${x.rule})`),
    }),
  );
  add(6, "Endings that build words", { kind: "table", head: ["Ending", "Means", "From your words"], rows: SUFFIXES.map((x) => [`**${x.suffix}**`, x.meaning, x.examples]) });

  // VIII: spelling
  add(7, "Silent letters for Latin's sake", {
    kind: "list",
    intro: "Around 1500 scholars respelled English words to show their Latin parents, adding letters nobody says. Twice they picked the wrong parent.",
    items: SPELLINGS.map((x) => `**${x.word}** was ${x.before}; ${x.wrong ? `the ${x.letter} came from` : "Latin"} ${x.latin}`),
  });
  {
    const x = SPELLINGS[0];
    const letters = [...new Set(x.word.replace(x.letter, "").split(""))].filter((c) => /[a-z]/.test(c));
    add(7, "Quick question", quiz(70, `Which letter in *${x.word}* was added for Latin?`, x.letter, [letters[0], letters[letters.length - 1]]));
  }

  // IX: grammar terms
  chunks(GRAMMAR_TERMS, 5).forEach((group, i) => add(8, i ? "Grammar words, more" : "The words of grammar are Latin", { kind: "table", head: ["Term", "Latin", "Literally"], rows: group.map((x) => [`**${x.term}**`, x.latin, x.meaning]) }));
  {
    const x = GRAMMAR_TERMS[0];
    add(8, "Quick question", quiz(80, `*${x.term}* literally means…`, x.meaning, [GRAMMAR_TERMS[3].meaning, GRAMMAR_TERMS[6].meaning]));
  }

  // X: abbreviations
  const abbr = chunks(ABBREVIATIONS, 6);
  abbr.forEach((group, i) => {
    add(9, i ? "Abbreviations, more" : "Latin abbreviations", { kind: "table", head: ["Short", "Latin", "Means"], rows: group.map((x) => [`**${x.abbr}**`, x.latin, x.meaning]) });
    if (i % 2 === 0 && i < abbr.length - 1) return;
    // a question on what was just read
    const x = group[0];
    const at = ABBREVIATIONS.indexOf(x);
    add(9, "Quick question", quiz(90 + i, `What does **${x.abbr}** stand for?`, x.meaning, [pick(ABBREVIATIONS, at + 4).meaning, pick(ABBREVIATIONS, at + 9).meaning]));
  });

  // XI: phrases
  chunks(PHRASES, 6).forEach((group, i) => add(10, i ? "Latin phrases, more" : "Latin English uses every day", { kind: "list", items: group.map((x) => `«${x.la}» · ${x.en}${x.note ? `. ${x.note}` : ""}`) }));
  {
    const x = PHRASES[1];
    add(10, "Quick question", quiz(100, `What does «${x.la}» mean?`, x.en, [PHRASES[4].en, PHRASES[8].en]));
  }

  // XII: Russian and Ukrainian
  add(11, "The same words, later", {
    kind: "text",
    paras: [
      "Russian and Ukrainian took the same Latin words later, mostly from the 1600s on, through Polish, German and French, and through schools that taught in Latin, such as the Kyiv-Mohyla Academy.",
      "That is why so many learned words are shared by all three languages. Church words are the exception: the Slavs took them from Greek, where English took them from Latin.",
    ],
  });
  chunks(THREE_LANGUAGES, 6).forEach((group, i) => add(11, i ? "Three languages, more" : "One word, three languages", { kind: "table", head: ["Latin", "English", "Russian", "Ukrainian"], rows: group.map((x) => [x.la, x.en, x.ru, x.uk]) }));

  steps.push({ part: "Fīnis", title: "The end", body: { kind: "end" } });
  return steps;
}

