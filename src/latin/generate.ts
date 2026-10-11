// Builds new practice sentences from the words and grammar a learner knows,
// then renders them as Latin (with every form analysed, for coloring) and as
// English (with a pattern that accepts the usual ways of saying it).
import { Analysis } from "./analyze";
import { alt, article, en3s, enIng, enPlural, reEscape, withParticle } from "./english";
import { conjugate, declineAdj, declineNoun } from "./morph";
import { adjDecl, nounSkill } from "./skills";
import { capitalize } from "./text";
import { AdjEntry, Case, EnVerb, FixedEntry, Form, full, Gender, NounEntry, NounKey, Num, PN, VerbEntry, VerbKey } from "./types";

// ------------------------------------------------------------ randomness

export type Rand = () => number;

/** Small seeded generator (mulberry32) so tests and replays are repeatable. */
export function seeded(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
export const chance = (r: Rand, p: number) => r() < p;

export function shuffle<T>(r: Rand, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --------------------------------------------------------------- model

export interface Knowledge {
  skills: Set<string>;
  nouns: NounEntry[];
  verbs: VerbEntry[];
  adjs: AdjEntry[];
  /** Indeclinable words by id: et, non, sed, nemo, quod, bene, nunc, in-prep, ad-prep, ego, tu. */
  fixed: Map<string, FixedEntry>;
  /** 0 = always sensible, 1 = anything goes. */
  silly: number;
  /**
   * How much a sentence may carry beyond its rule: 0 = bare and in the usual
   * order (a new rule), 1 = adjectives, "of" phrases, adverbs, and the object
   * sometimes first (a rule that has settled). Default 1.
   */
  richness?: number;
  /** Skills the sentence being built should show (set by generate). */
  focus?: string[];
  /** Extras already in the sentence being built (set by generate). */
  spent?: { n: number };
}

export interface NP {
  noun: NounEntry;
  case: Case;
  num: Num;
  adj?: AdjEntry;
  adjFirst?: boolean;
  poss?: NP;
  possFirst?: boolean;
}

export type Subject =
  | { kind: "np"; np: NP }
  | { kind: "coord"; nps: NP[] }
  | { kind: "pron"; person: 1 | 2; shown: boolean }
  | { kind: "nemo" };

export interface Clause {
  subj: Subject;
  person: 1 | 2 | 3;
  num: Num;
  verb: VerbEntry;
  neg: boolean;
  obj?: NP;
  inf?: { verb: VerbEntry; obj?: NP };
  pred?: { np?: NP; adj?: AdjEntry; gender: Gender; predFirst: boolean };
  pp?: { prep: "in" | "ad"; case: "abl" | "acc"; np: NP };
  adv?: "bene" | "nunc";
  /** The object comes before the subject (Discipulam magistra docet). */
  objFirst?: boolean;
  skills: string[];
  /** Which sentence pattern built it. */
  template?: string;
}

const MOTION = new Set(["ambulo", "fugito", "porto"]);

// ----------------------------------------------------------- what makes sense

/** What gods don't do in a sensible sentence: study, write letters, run away. */
const NOT_DIVINE = new Set(["disco", "studeo", "laboro", "lego", "scribo", "fugito", "doceo", "aro", "respondeo", "finio", "credo", "struo", "texo"]);
/** Where one flees to: away into the forest or over to an island, not into a school. */
const REFUGES = new Set(["silva", "insula", "creta"]);
/** Places you can't walk to: an island. Nor into the earth. */
const NOT_ON_FOOT = new Set(["insula", "creta", "terra"]);
/** Where one lives: in a forest, on an island, on earth; the gods on Olympus. */
const HOMES = new Set(["silva", "insula", "creta", "terra", "olympus"]);
const divine = (n?: NounEntry) => !!n?.tags.includes("divine");

/**
 * The checks a sensible sentence passes (silliness 0): gods live on Olympus and
 * watch the earth but don't go to school; people don't live on Olympus; you
 * flee into a forest, not into a school; you don't walk to an island.
 */
export function makesSense(c: Clause): boolean {
  const nps = c.subj.kind === "np" ? [c.subj.np] : c.subj.kind === "coord" ? c.subj.nps : [];
  const gods = nps.filter((np) => divine(np.noun)).length;
  if (gods && gods < nps.length) return false; // "the god and the friend work"
  const godly = gods > 0;
  if (godly && (NOT_DIVINE.has(c.verb.id) || (c.inf && NOT_DIVINE.has(c.inf.verb.id)))) return false;
  if (c.pred?.np && (godly || divine(c.pred.np.noun) || c.pred.np.noun.tags.includes("group"))) return false; // "the goddess is a poet", "you are a family"
  // a poet already writes
  if (c.inf?.verb.id === "scribo" && ((c.verb.id === "disco" && c.subj.kind === "np" && c.subj.np.noun.id === "poeta") || (c.verb.id === "doceo" && c.obj?.noun.id === "poeta"))) return false;
  const place = c.pp?.np.noun;
  if (place) {
    if (place.id === "olympus" && !godly) return false;
    if (godly && !HOMES.has(place.id)) return false; // gods keep to Olympus, forests, islands and the earth
    if (c.pp!.case === "abl") {
      if (!doneAt(place, c.verb)) return false;
    } else {
      if (c.verb.id === "fugito" && !REFUGES.has(place.id)) return false;
      if (c.verb.id === "ambulo" && NOT_ON_FOOT.has(place.id)) return false;
      if (place.id === "terra") return false;
    }
  }
  return true;
}

const pnOf = (person: 1 | 2 | 3, num: Num) => `${person}${num}` as PN;

// ------------------------------------------------------ what is usable

export function nounUsable(k: Knowledge, n: NounEntry, c: Case, num: Num): boolean {
  if (n.only && n.only !== num) return false;
  return k.skills.has(nounSkill(n.decl, c, num));
}

function genderMismatch(n: NounEntry): boolean {
  return (n.decl === "1" && n.gender === "m") || (n.decl === "2" && n.gender === "f");
}

export function adjUsable(k: Knowledge, a: AdjEntry, n: NounEntry, c: Case, num: Num): boolean {
  if (a.cls !== "12" || !k.skills.has("adj.agree")) return false;
  if (genderMismatch(n) && !k.skills.has("adj.gender")) return false;
  return k.skills.has(nounSkill(adjDecl(n.gender), c, num));
}

export function verbUsable(k: Knowledge, v: VerbEntry, pn: PN): boolean {
  if (v.irregular === "sum") return k.skills.has("v.sum") && pn.endsWith("sg");
  if (v.irregular === "possum") return k.skills.has("v.possum") && pn.endsWith("sg");
  if (v.irregular) return false;
  return k.skills.has(`v.${pn}`);
}

function npSkills(np: NP): string[] {
  const out = [nounSkill(np.noun.decl, np.case, np.num)];
  if (np.adj) {
    out.push("adj.agree", nounSkill(adjDecl(np.noun.gender), np.case, np.num));
    if (genderMismatch(np.noun)) out.push("adj.gender");
  }
  if (np.poss) out.push("s.gen", ...npSkills(np.poss));
  return out;
}

// ------------------------------------------------------------ builders

interface NPOpts {
  case: Case;
  num: Num;
  prefer?: (n: NounEntry) => boolean;
  require?: (n: NounEntry) => boolean;
  exclude?: string[];
  adjChance?: number;
  possChance?: number;
  /** How readily this slot ignores its preference (multiplies Knowledge.silly). */
  sillyScale?: number;
}

const rich = (k: Knowledge) => k.richness ?? 1;

/** The rule of "of" and its endings: any of them in focus makes an "of" phrase the thing practised. */
const GEN_SKILLS = ["s.gen", "n1.gen.sg", "n2.gen.sg", "n2n.gen.sg"];

/**
 * Chance of an optional extra (an adjective, "of" phrase, nōn, a second
 * subject…). Scaled by richness; while a rule is new a sentence carries an
 * extra only when that extra is what is being practised.
 */
function extra(k: Knowledge, skills: string[], normal: number): number {
  if (normal === 0) return 0; // the sentence pattern has no room for it
  const r = rich(k);
  if (r >= 0.5) return normal * r;
  if ((k.spent?.n ?? 0) >= 1) return 0; // one extra at a time
  return skills.some((s) => k.focus?.includes(s)) ? Math.max(normal, 0.5) : 0;
}

/** Rolls for an optional extra and counts it. */
function takeExtra(k: Knowledge, r: Rand, skills: string[], normal: number): boolean {
  if (!chance(r, extra(k, skills, normal))) return false;
  if (k.spent) k.spent.n++;
  return true;
}

const isPerson = (n: NounEntry) => n.tags.includes("person") || n.tags.includes("animal");
/** What a person may have as "my": a friend, a book, my school; not "my moon" or "my farmer". */
const mine = (n: NounEntry) => RELATIONS.has(n.id) || (physical(n) && !n.tags.includes("nature")) || n.id === "schola";
/** Things that are someone's: the poet's letter, the farmer's wine, the student's sword (not "the teacher's yoke"). */
const OWNED = new Set(["writing", "drink", "weapon", "tool", "story"]);
/** People who are someone's: a friend, a student, a teacher. */
const RELATIONS = new Set(["amicus", "amica", "discipulus", "discipula", "magistra", "familia"]);
/** Whose a student or a teacher is: the teacher's student, the girl's teacher (not the student's student). */
const OWNERS: Record<string, string[]> = {
  discipulus: ["magistra", "poeta"],
  discipula: ["magistra", "poeta"],
  magistra: ["discipulus", "discipula", "puella", "amicus", "amica"],
};
const isHuman = (n: NounEntry) => n.tags.includes("person");
/** Who does things: people, and (when silliness is allowed) animals too. */
const agent = (k: Knowledge) => (k.silly === 0 ? isHuman : isPerson);
/** Whether a verb takes an object here: there is nothing sensible to "learn" among the nouns yet. */
const takesObject = (k: Knowledge, v: VerbEntry) => !!v.trans && !(k.silly === 0 && v.id === "disco");

/** An adjective that suits a noun with these tags (long road, timid girl; not a long girl). */
export const adjFits = (a: AdjEntry, tags: string[]) =>
  !a.tags.length ||
  (a.tags.some((t) => tags.includes(t)) &&
    (!tags.includes("mass") || a.tags.includes("mass") || (tags.includes("abstract") && a.tags.includes("abstract"))) && // wine is not "long"; life can be beautiful
    (!tags.includes("nature") || tags.includes("place") || a.tags.includes("nature") || a.tags.includes("plant"))); // nor is the wind
/** "I am alone", not "the alone girl". */
const PREDICATE_ONLY = new Set(["solus", "vivus"]);
/** "much water", not "the water is much". */
const ATTRIBUTE_ONLY = new Set(["multus", "totus"]);
/** Needs words not taught yet ("full of …"): only in the dictionary's own examples. */
const NEVER = new Set(["plenus", "placeo", "creo", "multus", "totus"]);
const isThing = (n: NounEntry) => !isPerson(n);
const isPlace = (n: NounEntry) => n.tags.includes("place");

function makeNP(k: Knowledge, r: Rand, o: NPOpts): NP | null {
  let pool = k.nouns.filter(
    (n) =>
      nounUsable(k, n, o.case, o.num) &&
      !o.exclude?.includes(n.id) &&
      !(o.num === "pl" && (n.tags.includes("mass") || n.proper)) &&
      (o.require?.(n) ?? true),
  );
  if (o.prefer && !chance(r, k.silly * (o.sillyScale ?? 1))) {
    const preferred = pool.filter(o.prefer);
    if (preferred.length) pool = preferred;
  }
  if (!pool.length) return null;
  const noun = pick(r, pool);
  const np: NP = { noun, case: o.case, num: o.num };
  if (takeExtra(k, r, ["adj.agree", "adj.gender"], o.adjChance ?? 0.3)) {
    // a name takes what suits it (pulchra or timida Eurōpa, pulchra Crēta), never "big Europa" or "my Europa"
    const personal = (a: AdjEntry) => a.tags.length > 0 && a.tags.every((t) => t === "person" || t === "animal"); // timidus
    const fitsName = (a: AdjEntry) => a.id === "pulcher" || (isHuman(noun) && personal(a));
    let adjs = k.adjs.filter(
      (a) =>
        adjUsable(k, a, noun, o.case, o.num) &&
        !(noun.proper && a.id === "meus") &&
        !(k.silly === 0 && noun.proper && !fitsName(a)) &&
        // "my friend", "my book"; not "my farmer"; and no timid gods
        !(k.silly === 0 && a.id === "meus" && !mine(noun)) &&
        !(k.silly === 0 && a.id === "timidus" && divine(noun)) &&
        !PREDICATE_ONLY.has(a.id) &&
        !NEVER.has(a.id),
    );
    if (!chance(r, k.silly * 0.5)) {
      const fitting = adjs.filter((a) => adjFits(a, noun.tags));
      // sensible: an adjective that suits the noun, or none at all
      if (fitting.length || k.silly === 0) adjs = fitting;
    }
    if (adjs.length) {
      np.adj = pick(r, adjs);
      np.adjFirst = np.adj.id === "meus" ? false : chance(r, 0.5);
    }
  }
  // whose: people own things and places, and are friends, students or teachers of someone (not "the poet's farmer", "the bull's student")
  const ownable = isPlace(noun) || noun.id === "vita" || noun.tags.some((t) => OWNED.has(t));
  const owned = k.silly > 0 || (!noun.proper && (isHuman(noun) ? RELATIONS.has(noun.id) : ownable));
  // (an "of" phrase is what is practised when its rule or one of its endings is the focus)
  if (owned && np.adj?.id !== "meus" && k.skills.has("s.gen") && takeExtra(k, r, GEN_SKILLS, o.possChance ?? 0.2)) {
    const owner = OWNERS[noun.id];
    const allowed = k.silly === 0 && owner ? (n: NounEntry) => owner.includes(n.id) : undefined;
    const someone = k.silly === 0 ? isHuman : isPerson;
    // an owner whose ending is the one being practised (amīcī for -ī), when there is one
    const wanted = (n: NounEntry) => someone(n) && !!k.focus?.includes(nounSkill(n.decl, "gen", "sg"));
    const focused = k.nouns.some((n) => wanted(n) && nounUsable(k, n, "gen", "sg") && n.id !== noun.id && !n.proper && (allowed?.(n) ?? true));
    const poss = makeNP(k, r, {
      case: "gen",
      num: "sg",
      prefer: focused ? wanted : someone,
      require: allowed,
      exclude: [noun.id, ...(o.exclude ?? [])],
      adjChance: 0,
      possChance: 0,
    });
    if (poss && !poss.noun.proper) {
      np.poss = poss;
      np.possFirst = chance(r, 0.3);
    }
  }
  return np;
}

interface SubjectOpts {
  allowPron?: boolean;
  allowPlural?: boolean;
  allowNemo?: boolean;
  possChance?: number;
  anyNoun?: boolean;
  adjChance?: number;
  /** Only these nouns may be the subject (gods on Olympus); ego, tū and nēmō only if `people`. */
  who?: (n: NounEntry) => boolean;
  people?: boolean;
}

function makeSubject(k: Knowledge, r: Rand, o: SubjectOpts = {}) {
  type Opt = { w: number; build: () => { subj: Subject; person: 1 | 2 | 3; num: Num; skills: string[] } | null };
  if (o.people === false) o = { ...o, allowPron: false, allowNemo: false };
  const opts: Opt[] = [
    {
      w: 6,
      build: () => {
        const np = makeNP(k, r, { case: "nom", num: "sg", prefer: o.anyNoun ? undefined : agent(k), require: o.who, possChance: o.possChance, adjChance: o.adjChance, sillyScale: 0.5 });
        return np && { subj: { kind: "np", np }, person: 3, num: "sg", skills: ["s.sv", ...npSkills(np)] };
      },
    },
  ];
  const pluralW = 2.5 * extra(k, ["s.pl", "v.3pl", "n1.nom.pl", "n2.nom.pl"], 1);
  if (o.allowPlural !== false && k.skills.has("s.pl") && k.skills.has("v.3pl") && pluralW > 0) {
    opts.push({
      w: pluralW,
      build: () => {
        const np = makeNP(k, r, { case: "nom", num: "pl", prefer: agent(k), require: o.who, possChance: 0, sillyScale: 0.5 });
        return np && { subj: { kind: "np", np }, person: 3, num: "pl", skills: ["s.sv", "s.pl", ...npSkills(np)] };
      },
    });
    // "X et Y" is also the way to a plural subject before the plural endings are met
    const coordW = extra(k, ["s.et", "s.pl", "v.3pl"], 1);
    if (k.skills.has("s.et") && coordW > 0) {
      opts.push({
        w: coordW,
        build: () => {
          const a = makeNP(k, r, { case: "nom", num: "sg", prefer: agent(k), require: o.who, adjChance: 0.15, possChance: 0, sillyScale: 0.5 });
          if (!a) return null;
          const b = makeNP(k, r, { case: "nom", num: "sg", prefer: agent(k), require: o.who, adjChance: 0.15, possChance: 0, exclude: [a.noun.id], sillyScale: 0.5 });
          return b && { subj: { kind: "coord", nps: [a, b] }, person: 3, num: "pl", skills: ["s.sv", "s.pl", "s.et", ...npSkills(a), ...npSkills(b)] };
        },
      });
    }
  }
  if (o.allowPron !== false) {
    for (const person of [1, 2] as const) {
      if (!k.skills.has(`v.${person}sg`)) continue;
      opts.push({
        w: 2.5,
        build: () => {
          // a new rule keeps ego / tū in sight; later they are often left out, as in real Latin
          const shown = !k.skills.has("s.drop") || chance(r, rich(k) >= 0.5 ? 0.4 : k.focus?.includes("s.drop") ? 0.3 : 0.9);
          return { subj: { kind: "pron", person, shown }, person, num: "sg", skills: shown ? [] : ["s.drop"] };
        },
      });
    }
  }
  if (o.allowNemo && k.skills.has("s.conn") && k.fixed.has("nemo") && extra(k, ["s.conn"], 1) > 0) {
    opts.push({ w: 0.6 * extra(k, ["s.conn"], 1), build: () => ({ subj: { kind: "nemo" }, person: 3, num: "sg", skills: ["s.conn"] }) });
  }
  for (let tries = 0; tries < 6; tries++) {
    const total = opts.reduce((s, x) => s + x.w, 0);
    let roll = r() * total;
    const chosen = opts.find((x) => (roll -= x.w) < 0) ?? opts[0];
    const res = chosen.build();
    if (res) return res;
  }
  return null;
}

// What a verb sensibly acts on, by noun tags (silly sentences ignore it sometimes).
const physical = (n: NounEntry) =>
  isThing(n) && !n.tags.some((t) => t === "place" || t === "building" || t === "body" || t === "abstract" || t === "unseen" || t === "light" || t === "creature");
/** Things with a shape: you break a sword, not the water. */
const solid = (n: NounEntry) => physical(n) && !n.tags.includes("mass");
/** Things you can pick up: not the wind or the smoke, but water, a rose, a book. */
const portable = (n: NounEntry) => physical(n) && (!n.tags.includes("nature") || n.tags.includes("drink") || n.tags.includes("plant"));
/** What can be seen or watched: a number, a shape, a play; not "life" itself. */
const visible = (n: NounEntry) => !(n.tags.includes("abstract") && n.tags.includes("mass")) && !n.tags.includes("unseen") && !n.tags.includes("body"); // not "I see the eye"
const tagged = (tag: string) => (n: NounEntry) => n.tags.includes(tag);
/** Verbs that need an object or a place to make sense on their own: not "I see on Olympus", "learns to live". */
const NEEDS_MORE = new Set(["video", "sentio", "audio", "habito"]);
/** What one learns or teaches to do: to write, to sing; not "teaches the student to flee" or "learns to sleep". */
const LEARNABLE = new Set(["scribo", "lego", "laboro", "doceo", "canto", "aro", "texo", "respondeo", "struo"]);
/** Who is taught: students, a girl, a friend, a farmer (the Lesson II story); not a teacher, a poet or a god. */
const PUPILS = new Set(["discipula", "discipulus", "puella", "amica", "amicus", "agricola", "femina", "europa"]);

const none = () => false;
const OBJECTS: Record<string, (n: NounEntry) => boolean> = {
  lego: tagged("writing"),
  scribo: tagged("writing"),
  dico: tagged("story"), // says a word, tells a story
  aro: (n) => n.id === "terra" || n.id === "campus", // ploughs the land, a field; not the forest
  duco: (n) => isPerson(n) && !n.tags.includes("divine"),
  finio: tagged("writing"),
  credo: tagged("story"), // believes the story (a person would be dative)
  respondeo: none, // answers someone: dative, later
  canto: none, // sings (a song is a later word)
  texo: none,
  porto: portable,
  iacio: (n) => portable(n) && solid(n),
  mitto: (n) => (physical(n) && n.tags.includes("writing")) || n.id === "donum" || n.id === "praemium", // a letter, a book, a gift
  teneo: portable,
  traho: (n) => (solid(n) && !n.tags.includes("writing")) || n.tags.includes("animal"), // a sword, a bull; not a letter
  cupio: portable,
  habeo: (n) => portable(n) || (isHuman(n) && !n.tags.includes("divine") && !n.proper),
  tango: solid,
  moveo: solid,
  rumpo: solid,
  deleo: solid,
  creo: (n) => n.tags.includes("building") || n.tags.includes("story"),
  struo: tagged("building"), // a school, a theatre; not a sword
  sentio: (n) => (n.tags.includes("nature") && !n.tags.includes("place")) || n.tags.includes("light") || n.tags.includes("weather"), // the wind, the water, a ray
  video: visible,
  specto: (n) =>
    (isPerson(n) || isPlace(n) || n.tags.some((t) => t === "nature" || t === "sky" || t === "creature")) && !n.tags.includes("drink") && !n.tags.includes("unseen"), // a girl, a bull, the forest, the moon; not a book, the wine or the wind
  amo: (n) => isPerson(n) || n.tags.includes("plant") || n.tags.includes("drink") || n.tags.includes("abstract"),
  audio: isPerson,
  voco: isHuman,
  moneo: isHuman,
  doceo: isHuman,
  desidero: isHuman,
  transformo: isPerson,
  terreo: (n) => isPerson(n) && !n.tags.includes("divine"),
  cognosco: (n) => isHuman(n) || isPlace(n),
  peto: (n) => isPlace(n) || portable(n),
  disco: isThing,
};

function objectFor(k: Knowledge, r: Rand, verb: VerbEntry, exclude: string[], possChance?: number): NP | null {
  if (verb.id === "bibo") return makeNP(k, r, { case: "acc", num: "sg", require: tagged("drink"), exclude, adjChance: 0.15, possChance });
  const fits = OBJECTS[verb.id];
  return makeNP(k, r, { case: "acc", num: "sg", ...(k.silly === 0 && fits ? { require: fits } : { prefer: fits }), exclude, possChance });
}

function placeNoun(k: Knowledge, r: Rand, c: Case, exclude: string[]) {
  // a place whose ending is the one being practised (in Olympō for -ō), when there is one
  const wanted = (n: NounEntry) => isPlace(n) && !!k.focus?.includes(nounSkill(n.decl, c, "sg"));
  const focused = k.nouns.some((n) => wanted(n) && nounUsable(k, n, c, "sg") && !exclude.includes(n.id));
  return makeNP(k, r, { case: c, num: "sg", prefer: focused ? wanted : isPlace, require: (n) => !n.tags.includes("vague"), exclude, adjChance: 0.2, possChance: 0.05, sillyScale: 0.3 });
}

/** What one does at a place: on the land you work or sleep, not read; at school you don't live or drink. */
function doneAt(place: NounEntry, v: VerbEntry): boolean {
  if (v.id === "fugito") return false; // "flees in the forest": fleeing goes somewhere
  if (v.id === "habito" || v.id === "vivo") return HOMES.has(place.id); // not "lives in the theatre"
  if (place.id === "terra") return ["laboro", "dormio", "habito", "ambulo", "sedeo", "sto", "aro", "curro"].includes(v.id);
  if (place.id === "via") return ["ambulo", "curro", "sto", "sedeo", "laboro", "canto"].includes(v.id);
  if (place.id === "theatrum") return ["specto", "sedeo", "canto", "sto", "video", "audio", "laboro"].includes(v.id);
  if (v.id === "credo") return false;
  if (["respondeo", "dico"].includes(v.id)) return place.id === "schola"; // answers in class, not in the forest
  if (place.id === "schola") return !["habito", "bibo", "aro"].includes(v.id);
  return true;
}

const godlike = (s: { subj: Subject }) =>
  s.subj.kind === "np" ? divine(s.subj.np.noun) : s.subj.kind === "coord" ? s.subj.nps.every((np) => divine(np.noun)) : false;

/** Who sensibly is at a place: the gods on Olympus, people (not gods) at school. */
function whoAt(k: Knowledge, place: NounEntry): Pick<SubjectOpts, "who" | "people"> {
  if (k.silly > 0) return {};
  if (place.id === "olympus") return { who: (n) => divine(n), people: false };
  if (place.id === "schola") return { who: (n) => isHuman(n) && !divine(n) };
  return {};
}

type Template = (k: Knowledge, r: Rand) => Clause | null;

const finite = (k: Knowledge, pred: (v: VerbEntry) => boolean, person: 1 | 2 | 3, num: Num) =>
  k.verbs.filter((v) => !v.irregular && !NEVER.has(v.id) && pred(v) && verbUsable(k, v, pnOf(person, num)));

function base(k: Knowledge, r: Rand, s: NonNullable<ReturnType<typeof makeSubject>>, verb: VerbEntry, more: string[]): Clause {
  const c: Clause = { subj: s.subj, person: s.person, num: s.num, verb, neg: false, skills: [...s.skills, `v.${pnOf(s.person, s.num)}`, ...more] };
  if (s.subj.kind !== "nemo" && k.skills.has("s.non") && takeExtra(k, r, ["s.non"], 0.18)) {
    c.neg = true;
    c.skills.push("s.non");
  }
  return c;
}

const npIds = (np: NP): string[] => [np.noun.id, ...(np.poss ? npIds(np.poss) : [])];
const subjectIds = (s: Subject) => (s.kind === "np" ? npIds(s.np) : s.kind === "coord" ? s.nps.flatMap(npIds) : []);

const TEMPLATES: Record<string, Template> = {
  // Subject + verb, maybe "well" or "now".
  sv: (k, r) => {
    const s = makeSubject(k, r, { allowNemo: true });
    if (!s) return null;
    const verbs = finite(k, (v) => v.intrans && v.id !== "habito", s.person, s.num);
    if (!verbs.length) return null;
    const c = base(k, r, s, pick(r, verbs), []);
    if (k.skills.has("s.conn") && k.fixed.has("bene") && takeExtra(k, r, ["s.conn"], 0.15)) {
      c.adv = "bene";
      c.skills.push("s.conn");
    } else if (k.fixed.has("nunc") && chance(r, rich(k) >= 0.5 ? 0.1 * rich(k) : 0)) c.adv = "nunc";
    return c;
  },
  // Subject + object + verb.
  svo: (k, r) => {
    if (!k.skills.has("s.svo")) return null;
    const s = makeSubject(k, r, { allowNemo: true, possChance: 0.15 });
    if (!s) return null;
    const verbs = finite(k, (v) => takesObject(k, v), s.person, s.num);
    if (!verbs.length) return null;
    const verb = pick(r, verbs);
    const obj = objectFor(k, r, verb, subjectIds(s.subj));
    if (!obj) return null;
    if (s.num === "pl" && obj.poss) delete obj.poss; // "-ae" would read as a second plural subject
    if (s.subj.kind === "np" && s.subj.np.noun.gender === "n" && obj.noun.gender === "n") return null;
    const c = base(k, r, s, verb, ["s.svo"]);
    c.obj = obj;
    c.skills.push(...npSkills(obj));
    // once the endings are solid, the object sometimes leads: only the endings tell who does what
    // (not a plural subject: "Librum amīcae vident" would read as "they see the friend's book")
    if (rich(k) >= 1 && s.subj.kind === "np" && s.num === "sg" && chance(r, 0.3)) c.objFirst = true;
    return c;
  },
  // Where: in + ablative.
  loc: (k, r) => {
    if (!k.skills.has("s.loc")) return null;
    // the place first, then someone who belongs there
    const np = placeNoun(k, r, "abl", []);
    if (!np) return null;
    const s = makeSubject(k, r, { possChance: 0.1, ...whoAt(k, np.noun) });
    if (!s || subjectIds(s.subj).includes(np.noun.id)) return null;
    const verbs = finite(
      k,
      (v) => v.intrans && (k.silly > 0 || ((!NEEDS_MORE.has(v.id) || v.id === "habito") && doneAt(np.noun, v) && !(godlike(s) && NOT_DIVINE.has(v.id)))),
      s.person,
      s.num,
    );
    if (!verbs.length) return null;
    const c = base(k, r, s, pick(r, verbs), ["s.loc"]);
    c.pp = { prep: "in", case: "abl", np };
    c.skills.push(...npSkills(np));
    return c;
  },
  // Where to: in / ad + accusative with a verb of motion.
  motion: (k, r) => {
    const preps = [k.skills.has("s.into") && "in", k.skills.has("s.ad") && "ad"].filter(Boolean) as ("in" | "ad")[];
    if (!preps.length) return null;
    // the goal first, then someone who would go there
    const np = placeNoun(k, r, "acc", []);
    if (!np) return null;
    const s = makeSubject(k, r, { possChance: 0.1, ...whoAt(k, np.noun) });
    if (!s || subjectIds(s.subj).includes(np.noun.id)) return null;
    let verbs = finite(k, (v) => MOTION.has(v.id) || v.tags.includes("motion"), s.person, s.num);
    // while the rule is new: walk or run somewhere, without carrying anything
    if (rich(k) < 0.5 && verbs.some((v) => !v.trans)) verbs = verbs.filter((v) => !v.trans);
    // you flee into a forest or to an island, and don't walk to one
    if (k.silly === 0) {
      verbs = verbs.filter(
        (v) => !(v.id === "fugito" && !REFUGES.has(np.noun.id)) && !(v.id === "ambulo" && NOT_ON_FOOT.has(np.noun.id)) && !(godlike(s) && NOT_DIVINE.has(v.id)),
      );
    }
    if (!verbs.length) return null;
    const verb = pick(r, verbs);
    const prep = pick(r, preps);
    const c = base(k, r, s, verb, [prep === "in" ? "s.into" : "s.ad"]);
    c.pp = { prep, case: "acc", np };
    c.skills.push(...npSkills(np));
    if (verb.trans) {
      if (!k.skills.has("s.svo")) return null;
      const obj = objectFor(k, r, verb, [...subjectIds(s.subj), np.noun.id], 0.1);
      if (!obj) return null;
      c.obj = obj;
      c.skills.push("s.svo", ...npSkills(obj));
    }
    return c;
  },
  // X est Y / X Y est.
  est: (k, r) => {
    if (!k.skills.has("s.est")) return null;
    const sum = k.verbs.find((v) => v.irregular === "sum");
    if (!sum) return null;
    // "X is <adjective>" suits anything (life is beautiful); "X is a <noun>" wants a person
    const useAdj = k.skills.has("adj.agree") && chance(r, 0.55);
    const s = makeSubject(k, r, { allowPlural: false, possChance: 0.15, anyNoun: useAdj, adjChance: useAdj ? 0 : undefined });
    if (!s || !verbUsable(k, sum, pnOf(s.person, s.num))) return null;
    const c = base(k, r, s, sum, ["s.est", "v.sum"]);
    const gender: Gender = s.subj.kind === "np" ? s.subj.np.noun.gender : chance(r, 0.5) ? "m" : "f";
    if (useAdj) {
      const holder: NounEntry =
        s.subj.kind === "np" ? s.subj.np.noun : ({ decl: gender === "f" ? "1" : "2", gender } as NounEntry);
      let adjs = k.adjs.filter((a) => a.id !== "meus" && !ATTRIBUTE_ONLY.has(a.id) && !NEVER.has(a.id) && adjUsable(k, a, holder, "nom", "sg"));
      if (!chance(r, k.silly * 0.5)) {
        const fitting = adjs.filter((a) => adjFits(a, s.subj.kind === "np" ? s.subj.np.noun.tags : ["person"]));
        if (fitting.length || k.silly === 0) adjs = fitting;
      }
      if (!adjs.length) return null;
      c.pred = { adj: pick(r, adjs), gender, predFirst: chance(r, 0.6) };
      c.skills.push("adj.agree", nounSkill(adjDecl(gender), "nom", "sg"));
      if (s.subj.kind === "np" && genderMismatch(s.subj.np.noun)) c.skills.push("adj.gender");
    } else {
      const np = makeNP(k, r, {
        case: "nom",
        num: "sg",
        prefer: agent(k), // "the farmer is a poet"; "the farmer is a bull" only when silly
        require: (n) => {
          if (n.proper || !(s.subj.kind !== "pron" || n.gender === gender || n.tags.includes("person"))) return false;
          // sensible: not "the student (f) is a student (m)"
          if (k.silly === 0 && s.subj.kind === "np") {
            const subj = s.subj.np.noun;
            if (n.en === subj.en || (isHuman(n) && isHuman(subj) && n.gender !== subj.gender)) return false;
          }
          return true;
        },
        exclude: subjectIds(s.subj),
        possChance: 0.15,
      });
      if (!np) return null;
      c.pred = { np, gender, predFirst: chance(r, 0.6) };
      c.skills.push(...npSkills(np));
    }
    return c;
  },
  // can + infinitive (+ object).
  possum: (k, r) => {
    if (!k.skills.has("s.inf")) return null;
    const possum = k.verbs.find((v) => v.irregular === "possum");
    if (!possum) return null;
    const s = makeSubject(k, r, { allowPlural: false, possChance: 0.1 });
    if (!s || !verbUsable(k, possum, pnOf(s.person, s.num))) return null;
    const infs = k.verbs.filter((v) => !v.irregular && !NEVER.has(v.id) && (k.silly > 0 || (v.id !== "habito" && v.id !== "vivo")));
    if (!infs.length) return null;
    const inf = pick(r, infs);
    const c = base(k, r, s, possum, ["v.possum", "s.inf", "v.inf"]);
    c.inf = { verb: inf };
    if (takesObject(k, inf) && k.skills.has("s.svo") && (!inf.intrans || chance(r, 0.6))) {
      const obj = objectFor(k, r, inf, subjectIds(s.subj));
      if (obj) {
        c.inf.obj = obj;
        c.skills.push("s.svo", ...npSkills(obj));
      }
    }
    if (!c.inf.obj && inf.trans && !inf.intrans) return null;
    return c;
  },
  // learns to / teaches someone to + infinitive.
  learnTo: (k, r) => {
    if (!k.skills.has("s.inf")) return null;
    const s = makeSubject(k, r, { allowPlural: false, possChance: 0 });
    if (!s) return null;
    const verbs = finite(k, (v) => v.id === "disco" || v.id === "doceo", s.person, s.num);
    if (!verbs.length) return null;
    const verb = pick(r, verbs);
    const infs = k.verbs.filter((v) => !v.irregular && v.intrans && v.id !== verb.id && (k.silly > 0 ? !NEEDS_MORE.has(v.id) : LEARNABLE.has(v.id)));
    if (!infs.length) return null;
    const c = base(k, r, s, verb, ["s.inf", "v.inf"]);
    c.inf = { verb: pick(r, infs) };
    if (verb.id === "doceo") {
      if (!k.skills.has("s.svo")) return null;
      // people are taught; not a goddess or a letter
      const pupil = k.silly === 0 ? (n: NounEntry) => PUPILS.has(n.id) : agent(k);
      const obj = makeNP(k, r, { case: "acc", num: "sg", prefer: pupil, exclude: subjectIds(s.subj), possChance: 0 });
      if (!obj) return null;
      c.obj = obj;
      c.skills.push("s.svo", ...npSkills(obj));
    }
    return c;
  },
};

export const TEMPLATE_NAMES = Object.keys(TEMPLATES);

/**
 * A new sentence. Builds several candidates and keeps the one that practises
 * the most focus skills (ties broken at random).
 */
/** The construction each pattern beyond subject-verb(-object) is there to show. */
const TEMPLATE_SKILLS: Record<string, string[]> = {
  loc: ["s.loc", "n1.abl.sg", "n2.abl.sg", "n2n.abl.sg"],
  motion: ["s.into", "s.ad"],
  est: ["s.est", "v.sum"],
  possum: ["v.possum", "s.inf"],
  learnTo: ["s.inf", "v.inf"],
};

export function generate(k0: Knowledge, r: Rand, focus: string[] = [], templates: string[] = TEMPLATE_NAMES): Clause | null {
  const k = { ...k0, focus };
  let alive = templates.filter((t) => TEMPLATES[t]);
  // while a rule is new, a longer pattern only when it is the thing being practised
  if (rich(k) < 0.5) {
    const plain = alive.filter((t) => !TEMPLATE_SKILLS[t] || TEMPLATE_SKILLS[t].some((s) => focus.includes(s)));
    if (plain.length) alive = plain;
  }
  const fails: Record<string, number> = {};
  let best: Clause | null = null;
  let bestScore = -1;
  for (let i = 0; i < 80 && alive.length; i++) {
    const name = pick(r, alive);
    const c = TEMPLATES[name]({ ...k, spent: { n: 0 } }, r);
    if (!c) {
      fails[name] = (fails[name] ?? 0) + 1;
      if (fails[name] >= 6) alive = alive.filter((t) => t !== name);
      continue;
    }
    if (k.silly === 0 && !makesSense(c)) continue;
    c.template = name;
    const hits = focus.filter((f) => c.skills.includes(f)).length;
    const score = hits + r() * 0.5;
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
    if (hits >= focus.length) break;
  }
  if (best) best.skills = [...new Set(best.skills)];
  return best;
}

// ------------------------------------------------------- Latin output

export type Role =
  | "subj" | "subj-adj" | "subj-poss" | "pron" | "obj" | "obj-adj" | "obj-poss"
  | "verb" | "inf" | "pred" | "pred-adj" | "pred-poss" | "prep" | "pp" | "pp-adj" | "pp-poss" | "neg" | "conj" | "adv";

export interface LToken {
  text: string;
  role: Role;
  analysis?: Analysis;
  /** Skill whose ending this word shows (for focus blanks and feedback). */
  skill?: string;
}

function nounToken(n: NounEntry, c: Case, num: Num, role: Role): LToken {
  const key = `${c}.${num}` as NounKey;
  const form = declineNoun(n)[key]!;
  return { text: full(form), role, analysis: { entry: n, key, gender: n.gender, form }, skill: nounSkill(n.decl, c, num) };
}

function adjToken(a: AdjEntry, g: Gender, c: Case, num: Num, role: Role): LToken {
  const key = `${c}.${num}` as NounKey;
  const form = declineAdj(a, g)[key];
  return { text: full(form), role, analysis: { entry: a, key, gender: g, form }, skill: nounSkill(adjDecl(g), c, num) };
}

function verbToken(v: VerbEntry, key: VerbKey, role: Role): LToken {
  const form = conjugate(v)[key] ?? ({ stem: v.pp[0], ending: "" } as Form);
  const skill =
    key === "inf" ? "v.inf"
    : v.irregular === "sum" ? "v.sum"
    : v.irregular === "possum" ? "v.possum"
    : `v.${key.split(".")[1]}`;
  return { text: full(form), role, analysis: { entry: v, key, form }, skill };
}

function fixedToken(k: Knowledge, id: string, role: Role, fallback: string): LToken {
  const e = k.fixed.get(id);
  return { text: e?.lemma ?? fallback, role, analysis: e ? { entry: e, key: "", form: { stem: e.lemma, ending: "" } } : undefined };
}

function npTokens(np: NP, role: "subj" | "obj" | "pred" | "pp"): LToken[] {
  const head = nounToken(np.noun, np.case, np.num, role);
  const out: LToken[] = [head];
  if (np.adj) {
    const a = adjToken(np.adj, np.noun.gender, np.case, np.num, `${role}-adj` as Role);
    if (np.adjFirst) out.unshift(a);
    else out.push(a);
  }
  if (np.poss) {
    const p = nounToken(np.poss.noun, "gen", np.poss.num, `${role}-poss` as Role);
    if (np.possFirst) out.unshift(p);
    else out.push(p);
  }
  return out;
}

const NOUNISH = /^(subj|obj|pred|pp)(-adj)?$/;
const groupOf = (t?: LToken) => (t && NOUNISH.test(t.role) ? t.role.replace("-adj", "") : null);

/**
 * A genitive between two nouns could belong to either ("Puella deae epistulam
 * scrībit": the goddess's girl, or the goddess's letter?). Moves it to the far
 * side of its own noun: "Puella epistulam deae scrībit".
 */
export function untangle(out: LToken[]): LToken[] {
  for (let i = 1; i < out.length - 1; i++) {
    const t = out[i];
    if (!t.role.endsWith("-poss")) continue;
    const own = t.role.slice(0, -"-poss".length);
    const left = groupOf(out[i - 1]);
    const right = groupOf(out[i + 1]);
    if (!left || !right || left === right) continue;
    if (right === own) {
      out.splice(i, 1);
      let j = i;
      while (j < out.length && groupOf(out[j]) === own) j++;
      out.splice(j, 0, t);
    } else if (left === own) {
      out.splice(i, 1);
      let j = i - 1;
      while (j >= 0 && groupOf(out[j]) === own) j--;
      out.splice(j + 1, 0, t);
    }
  }
  return out;
}

/** The sentence in Latin, word by word, in a natural order (verb last). */
export function latinTokens(c: Clause, k: Knowledge): LToken[] {
  const out: LToken[] = [];
  const pn = pnOf(c.person, c.num);
  if (c.adv === "nunc") out.push(fixedToken(k, "nunc", "adv", "nunc"));
  const objFirst = c.objFirst && c.obj && !c.pred && !c.inf;
  if (objFirst) out.push(...npTokens(c.obj!, "obj"));
  switch (c.subj.kind) {
    case "np":
      out.push(...npTokens(c.subj.np, "subj"));
      break;
    case "coord":
      c.subj.nps.forEach((np, i) => {
        if (i) out.push(fixedToken(k, "et", "conj", "et"));
        out.push(...npTokens(np, "subj"));
      });
      break;
    case "pron":
      if (c.subj.shown) out.push(fixedToken(k, c.subj.person === 1 ? "ego" : "tu", "pron", c.subj.person === 1 ? "ego" : "tū"));
      break;
    case "nemo":
      out.push(fixedToken(k, "nemo", "subj", "nēmō"));
      break;
  }
  if (c.pp) {
    out.push(fixedToken(k, c.pp.prep === "in" ? "in-prep" : "ad-prep", "prep", c.pp.prep));
    out.push(...npTokens(c.pp.np, "pp"));
  }
  if (c.obj && !objFirst) out.push(...npTokens(c.obj, "obj"));
  const verb = verbToken(c.verb, `pres.${pn}` as VerbKey, "verb");
  if (c.pred) {
    const pred: LToken[] = c.pred.np
      ? npTokens(c.pred.np, "pred")
      : [adjToken(c.pred.adj!, c.pred.gender, "nom", "sg", "pred-adj")];
    const neg = c.neg ? [fixedToken(k, "non", "neg", "nōn")] : [];
    // nōn stays right before est: "Poēta nōn est puella" / "Poēta puella nōn est"
    if (c.pred.predFirst) out.push(...pred, ...neg, verb);
    else out.push(...neg, verb, ...pred);
    return untangle(out);
  }
  if (c.inf) {
    if (c.inf.obj && c.verb.id !== "doceo") out.push(...npTokens(c.inf.obj, "obj"));
    out.push(verbToken(c.inf.verb, "inf", "inf"));
  }
  if (c.adv === "bene") out.push(fixedToken(k, "bene", "adv", "bene"));
  if (c.neg) out.push(fixedToken(k, "non", "neg", "nōn"));
  out.push(verb);
  return untangle(out);
}

export function latinText(tokens: LToken[]): string {
  return capitalize(tokens.map((t) => t.text).join(" ")) + ".";
}

// ------------------------------------------------------ English output

interface EnPhrase {
  /** The phrase as shown in prompts. */
  text: string;
  /** Regex source accepting equivalent phrasings. */
  re: string;
}

const ART_SG = "(?:(?:the|a|an) )?";
const ART_PL = "(?:the )?";

function glosses(e: { en: string; alt?: string[] }): string[] {
  return [e.en, ...(e.alt ?? [])].map((g) => g.toLowerCase());
}

/** Nouns whose English word is shared with a known noun of another gender get (m) / (f) in prompts. */
export function genderTwins(k: Knowledge): Set<string> {
  const byGloss = new Map<string, NounEntry[]>();
  for (const n of k.nouns) {
    const list = byGloss.get(n.en) ?? [];
    list.push(n);
    byGloss.set(n.en, list);
  }
  const out = new Set<string>();
  for (const list of byGloss.values()) if (new Set(list.map((n) => n.gender)).size > 1) list.forEach((n) => out.add(n.id));
  return out;
}

function nounEnglish(n: NounEntry, num: Num, twins: Set<string>): EnPhrase {
  const base = num === "pl" ? enPlural(n.en, n.enPl) : n.en;
  const marker = twins.has(n.id) ? (n.gender === "f" ? " (f)" : " (m)") : "";
  const words = glosses(n).flatMap((g) => {
    const w = num === "pl" ? enPlural(g, g === n.en ? n.enPl : undefined) : g;
    const genderWord = n.gender === "f" ? "female" : "male";
    return twins.has(n.id) ? [w, `${genderWord} ${w}`] : [w];
  });
  return { text: base + marker, re: alt(words.map(reEscape)) };
}

function adjEnglish(a: AdjEntry): EnPhrase {
  return { text: a.en, re: alt(glosses(a).map(reEscape)) };
}

function possessive(word: string, num: Num): string {
  return num === "pl" ? (word.endsWith("s") ? `${word}'` : `${word}'s`) : `${word}'s`;
}

function npEnglish(np: NP, twins: Set<string>, opts: { article?: "the" | "a" } = {}): EnPhrase {
  const noun = nounEnglish(np.noun, np.num, twins);
  const adj = np.adj ? adjEnglish(np.adj) : null;
  const isMy = np.adj?.id === "meus";
  const art = np.noun.proper ? "" : np.num === "pl" ? ART_PL : ART_SG;
  const shownArt = np.noun.proper ? "" : opts.article === "a" && np.num === "sg" ? article((adj && !isMy ? adj.text : noun.text)) + " " : "the ";
  const adjRe = adj && !isMy ? `${adj.re} ` : "";
  const adjText = adj && !isMy ? `${adj.text} ` : "";
  const lead = isMy ? "my " : shownArt;
  const leadRe = isMy ? "my " : art;
  let text = `${lead}${adjText}${noun.text}`;
  let re = `${leadRe}${adjRe}${noun.re}`;
  if (np.poss) {
    const p = npEnglish(np.poss, twins);
    const pArt = np.poss.noun.proper ? "" : ART_SG;
    const sWord = alt(glosses(np.poss.noun).map((g) => reEscape(possessive(g, np.poss!.num))));
    const genderWord = twins.has(np.poss.noun.id) ? `(?:${np.poss.noun.gender === "f" ? "female" : "male"} )?` : "";
    const sPossessive = `${pArt}${genderWord}${sWord} ${adjRe}${noun.re}`;
    re = alt([sPossessive, `${re} of ${p.re}`]);
    // "the poet's letter"; with an (m) / (f) marker the "of" form reads better
    text = twins.has(np.poss.noun.id) || np.poss.noun.proper
      ? `${text} of ${p.text}`
      : `the ${possessive(np.poss.noun.en, np.poss.num)} ${adjText}${noun.text}`;
  }
  return { text, re };
}

function subjectEnglish(c: Clause, twins: Set<string>): EnPhrase {
  switch (c.subj.kind) {
    case "np":
      return npEnglish(c.subj.np, twins);
    case "coord": {
      const parts = c.subj.nps.map((np) => npEnglish(np, twins));
      return { text: parts.map((p) => p.text).join(" and "), re: parts.map((p) => p.re).join(" and ") };
    }
    case "pron":
      return c.subj.person === 1 ? { text: "I", re: "i" } : { text: "you", re: "you" };
    case "nemo":
      return { text: "no one", re: "(?:no one|nobody|noone|no-one)" };
  }
}

function beForm(person: 1 | 2 | 3, num: Num): string {
  if (person === 1 && num === "sg") return "am";
  if (person === 3 && num === "sg") return "is";
  return "are";
}

/** Verb phrase variants: simple and progressive present, with negation. */
function verbEnglish(v: EnVerb, person: 1 | 2 | 3, num: Num, neg: boolean): EnPhrase {
  const third = person === 3 && num === "sg";
  const be = beForm(person, num);
  const simple = withParticle(v, third ? en3s(v) : v.base);
  const prog = `${be} ${withParticle(v, enIng(v))}`;
  if (neg) {
    const doForm = third ? "does" : "do";
    const negSimple = `${doForm} not ${withParticle(v, v.base)}`;
    const negProg = `${be} not ${withParticle(v, enIng(v))}`;
    return { text: negSimple, re: alt([negSimple, negProg].map(reEscape)) };
  }
  return { text: simple, re: alt([simple, prog].map(reEscape)) };
}

function verbAlternatives(v: VerbEntry): EnVerb[] {
  return [v.env, ...(v.altv ?? [])];
}

function predicateEnglish(c: Clause, twins: Set<string>): EnPhrase {
  const p = c.pred!;
  if (p.adj) return adjEnglish(p.adj);
  return npEnglish(p.np!, twins, { article: "a" });
}

function ppEnglish(c: Clause, twins: Set<string>): EnPhrase {
  const pp = c.pp!;
  const np = npEnglish(pp.np, twins);
  const tags = pp.np.noun.tags;
  let preps: string[];
  let shown: string;
  if (pp.prep === "ad") {
    preps = ["to", "toward", "towards", "up to"];
    shown = "to";
  } else if (pp.case === "acc") {
    preps = ["into", "in to", "onto", "in"];
    shown = "into";
  } else {
    preps = ["in", "on", "at", "inside"];
    shown = tags.includes("on") ? "on" : "in";
  }
  return { text: `${shown} ${np.text}`, re: `${alt(preps.map(reEscape))} ${np.re}` };
}

export interface English {
  text: string;
  pattern: RegExp;
}

/** The English translation of a clause plus a pattern accepting common rephrasings. */
export function english(c: Clause, k: Knowledge): English {
  const twins = genderTwins(k);
  const subj = subjectEnglish(c, twins);
  const tail: EnPhrase[] = [];
  let vp: EnPhrase;
  if (c.verb.irregular === "sum") {
    const be = beForm(c.person, c.num);
    const pred = predicateEnglish(c, twins);
    const verb = c.neg ? `${be} not` : be;
    vp = { text: `${verb} ${pred.text}`, re: `${reEscape(verb)} ${pred.re}` };
  } else if (c.verb.irregular === "possum") {
    const inf = c.inf!.verb;
    const infs = verbAlternatives(inf);
    const be = beForm(c.person, c.num);
    const obj = c.inf!.obj ? npEnglish(c.inf!.obj, twins) : null;
    const after = obj ? ` ${obj.re}` : "";
    const baseRe = alt(infs.map((v) => reEscape(withParticle(v, v.base))));
    const can = c.neg ? "(?:cannot|can not)" : "can";
    const able = c.neg ? `${be} not able to` : `${be} able to`;
    vp = {
      text: `${c.neg ? "cannot" : "can"} ${withParticle(inf.env, inf.env.base)}${obj ? " " + obj.text : ""}`,
      re: `${alt([can, reEscape(able)])} ${baseRe}${after}`,
    };
  } else {
    const variants = verbAlternatives(c.verb).map((v) => verbEnglish(v, c.person, c.num, c.neg));
    vp = { text: variants[0].text, re: alt(variants.map((v) => v.re)) };
    if (c.obj && !(c.verb.id === "doceo" && c.inf)) {
      const o = npEnglish(c.obj, twins);
      vp = { text: `${vp.text} ${o.text}`, re: `${vp.re} ${o.re}` };
    }
    if (c.inf) {
      const infs = verbAlternatives(c.inf.verb);
      const infRe = alt(infs.map((v) => reEscape("to " + withParticle(v, v.base))));
      const infText = "to " + withParticle(c.inf.verb.env, c.inf.verb.env.base);
      if (c.verb.id === "doceo" && c.obj) {
        const o = npEnglish(c.obj, twins);
        vp = { text: `${vp.text} ${o.text} ${infText}`, re: `${vp.re} ${o.re} ${infRe}` };
      } else vp = { text: `${vp.text} ${infText}`, re: `${vp.re} ${infRe}` };
    }
  }
  if (c.pp) tail.push(ppEnglish(c, twins));
  if (c.adv === "bene") tail.push({ text: "well", re: "well" });
  const parts = [c.adv === "nunc" ? "now" : "", subj.text, vp.text, ...tail.map((t) => t.text)].filter(Boolean);
  const text = parts.join(" ");
  const core = [subj.re, vp.re, ...tail.map((t) => t.re)].join(" ");
  let variants = [core];
  if (c.pp) {
    const pp = ppEnglish(c, twins);
    const rest = [subj.re, vp.re, ...tail.filter((t) => t.re !== pp.re).map((t) => t.re)].join(" ");
    variants.push(`${pp.re} ${rest}`);
  }
  if (c.adv === "nunc") variants = variants.flatMap((v) => [`now ${v}`, `${v} now`]);
  if (c.pred?.np && c.subj.kind === "np") {
    // "The farmer is a poet" can also be read "The poet is a farmer".
    const swapped: Clause = { ...c, subj: { kind: "np", np: { ...c.pred.np } }, pred: { ...c.pred, np: c.subj.np } };
    const s2 = subjectEnglish(swapped, twins);
    const be = beForm(3, "sg");
    const verb = c.neg ? `${be} not` : be;
    variants.push(`${s2.re} ${reEscape(verb)} ${predicateEnglish(swapped, twins).re}`);
  }
  const pattern = new RegExp(`^(?:${variants.join("|")})$`);
  return { text: capitalize(text) + ".", pattern };
}

/** The same clause with subject and object swapped (for spotting role mix-ups). */
export function swapRoles(c: Clause): Clause | null {
  if (c.subj.kind !== "np" || !c.obj || c.subj.np.num !== "sg") return null;
  const subjNp: NP = { ...c.obj, case: "nom" };
  const objNp: NP = { ...c.subj.np, case: "acc" };
  return { ...c, subj: { kind: "np", np: subjNp }, obj: objNp };
}
