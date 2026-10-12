// The words of the messenger. The people there write only with words the
// learner knows, in the forms of the rules the learner has seen, plus a few
// chat words every conversation needs (salvē, valē, quid agis?…) and names.
// Everything here is plain data and pure functions, so the page, the tests and
// the phone-notification routine agree on what may be written.
import { OTHER_NAMES, PEOPLE } from "../content/people";
import { STORY_ONLY } from "../content/words";
import { Lexicon } from "../latin/analyze";
import { conjugate, declineAdj, declineNoun, fixed, noun, verb } from "../latin/morph";
import { adjDecl, nounSkill } from "../latin/skills";
import { stripMarks } from "../latin/text";
import { Case, Entry, full, Gender, NounKey, Num } from "../latin/types";

const CHAT = { chat: true } as const;

/** Words for chatting that the lessons have not taught yet (each shows its meaning). */
export const CHAT_WORDS: Entry[] = [
  fixed("salvē", "interj", { id: "salve", en: "hello", alt: ["hi"], note: "To several people: salvēte." }, CHAT),
  fixed("salvēte", "interj", { id: "salvete", en: "hello (to several people)" }, CHAT),
  fixed("valē", "interj", { id: "vale", en: "goodbye", alt: ["bye"], note: "To several people: valēte." }, CHAT),
  fixed("valēte", "interj", { id: "valete", en: "goodbye (to several people)" }, CHAT),
  fixed("ita", "adv", { id: "ita", en: "yes", alt: ["so"] }, CHAT),
  fixed("minimē", "adv", { id: "minime", en: "no", alt: ["not at all"] }, CHAT),
  fixed("quid", "question", { id: "quid", en: "what" }, CHAT),
  fixed("quis", "question", { id: "quis", en: "who" }, CHAT),
  fixed("ubi", "question", { id: "ubi", en: "where" }, CHAT),
  fixed("quō", "question", { id: "quo", en: "where to" }, CHAT),
  fixed("cūr", "question", { id: "cur", en: "why" }, CHAT),
  fixed("hodiē", "adv", { id: "hodie", en: "today" }, CHAT),
  fixed("crās", "adv", { id: "cras", en: "tomorrow" }, CHAT),
  fixed("quoque", "adv", { id: "quoque", en: "also", alt: ["too"] }, CHAT),
  fixed("male", "adv", { id: "male", en: "badly", alt: ["bad"] }, CHAT),
  fixed("optimē", "adv", { id: "optime", en: "very well", alt: ["great"] }, CHAT),
  fixed("grātiās", "interj", { id: "gratias", en: "thanks", alt: ["thank you"] }, CHAT),
  fixed("heu", "interj", { id: "heu", en: "oh no!", alt: ["alas"] }, CHAT),
  fixed("euge", "interj", { id: "euge", en: "great!", alt: ["hooray", "well done"] }, CHAT),
  fixed("ecce", "interj", { id: "ecce", en: "look!", alt: ["here is"] }, CHAT),
  fixed("ō", "interj", { id: "o", en: "oh (calling someone: «Ō Iuppiter!»)" }, CHAT),
  fixed("hahae", "interj", { id: "hahae", en: "haha" }, CHAT),
  verb("agō, agere, ēgī, āctum", { id: "ago", en: { base: "do", s: "does", past: "did", pp: "done", ing: "doing" }, trans: true, intrans: true, note: "«Quid agis?» = How are you? (literally: what are you doing?)" }, CHAT),
];

/** The chat words to list for the learner (the plural greetings go with their singulars). */
export const CHAT_WORD_LIST = CHAT_WORDS.filter((w) => !["salvete", "valete", "hahae", "o"].includes(w.id));

const idOf = (s: string) => stripMarks(s).toLowerCase().replace(/[^a-z]/g, "");

/** A name as a word: declined when it is a Latin -us, -ius or -a name, else used as it is. */
export function nameEntry(name: string, en: string, g: "m" | "f"): Entry {
  const n = stripMarks(name).toLowerCase();
  const id = `name-${idOf(name)}`;
  const spec = { id, en, tags: ["person", "name"], proper: true, only: "sg" as const };
  if (n.endsWith("us") && n.length > 3) return noun(name, `${name.slice(0, -2)}ī`, "m", spec, CHAT);
  if (n.endsWith("a") && n.length > 2) return noun(name, `${name.slice(0, -1)}ae`, g === "m" ? "m" : "f", spec, CHAT);
  return fixed(name, "interj", { id, en, tags: ["person", "name"] }, CHAT);
}

/** A word the day brings (calendar.ts): a person's or a land's name, declined; a festival's name or a cheer, as it is. */
export function calendarEntry(w: { word: string; g?: "m" | "f"; en: string; decline: boolean }): Entry {
  if (w.decline) return nameEntry(w.word, w.en, w.g ?? "m");
  const id = `day-${idOf(w.word)}`;
  // a cheer (iō) is a chat word; a festival's name is a name
  return /^[a-zāēīōū]/.test(w.word) ? fixed(w.word, "interj", { id, en: `${w.word} (a cheer at ${w.en})` }, CHAT) : fixed(w.word, "interj", { id, en: w.en, tags: ["name"] }, CHAT);
}

/** The names everyone in the messenger may use: the five friends, their families and pets, Rome. */
export const FIXED_NAMES: Entry[] = [
  ...PEOPLE.map((p) => nameEntry(p.name, p.name, p.g)),
  ...OTHER_NAMES.map((x) => nameEntry(x.name, x.en, x.g)),
];

/** What a name is called when someone speaks to them: Marcus → Marce, Lūcius → Lūcī. */
export function vocativeOf(name: string): string {
  const n = stripMarks(name).toLowerCase();
  if (n.endsWith("ius") && n.length > 4) return `${name.slice(0, -3)}ī`;
  if (n.endsWith("us") && n.length > 3) return `${name.slice(0, -2)}e`;
  return name;
}

const isName = (e: Entry) => e.tags.includes("name");

/** Fixed words that are a rule of their own: allowed once that rule is seen. */
const WORD_RULES: Record<string, string[]> = {
  et: ["s.et"],
  non: ["s.non"],
  sed: ["s.conn"],
  quod: ["s.conn"],
  nemo: ["s.conn"],
  bene: ["s.conn"],
  "in-prep": ["s.loc", "s.into"],
  "ad-prep": ["s.ad"],
  ego: ["v.1sg"],
  tu: ["v.2sg"],
};

/**
 * The words of the messenger: the learner's own words (lesson words and added
 * cards, without the story-only ones), the chat words and the names.
 */
export function chatEntries(known: Entry[], names: Entry[] = []): Entry[] {
  const out: Entry[] = [];
  const seen = new Set<string>();
  for (const e of [...known.filter((w) => !STORY_ONLY.has(w.id) || w.id === "iuppiter"), ...CHAT_WORDS, ...FIXED_NAMES, ...names]) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}

export const chatLexicon = (entries: Entry[]) => new Lexicon(entries);

/**
 * The forms of a word the learner can read now: the endings of the rules seen.
 * A name may always be said and called (nominative, vocative); verbs only in
 * the present (I, you, he / she, they) and the infinitive; story-only words never.
 */
export function formsFor(e: Entry, seen: Set<string>): string[] {
  const out = new Set<string>();
  switch (e.kind) {
    case "noun": {
      for (const [key, form] of Object.entries(declineNoun(e)) as [NounKey, { stem: string; ending: string }][]) {
        const [c, n] = key.split(".") as [Case, Num];
        const ok = seen.has(nounSkill(e.decl, c, n)) || (isName(e) && n === "sg" && (c === "nom" || c === "voc"));
        if (ok) out.add(full(form));
      }
      break;
    }
    case "adj": {
      if (!seen.has("adj.agree")) break;
      for (const g of ["m", "f", "n"] as Gender[])
        for (const [key, form] of Object.entries(declineAdj(e, g))) {
          const [c, n] = key.split(".") as [Case, Num];
          if (seen.has(nounSkill(adjDecl(g), c, n))) out.add(full(form));
        }
      break;
    }
    case "verb": {
      const forms = conjugate(e);
      const irregular = e.irregular === "sum" ? "v.sum" : e.irregular === "possum" ? "v.possum" : null;
      for (const pn of ["1sg", "2sg", "3sg", "3pl"] as const) {
        const f = forms[`pres.${pn}`];
        if (!f) continue;
        const ok = irregular ? seen.has(irregular) && (pn !== "3pl" || seen.has("v.3pl")) : seen.has(`v.${pn}`);
        if (ok) out.add(full(f));
      }
      if (forms.inf && seen.has("v.inf") && (!irregular || seen.has(irregular))) out.add(full(forms.inf));
      break;
    }
    case "fixed": {
      if (e.id === "qui" || e.id === "se") break;
      const rules = WORD_RULES[e.id];
      if (!rules || rules.some((r) => seen.has(r)) || "chat" in e.source) out.add(e.lemma);
      break;
    }
  }
  return [...out];
}

/** Every word the people may write now, with its allowed forms and meaning. */
export interface AllowedWord {
  id: string;
  lemma: string;
  en: string;
  forms: string[];
  chat: boolean;
  name: boolean;
}

/** The dictionary headword: labōrō for a verb, the nominative for the rest. */
/** Common English words that are no Latin word (a, in, is, an, do are left out: they are Latin too). */
const ENGLISH = new Set("i you he she we they the am are was to how what why does my your and of for with love want say this that be not can have know like".split(" "));

/** Text written in English, Russian or Ukrainian rather than Latin: Check then gives it in Latin. */
export function notLatin(text: string): boolean {
  if (/[а-яёіїєґ]/i.test(text)) return true;
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  const english = words.filter((w) => ENGLISH.has(w)).length;
  return english > 0 && english / words.length >= 0.25;
}

export const headword = (e: Entry) => (e.kind === "verb" ? e.pp[0] : e.lemma);

export function allowedWords(entries: Entry[], seen: Set<string>): AllowedWord[] {
  return entries
    .map((e) => ({ id: e.id, lemma: headword(e), en: e.en, forms: formsFor(e, seen), chat: "chat" in e.source && !isName(e), name: isName(e) }))
    .filter((w) => w.forms.length > 0);
}

/** Plain spellings (no long marks, lower case) of every allowed form, for a quick check of any text. */
export function allowedSpellings(words: AllowedWord[]): Set<string> {
  const out = new Set<string>();
  for (const w of words) for (const f of w.forms) out.add(stripMarks(f).toLowerCase());
  return out;
}
