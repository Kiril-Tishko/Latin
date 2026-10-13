// "Find someone random": a stranger from anywhere in the Roman world. The page
// rolls the dice (who they are, where, their temper, a quirk or none, what is
// going on, why they write, how they text), so every stranger is truly
// different; Claude then makes a real person of them.
import type { Day, Happening } from "../content/people";
import { PORTRAITS } from "../content/portraits";
import { PEOPLE, OTHER_NAMES } from "../content/people";
import { Rand } from "./life";

export interface Stranger {
  id: string;
  name: string;
  /** As called: Quīnte. */
  voc: string;
  g: "m" | "f";
  age: number;
  portrait: string;
  /** Shown mirrored (a portrait used twice looks like someone else). */
  flip: boolean;
  city: string;
  tz: string;
  job: string;
  /** Their temper, from everyday to extreme. */
  traits: string[];
  intensity: "mild" | "strong" | "extreme";
  quirk?: string;
  /** Why they write to the learner. */
  why: string;
  /** How they text. */
  style: string;
  day: Day;
  moods: [string, number][];
  swing: number;
  happenings: Happening[];
  /** Whether they write first. */
  writesFirst: boolean;
  /** How they know one of the five friends (most strangers do: the learner asked for people who are connected). */
  link?: { to: string; how: string };
  /** From Claude: who they are (English, two or three sentences) and what they keep to themselves. */
  about?: string;
  secret?: string;
  /** How they felt about the learner from the start (Claude, when they were made real). */
  first?: string;
  /** Brought into the story by the people themselves (hidden from the chat list until they write). */
  invented?: boolean;
  /** Someone from the story the learner sought out and wrote to (shown in the list at once). */
  story?: boolean;
  createdAt: number;
}

export const CITIES: { city: string; tz: string }[] = [
  { city: "Rome", tz: "Europe/Rome" },
  { city: "Rome, near the Circus Maximus", tz: "Europe/Rome" },
  { city: "Ostia, the port of Rome", tz: "Europe/Rome" },
  { city: "Alexandria in Egypt", tz: "Africa/Cairo" },
  { city: "Athens", tz: "Europe/Athens" },
  { city: "Corinth", tz: "Europe/Athens" },
  { city: "Carthage in Africa", tz: "Africa/Tunis" },
  { city: "Leptis Magna in Africa", tz: "Africa/Tripoli" },
  { city: "Londinium in Britannia", tz: "Europe/London" },
  { city: "Vindolanda, a fort in the cold north of Britannia", tz: "Europe/London" },
  { city: "Aquae Sulis in Britannia, the town of hot baths", tz: "Europe/London" },
  { city: "Lugdunum in Gaul", tz: "Europe/Paris" },
  { city: "Massilia, the old Greek port in Gaul", tz: "Europe/Paris" },
  { city: "Colonia Agrippina on the Rhine", tz: "Europe/Berlin" },
  { city: "Antioch in Syria", tz: "Europe/Istanbul" },
  { city: "Ephesus", tz: "Europe/Istanbul" },
  { city: "Hispalis in Hispania", tz: "Europe/Madrid" },
  { city: "Tarraco in Hispania", tz: "Europe/Madrid" },
  { city: "Aquincum on the Danube", tz: "Europe/Budapest" },
  { city: "Tomis on the Black Sea, where the poet Ovid was exiled", tz: "Europe/Bucharest" },
  { city: "Olbia on the Black Sea, not far from the learner's own land", tz: "Europe/Kyiv" },
  { city: "a ship somewhere at sea between Sicily and Africa", tz: "Europe/Rome" },
];

export const JOBS = [
  "baker", "fishmonger", "gladiator", "retired gladiator", "perfume seller", "astrologer", "public letter-writer", "sailor",
  "legionary", "centurion", "priest or priestess of Isis", "tavern keeper", "midwife", "mosaic artist", "mime actor",
  "slave who keeps a rich man's accounts", "freed slave who now runs a shop", "Cynic philosopher who sleeps in a large jar",
  "Greek doctor", "charioteer", "barber", "fuller (washes cloth, with urine)", "olive-oil merchant", "shepherd", "weaver",
  "cook in a rich house", "architect", "teacher of public speaking", "beekeeper", "potter", "wrestler", "fortune teller",
  "tax collector", "street musician", "gardener of a rich villa", "bath attendant", "lamp maker", "spice trader",
  "copyist of books", "dancer", "hunter", "ferryman", "jeweller", "blacksmith", "nurse", "bored child of a rich senator (an adult)",
  "keeper of the great lighthouse of Alexandria", "camel driver", "librarian", "hairdresser of rich ladies", "sandal maker",
  "dream interpreter", "acrobat", "guard at a temple", "flower seller", "vet for horses at the races",
];

const TRAITS = {
  mild: ["friendly", "shy", "talkative", "curious", "kind", "practical", "calm", "polite", "cheerful", "serious", "thoughtful", "a little nervous", "warm", "easygoing"],
  strong: ["sarcastic", "boastful", "grumpy", "dramatic", "nosy", "anxious", "lazy", "bossy", "charming and playful", "gloomy", "hyperactive", "competitive", "proud", "suspicious", "romantic", "stubborn", "absent-minded", "impatient", "very religious", "gossipy", "overly polite"],
  extreme: ["paranoid", "wildly enthusiastic about everything", "deeply melancholic", "outrageously arrogant", "painfully shy", "furious at the whole world", "insanely jealous", "over-the-top theatrical", "shockingly blunt", "manic", "weepy and sentimental"],
};

const QUIRKS = {
  mild: [
    "talks about food all the time", "always answers a question with a question", "counts everything", "loves cats more than people",
    "believes in every omen", "keeps mentioning their mother", "is obsessed with the chariot races", "collects shells",
    "gives advice nobody asked for", "says goodbye in the middle of the conversation and then keeps writing", "loves the number three",
  ],
  strong: [
    "speaks about themselves in the third person", "is convinced the learner is a god in disguise", "thinks they are a Greek hero reborn",
    "is sure the world ends tomorrow", "believes their goat understands Latin", "pretends to be an emperor", "claims to have met Jupiter",
    "is (badly) pretending to be a secret spy", "wrote to the wrong person and pretends that was the plan", "laughs at everything (hahae)",
    "insists it is the year of Rome's founding", "writes everything as if it were a prophecy",
  ],
};

const WHY = [
  "is just bored", "is lonely and wants a friend", "got the learner's name from a friend of a friend", "meant to write to someone else (wrong person)",
  "wants to sell the learner something", "is curious about the far north-east where the learner lives", "needs advice about a problem",
  "wants to practise writing letters", "is looking for a lost animal", "has big news and must tell someone", "collects stories from faraway lands",
  "was dared by friends to write to a stranger",
];

const STYLE = {
  length: ["very short messages, one to three words", "short messages", "chatty: several messages in a row"],
  emoji: ["no emoji at all", "a few emoji", "lots of emoji"],
  marks: ["calm punctuation", "lots of «!!!»", "trailing «...»", "hardly any punctuation", "ALL CAPITALS now and then"],
};

/**
 * How a stranger can know one of the friends: [friend, how, where they must live
 * for it (true: Rome or Ostia; a place; false: anywhere)].
 */
export const LINKS: [string, string, boolean | string][] = [
  ["marcus", "Marcus's landlord in the Subura", "Rome, in the Subura"],
  ["marcus", "a fellow Greens fan Marcus shouts with at the races", true],
  ["marcus", "works at the next desk in Marcus's moneylender's office", "Rome"],
  ["marcus", "Marcus owes them money", false],
  ["marcus", "the brother or sister of Flāvia, the baker's daughter Marcus loves", "Rome"],
  ["iulia", "a friend Iūlia gossips with at the baths", true],
  ["iulia", "family of Iūlia's Greek tutor", false],
  ["iulia", "buys wine from Iūlia's father", false],
  ["iulia", "an actor Iūlia admires from the theatre", true],
  ["gaius", "a wine merchant who buys Gāius's wine", false],
  ["gaius", "the farmer on the next farm to Gāius", "a farm in the hills near Tibur"],
  ["gaius", "family of Pompōnia, Gāius's wife", false],
  ["gaius", "the soothsayer Gāius asks about his omens", true],
  ["claudia", "the parent of one of Claudia's pupils", "Ostia, the port of Rome"],
  ["claudia", "a sailor on the ship of Titus, Claudia's husband", false],
  ["claudia", "Claudia's cousin", false],
  ["claudia", "a bookseller Claudia buys from", false],
  ["lucius", "a rival poet who mocks Lūcius", false],
  ["lucius", "Lūcius's landlady (or landlord), who wants the rent", "Rome"],
  ["lucius", "a rich man or woman Lūcius hopes will be his patron", false],
  ["lucius", "keeps the tavern where Lūcius writes at night", "Rome"],
];

const MOODS = ["cheerful", "bored", "grumpy", "excited", "sad", "anxious", "curious", "tired", "silly", "dreamy", "proud", "lonely", "restless", "suspicious", "content"];

const NAMES = {
  m: ["Quīntus", "Sextus", "Decimus", "Servius", "Tiberius", "Publius", "Gnaeus", "Spurius", "Faustus", "Fēlīx", "Sevērus", "Rūfus", "Crispus", "Cornēlius", "Flāvius", "Valerius", "Antōnius", "Septimus", "Octāvius", "Mārcellus", "Lentulus", "Sīlvānus", "Victor", "Māximus", "Paulus", "Lūcīlius", "Iūnius", "Horātius", "Philippus", "Dēmētrius", "Theodōrus", "Postumus", "Agrippa", "Primus", "Celsus", "Varus", "Vitālis", "Iūstus"],
  f: ["Aurēlia", "Cornēlia", "Valeria", "Līvia", "Octāvia", "Sabīna", "Tullia", "Fausta", "Prīma", "Secunda", "Quīnta", "Lucrētia", "Caecilia", "Domitia", "Iūnia", "Antōnia", "Fabia", "Hortēnsia", "Sulpicia", "Terentia", "Galla", "Rūfīna", "Sevēra", "Marcella", "Paulīna", "Helena", "Chloē", "Daphnē", "Vibia", "Aemilia", "Cassia", "Licinia"],
};

const TAKEN = new Set([...PEOPLE.map((p) => p.name), ...OTHER_NAMES.map((n) => n.name)]);

function pick<T>(r: Rand, xs: T[]): T {
  return xs[Math.floor(r() * xs.length) % xs.length];
}

function vocative(name: string): string {
  if (/ius$/.test(name)) return `${name.slice(0, -3)}ī`;
  if (/us$/.test(name)) return `${name.slice(0, -2)}e`;
  return name;
}

/** A random day: early birds, night owls and everything between, with one or two busy stretches. */
function rollDay(r: Rand, job: string): Day {
  const owl = r() < 0.15;
  const wake = owl ? 10 + r() * 3 : 4.5 + r() * 4;
  const sleep = owl ? 26 + r() * 2.5 : 21 + r() * 3.5;
  const start = wake + 1 + r() * 2;
  const busy: Day["busy"] = [[start, start + 3 + r() * 4, `working (${job})`]];
  if (r() < 0.5) {
    const again = busy[0][1] + 1 + r() * 2;
    if (again + 2 < sleep) busy.push([again, again + 2 + r() * 3, `working again (${job})`]);
  }
  return { wake: Math.round(wake * 4) / 4, sleep: Math.round(sleep * 4) / 4, busy: busy.map(([a, b, w]) => [Math.round(a * 4) / 4, Math.round(b * 4) / 4, w]) };
}

/** Rolls a new stranger. Names and portraits already in the messenger are avoided while others are left. */
export function rollStranger(r: Rand, used: { names: string[]; portraits: string[] }, now = Date.now()): Stranger {
  const g = r() < 0.5 ? "m" : "f";
  const ageGroup = r() < 0.42 ? "young" : r() < 0.85 ? "adult" : "old";
  const age = ageGroup === "young" ? 18 + Math.floor(r() * 10) : ageGroup === "adult" ? 28 + Math.floor(r() * 27) : 56 + Math.floor(r() * 25);
  const busyNames = new Set([...TAKEN, ...used.names]);
  const freeNames = NAMES[g].filter((n) => !busyNames.has(n));
  const name = pick(r, freeNames.length ? freeNames : NAMES[g]);

  // a portrait of the right sex and about the right age, unused if possible (else shown mirrored)
  const personas = new Set(PEOPLE.map((p) => p.portrait));
  const pool = PORTRAITS.filter((p) => p.g === g && !personas.has(p.id));
  const byAge = pool.filter((p) => p.age === ageGroup || (ageGroup === "old" && p.age === "adult"));
  const candidates = byAge.length ? byAge : pool;
  const unused = candidates.filter((p) => !used.portraits.includes(p.id));
  const portrait = pick(r, unused.length ? unused : candidates);

  // most strangers know one of the friends; some links need them in Rome or Ostia
  const link = r() < 0.7 ? pick(r, LINKS) : undefined;
  const near = CITIES.filter((c) => /^(Rome|Ostia)/.test(c.city));
  const place = !link || link[2] === false ? pick(r, CITIES) : link[2] === true ? pick(r, near) : { city: link[2], tz: "Europe/Rome" };
  const job = pick(r, JOBS);
  const x = r();
  const intensity: Stranger["intensity"] = x < 0.4 ? "mild" : x < 0.8 ? "strong" : "extreme";
  const traits = intensity === "mild" ? [pick(r, TRAITS.mild), pick(r, TRAITS.mild)] : intensity === "strong" ? [pick(r, TRAITS.strong), pick(r, TRAITS.mild)] : [pick(r, TRAITS.extreme), pick(r, TRAITS.strong)];
  const q = r();
  const quirk = q < 0.45 ? undefined : q < 0.8 ? pick(r, QUIRKS.mild) : pick(r, QUIRKS.strong);
  const style = [pick(r, STYLE.length), pick(r, STYLE.emoji), pick(r, STYLE.marks)].join("; ");
  const moods: [string, number][] = [...new Set([pick(r, MOODS), pick(r, MOODS), pick(r, MOODS), pick(r, MOODS)])].map((m, i) => [m, 4 - i]);
  return {
    id: `s${now.toString(36)}${Math.floor(r() * 1e6).toString(36)}`,
    name,
    voc: vocative(name),
    g,
    age,
    portrait: portrait.id,
    flip: used.portraits.includes(portrait.id),
    city: place.city,
    tz: place.tz,
    job,
    traits: [...new Set(traits)],
    intensity,
    quirk,
    why: pick(r, WHY),
    style,
    day: rollDay(r, job),
    moods,
    swing: intensity === "mild" ? 0.3 : intensity === "strong" ? 0.6 : 0.95,
    happenings: [],
    writesFirst: r() < 0.6,
    ...(link ? { link: { to: link[0], how: link[1] } } : {}),
    createdAt: now,
  };
}

/** Someone the people bring into their lives themselves (a lover, a rival, a cousin), as Claude described them. */
export interface NewPerson {
  name: string;
  g: "m" | "f";
  age: number;
  job: string;
  city: string;
  about: string;
  /** Which of the five they are tied to, and how. */
  link?: { to: string; how: string };
  /** How they feel about the learner from the start. */
  first?: string;
}

/**
 * A new person in the story: the dice give them a face, a day and a way of
 * texting; Claude's description gives the rest. Their city keeps its time zone
 * when it is one of the known cities (else Rome's).
 */
export function inventStranger(p: NewPerson, r: Rand, used: { names: string[]; portraits: string[] }, now = Date.now()): Stranger {
  const s = rollStranger(r, used, now);
  const age = Math.max(18, Math.min(90, Math.round(p.age) || s.age));
  // a face of their sex and age group, unused if possible
  const group = age < 28 ? "young" : age < 56 ? "adult" : "old";
  const personas = new Set(PEOPLE.map((x) => x.portrait));
  const pool = PORTRAITS.filter((x) => x.g === p.g && !personas.has(x.id));
  const fit = pool.filter((x) => x.age === group || (group === "old" && x.age === "adult"));
  const unused = (fit.length ? fit : pool).filter((x) => !used.portraits.includes(x.id));
  const portrait = (unused.length ? unused : fit.length ? fit : pool)[Math.floor(r() * (unused.length || fit.length || pool.length))] ?? PORTRAITS[0];
  const place = CITIES.find((c) => c.city.toLowerCase().startsWith(p.city.toLowerCase().split(/[ ,]/)[0])) ?? { city: p.city, tz: "Europe/Rome" };
  return {
    ...s,
    name: p.name,
    voc: vocative(p.name),
    g: p.g,
    age,
    portrait: portrait.id,
    flip: used.portraits.includes(portrait.id),
    city: p.city || place.city,
    tz: place.tz,
    job: p.job || s.job,
    day: rollDay(r, p.job || s.job),
    about: p.about,
    first: p.first,
    writesFirst: false,
    ...(p.link && PEOPLE.some((x) => x.id === p.link!.to) ? { link: p.link } : {}),
    createdAt: now,
  };
}
