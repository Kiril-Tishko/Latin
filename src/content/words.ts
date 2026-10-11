// Every word taught in the Easy Latin Lessons, with full grammar so the
// engine can build any form of it. Grouped by the lesson that introduces it.
import { adj, fixed, noun, verb } from "../latin/morph";
import { Entry } from "../latin/types";

const L = (n: number) => ({ lesson: n }) as const;

export const LESSON_WORDS: Record<number, Entry[]> = {
  1: [
    noun("poēta", "poētae", "m", { en: "poet", tags: ["person"], note: "Masculine, even though it ends in -a." }, L(1)),
    noun("discipula", "discipulae", "f", { en: "student", alt: ["pupil", "female student"], tags: ["person"] }, L(1)),
    noun("agricola", "agricolae", "m", { en: "farmer", tags: ["person"], note: "Masculine, even though it ends in -a." }, L(1)),
    noun("magistra", "magistrae", "f", { en: "teacher", alt: ["female teacher", "mistress"], tags: ["person"] }, L(1)),
    verb("scrībō, scrībere, scrīpsī, scrīptum", { en: { base: "write", ing: "writing", past: "wrote", pp: "written" }, trans: true, intrans: true }, L(1)),
    verb("studeō, studēre, studuī", { en: { base: "study", s: "studies", past: "studied" }, note: "Strictly, studeō takes the dative (what you are keen on), so it is drilled here without an object." }, L(1)),
    verb("legō, legere, lēgī, lēctum", { en: { base: "read", past: "read", pp: "read" }, trans: true, intrans: true }, L(1)),
    verb("dormiō, dormīre, dormīvī, dormītum", { en: "sleep" }, L(1)),
    verb("labōrō, labōrāre, labōrāvī, labōrātum", { en: "work", alt: ["labor", "toil"] }, L(1)),
    verb("discō, discere, didicī", { en: { base: "learn", past: "learned" }, trans: true, intrans: true }, L(1)),
    verb("doceō, docēre, docuī, doctum", { en: { base: "teach", past: "taught", pp: "taught" }, trans: true, intrans: true }, L(1)),
    fixed("ego", "pron", { id: "ego", en: "I", tags: ["pronoun"] }, L(1)),
    fixed("tū", "pron", { id: "tu", en: "you", tags: ["pronoun"] }, L(1)),
    fixed("et", "conj", { en: "and", note: "Also 'too, even', as in Et tū, Brūte? (You too, Brutus?)" }, L(1)),
    fixed("quī", "question", { en: "who", note: "Here: 'he who', as in Quī docet discit." }, L(1)),
  ],
  2: [
    noun("epistula", "epistulae", "f", { en: "letter", alt: ["epistle"], tags: ["thing", "writing", "long"] }, L(2)),
    noun("aqua", "aquae", "f", { en: "water", tags: ["thing", "drink", "nature", "mass"] }, L(2)),
    verb("videō, vidēre, vīdī, vīsum", { en: { base: "see", past: "saw", pp: "seen" }, trans: true, intrans: true }, L(2)),
    verb("bibō, bibere, bibī", { en: { base: "drink", past: "drank", pp: "drunk" }, trans: true, intrans: true }, L(2)),
    adj("longus", "longa", "longum", { en: "long", tags: ["long"] }, L(2)),
    adj("magnus", "magna", "magnum", { en: "big", alt: ["large", "great", "tall", "strong"], tags: ["person", "animal", "place", "thing", "nature", "weather"] }, L(2)),
    adj("pulcher", "pulchra", "pulchrum", { en: "beautiful", alt: ["pretty", "handsome", "lovely"], tags: ["person", "animal", "place", "thing", "nature", "beauty"] }, L(2)),
    fixed("nōn", "neg", { en: "not", note: "Put it right before the word it negates, usually the verb." }, L(2)),
    fixed("sed", "conj", { en: "but" }, L(2)),
    fixed("nēmō", "pron", { en: "no one", alt: ["nobody"], tags: ["pronoun"], note: "Used as a subject: Nēmō legit (No one reads)." }, L(2)),
    fixed("quod", "conj", { en: "because" }, L(2)),
    fixed("bene", "adv", { en: "well" }, L(2)),
  ],
  3: [
    noun("discipulus", "discipulī", "m", { en: "student", alt: ["pupil", "male student"], tags: ["person"] }, L(3)),
    noun("amīcus", "amīcī", "m", { en: "friend", alt: ["male friend"], tags: ["person", "friend"] }, L(3)),
    noun("amīca", "amīcae", "f", { en: "friend", alt: ["female friend", "girlfriend"], tags: ["person", "friend"] }, L(3)),
    noun("liber", "librī", "m", { en: "book", tags: ["thing", "writing", "long"], note: "Nominative liber; every other form is built on libr-." }, L(3)),
    noun("gladius", "gladiī", "m", { en: "sword", tags: ["thing", "weapon", "long"] }, L(3)),
    noun("puella", "puellae", "f", { en: "girl", tags: ["person"] }, L(3)),
    noun("terra", "terrae", "f", { en: "earth", alt: ["land", "ground"], tags: ["place", "nature", "mass", "on"] }, L(3)),
    noun("taurus", "taurī", "m", { en: "bull", tags: ["animal"] }, L(3)),
    noun("deus", "deī", "m", {
      en: "god",
      tags: ["person", "divine"],
      forms: { "voc.sg": "deus", "nom.pl": "dī", "dat.pl": "dīs", "abl.pl": "dīs", "voc.pl": "dī" },
    }, L(3)),
    noun("Iuppiter", "Iovis", "m", { en: "Jupiter", tags: ["person", "divine", "name"], note: "Irregular: Iuppiter, Iovis, Iovī, Iovem, Iove." }, L(3)),
    noun("Eurōpa", "Eurōpae", "f", { en: "Europa", alt: ["Europe"], tags: ["person", "name"], note: "The princess of the myth, who gave her name to Europe." }, L(3)),
    noun("Olympus", "Olympī", "m", { en: "Olympus", tags: ["place", "name", "on"] }, L(3)),
    verb("sum, esse, fuī, futūrus", { en: { base: "be", s: "is", ing: "being", past: "was", pp: "been" }, irregular: "sum", note: "Irregular: sum (I am), es (you are), est (he / she / it is)." }, L(3)),
    verb("possum, posse, potuī", { en: { base: "can" }, irregular: "possum", note: "pot- + sum: possum (I can), potes (you can), potest (he / she / it can). Add an infinitive: legere potest (he can read)." }, L(3)),
    verb("habeō, habēre, habuī, habitum", { en: { base: "have", s: "has", past: "had", pp: "had" }, trans: true }, L(3)),
    verb("dēsīderō, dēsīderāre, dēsīderāvī, dēsīderātum", { en: "miss", alt: ["desire", "want", "long for"], trans: true, note: "To long for someone or something that is away: Amīcum dēsīderō, I miss my friend." }, L(3)),
    verb("habitō, habitāre, habitāvī, habitātum", { en: "live", alt: ["dwell", "reside"] }, L(3)),
    verb("spectō, spectāre, spectāvī, spectātum", { en: "watch", alt: [{ base: "look", particle: "at" }, "observe"], trans: true }, L(3)),
    verb("trānsfōrmō, trānsfōrmāre, trānsfōrmāvī, trānsfōrmātum", { en: "transform", alt: ["change"], trans: true }, L(3)),
    adj("meus", "mea", "meum", { en: "my", note: "Declines like magnus. Vocative masculine: mī." }, L(3)),
    adj("timidus", "timida", "timidum", { en: "timid", alt: ["shy", "fearful"], tags: ["person", "animal"] }, L(3)),
    fixed("sē", "pron", { id: "se", en: "himself", alt: ["herself", "itself", "themselves"], tags: ["pronoun"] }, L(3)),
    fixed("in", "prep", { en: "in", alt: ["on", "into", "onto"], governs: "abl", note: "in + ablative: where something is (in silvā). in + accusative: where it goes, into (in silvam)." }, L(3)),
  ],
  4: [
    noun("vīnum", "vīnī", "n", { en: "wine", tags: ["thing", "drink", "mass"] }, L(4)),
    noun("silva", "silvae", "f", { en: "forest", alt: ["woods", "wood"], tags: ["place", "nature"] }, L(4)),
    noun("dea", "deae", "f", { en: "goddess", tags: ["person", "divine"] }, L(4)),
    noun("schola", "scholae", "f", { en: "school", tags: ["place", "building", "public"] }, L(4)),
    noun("īnsula", "īnsulae", "f", { en: "island", tags: ["place", "nature", "on"] }, L(4)),
    noun("Crēta", "Crētae", "f", { en: "Crete", tags: ["place", "name", "on"] }, L(4)),
    verb("ambulō, ambulāre, ambulāvī, ambulātum", { en: "walk", alt: ["stroll"], tags: ["motion"] }, L(4)),
    verb("portō, portāre, portāvī, portātum", { en: { base: "carry", s: "carries", past: "carried" }, alt: ["bring", "take"], trans: true, tags: ["motion"] }, L(4)),
    verb("fugitō, fugitāre, fugitāvī, fugitātum", { en: { base: "flee", past: "fled" }, alt: [{ base: "run", particle: "away", ing: "running", past: "ran" }, "escape"], tags: ["motion"] }, L(4)),
    fixed("ad", "prep", { en: "to", alt: ["toward", "towards", "at"], governs: "acc", note: "ad + accusative: to, toward (ad silvam: to the forest)." }, L(4)),
    fixed("nunc", "adv", { en: "now" }, L(4)),
  ],
};

/** Words that appear only in a story or a set phrase: shown on lesson pages, never drilled. */
export const STORY_ONLY = new Set(["iuppiter", "se", "qui", "transformo"]);
