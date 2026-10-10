import { describe, expect, it } from "vitest";
import { adj, adj3, conjugate, declineAdj, declineNoun, dictionaryForm, noun, syllables, verb } from "../src/latin/morph";
import { full, NounKey, VerbKey } from "../src/latin/types";

const L = { lesson: 1 } as const;

function paradigm(forms: Partial<Record<NounKey, { stem: string; ending: string }>>, keys: NounKey[]) {
  return keys.map((k) => (forms[k] ? full(forms[k]!) : "-"));
}

const ALL: NounKey[] = [
  "nom.sg", "gen.sg", "dat.sg", "acc.sg", "abl.sg", "voc.sg",
  "nom.pl", "gen.pl", "dat.pl", "acc.pl", "abl.pl", "voc.pl",
];

describe("nouns", () => {
  it("declines first declension", () => {
    const e = noun("puella", "puellae", "f", { en: "girl" }, L);
    expect(e.decl).toBe("1");
    expect(paradigm(declineNoun(e), ALL)).toEqual([
      "puella", "puellae", "puellae", "puellam", "puellā", "puella",
      "puellae", "puellārum", "puellīs", "puellās", "puellīs", "puellae",
    ]);
    expect(declineNoun(e)["acc.sg"]).toEqual({ stem: "puell", ending: "am" });
  });

  it("keeps masculine first-declension nouns in the first declension", () => {
    const e = noun("agricola", "agricolae", "m", { en: "farmer" }, L);
    expect(e.decl).toBe("1");
    expect(full(declineNoun(e)["acc.sg"]!)).toBe("agricolam");
  });

  it("declines second declension -us, -er and neuter", () => {
    const amicus = noun("amīcus", "amīcī", "m", { en: "friend" }, L);
    expect(paradigm(declineNoun(amicus), ALL)).toEqual([
      "amīcus", "amīcī", "amīcō", "amīcum", "amīcō", "amīce",
      "amīcī", "amīcōrum", "amīcīs", "amīcōs", "amīcīs", "amīcī",
    ]);
    const liber = noun("liber", "librī", "m", { en: "book" }, L);
    expect(paradigm(declineNoun(liber), ["nom.sg", "gen.sg", "acc.sg", "abl.sg", "nom.pl"])).toEqual([
      "liber", "librī", "librum", "librō", "librī",
    ]);
    expect(declineNoun(liber)["nom.sg"]).toEqual({ stem: "liber", ending: "" });
    const puer = noun("puer", "puerī", "m", { en: "boy" }, L);
    expect(full(declineNoun(puer)["acc.sg"]!)).toBe("puerum");
    const vinum = noun("vīnum", "vīnī", "n", { en: "wine" }, L);
    expect(vinum.decl).toBe("2n");
    expect(paradigm(declineNoun(vinum), ALL)).toEqual([
      "vīnum", "vīnī", "vīnō", "vīnum", "vīnō", "vīnum",
      "vīna", "vīnōrum", "vīnīs", "vīna", "vīnīs", "vīna",
    ]);
  });

  it("handles -ius vocatives and proper names", () => {
    const gladius = noun("gladius", "gladiī", "m", { en: "sword" }, L);
    expect(full(declineNoun(gladius)["gen.sg"]!)).toBe("gladiī");
    expect(full(declineNoun(gladius)["voc.sg"]!)).toBe("gladī");
    const olympus = noun("Olympus", "Olympī", "m", { en: "Olympus" }, L);
    expect(olympus.proper).toBe(true);
    expect(declineNoun(olympus)["nom.pl"]).toBeUndefined();
    expect(full(declineNoun(olympus)["abl.sg"]!)).toBe("Olympō");
    const marcus = noun("Mārcus", "Mārcī", "m", { en: "Marcus" }, L);
    expect(full(declineNoun(marcus)["voc.sg"]!)).toBe("Mārce");
  });

  it("declines third declension, consonant and i-stems", () => {
    const rex = noun("rēx", "rēgis", "m", { en: "king" }, L);
    expect(rex.iStem).toBe(false);
    expect(paradigm(declineNoun(rex), ALL)).toEqual([
      "rēx", "rēgis", "rēgī", "rēgem", "rēge", "rēx",
      "rēgēs", "rēgum", "rēgibus", "rēgēs", "rēgibus", "rēgēs",
    ]);
    const navis = noun("nāvis", "nāvis", "f", { en: "ship" }, L);
    expect(navis.iStem).toBe(true);
    expect(full(declineNoun(navis)["gen.pl"]!)).toBe("nāvium");
    const urbs = noun("urbs", "urbis", "f", { en: "city" }, L);
    expect(urbs.iStem).toBe(true);
    const pater = noun("pater", "patris", "m", { en: "father" }, L);
    expect(pater.iStem).toBe(false);
    expect(full(declineNoun(pater)["gen.pl"]!)).toBe("patrum");
    const nomen = noun("nōmen", "nōminis", "n", { en: "name" }, L);
    expect(paradigm(declineNoun(nomen), ["nom.sg", "acc.sg", "abl.sg", "nom.pl", "gen.pl"])).toEqual([
      "nōmen", "nōmen", "nōmine", "nōmina", "nōminum",
    ]);
    const mare = noun("mare", "maris", "n", { en: "sea" }, L);
    expect(mare.iStem).toBe(true);
    expect(paradigm(declineNoun(mare), ["abl.sg", "nom.pl", "gen.pl"])).toEqual(["marī", "maria", "marium"]);
    const canis = noun("canis", "canis", "m", { en: "dog", iStem: false }, L);
    expect(full(declineNoun(canis)["gen.pl"]!)).toBe("canum");
  });

  it("declines fourth and fifth declension", () => {
    const manus = noun("manus", "manūs", "f", { en: "hand" }, L);
    expect(manus.decl).toBe("4");
    expect(paradigm(declineNoun(manus), ["gen.sg", "dat.sg", "abl.sg", "gen.pl", "dat.pl"])).toEqual([
      "manūs", "manuī", "manū", "manuum", "manibus",
    ]);
    const dies = noun("diēs", "diēī", "m", { en: "day" }, L);
    expect(dies.decl).toBe("5");
    expect(paradigm(declineNoun(dies), ["gen.sg", "acc.sg", "abl.sg", "gen.pl"])).toEqual([
      "diēī", "diem", "diē", "diērum",
    ]);
    const res = noun("rēs", "reī", "f", { en: "thing" }, L);
    expect(paradigm(declineNoun(res), ["gen.sg", "acc.sg", "abl.sg"])).toEqual(["reī", "rem", "rē"]);
  });

  it("applies irregular overrides", () => {
    const deus = noun("deus", "deī", "m", { en: "god", forms: { "voc.sg": "deus", "nom.pl": "dī", "dat.pl": "dīs", "abl.pl": "dīs" } }, L);
    expect(paradigm(declineNoun(deus), ["voc.sg", "nom.pl", "acc.pl"])).toEqual(["deus", "dī", "deōs"]);
  });

  it("counts syllables with diphthongs", () => {
    expect(syllables("puellae")).toBe(3);
    expect(syllables("nāvis")).toBe(2);
    expect(syllables("urbs")).toBe(1);
  });
});

describe("adjectives", () => {
  it("agrees in gender, case and number (1st/2nd)", () => {
    const magnus = adj("magnus", "magna", "magnum", { en: "big" }, L);
    expect(full(declineAdj(magnus, "m")["nom.sg"])).toBe("magnus");
    expect(full(declineAdj(magnus, "f")["acc.sg"])).toBe("magnam");
    expect(full(declineAdj(magnus, "n")["nom.pl"])).toBe("magna");
    expect(full(declineAdj(magnus, "m")["abl.sg"])).toBe("magnō");
  });

  it("handles -er adjectives", () => {
    const pulcher = adj("pulcher", "pulchra", "pulchrum", { en: "beautiful" }, L);
    expect(full(declineAdj(pulcher, "m")["nom.sg"])).toBe("pulcher");
    expect(full(declineAdj(pulcher, "m")["acc.sg"])).toBe("pulchrum");
    expect(full(declineAdj(pulcher, "f")["nom.sg"])).toBe("pulchra");
    const miser = adj("miser", "misera", "miserum", { en: "wretched" }, L);
    expect(full(declineAdj(miser, "m")["gen.sg"])).toBe("miserī");
  });

  it("declines third-declension adjectives as i-stems", () => {
    const omnis = adj3(["omnis", "omne"], null, { en: "every" }, L);
    expect(full(declineAdj(omnis, "m")["abl.sg"])).toBe("omnī");
    expect(full(declineAdj(omnis, "n")["nom.pl"])).toBe("omnia");
    expect(full(declineAdj(omnis, "f")["acc.sg"])).toBe("omnem");
    const felix = adj3(["fēlīx"], "fēlīcis", { en: "happy" }, L);
    expect(full(declineAdj(felix, "n")["acc.sg"])).toBe("fēlīx");
    expect(full(declineAdj(felix, "m")["acc.sg"])).toBe("fēlīcem");
    const acer = adj3(["ācer", "ācris", "ācre"], null, { en: "sharp" }, L);
    expect(full(declineAdj(acer, "f")["nom.sg"])).toBe("ācris");
    expect(full(declineAdj(acer, "m")["gen.pl"])).toBe("ācrium");
  });
});

describe("verbs", () => {
  const V = (pp: string, irregular?: "sum" | "possum" | "eo" | "volo" | "fero") =>
    conjugate(verb(pp, { en: "x", irregular }, L));
  const six = (forms: ReturnType<typeof V>, tense: string) =>
    ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"].map((pn) => full(forms[`${tense}.${pn}` as VerbKey]!));

  it("conjugates the present of all four conjugations", () => {
    expect(six(V("labōrō, labōrāre, labōrāvī, labōrātum"), "pres")).toEqual([
      "labōrō", "labōrās", "labōrat", "labōrāmus", "labōrātis", "labōrant",
    ]);
    expect(six(V("doceō, docēre, docuī, doctum"), "pres")).toEqual([
      "doceō", "docēs", "docet", "docēmus", "docētis", "docent",
    ]);
    expect(six(V("scrībō, scrībere, scrīpsī, scrīptum"), "pres")).toEqual([
      "scrībō", "scrībis", "scrībit", "scrībimus", "scrībitis", "scrībunt",
    ]);
    expect(six(V("capiō, capere, cēpī, captum"), "pres")).toEqual([
      "capiō", "capis", "capit", "capimus", "capitis", "capiunt",
    ]);
    expect(six(V("dormiō, dormīre, dormīvī, dormītum"), "pres")).toEqual([
      "dormiō", "dormīs", "dormit", "dormīmus", "dormītis", "dormiunt",
    ]);
  });

  it("splits personal endings for coloring", () => {
    const f = V("labōrō, labōrāre, labōrāvī, labōrātum");
    expect(f["pres.3sg"]).toEqual({ stem: "labōra", ending: "t" });
    expect(f["pres.1sg"]).toEqual({ stem: "labōr", ending: "ō" });
    expect(f["pres.3pl"]).toEqual({ stem: "labōra", ending: "nt" });
  });

  it("detects conjugations", () => {
    expect(verb("videō, vidēre, vīdī, vīsum", { en: "see" }, L).conj).toBe("2");
    expect(verb("legō, legere, lēgī, lēctum", { en: "read" }, L).conj).toBe("3");
    expect(verb("fugiō, fugere, fūgī, fugitum", { en: "flee" }, L).conj).toBe("3io");
    expect(verb("audiō, audīre, audīvī, audītum", { en: "hear" }, L).conj).toBe("4");
  });

  it("builds other tenses, imperatives and infinitives", () => {
    const amo = V("amō, amāre, amāvī, amātum");
    expect(six(amo, "impf")).toEqual(["amābam", "amābās", "amābat", "amābāmus", "amābātis", "amābant"]);
    expect(six(amo, "fut")).toEqual(["amābō", "amābis", "amābit", "amābimus", "amābitis", "amābunt"]);
    expect(six(amo, "perf")).toEqual(["amāvī", "amāvistī", "amāvit", "amāvimus", "amāvistis", "amāvērunt"]);
    expect(full(amo["imp.2sg"]!)).toBe("amā");
    expect(full(amo["imp.2pl"]!)).toBe("amāte");
    expect(full(amo.inf!)).toBe("amāre");
    const lego = V("legō, legere, lēgī, lēctum");
    expect(six(lego, "fut")).toEqual(["legam", "legēs", "leget", "legēmus", "legētis", "legent"]);
    expect(full(lego["imp.2sg"]!)).toBe("lege");
    const duco = conjugate(verb("dūcō, dūcere, dūxī, ductum", { en: "lead", shortImp: true }, L));
    expect(full(duco["imp.2sg"]!)).toBe("dūc");
    const audio = V("audiō, audīre, audīvī, audītum");
    expect(six(audio, "impf")[0]).toBe("audiēbam");
    expect(six(audio, "fut")).toEqual(["audiam", "audiēs", "audiet", "audiēmus", "audiētis", "audient"]);
  });

  it("conjugates irregular verbs", () => {
    const sum = V("sum, esse, fuī, futūrus", "sum");
    expect(six(sum, "pres")).toEqual(["sum", "es", "est", "sumus", "estis", "sunt"]);
    expect(sum["pres.3sg"]).toEqual({ stem: "es", ending: "t" });
    expect(full(sum.inf!)).toBe("esse");
    const possum = V("possum, posse, potuī", "possum");
    expect(six(possum, "pres")).toEqual(["possum", "potes", "potest", "possumus", "potestis", "possunt"]);
    const absum = V("absum, abesse, āfuī", "sum");
    expect(full(absum["pres.3sg"]!)).toBe("abest");
    const eo = V("eō, īre, iī, itum", "eo");
    expect(six(eo, "pres")).toEqual(["eō", "īs", "it", "īmus", "ītis", "eunt"]);
    const fero = V("ferō, ferre, tulī, lātum", "fero");
    expect(six(fero, "pres")).toEqual(["ferō", "fers", "fert", "ferimus", "fertis", "ferunt"]);
  });
});

describe("dictionary forms", () => {
  it("formats entries like a dictionary", () => {
    expect(dictionaryForm(noun("puella", "puellae", "f", { en: "girl" }, L))).toBe("puella, puellae, f.");
    expect(dictionaryForm(adj("magnus", "magna", "magnum", { en: "big" }, L))).toBe("magnus, magna, magnum");
    expect(dictionaryForm(adj3(["fēlīx"], "fēlīcis", { en: "happy" }, L))).toBe("fēlīx, fēlīcis");
    expect(dictionaryForm(verb("amō, amāre, amāvī, amātum", { en: "love" }, L))).toBe("amō, amāre, amāvī, amātum");
  });
});
