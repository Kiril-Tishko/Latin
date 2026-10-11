// Discover cards: which ones are open to the learner, and fresh example
// sentences that pair the new word with words the learner already knows.
import { Card, DECK_CARDS } from "../content/deck";
import { Lexicon } from "../latin/analyze";
import { english, generate, Knowledge, latinText, latinTokens, LToken, Rand } from "../latin/generate";
import { nounSkill } from "../latin/skills";
import { AdjEntry, Entry, NounEntry, VerbEntry } from "../latin/types";
import { fullLexicon } from "./knowledge";
import { readLine } from "./lines";

export function cardUnlocked(card: Card, k: Knowledge): boolean {
  const e = card.entry;
  switch (e.kind) {
    case "noun":
      return k.skills.has(nounSkill(e.decl, "nom", "sg"));
    case "verb":
      return !e.irregular && k.skills.has("v.3sg");
    case "adj":
      return e.cls === "12" && k.skills.has("adj.agree");
    default:
      return false;
  }
}

/** Why a card is still closed, in learner terms. */
export function lockedReason(card: Card): string {
  const e = card.entry;
  if (e.kind === "noun") return `Opens when you learn the ${e.decl.replace("n", "")}rd-declension nouns.`;
  if (e.kind === "adj") return "Opens with third-declension adjectives.";
  return "Opens in a later lesson.";
}

/** The next unopened, unlocked card, in deck order. */
export function nextCard(revealed: string[], k: Knowledge, known: Set<string>): Card | undefined {
  return DECK_CARDS.find((c) => !revealed.includes(c.id) && !known.has(c.id) && cardUnlocked(c, k));
}

/** Knowledge with the card's word added (and favoured, so examples feature it). */
export function withWord(k: Knowledge, card: Card | Entry, weight = 1): Knowledge {
  const e = "entry" in card ? card.entry : card;
  const rep = <T>(x: T) => Array.from({ length: weight }, () => x);
  return {
    ...k,
    nouns: e.kind === "noun" ? [...k.nouns.filter((n) => n.id !== e.id), ...rep(e as NounEntry)] : k.nouns,
    verbs: e.kind === "verb" ? [...k.verbs.filter((v) => v.id !== e.id), ...rep(e as VerbEntry)] : k.verbs,
    adjs: e.kind === "adj" ? [...k.adjs.filter((a) => a.id !== e.id), ...rep(e as AdjEntry)] : k.adjs,
  };
}

export interface Example {
  tokens: LToken[];
  latin: string;
  english: string;
}

/** The construction that shows off an indeclinable word (nōn, in, ad, et…). */
const FIXED_FOCUS: Record<string, string[]> = {
  non: ["s.non"],
  "in-prep": ["s.loc", "s.into"],
  "ad-prep": ["s.ad"],
  et: ["s.et"],
  nemo: ["s.conn"],
  bene: ["s.conn"],
  ego: ["v.1sg"],
  tu: ["v.2sg"],
};

/**
 * Up to `count` sensible sentences that use a word with known words and
 * grammar: short ones first, one per sentence pattern where possible.
 */
export function wordExamples(e: Entry, k: Knowledge, r: Rand, count = 3): Example[] {
  const biased = { ...withWord(k, e, e.kind === "adj" ? 4 : 8), silly: 0, richness: 0.5 };
  const focus = e.kind === "fixed" ? FIXED_FOCUS[e.id] ?? [] : [];
  const pool: (Example & { template: string })[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < 600 && pool.length < count * 4; i++) {
    const c = generate(biased, r, focus);
    if (!c) continue;
    const tokens = latinTokens(c, biased);
    if (!tokens.some((t) => t.analysis?.entry.id === e.id)) continue;
    const latin = latinText(tokens);
    if (seen.has(latin) || tokens.length > 7) continue;
    seen.add(latin);
    pool.push({ tokens, latin, english: english(c, biased).text, template: c.template ?? "" });
  }
  pool.sort((a, b) => a.tokens.length - b.tokens.length);
  // the shortest of each pattern first, then the shortest of the rest
  const out: typeof pool = [];
  for (const x of pool) if (out.length < count && !out.some((o) => o.template === x.template)) out.push(x);
  for (const x of pool) if (out.length < count && !out.includes(x)) out.push(x);
  const made = out.sort((a, b) => a.tokens.length - b.tokens.length).map(({ tokens, latin, english }) => ({ tokens, latin, english }));
  // words with hand-made examples fill up with those
  return [...made, ...curatedExamples(e, k).filter((c) => !made.some((m) => m.latin === c.latin))].slice(0, count);
}

/**
 * Hand-made examples for words whose sensible uses need care ("much water",
 * not "the water is much"; "the school is full") or words the generator
 * leaves alone. Checked by the tests like every other Latin on the site.
 */
const CURATED: Record<string, [string, string][]> = {
  clarus: [["Poēta clārus est.", "The poet is famous."], ["Clārum poētam videō.", "I see the famous poet."]],
  creo: [["Deus terram creat.", "The god creates the earth."], ["Poēta librum creat.", "The poet creates a book."]],
  dico: [["Poēta bene dīcit.", "The poet speaks well."], ["Magistra dīcit et discipula scrībit.", "The teacher speaks and the student writes."]],
  imperium: [["Deus magnum imperium habet.", "The god has great power."], ["Imperium deī#gen.sg magnum est.", "The god's power is great."]],
  multus: [["Multam aquam bibō.", "I drink a lot of water."], ["Agricola multum vīnum habet.", "The farmer has a lot of wine."]],
  officium: [["Officium meum est docēre.", "My duty is to teach."], ["Officium magistrae#gen.sg est docēre.", "The teacher's duty is to teach."]],
  placeo: [["Epistula placet.", "The letter pleases."], ["Vīnum placet.", "The wine pleases."]],
  plenus: [["Schola plēna est.", "The school is full."], ["Plēnam scholam videō.", "I see a full school."]],
  publicus: [["Schola pūblica est.", "The school is public."], ["In scholā pūblicā studeō.", "I study at a public school."]],
  radius: [["Radium in aquā videō.", "I see a ray of light in the water."], ["Puella radium spectat.", "The girl watches the ray of light."]],
  totus: [["Tōtam epistulam legō.", "I read the whole letter."], ["Poēta tōtum librum scrībit.", "The poet writes the whole book."]],
  vita: [["Vīta pulchra est.", "Life is beautiful."], ["Vīta poētae#gen.sg longa est.", "The poet's life is long."]],
};

let curatedLex: Lexicon | null = null;

/** The hand-made examples of a word that use only words the learner knows. */
export function curatedExamples(e: Entry, k: Knowledge): Example[] {
  const list = CURATED[e.id];
  if (!list) return [];
  curatedLex ??= fullLexicon(DECK_CARDS.map((c) => c.entry));
  const known = new Set<string>([e.id, ...k.nouns.map((x) => x.id), ...k.verbs.map((x) => x.id), ...k.adjs.map((x) => x.id), ...k.fixed.keys()]);
  const out: Example[] = [];
  for (const [la, en] of list) {
    const tokens = readLine(la, curatedLex);
    if (tokens && tokens.every((t) => known.has(t.analysis!.entry.id))) out.push({ tokens, latin: la.replace(/#[\w.]+/g, ""), english: en });
  }
  return out;
}

/** Examples for a Discover card. */
export function cardExamples(card: Card, k: Knowledge, r: Rand, count = 3): Example[] {
  return wordExamples(card.entry, k, r, count);
}
