// Words the learner adds to their own dictionary. Claude fills in what a word
// is (its dictionary line, meaning, what it goes with, its relatives, origin
// and story); the grammar engine builds every form from the dictionary line and
// refuses a word it cannot read. An added word then works like a lesson word:
// in the Words page, Ask Claude, the messenger, and practice once its endings
// are learned. A word typed in by hand (without Claude) is only for reading and
// word reviews: nothing says what it goes with, so made-up sentences leave it out.
import { adj, adj3, dictionaryForm, fixed, headword, noun, verb } from "../latin/morph";
import { Case, Entry, FixedEntry, Gender, WordStory } from "../latin/types";

export interface OwnWord {
  id: string;
  kind: "noun" | "verb" | "adj" | "fixed";
  /** The dictionary line with long marks: "gladius, gladiī, m." · "pugnō, pugnāre, pugnāvī, pugnātum" · "fortis, forte" · "saepe". */
  dict: string;
  /** The main English meaning (a verb in its plain form: "fight"). */
  en: string;
  alt?: string[];
  /** What it is (person, place, weapon…); for an adjective, the nouns it can describe. */
  tags: string[];
  /** Verbs: takes an object; can stand alone; English forms; the tags of nouns that make sense as its object. */
  trans?: boolean;
  intrans?: boolean;
  enVerb?: { s?: string; ing?: string; past?: string; pp?: string };
  objects?: string[];
  /** Other words: what kind, and the case a preposition takes. */
  role?: FixedEntry["role"];
  governs?: Case;
  note?: string;
  story?: WordStory;
  /** Used in made-up practice sentences (Claude said what it goes with). */
  practice: boolean;
  added: number;
}

/** The kinds of things a noun can be, as the sentence maker reads them. */
export const NOUN_TAGS: Record<string, string> = {
  person: "a human being (girl, farmer, soldier)",
  divine: "a god or goddess (also person)",
  animal: "an animal",
  creature: "a monster or a creature of myth",
  group: "a group of people (family, army)",
  place: "somewhere one can be in or go to (forest, island, field, city, road)",
  on: "a place one is ON rather than in (an island, a road, a wall); also place",
  building: "a building (school, temple, house)",
  thing: "a solid object one can touch",
  writing: "something written or read (letter, book)",
  story: "something told or sung (story, word, song)",
  weapon: "a weapon (sword, spear)",
  tool: "a tool (plough, needle)",
  food: "something to eat",
  drink: "something to drink",
  plant: "a plant or flower",
  nature: "part of nature (water, wind, earth, sea)",
  weather: "weather (rain, wind)",
  sky: "in the sky (sun, moon, star)",
  light: "light (ray, fire's light)",
  body: "a part of the body",
  abstract: "an idea, a quality or a feeling (glory, fear, life)",
  mass: "uncountable (water, wine, sand, glory): never in the plural",
  unseen: "cannot be seen (wind, voice, smell, idea)",
  long: "can be long (road, letter, sword, hair)",
  beauty: "can be called beautiful",
};

const CASES = new Set(["acc", "abl"]);
const ROLES = new Set(["prep", "conj", "adv", "neg", "question", "interj", "enclitic", "pron"]);

/** A word id not used by another word: līber (free) next to liber (book) becomes "liber-adj". */
export function freeId(base: string, kind: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  if (!taken.has(`${base}-${kind}`)) return `${base}-${kind}`;
  let n = 2;
  while (taken.has(`${base}-${kind}${n}`)) n++;
  return `${base}-${kind}${n}`;
}

const parts = (line: string) => line.split(",").map((x) => x.trim().replace(/\.$/, "")).filter(Boolean);
const ends = (w: string, e: string) => w.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().endsWith(e);

/** The engine's entry for an own word, or what it cannot read. */
export function ownEntry(w: OwnWord): Entry | { error: string } {
  const source = { own: true } as const;
  const common = { id: w.id, alt: w.alt?.length ? w.alt : undefined, tags: w.tags, note: w.note || undefined };
  try {
    let e: Entry;
    const p = parts(w.dict);
    if (w.kind === "noun") {
      const [lemma, gen, g] = p;
      const gender = (g ?? "").replace(/[^mfn]/g, "")[0] as Gender | undefined;
      if (!lemma || !gen || !gender) return { error: `A noun needs its dictionary line: nominative, genitive, gender ("gladius, gladiī, m."), not "${w.dict}".` };
      e = noun(lemma, gen, gender, { ...common, en: w.en }, source);
    } else if (w.kind === "verb") {
      if (p.length < 2) return { error: `A verb needs its principal parts ("pugnō, pugnāre, pugnāvī, pugnātum"), not "${w.dict}".` };
      e = verb(p.join(", "), { ...common, en: { base: w.en, ...w.enVerb }, trans: !!w.trans, intrans: w.intrans ?? !w.trans }, source);
      if (w.objects) e.objects = w.objects;
    } else if (w.kind === "adj") {
      if (p.length === 3 && ends(p[1], "a") && ends(p[2], "um")) e = adj(p[0], p[1], p[2], { ...common, en: w.en }, source);
      else if (p.length === 3) e = adj3(p, null, { ...common, en: w.en }, source);
      else if (p.length === 2 && ends(p[1], "is") && !ends(p[0], "is")) e = adj3([p[0]], p[1], { ...common, en: w.en }, source);
      else if (p.length === 2) e = adj3(p, null, { ...common, en: w.en }, source);
      else return { error: `An adjective needs its forms ("longus, longa, longum" or "fortis, forte"), not "${w.dict}".` };
    } else {
      if (!p.length) return { error: "The word is missing." };
      e = fixed(w.dict.trim(), w.role && ROLES.has(w.role) ? w.role : "adv", { ...common, en: w.en, governs: w.governs && CASES.has(w.governs) ? w.governs : undefined }, source);
    }
    e.id = w.id;
    if (w.story) e.story = w.story;
    return e;
  } catch (err) {
    return { error: (err as Error).message || "The grammar engine cannot read this word." };
  }
}

// ---------------------------------------------------------------- Claude

/** What Claude is asked when the learner adds a word. */
export function lookupPrompt(input: string, known: string[]): string {
  return `You fill in a dictionary card for a beginner in Latin (native in English, Russian and Ukrainian) who wants to add a word to their own dictionary. They typed: "${input}"

If it is a Latin word (any form, with or without long marks), give its dictionary word. If it is an English, Russian or Ukrainian word, give the most common classical Latin word for it. If you do not know such a word well, or it is not a word, answer {"found": false, "why": "<one short sentence>"}.

Otherwise reply with only JSON:
{"found": true,
 "kind": "noun" | "verb" | "adj" | "fixed",
 "dict": "<the dictionary line with every long mark. Noun: nominative, genitive, gender: \\"gladius, gladiī, m.\\". Verb: the principal parts: \\"pugnō, pugnāre, pugnāvī, pugnātum\\". Adjective: \\"longus, longa, longum\\", \\"fortis, forte\\" or \\"fēlīx, fēlīcis\\". Any other word: the word itself>",
 "en": "<the main English meaning, 1-3 words; a verb in its plain form (\\"fight\\"), a noun in the singular>",
 "alt": ["<other common meanings>"],
 "tags": ["<what it is, from the list below>"],
 "verb": {"s": "<English he-form: fights>", "ing": "<fighting>", "past": "<fought>", "pp": "<fought>", "trans": <true if it takes a direct object in the accusative>, "intrans": <true if it can stand without one>, "objects": ["<tags of the nouns that make sense as its object>"], "deponent": <true for a deponent verb>, "irregular": <true for an irregular verb such as ferō, eō, volō>},
 "role": "<only for a word that never changes: adv | prep | conj | interj | pron | question | neg>",
 "governs": "<only for a preposition: acc | abl>",
 "note": "<one short note when something is surprising (a masculine noun in -a), else empty>",
 "origin": "<where the word comes from, one or two short sentences>",
 "history": "<one interesting historical fact about the word or about what it names, one or two short sentences>",
 "link": "<one surprising, real connection the learner may have missed: a first name, a modern word, a scientific term, a brand or a place, in English, Russian or Ukrainian (for euge: Greek eu 'well' → Eugene, Євген, eugenics); empty when there is none>",
 "from": {"en": [], "ru": [], "uk": []},
 "kin": {"en": [], "ru": [], "uk": []},
 "examples": [{"la": "<a short, simple Latin sentence with it, long marks>", "en": "<its English>"}, {"la": "…", "en": "…"}]}

"from": words borrowed from this Latin word (directly, or through French, Italian…). "kin": words of the same ancient (Indo-European) root that were not borrowed. Only well-established ones, at most four each; never a look-alike; leave a list empty when unsure. In "origin" say "probably" where scholars are not sure. Never invent an etymology, a relative or a story.
Leave out "verb" for a word that is not a verb, and "role" and "governs" for one that changes.

Tags, all that fit (for an adjective: the tags of the nouns it can describe, e.g. "long" for long, "person" and "animal" for brave):
${Object.entries(NOUN_TAGS)
  .map(([t, d]) => `- ${t}: ${d}`)
  .join("\n")}

Examples: the present tense, one clause each, with the learner's words where you can: ${known.slice(0, 120).join(", ")}.`;
}

const strs = (x: unknown, max = 6): string[] => (Array.isArray(x) ? x.map((s) => String(s ?? "").trim()).filter(Boolean).slice(0, max) : []);
const str = (x: unknown) => (typeof x === "string" ? x.trim() : "");
const rel = (x: unknown) => {
  const o = (x ?? {}) as Record<string, unknown>;
  const out = { en: strs(o.en, 5), ru: strs(o.ru, 5), uk: strs(o.uk, 5) };
  return out.en.length || out.ru.length || out.uk.length ? out : undefined;
};

/**
 * Claude's card as an own word, checked by the engine; or why it cannot be
 * added (Claude found nothing, or the engine cannot build its forms).
 */
export function fromClaude(raw: unknown, taken: Set<string>, now = Date.now()): { word: OwnWord; entry: Entry } | { error: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.found === false) return { error: str(r.why) || "Claude did not find this word." };
  const kind = str(r.kind) as OwnWord["kind"];
  if (!["noun", "verb", "adj", "fixed"].includes(kind)) return { error: "Claude's card could not be read. Try again." };
  const dict = str(r.dict);
  const en = str(r.en);
  if (!dict || !en) return { error: "Claude's card could not be read. Try again." };
  const v = (r.verb ?? {}) as Record<string, unknown>;
  if (kind === "verb" && (v.deponent === true || v.irregular === true)) {
    return { error: `«${parts(dict)[0]}» changes in ways the lessons have not taught yet (${v.deponent === true ? "a deponent verb" : "an irregular verb"}), so it cannot be added yet.` };
  }
  const tags = strs(r.tags, 8).filter((t) => t in NOUN_TAGS);
  const word: OwnWord = {
    id: "",
    kind,
    dict,
    en,
    alt: strs(r.alt, 4),
    tags: tags.length ? tags : kind === "noun" ? ["thing"] : [],
    note: str(r.note) || undefined,
    story: {
      origin: str(r.origin) || undefined,
      history: str(r.history) || undefined,
      link: str(r.link) || undefined,
      from: rel(r.from),
      kin: rel(r.kin),
      examples: (Array.isArray(r.examples) ? r.examples : [])
        .map((x) => ({ la: str((x as Record<string, unknown>)?.la), en: str((x as Record<string, unknown>)?.en) }))
        .filter((x) => x.la && x.en)
        .slice(0, 3),
    },
    practice: true,
    added: now,
  };
  if (kind === "verb") {
    word.trans = v.trans === true;
    word.intrans = v.intrans !== false;
    word.enVerb = { s: str(v.s) || undefined, ing: str(v.ing) || undefined, past: str(v.past) || undefined, pp: str(v.pp) || undefined };
    word.objects = strs(v.objects, 8).filter((t) => t in NOUN_TAGS);
  }
  if (kind === "fixed") {
    word.role = (ROLES.has(str(r.role)) ? str(r.role) : "adv") as FixedEntry["role"];
    const g = str(r.governs);
    if (CASES.has(g)) word.governs = g as Case;
    // a word that never changes takes no part in made-up sentences (they use the lessons' own small words)
    word.practice = false;
  }
  return withId(word, taken);
}

/** A word typed in by hand: "gladius, gladiī, m. = sword" (no Claude): for reading and word reviews only. */
export function fromLine(line: string, taken: Set<string>, now = Date.now()): { word: OwnWord; entry: Entry } | { error: string } {
  const m = line.match(/^(.+?)\s*(?:=|—|–| - |:)\s*(.+)$/);
  if (!m) return { error: "Write the dictionary line, then = and the meaning: gladius, gladiī, m. = sword" };
  const dict = m[1].trim();
  const en = m[2].trim();
  const p = parts(dict);
  const kind: OwnWord["kind"] =
    p.length >= 3 && /^[mfn]\.?$/.test(p[2]) ? "noun"
    : p.length >= 2 && /(āre|ēre|ere|īre)$/.test(p[1].toLowerCase()) ? "verb"
    : p.length >= 2 ? "adj"
    : "fixed";
  const word: OwnWord = { id: "", kind, dict, en: kind === "verb" ? en.replace(/^to\s+/i, "") : en, tags: kind === "noun" ? ["thing"] : [], practice: false, added: now };
  if (kind === "verb") word.intrans = true;
  return withId(word, taken);
}

function withId(word: OwnWord, taken: Set<string>): { word: OwnWord; entry: Entry } | { error: string } {
  const probe = ownEntry({ ...word, id: "probe" });
  if ("error" in probe) return probe;
  const base = probe.kind === "verb" ? headword(probe) : probe.lemma;
  word.id = freeId(base.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z]/g, "") || "word", word.kind, taken);
  const entry = ownEntry(word);
  if ("error" in entry) return entry;
  return { word, entry };
}

/** "gladius, gladiī, m." for showing. */
export const ownDictionary = (e: Entry) => dictionaryForm(e);
