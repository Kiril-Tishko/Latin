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
  skills: string[];
  /** Which sentence pattern built it. */
  template?: string;
}

const MOTION = new Set(["ambulo", "fugito", "porto"]);

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

const isPerson = (n: NounEntry) => n.tags.includes("person") || n.tags.includes("animal");
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
  if (chance(r, o.adjChance ?? 0.3)) {
    let adjs = k.adjs.filter((a) => adjUsable(k, a, noun, o.case, o.num));
    if (!chance(r, k.silly * 0.5)) {
      const fitting = adjs.filter((a) => !a.tags.length || a.tags.some((t) => noun.tags.includes(t)));
      if (fitting.length) adjs = fitting;
    }
    if (adjs.length) {
      np.adj = pick(r, adjs);
      np.adjFirst = np.adj.id === "meus" ? false : chance(r, 0.5);
    }
  }
  if (np.adj?.id !== "meus" && k.skills.has("s.gen") && chance(r, o.possChance ?? 0.2)) {
    const poss = makeNP(k, r, {
      case: "gen",
      num: "sg",
      prefer: isPerson,
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

function makeSubject(k: Knowledge, r: Rand, o: { allowPron?: boolean; allowPlural?: boolean; allowNemo?: boolean; possChance?: number } = {}) {
  type Opt = { w: number; build: () => { subj: Subject; person: 1 | 2 | 3; num: Num; skills: string[] } | null };
  const opts: Opt[] = [
    {
      w: 6,
      build: () => {
        const np = makeNP(k, r, { case: "nom", num: "sg", prefer: isPerson, possChance: o.possChance, sillyScale: 0.5 });
        return np && { subj: { kind: "np", np }, person: 3, num: "sg", skills: ["s.sv", ...npSkills(np)] };
      },
    },
  ];
  if (o.allowPlural !== false && k.skills.has("s.pl") && k.skills.has("v.3pl")) {
    opts.push({
      w: 2.5,
      build: () => {
        const np = makeNP(k, r, { case: "nom", num: "pl", prefer: isPerson, possChance: 0, sillyScale: 0.5 });
        return np && { subj: { kind: "np", np }, person: 3, num: "pl", skills: ["s.sv", "s.pl", ...npSkills(np)] };
      },
    });
    if (k.skills.has("s.et")) {
      opts.push({
        w: 1,
        build: () => {
          const a = makeNP(k, r, { case: "nom", num: "sg", prefer: isPerson, adjChance: 0.15, possChance: 0, sillyScale: 0.5 });
          if (!a) return null;
          const b = makeNP(k, r, { case: "nom", num: "sg", prefer: isPerson, adjChance: 0.15, possChance: 0, exclude: [a.noun.id], sillyScale: 0.5 });
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
          const shown = !k.skills.has("s.drop") || chance(r, 0.4);
          return { subj: { kind: "pron", person, shown }, person, num: "sg", skills: shown ? [] : ["s.drop"] };
        },
      });
    }
  }
  if (o.allowNemo && k.skills.has("s.conn") && k.fixed.has("nemo")) {
    opts.push({ w: 0.6, build: () => ({ subj: { kind: "nemo" }, person: 3, num: "sg", skills: ["s.conn"] }) });
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

function objectFor(k: Knowledge, r: Rand, verb: VerbEntry, exclude: string[]): NP | null {
  const drink = (n: NounEntry) => n.tags.includes("drink");
  const writing = (n: NounEntry) => n.tags.includes("writing");
  if (verb.id === "bibo") return makeNP(k, r, { case: "acc", num: "sg", require: drink, exclude, adjChance: 0.15 });
  const prefer =
    verb.id === "lego" || verb.id === "scribo" ? writing
    : verb.id === "disco" ? isThing
    : verb.id === "doceo" || verb.id === "desidero" ? isPerson
    : undefined;
  return makeNP(k, r, { case: "acc", num: "sg", prefer, exclude });
}

const placeNoun = (k: Knowledge, r: Rand, c: Case, exclude: string[]) =>
  makeNP(k, r, { case: c, num: "sg", prefer: isPlace, exclude, adjChance: 0.2, possChance: 0.05, sillyScale: 0.3 });

type Template = (k: Knowledge, r: Rand) => Clause | null;

const finite = (k: Knowledge, pred: (v: VerbEntry) => boolean, person: 1 | 2 | 3, num: Num) =>
  k.verbs.filter((v) => !v.irregular && pred(v) && verbUsable(k, v, pnOf(person, num)));

function base(k: Knowledge, r: Rand, s: NonNullable<ReturnType<typeof makeSubject>>, verb: VerbEntry, extra: string[]): Clause {
  const c: Clause = { subj: s.subj, person: s.person, num: s.num, verb, neg: false, skills: [...s.skills, `v.${pnOf(s.person, s.num)}`, ...extra] };
  if (s.subj.kind !== "nemo" && k.skills.has("s.non") && chance(r, 0.18)) {
    c.neg = true;
    c.skills.push("s.non");
  }
  return c;
}

const subjectIds = (s: Subject) => (s.kind === "np" ? [s.np.noun.id] : s.kind === "coord" ? s.nps.map((n) => n.noun.id) : []);

const TEMPLATES: Record<string, Template> = {
  // Subject + verb, maybe "well" or "now".
  sv: (k, r) => {
    const s = makeSubject(k, r, { allowNemo: true });
    if (!s) return null;
    const verbs = finite(k, (v) => v.intrans && v.id !== "habito", s.person, s.num);
    if (!verbs.length) return null;
    const c = base(k, r, s, pick(r, verbs), []);
    if (k.skills.has("s.conn") && k.fixed.has("bene") && chance(r, 0.15)) {
      c.adv = "bene";
      c.skills.push("s.conn");
    } else if (k.fixed.has("nunc") && chance(r, 0.1)) c.adv = "nunc";
    return c;
  },
  // Subject + object + verb.
  svo: (k, r) => {
    if (!k.skills.has("s.svo")) return null;
    const s = makeSubject(k, r, { allowNemo: true, possChance: 0.15 });
    if (!s) return null;
    const verbs = finite(k, (v) => v.trans, s.person, s.num);
    if (!verbs.length) return null;
    const verb = pick(r, verbs);
    const obj = objectFor(k, r, verb, subjectIds(s.subj));
    if (!obj) return null;
    if (s.num === "pl" && obj.poss) delete obj.poss; // "-ae" would read as a second plural subject
    if (s.subj.kind === "np" && s.subj.np.noun.gender === "n" && obj.noun.gender === "n") return null;
    const c = base(k, r, s, verb, ["s.svo"]);
    c.obj = obj;
    c.skills.push(...npSkills(obj));
    return c;
  },
  // Where: in + ablative.
  loc: (k, r) => {
    if (!k.skills.has("s.loc")) return null;
    const s = makeSubject(k, r, { possChance: 0.1 });
    if (!s) return null;
    const verbs = finite(k, (v) => v.intrans, s.person, s.num);
    if (!verbs.length) return null;
    const np = placeNoun(k, r, "abl", subjectIds(s.subj));
    if (!np) return null;
    const c = base(k, r, s, pick(r, verbs), ["s.loc"]);
    c.pp = { prep: "in", case: "abl", np };
    c.skills.push(...npSkills(np));
    return c;
  },
  // Where to: in / ad + accusative with a verb of motion.
  motion: (k, r) => {
    const preps = [k.skills.has("s.into") && "in", k.skills.has("s.ad") && "ad"].filter(Boolean) as ("in" | "ad")[];
    if (!preps.length) return null;
    const s = makeSubject(k, r, { possChance: 0.1 });
    if (!s) return null;
    const verbs = finite(k, (v) => MOTION.has(v.id) || v.tags.includes("motion"), s.person, s.num);
    if (!verbs.length) return null;
    const verb = pick(r, verbs);
    const prep = pick(r, preps);
    const np = placeNoun(k, r, "acc", subjectIds(s.subj));
    if (!np) return null;
    const c = base(k, r, s, verb, [prep === "in" ? "s.into" : "s.ad"]);
    c.pp = { prep, case: "acc", np };
    c.skills.push(...npSkills(np));
    if (verb.trans) {
      if (!k.skills.has("s.svo")) return null;
      const obj = makeNP(k, r, { case: "acc", num: "sg", exclude: [...subjectIds(s.subj), np.noun.id], possChance: 0.1 });
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
    const s = makeSubject(k, r, { allowPlural: false, possChance: 0.15 });
    if (!s || !verbUsable(k, sum, pnOf(s.person, s.num))) return null;
    const c = base(k, r, s, sum, ["s.est", "v.sum"]);
    const gender: Gender = s.subj.kind === "np" ? s.subj.np.noun.gender : chance(r, 0.5) ? "m" : "f";
    const useAdj = k.skills.has("adj.agree") && chance(r, 0.55);
    if (useAdj) {
      const holder: NounEntry =
        s.subj.kind === "np" ? s.subj.np.noun : ({ decl: gender === "f" ? "1" : "2", gender } as NounEntry);
      const adjs = k.adjs.filter((a) => a.id !== "meus" && adjUsable(k, a, holder, "nom", "sg"));
      if (!adjs.length) return null;
      c.pred = { adj: pick(r, adjs), gender, predFirst: chance(r, 0.6) };
      c.skills.push("adj.agree", nounSkill(adjDecl(gender), "nom", "sg"));
      if (s.subj.kind === "np" && genderMismatch(s.subj.np.noun)) c.skills.push("adj.gender");
    } else {
      const np = makeNP(k, r, {
        case: "nom",
        num: "sg",
        prefer: isPerson,
        require: (n) => !n.proper && (s.subj.kind !== "pron" || n.gender === gender || n.tags.includes("person")),
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
    const infs = k.verbs.filter((v) => !v.irregular);
    if (!infs.length) return null;
    const inf = pick(r, infs);
    const c = base(k, r, s, possum, ["v.possum", "s.inf", "v.inf"]);
    c.inf = { verb: inf };
    if (inf.trans && k.skills.has("s.svo") && (!inf.intrans || chance(r, 0.6))) {
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
    const infs = k.verbs.filter((v) => !v.irregular && v.intrans && v.id !== verb.id);
    if (!infs.length) return null;
    const c = base(k, r, s, verb, ["s.inf", "v.inf"]);
    c.inf = { verb: pick(r, infs) };
    if (verb.id === "doceo") {
      if (!k.skills.has("s.svo")) return null;
      const obj = makeNP(k, r, { case: "acc", num: "sg", prefer: isPerson, exclude: subjectIds(s.subj), possChance: 0 });
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
export function generate(k: Knowledge, r: Rand, focus: string[] = [], templates: string[] = TEMPLATE_NAMES): Clause | null {
  let alive = templates.filter((t) => TEMPLATES[t]);
  const fails: Record<string, number> = {};
  let best: Clause | null = null;
  let bestScore = -1;
  for (let i = 0; i < 80 && alive.length; i++) {
    const name = pick(r, alive);
    const c = TEMPLATES[name](k, r);
    if (!c) {
      fails[name] = (fails[name] ?? 0) + 1;
      if (fails[name] >= 6) alive = alive.filter((t) => t !== name);
      continue;
    }
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

/** The sentence in Latin, word by word, in a natural order (verb last). */
export function latinTokens(c: Clause, k: Knowledge): LToken[] {
  const out: LToken[] = [];
  const pn = pnOf(c.person, c.num);
  if (c.adv === "nunc") out.push(fixedToken(k, "nunc", "adv", "nunc"));
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
  if (c.obj) out.push(...npTokens(c.obj, "obj"));
  const verb = verbToken(c.verb, `pres.${pn}` as VerbKey, "verb");
  if (c.pred) {
    const pred: LToken[] = c.pred.np
      ? npTokens(c.pred.np, "pred")
      : [adjToken(c.pred.adj!, c.pred.gender, "nom", "sg", "pred-adj")];
    const neg = c.neg ? [fixedToken(k, "non", "neg", "nōn")] : [];
    // nōn stays right before est: "Poēta nōn est puella" / "Poēta puella nōn est"
    if (c.pred.predFirst) out.push(...pred, ...neg, verb);
    else out.push(...neg, verb, ...pred);
    return out;
  }
  if (c.inf) {
    if (c.inf.obj && c.verb.id !== "doceo") out.push(...npTokens(c.inf.obj, "obj"));
    out.push(verbToken(c.inf.verb, "inf", "inf"));
  }
  if (c.adv === "bene") out.push(fixedToken(k, "bene", "adv", "bene"));
  if (c.neg) out.push(fixedToken(k, "non", "neg", "nōn"));
  out.push(verb);
  return out;
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
