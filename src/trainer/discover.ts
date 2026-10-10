// Discover cards: which ones are open to the learner, and fresh example
// sentences that pair the new word with words the learner already knows.
import { Card, DECK_CARDS } from "../content/deck";
import { english, generate, Knowledge, latinText, latinTokens, LToken, Rand } from "../latin/generate";
import { nounSkill } from "../latin/skills";
import { AdjEntry, NounEntry, VerbEntry } from "../latin/types";

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
export function withWord(k: Knowledge, card: Card, weight = 1): Knowledge {
  const e = card.entry;
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

/** Up to `count` different sentences that use the card's word with known words and grammar. */
export function cardExamples(card: Card, k: Knowledge, r: Rand, count = 3): Example[] {
  const biased = withWord({ ...k, silly: 0 }, card, card.entry.kind === "adj" ? 4 : 8);
  const out: Example[] = [];
  const seen = new Set<string>();
  const usedTemplates = new Set<string>();
  for (let i = 0; i < 300 && out.length < count; i++) {
    const c = generate(biased, r);
    if (!c) continue;
    const tokens = latinTokens(c, biased);
    if (!tokens.some((t) => t.analysis?.entry.id === card.entry.id)) continue;
    const latin = latinText(tokens);
    if (seen.has(latin) || tokens.length > 7) continue;
    // one example per sentence pattern, while there is a choice
    if (i < 240 && usedTemplates.has(c.template ?? "")) continue;
    usedTemplates.add(c.template ?? "");
    seen.add(latin);
    out.push({ tokens, latin, english: english(c, biased).text });
  }
  return out.sort((a, b) => a.tokens.length - b.tokens.length);
}
