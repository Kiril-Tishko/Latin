// Lessons 1-4 of the Easy Latin Lessons playlist, as taught in the videos.
// Sentences come from the videos (original 2020 recordings, checked against the
// 2025 re-recordings). Inline markup used in rule texts:
//   «Latin text»   rendered as Latin with colored endings
//   word#acc.sg    hint for an ambiguous form inside «…» or an example
//   **bold**
import { Entry } from "../latin/types";
import { LESSON_WORDS } from "./words";

export interface Example {
  la: string;
  en: string;
  note?: string;
}

export interface Rule {
  id: string;
  title: string;
  what: string;
  how: string;
  when: string;
  examples: Example[];
  /** Comparison with Russian / Ukrainian, when it helps. */
  slavic?: string;
  skills: string[];
}

export interface StoryLine extends Example {
  /** Reconstructed from the narration; needs checking against the video. */
  unverified?: boolean;
}

export interface Lesson {
  n: number;
  title: string;
  videoId: string;
  /** The 2025 re-recording in the "New Easy Latin Lessons" playlist. */
  newVideoId: string;
  minutes: number;
  summary: string;
  words: Entry[];
  sentences: Example[];
  phrases: Example[];
  story?: { title: string; lines: StoryLine[] };
  rules: Rule[];
  /** Notes where this site differs from the original video, and why. */
  fixes: string[];
  skills: string[];
}

const lessons: Omit<Lesson, "words" | "skills">[] = [
  {
    n: 1,
    title: "Who is doing it: -ō, -s, -t",
    videoId: "aWUlrL6E_QU",
    newVideoId: "cHuDErhK0xA",
    minutes: 12,
    summary:
      "Simple present-tense sentences. The verb ending tells you who acts: -ō for I, -s for you, -t for he / she / it. Infinitives, et, and the first proverb.",
    sentences: [
      { la: "Poēta scrībit.", en: "The poet writes." },
      { la: "Discipula studet.", en: "The student studies." },
      { la: "Discipula scrībit.", en: "The student writes." },
      { la: "Poēta studet.", en: "The poet studies." },
      { la: "Ego studeō.", en: "I study." },
      { la: "Ego scrībō.", en: "I write." },
      { la: "Discipula legit.", en: "The student reads." },
      { la: "Ego legō.", en: "I read." },
      { la: "Tū scrībis. Tū studēs. Tū legis.", en: "You write. You study. You read." },
      { la: "Ego dormiō. Discipula dormit.", en: "I sleep. The student sleeps." },
      { la: "Tū dormīs.", en: "You sleep.", note: "The tū form has a long vowel before -s." },
      { la: "Agricola dormit.", en: "The farmer sleeps." },
      { la: "Agricola labōrat.", en: "The farmer works." },
      { la: "Ego labōrō. Tū labōrās.", en: "I work. You work." },
      { la: "Discipula discit.", en: "The student learns." },
      { la: "Discipula legit et discit.", en: "The student reads and learns." },
      { la: "Tū studēs et discis.", en: "You study and learn.", note: "Short i in discis." },
      { la: "Tū labōrās et scrībis et studēs et dormīs.", en: "You work and write and study and sleep." },
      { la: "Magistra docet.", en: "The teacher teaches." },
      { la: "Ego doceō. Tū docēs.", en: "I teach. You teach." },
    ],
    phrases: [
      { la: "Quī docet discit.", en: "He who teaches learns.", note: "The first proverb. Literally: who teaches, learns." },
      { la: "Et tū, Brūte?", en: "You too, Brutus?", note: "Caesar's words in Shakespeare. et = and, also." },
    ],
    rules: [
      {
        id: "l1-endings",
        title: "The verb ending says who acts",
        what: "Every verb changes its last letters to show who is doing the action.",
        how: "«ego» (I): **-ō**. «tū» (you): **-s**. he / she / it, or one named person: **-t**. So «labōrō», «labōrās», «labōrat».",
        when: "Every time you use a verb in the present. Check the subject first, then pick the ending.",
        examples: [
          { la: "Ego scrībō.", en: "I write." },
          { la: "Tū scrībis.", en: "You write." },
          { la: "Poēta scrībit.", en: "The poet writes." },
        ],
        slavic: "Same idea as Russian / Ukrainian: пишу, пишешь, пишет / пишу, пишеш, пише. The ending alone tells you the person.",
        skills: ["v.1sg", "v.2sg", "v.3sg"],
      },
      {
        id: "l1-patterns",
        title: "The vowel before the ending can change",
        what: "Verbs follow a few patterns (conjugations). The ending is always -ō / -s / -t, but the vowel in front of it differs.",
        how: "«labōrō, labōrās, labōrat» · «doceō, docēs, docet» · «scrībō, scrībis, scrībit» · «dormiō, dormīs, dormit». The vowel before -s is usually long (ā, ē, ī). In -ō forms the vowel often drops out (labōr-ō, not labōra-ō).",
        when: "Learn each new verb with its ego and tū forms; the pattern then repeats for every verb of the same type.",
        examples: [
          { la: "Agricola labōrat. Ego labōrō.", en: "The farmer works. I work." },
          { la: "Magistra docet. Tū docēs.", en: "The teacher teaches. You teach." },
          { la: "Discipula dormit. Tū dormīs.", en: "The student sleeps. You sleep." },
        ],
        skills: [],
      },
      {
        id: "l1-articles",
        title: "No words for 'a' or 'the'",
        what: "Latin has no articles.",
        how: "«Poēta scrībit» can mean 'the poet writes' or 'a poet writes'. Context decides.",
        when: "When translating into English, add 'the' or 'a' as it sounds natural. When translating into Latin, just leave them out.",
        examples: [{ la: "Poēta scrībit.", en: "The poet writes. / A poet writes." }],
        slavic: "Exactly like Russian and Ukrainian: поэт пишет / поет пише.",
        skills: ["s.sv", "n1.nom.sg"],
      },
      {
        id: "l1-infinitive",
        title: "The infinitive: -re (to …)",
        what: "Dictionaries list verbs by their infinitive, the 'to …' form.",
        how: "«labōrāre» (to work), «studēre» (to study), «dormīre» (to sleep) have a long vowel before -re; «scrībere», «legere», «discere» have a short e.",
        when: "Looking words up, and (from Lesson 2) after verbs like 'learns to' or 'can'.",
        examples: [
          { la: "labōrāre", en: "to work" },
          { la: "docēre", en: "to teach" },
          { la: "scrībere", en: "to write" },
          { la: "dormīre", en: "to sleep" },
        ],
        slavic: "Like работать / працювати: the dictionary form of a verb.",
        skills: ["v.inf"],
      },
      {
        id: "l1-et",
        title: "et joins things",
        what: "«et» means 'and' (and sometimes 'too').",
        how: "Put it between the words or sentences you join: «Discipula legit et discit».",
        when: "Whenever you would say 'and'.",
        examples: [
          { la: "Discipula legit et discit.", en: "The student reads and learns." },
          { la: "Tū studēs et discis.", en: "You study and learn." },
        ],
        skills: ["s.et"],
      },
      {
        id: "l1-sounds",
        title: "How it sounds (classical pronunciation)",
        what: "The videos use classical pronunciation, and long vowels are marked with a line (macron).",
        how: "c and g are always hard: discipula = di-SKI-pu-la, legit = LE-git. r is trilled. A line over a vowel (ā, ē, ī, ō, ū) means it is held longer.",
        when: "Read every example out loud in the pauses, as the video suggests. You never have to type the lines here: puella and puellā are both accepted as typing.",
        examples: [{ la: "Discipula scrībit.", en: "The student writes." }],
        skills: [],
      },
    ],
    fixes: [
      "The 2025 recording says 'a few conjugation patterns' instead of 'four': besides the four main ones there is a small mixed group (capiō type), which comes later.",
    ],
  },
  {
    n: 2,
    title: "Subject and object: -a and -am",
    videoId: "3MR1himw7EM",
    newVideoId: "OEgf1NRWO-8",
    minutes: 13,
    summary:
      "The object takes -m, so word order becomes free. Possession with -ae, adjectives that match their noun, nōn, sed, nēmō, quod, bene, and a first story.",
    sentences: [
      { la: "Agricola labōrat et dormit.", en: "The farmer works and sleeps." },
      { la: "Magistra docet et discipula discit.", en: "The teacher teaches and the student learns." },
      { la: "Magistra discipulam docet.", en: "The teacher teaches the student." },
      { la: "Discipula magistram docet.", en: "The student teaches the teacher." },
      { la: "Magistram discipula docet.", en: "The student teaches the teacher.", note: "Same meaning: the endings, not the order, show who does what." },
      { la: "Poēta epistulam scrībit.", en: "The poet writes a letter." },
      { la: "Legō. Labōrō. Dormiō.", en: "I read. I work. I sleep.", note: "No ego needed: the -ō already says 'I'." },
      { la: "Scrībō et legis.", en: "I write and you read." },
      { la: "Poētam videō.", en: "I see the poet.", note: "-m on poētam marks the object, so it can't be 'the poet sees'." },
      { la: "Poēta videt.", en: "The poet sees." },
      { la: "Discipula epistulam videt.", en: "The student sees the letter." },
      { la: "Magistram vidēs.", en: "You see the teacher." },
      { la: "Epistulam legis.", en: "You read the letter." },
      { la: "Agricola aquam bibit.", en: "The farmer drinks water." },
      { la: "Magistra discipulae#gen.sg", en: "The student's teacher / the teacher of the student." },
      { la: "Epistulam poētae#gen.sg legō.", en: "I read the poet's letter." },
      { la: "Aquam agricolae#gen.sg bibis.", en: "You drink the farmer's water." },
      { la: "Discipula epistulam magistrae#gen.sg scrībit.", en: "The student writes the teacher's letter." },
      { la: "Longam epistulam scrībō.", en: "I write a long letter." },
      { la: "Magistra magnam discipulam docet.", en: "The teacher teaches the big student." },
      { la: "Magistra magna discipulam docet.", en: "The big teacher teaches the student." },
      { la: "Magistra magna discipulam pulchram docet.", en: "The big teacher teaches the beautiful student." },
      { la: "Magistra docet sed discipula nōn discit.", en: "The teacher teaches but the student does not learn." },
      { la: "Magistra docet sed nēmō discit.", en: "The teacher teaches but no one learns." },
    ],
    phrases: [
      { la: "Vēnī, vīdī, vīcī.", en: "I came, I saw, I conquered.", note: "Caesar. Past tense (later). Latin v sounds like English w: wee-dee." },
    ],
    story: {
      title: "The farmer learns to write",
      lines: [
        { la: "Magistra agricolam scrībere docet.", en: "The teacher teaches the farmer to write.", unverified: true },
        { la: "Agricola studet et scrībere discit.", en: "The farmer studies and learns to write.", unverified: true },
        { la: "Pulchram epistulam scrībit quod magistra bene docet.", en: "He writes a beautiful letter because the teacher teaches well.", unverified: true },
        { la: "Agricola epistulam bene scrībit sed nēmō legit.", en: "The farmer writes the letter well, but no one reads it.", unverified: true },
      ],
    },
    rules: [
      {
        id: "l2-object",
        title: "The object gets -m",
        what: "The subject does the action; the object receives it. Latin marks the object by changing its ending: -a becomes **-am** (the accusative).",
        how: "«magistra» → «magistram», «epistula» → «epistulam», «poēta» → «poētam».",
        when: "Whenever a noun is the thing or person the verb acts on: who is taught, what is written, what is seen.",
        examples: [
          { la: "Magistra discipulam docet.", en: "The teacher teaches the student." },
          { la: "Discipula magistram docet.", en: "The student teaches the teacher." },
          { la: "Poētam videō.", en: "I see the poet." },
        ],
        slavic: "This is the винительный / знахідний case. Compare Russian девушка → вижу девушку, Ukrainian дівчина → бачу дівчину: the -у does the job of Latin -m.",
        skills: ["n1.acc.sg", "s.svo"],
      },
      {
        id: "l2-order",
        title: "Word order is free",
        what: "Because the endings show who does what, the words can move.",
        how: "«Discipula magistram docet», «Magistram discipula docet» and «Docet magistram discipula» all mean the student teaches the teacher. The verb usually goes last; first and last positions get the emphasis.",
        when: "Reading: find the verb, then the -a word (subject) and the -am word (object), wherever they stand. Writing: subject, object, verb is the safe default.",
        examples: [
          { la: "Discipula magistram docet.", en: "The student teaches the teacher." },
          { la: "Magistram discipula docet.", en: "The student teaches the teacher (stress on the teacher)." },
        ],
        slavic: "Just like Russian / Ukrainian, where «Маму любит дочка» still means the daughter loves mum.",
        skills: [],
      },
      {
        id: "l2-drop",
        title: "Leave out ego and tū",
        what: "The verb ending already says who acts, so the subject pronoun is usually dropped.",
        how: "«Legō» = I read, «Labōrās» = you work. Say «ego» or «tū» only for emphasis or contrast.",
        when: "Most of the time. The verb alone is a complete sentence.",
        examples: [
          { la: "Legō. Labōrō. Dormiō.", en: "I read. I work. I sleep." },
          { la: "Scrībō et legis.", en: "I write and you read." },
        ],
        slavic: "Ukrainian and Russian do this too: Читаю. Працюю. Сплю.",
        skills: ["s.drop"],
      },
      {
        id: "l2-genitive",
        title: "Whose: -ae (of / 's)",
        what: "To say whose something is, the owner takes **-ae** (the genitive).",
        how: "«poēta» → «poētae»: «epistula poētae#gen.sg» = the poet's letter. The owner can stand before or after: «discipulae#gen.sg magistra» = «magistra discipulae#gen.sg».",
        when: "Whenever English uses 's or 'of'.",
        examples: [
          { la: "Epistulam poētae#gen.sg legō.", en: "I read the poet's letter." },
          { la: "Aquam agricolae#gen.sg bibis.", en: "You drink the farmer's water." },
        ],
        slavic: "The родительный / родовий case: письмо поэта / лист поета.",
        skills: ["n1.gen.sg", "s.gen"],
      },
      {
        id: "l2-adjectives",
        title: "Adjectives match their noun",
        what: "An adjective takes the same ending as the noun it describes.",
        how: "«epistulam» → «longam epistulam»; «magistra» → «magistra magna». The ending tells you which noun it belongs to, even when the words are far apart.",
        when: "Every time you add a describing word: long, big, beautiful.",
        examples: [
          { la: "Longam epistulam scrībō.", en: "I write a long letter." },
          { la: "Magistra magnam discipulam docet.", en: "The teacher teaches the big student." },
          { la: "Magistra magna discipulam docet.", en: "The big teacher teaches the student." },
        ],
        slavic: "Same as большая книга → большую книгу / велика книга → велику книгу.",
        skills: ["adj.agree"],
      },
      {
        id: "l2-non",
        title: "nōn, sed, nēmō",
        what: "«nōn» = not, «sed» = but, «nēmō» = no one.",
        how: "Put «nōn» right before the verb: «discipula nōn discit». No 'do / does' needed. «nēmō» is a subject: «nēmō discit».",
        when: "To negate a verb, to contrast two ideas, and to say nobody does something.",
        examples: [
          { la: "Magistra docet sed discipula nōn discit.", en: "The teacher teaches but the student does not learn." },
          { la: "Magistra docet sed nēmō discit.", en: "The teacher teaches but no one learns." },
        ],
        slavic: "nōn sits before the verb like не / не: не учится.",
        skills: ["s.non", "s.conn"],
      },
      {
        id: "l2-inf",
        title: "Verb + infinitive: learns to write",
        what: "An infinitive (-re) can complete another verb, like English 'to …'.",
        how: "«scrībere discit» = learns to write, «scrībere docet» = teaches to write. «quod» = because, «bene» = well.",
        when: "After verbs like learn, teach (and, in Lesson 3, can).",
        examples: [
          { la: "Agricola scrībere discit.", en: "The farmer learns to write." },
          { la: "Magistra agricolam scrībere docet.", en: "The teacher teaches the farmer to write." },
        ],
        skills: ["s.inf"],
      },
    ],
    fixes: [
      "Both recordings ask you to say «Aquam studēs» ('you study the water'). In classical Latin studeō takes the dative (aquae studēs), so this site practises studeō without an object until the dative is taught.",
    ],
  },
  {
    n: 3,
    title: "Masculine -us, est, possum",
    videoId: "CeAQzYMTwsA",
    newVideoId: "qN79sZIPKwE",
    minutes: 14,
    summary:
      "Second-declension nouns (-us, -um, -ī) and gender, to be (sum, es, est), can (possum, potes, potest), meus, and the start of the story of Jupiter and Europa.",
    sentences: [
      { la: "Discipulus studet.", en: "The (male) student studies." },
      { la: "Discipulum videō.", en: "I see the (male) student." },
      { la: "Agricola epistulam poētae#gen.sg legit.", en: "The farmer reads the poet's letter." },
      { la: "Agricola epistulam discipulī#gen.sg legit.", en: "The farmer reads the (male) student's letter.", note: "-us changes to -ī for 'of'." },
      { la: "Amīcum habeō.", en: "I have a (male) friend." },
      { la: "Discipulus amīcam habet.", en: "The (male) student has a (female) friend." },
      { la: "Epistulam agricolae#gen.sg habēs.", en: "You have the farmer's letter." },
      { la: "Poēta librum scrībit.", en: "The poet writes a book." },
      { la: "Discipulus gladium habet.", en: "The student has a sword." },
      { la: "Amīcus gladiī#gen.sg", en: "The sword's friend (the friend of the sword).", note: "Only the -us is dropped: gladi-ī." },
      { la: "Gladius amīcī#gen.sg", en: "The friend's sword." },
      { la: "Agricola poēta est.", en: "The farmer is a poet.", note: "Both nouns are nominative: est works like =." },
      { la: "Discipula est amīca mea.", en: "The (female) student is my friend." },
      { la: "Discipulus est amīcus meus.", en: "The (male) student is my friend." },
      { la: "Magistra pulchra est.", en: "The teacher is beautiful." },
      { la: "Discipulus pulcher est.", en: "The (male) student is handsome." },
      { la: "Poēta pulcher est.", en: "The poet is handsome.", note: "poēta is masculine, so pulcher, not pulchra." },
      { la: "Agricola magnus est.", en: "The farmer is big." },
      { la: "Tū es discipula.", en: "You are a student (to a woman)." },
      { la: "Amīcus discipulī#gen.sg es.", en: "You are the student's friend (to a man)." },
      { la: "Magnus discipulus sum.", en: "I am a big student (said by a man)." },
      { la: "Magna discipula sum.", en: "I am a big student (said by a woman)." },
      { la: "Poēta bene scrībere potest.", en: "The poet can write well." },
      { la: "Sed nēmō legit.", en: "But no one reads." },
      { la: "Amīcus meus nōn potest legere.", en: "My friend cannot read." },
      { la: "Amīcum dēsīderō.", en: "I miss a friend. / I want a friend." },
      { la: "Puellam dēsīderat.", en: "He desires the girl." },
      { la: "Poēta nōn est puella.", en: "The poet is not a girl." },
      { la: "Epistulam puellae#gen.sg legis.", en: "You read the girl's letter." },
    ],
    phrases: [],
    story: {
      title: "Jupiter and Europa (part 1)",
      lines: [
        { la: "Iuppiter deus est et in Olympō habitat.", en: "Jupiter is a god and lives on Olympus.", unverified: true },
        { la: "Terram spectat.", en: "He watches the earth.", unverified: true },
        { la: "Eurōpam videt et puellam dēsīderat.", en: "He sees Europa and desires the girl.", unverified: true },
        { la: "Iuppiter sē in taurum trānsfōrmat quod Eurōpa timida est.", en: "Jupiter transforms himself into a bull because Europa is timid." },
      ],
    },
    rules: [
      {
        id: "l3-gender",
        title: "Nouns have gender",
        what: "Nouns in -a are usually feminine, nouns in -us masculine. A few -a nouns are masculine: «agricola», «poēta».",
        how: "Pairs: «discipula» / «discipulus» (female / male student), «amīca» / «amīcus» (female / male friend).",
        when: "Gender matters as soon as you add an adjective (next rules).",
        examples: [
          { la: "Discipulus studet.", en: "The (male) student studies." },
          { la: "Discipulus amīcam habet.", en: "The (male) student has a (female) friend." },
        ],
        slavic: "Like студентка / студент, подруга / друг. And like Russian / Ukrainian папа / тато: masculine despite the -a.",
        skills: ["n2.nom.sg"],
      },
      {
        id: "l3-second",
        title: "Second declension: -us, -um, -ī",
        what: "Masculine -us nouns have their own endings (the second declension).",
        how: "Subject «discipulus» · object «discipulum» · 'of' «discipulī#gen.sg». Compare the first declension: «discipula», «discipulam», «discipulae#gen.sg».",
        when: "With every -us noun: amīcus, gladius, taurus, deus, Olympus.",
        examples: [
          { la: "Discipulum videō.", en: "I see the (male) student." },
          { la: "Agricola epistulam discipulī#gen.sg legit.", en: "The farmer reads the student's letter." },
          { la: "Discipulus gladium habet.", en: "The student has a sword." },
        ],
        slavic: "Similar to стол / стола / столом: a different set of endings for a different class of nouns.",
        skills: ["n2.acc.sg", "n2.gen.sg"],
      },
      {
        id: "l3-liber",
        title: "liber: an -er noun",
        what: "A few second-declension nouns end in -er in the nominative.",
        how: "«liber» (book) is the subject form; every other form is built on libr-: «librum», «librī#gen.sg». The nominative 'names' the noun.",
        when: "liber and later puer, ager, magister.",
        examples: [{ la: "Poēta librum scrībit.", en: "The poet writes a book." }],
        skills: [],
      },
      {
        id: "l3-gender-adj",
        title: "Adjectives follow gender, not the ending",
        what: "An adjective takes the endings of its noun's gender, even when the noun's own ending looks different.",
        how: "«poēta» is masculine, so «poēta pulcher», «agricola magnus». «magnus» declines like «amīcus»; «pulcher» like «liber» («pulchrum»).",
        when: "With agricola and poēta, and any noun whose ending doesn't match its gender.",
        examples: [
          { la: "Poēta pulcher est.", en: "The poet is handsome." },
          { la: "Agricola magnus est.", en: "The farmer is big." },
          { la: "Magistra pulchra est.", en: "The teacher is beautiful." },
        ],
        slavic: "Like мой папа / мій тато: papa ends in -a but takes masculine мой / мій.",
        skills: ["adj.gender"],
      },
      {
        id: "l3-est",
        title: "To be: sum, es, est",
        what: "To be is irregular: «sum» (I am), «es» (you are), «est» (he / she / it is).",
        how: "«est» works like '=': both sides stay in the nominative: «Agricola poēta est». An adjective after est matches the subject: «Magistra pulchra est».",
        when: "Saying what or how someone is. The adjective's gender follows the speaker: a man says «magnus discipulus sum», a woman «magna discipula sum».",
        examples: [
          { la: "Agricola poēta est.", en: "The farmer is a poet." },
          { la: "Discipula est amīca mea.", en: "The student is my friend." },
          { la: "Tū es discipula.", en: "You are a student." },
          { la: "Magnus discipulus sum.", en: "I am a big student." },
        ],
        slavic: "Russian and Ukrainian usually drop есть / є (Он поэт), but Latin keeps est. Note est and есть / є share the same ancient root.",
        skills: ["v.sum", "s.est"],
      },
      {
        id: "l3-meus",
        title: "meus, mea: my",
        what: "'My' is an adjective in Latin, so it matches its noun.",
        how: "«amīcus meus», «amīca mea»; usually after the noun.",
        when: "Whenever you say 'my'.",
        examples: [
          { la: "Discipulus est amīcus meus.", en: "The student is my friend." },
          { la: "Discipula est amīca mea.", en: "The student is my friend." },
        ],
        slavic: "Same as мой друг / моя подруга, мій друг / моя подруга.",
        skills: [],
      },
      {
        id: "l3-possum",
        title: "possum: I can",
        what: "'Can' is pot- + the forms of to be: «possum», «potes», «potest».",
        how: "Add an infinitive: «legere potest» (he can read). pot- + sum becomes possum: the t turns into s.",
        when: "Saying what someone is able to do. «nōn potest» = cannot.",
        examples: [
          { la: "Poēta bene scrībere potest.", en: "The poet can write well." },
          { la: "Amīcus meus nōn potest legere.", en: "My friend cannot read." },
        ],
        slavic: "Like могу / может + infinitive: может читать.",
        skills: ["v.possum"],
      },
    ],
    fixes: [],
  },
  {
    n: 4,
    title: "Where and where to: -ā / -ō, in, ad, plurals",
    videoId: "akV-riuCrWg",
    newVideoId: "I7vo2Ax-cQ0",
    minutes: 13,
    summary:
      "The ablative for location (in silvā), the accusative for direction (in silvam, ad silvam), the first neuter noun (vīnum), and the first plurals: -nt verbs, -ae and -ī nouns.",
    sentences: [
      { la: "in Olympō", en: "in Olympus (on Olympus)" },
      { la: "in amīcō", en: "in the friend" },
      { la: "deus Olympī#gen.sg", en: "the god of Olympus" },
      { la: "Vīnum bibō.", en: "I drink wine." },
      { la: "Vīnum in silvā bibis.", en: "You drink wine in the forest." },
      { la: "Silva magna est.", en: "The forest is big." },
      { la: "In silvā ambulō.", en: "I walk in the forest.", note: "Ablative: the place where the walking happens." },
      { la: "In silvam ambulō.", en: "I walk into the forest.", note: "Accusative: the goal of the movement." },
      { la: "Iuppiter sē in taurum trānsfōrmat.", en: "Jupiter transforms himself into a bull." },
      { la: "Deus in Olympō habitat.", en: "The god lives on Olympus." },
      { la: "Dea in Olympum ambulat.", en: "The goddess walks into Olympus." },
      { la: "Ad silvam ambulās.", en: "You walk to the forest." },
      { la: "Agricola aquam portat.", en: "The farmer carries water." },
      { la: "Taurus puellam portat.", en: "The bull carries the girl." },
      { la: "Epistulam ad silvam portās.", en: "You carry the letter to the forest." },
      { la: "Librum et vīnum in Olympum portō.", en: "I carry a book and wine into Olympus." },
      { la: "Discipulus et discipula in scholā student.", en: "The (male) student and the (female) student study in school." },
      { la: "Ad scholam ambulō.", en: "I walk to school." },
      { la: "Discipulī#nom.pl et discipulae#nom.pl in scholā student.", en: "The students (male and female) study in school." },
      { la: "Agricolae#nom.pl labōrant.", en: "The farmers work." },
      { la: "Discipulae#nom.pl epistulam poētae#gen.sg vident.", en: "The (female) students see the poet's letter.", note: "Ambiguous! It could also be 'the poets see the student's letter'. Only context decides." },
      { la: "Puellae#nom.pl fugitant.", en: "The girls flee." },
      { la: "Puella ad silvam fugitat.", en: "The girl flees to the forest." },
      { la: "Agricolae#nom.pl librum ad īnsulam portant.", en: "The farmers carry a book to the island." },
      { la: "Terram spectat.", en: "He watches the earth." },
      { la: "Epistulam nōn spectō.", en: "I don't look at the letter." },
    ],
    phrases: [
      { la: "In vīnō vēritās.", en: "In wine there is truth.", note: "est is left out because it is obvious (ellipsis)." },
      { la: "ad nauseam", en: "to the point of seasickness", note: "nausea comes from the Greek for ship, as in nautical." },
    ],
    story: {
      title: "Jupiter and Europa (the end)",
      lines: [
        { la: "Eurōpa taurum spectat.", en: "Europa looks at the bull." },
        { la: "Taurus Eurōpam portat.", en: "The bull carries Europa.", unverified: true },
        { la: "Nunc Eurōpa nōn est timida.", en: "Now Europa is not timid.", unverified: true },
        { la: "Sed taurus fugitat et Eurōpam ad īnsulam Crētam portat.", en: "But the bull runs off and carries Europa to the island of Crete.", unverified: true },
        { la: "Iuppiter et Eurōpa in īnsulā habitant.", en: "Jupiter and Europa live on the island.", unverified: true },
      ],
    },
    rules: [
      {
        id: "l4-ablative",
        title: "Where: in + ablative (-ā, -ō)",
        what: "The ablative is the form for the place where something happens. After «in» it means in / on.",
        how: "First declension: long **-ā** («in silvā»). Second declension: long **-ō** («in Olympō», «in vīnō»).",
        when: "Answering 'where?': walking in the forest, living on Olympus, studying in school.",
        examples: [
          { la: "In silvā ambulō.", en: "I walk in the forest." },
          { la: "Deus in Olympō habitat.", en: "The god lives on Olympus." },
          { la: "Discipulus et discipula in scholā student.", en: "The students study in school." },
        ],
        slavic: "Like the предложный / місцевий case after в / у: в лесу / у лісі.",
        skills: ["n1.abl.sg", "n2.abl.sg", "s.loc"],
      },
      {
        id: "l4-into",
        title: "Where to: in / ad + accusative",
        what: "With movement, the goal goes into the accusative (-am, -um). «in» + accusative = into; «ad» + accusative = to, toward.",
        how: "«in silvam ambulō» (into the forest), «ad silvam ambulō» (to the forest), «in taurum trānsfōrmat» (into a bull).",
        when: "Answering 'where to?'. Same preposition «in», different ending, different meaning: «in silvā» (inside) vs «in silvam» (into).",
        examples: [
          { la: "In silvam ambulō.", en: "I walk into the forest." },
          { la: "Ad scholam ambulō.", en: "I walk to school." },
          { la: "Epistulam ad silvam portās.", en: "You carry the letter to the forest." },
        ],
        slavic: "Exactly the Russian / Ukrainian split: в лесу (where) vs в лес (where to); у лісі vs у ліс.",
        skills: ["s.into", "s.ad"],
      },
      {
        id: "l4-neuter",
        title: "Neuter nouns: vīnum",
        what: "Neuter nouns are neither masculine nor feminine. Their subject and object forms are the same: -um.",
        how: "«vīnum» (subject and object), «vīnī#gen.sg» (of wine), «in vīnō» (in wine). Context tells subject from object: «vīnum bibit» can only mean he drinks wine.",
        when: "With -um nouns like vīnum.",
        examples: [
          { la: "Vīnum bibō.", en: "I drink wine." },
          { la: "In vīnō vēritās.", en: "In wine there is truth." },
        ],
        slavic: "Like вино / вино: the same form as subject and object.",
        skills: ["n2n.nom.sg", "n2n.acc.sg", "n2n.gen.sg", "n2n.abl.sg"],
      },
      {
        id: "l4-plural-verbs",
        title: "They: -nt",
        what: "With a plural subject (two or more), the verb adds **-n** before the -t.",
        how: "«studet» → «student», «labōrat» → «labōrant», «videt» → «vident». Two subjects joined by et also count as plural.",
        when: "Whenever the subject is 'they' or several people or things.",
        examples: [
          { la: "Discipulus et discipula in scholā student.", en: "The student and the student study in school." },
          { la: "Agricolae#nom.pl labōrant.", en: "The farmers work." },
        ],
        slavic: "Like работает → работают / працює → працюють.",
        skills: ["v.3pl", "s.pl"],
      },
      {
        id: "l4-plural-nouns",
        title: "Plural subjects: -ae and -ī",
        what: "Plural subjects: first declension **-ae**, second declension **-ī**. These look exactly like the genitive singular ('of').",
        how: "«discipulae#nom.pl» = students (or: of the student), «discipulī#nom.pl» = students (or: of the student). Look at the verb: -nt means a plural subject.",
        when: "Reading plurals. Tip: English adds an s for both plural and 's possession, and Latin also uses one form for both.",
        examples: [
          { la: "Puellae#nom.pl fugitant.", en: "The girls flee." },
          { la: "Discipulae#nom.pl epistulam poētae#gen.sg vident.", en: "The students see the poet's letter (or: the poets see the student's letter)." },
        ],
        skills: ["n1.nom.pl", "n2.nom.pl"],
      },
      {
        id: "l4-table",
        title: "Review: four cases, four noun types",
        what: "The table from the video: the endings you know, by noun type.",
        how: "Every object form ends in -m. 'Of' is -ae or -ī. The ablative is a long vowel: -ā or -ō. Only the subject (nominative) really differs between columns.",
        when: "Come back to this table whenever an ending feels shaky; the video says to build a strong foundation here before the other declensions.",
        examples: [
          { la: "puella · puellam · puellae#gen.sg · puellā", en: "girl (first declension)" },
          { la: "amīcus · amīcum · amīcī#gen.sg · amīcō", en: "friend (second declension)" },
          { la: "liber · librum · librī#gen.sg · librō", en: "book (second declension, -er)" },
          { la: "vīnum#nom.sg · vīnum#acc.sg · vīnī#gen.sg · vīnō", en: "wine (second declension, neuter)" },
        ],
        skills: [],
      },
    ],
    fixes: [],
  },
  {
    n: 5,
    title: "We, they are, to whom: -mus, sunt, the dative",
    videoId: "GnoqpwWFjQA",
    newVideoId: "r1B_EnvJLvY",
    minutes: 12,
    summary:
      "We (-mus, nōs), sunt (they are) with plural describing words, the dative for 'to whom' (dō, dare: to give), and a city with no in / ad: Rōmam (to Rome), Rōmae (in Rome). New words: via, Rōma, Italia, magister, dūcō, volō, hīc, optimus.",
    sentences: [
      { la: "Discipulī#nom.pl et discipulae#nom.pl in scholā student.", en: "The students (male and female) study in school.", note: "A look back at Lesson IV." },
      { la: "Agricolae#nom.pl ambulant.", en: "The farmers walk." },
      { la: "Amīcae#nom.pl fugitant.", en: "The (female) friends flee." },
      { la: "Poētae#nom.pl legunt.", en: "The poets read." },
      { la: "Puellae#nom.pl bibunt.", en: "The girls drink." },
      { la: "Ambulāmus.", en: "We walk.", note: "We: -mus. The same vowel as the tū form: ambulās → ambulāmus." },
      { la: "In silvam ambulāmus.", en: "We walk into the forest." },
      { la: "Nōs in silvā bibimus.", en: "We drink in the forest.", note: "bibis → bibimus. nōs (we) can be left out, like ego and tū." },
      { la: "Poēta et ego legimus.", en: "The poet and I read.", note: "The subject includes ego, so the verb takes -mus." },
      { la: "Via longa est.", en: "The road is long." },
      { la: "Viae#nom.pl longae#nom.pl sunt.", en: "The roads are long.", note: "Every word goes plural: est becomes sunt." },
      { la: "Via Rōmam dūcit.", en: "The road leads to Rome.", note: "To a city there is no ad or in: just Rōmam." },
      { la: "Rōma in Italiā est.", en: "Rome is in Italy." },
      { la: "Italia in Eurōpā est.", en: "Italy is in Europe." },
      { la: "Rōmae#x habitō.", en: "I live in Rome.", note: "Rōmae here is the locative, an old 'where' case that cities keep." },
      { la: "Poēta agricolae#dat.sg legit.", en: "The poet reads to the farmer.", note: "Or 'the farmer's poet reads': agricolae is also 'of the farmer'. Context decides." },
      { la: "Poēta agricolae#dat.sg epistulam legit.", en: "The poet reads the letter to the farmer.", note: "Or: the poet reads the farmer's letter." },
      { la: "Discipula discipulō#dat.sg gladium dat.", en: "The (female) student gives the (male) student a sword.", note: "The dative of -us words is -ō, like the ablative." },
      { la: "Discipulī#gen.sg amīcae#dat.sg librum dō.", en: "I give a book to the student's (female) friend." },
      { la: "Magistrō#dat.sg tunicam dās.", en: "You give the (male) teacher a tunic.", note: "magister declines like liber: magistrum, magistrī, magistrō." },
      { la: "Puellae#dat.sg aquam damus.", en: "We give the girl water.", note: "A short a: damus, not dāmus." },
      { la: "Optimus sum quod possum legere.", en: "I am the best because I can read." },
      { la: "Optima sum quod possum legere.", en: "I am the best because I can read (a woman says it)." },
      { la: "Amīcum volō.", en: "I want a friend." },
      { la: "Nunc legere volō.", en: "Now I want to read." },
      { la: "Hīc labōrō.", en: "I work here." },
      { la: "Librī#nom.pl hīc sunt.", en: "There are books here.", note: "est / sunt also mean 'there is / there are'." },
    ],
    phrases: [
      { la: "Omnēs viae Rōmam dūcunt.", en: "All roads lead to Rome.", note: "omnēs is the plural of omnis (all): omnipotent, omnivore, and the omnibus, 'for all', which became the bus." },
      { la: "Hīc sunt dracōnēs.", en: "Here be dragons.", note: "Written on old maps where the known world ended; dracōnēs (dragons) belongs to a later lesson." },
    ],
    story: {
      title: "Rome",
      lines: [
        { la: "Rōma optima est.", en: "Rome is the best.", unverified: true },
        { la: "Viae Rōmae#gen.sg rēctae sunt.", en: "The streets of Rome are straight.", unverified: true },
        { la: "Aqua clāra est.", en: "The water is clear.", unverified: true },
        { la: "Arma splendida sunt.", en: "The weapons are splendid.", unverified: true },
        { la: "Volō hīc habitāre.", en: "I want to live here.", unverified: true },
      ],
    },
    rules: [
      {
        id: "l5-we",
        title: "We: -mus",
        what: "When 'we' do it, the verb ends in **-mus**. The word for we is «nōs», often left out like ego and tū.",
        how: "Take the tū form and put -mus where the -s was, keeping its vowel: «ambulās» → «ambulāmus», «vidēs» → «vidēmus», «bibis» → «bibimus», «dormīs» → «dormīmus».",
        when: "Whenever the subject is 'we', also 'the poet and I': «Poēta et ego legimus».",
        examples: [
          { la: "In silvam ambulāmus.", en: "We walk into the forest." },
          { la: "Nōs in silvā bibimus.", en: "We drink in the forest." },
          { la: "Poēta et ego legimus.", en: "The poet and I read." },
        ],
        slavic: "Ukrainian has the same ending from the same ancient source: ми читаємо, ми ходимо (-мо). Russian: мы читаем.",
        skills: ["v.1pl"],
      },
      {
        id: "l5-sunt",
        title: "They are: sunt",
        what: "The plural of «est» is «sunt», and the describing word after it goes plural too.",
        how: "«Via longa est» → «Viae#nom.pl longae#nom.pl sunt». Like «scrībunt» and «bibunt», it ends in -unt.",
        when: "Saying what several people or things are like, and 'there are': «Librī#nom.pl hīc sunt».",
        examples: [
          { la: "Viae#nom.pl longae#nom.pl sunt.", en: "The roads are long." },
          { la: "Librī#nom.pl hīc sunt.", en: "There are books here." },
        ],
        slavic: "Russian and Ukrainian say it without 'are': дороги длинные / дороги довгі; Latin needs sunt.",
        skills: ["v.sunt"],
      },
      {
        id: "l5-dative",
        title: "To whom: the dative (-ae, -ō)",
        what: "The one who receives something (is given, read or told it) is in the **dative**: -a words take **-ae**, -us words take **-ō**.",
        how: "«Discipula discipulō#dat.sg gladium dat» (gives the student a sword); «Puellae#dat.sg aquam damus» (we give the girl water). The thing given is the object, with -m. To give is «dō, dare»: dō, dās, dat, damus, dant.",
        when: "With giving, sending, reading or telling to someone. -ae is also 'of' and 'they', and -ō is also 'in': the sentence decides.",
        examples: [
          { la: "Discipula discipulō#dat.sg gladium dat.", en: "The student gives the student a sword." },
          { la: "Magistrō#dat.sg tunicam dās.", en: "You give the teacher a tunic." },
          { la: "Puellae#dat.sg aquam damus.", en: "We give the girl water." },
        ],
        slavic: "The дательный / давальний case: даю книгу другу / даю книгу другові. Same idea, same name: dative, from dare, to give.",
        skills: ["n1.dat.sg", "n2.dat.sg", "s.dat"],
      },
      {
        id: "l5-city",
        title: "A city needs no in: Rōmam, Rōmae",
        what: "With the name of a city Latin leaves out in / ad: the accusative alone is 'to', and an old case, the locative, is 'in'.",
        how: "«Via Rōmam dūcit» (to Rome); «Rōmae#x habitō» (I live in Rome). A country keeps its in: «Rōma in Italiā est».",
        when: "With Rōma and other cities (more come in later lessons).",
        examples: [
          { la: "Via Rōmam dūcit.", en: "The road leads to Rome." },
          { la: "Rōma in Italiā est.", en: "Rome is in Italy." },
        ],
        slavic: "Russian and Ukrainian always need в: в Рим, в Риме / у Рим, у Римі. Latin drops it for cities.",
        skills: ["s.city"],
      },
      {
        id: "l5-words",
        title: "New words: magister, dō, volō, hīc, optimus",
        what: "«magister» is the male teacher (magistra the female one); «dō, dare» to give; «volō» I want; «hīc» here; «optimus» best.",
        how: "«magister» drops its e like liber: magistrum, magistrī, magistrō. «dō» has a short a: damus, dare. «volō» takes a thing or an infinitive: «Amīcum volō», «Legere volō».",
        when: "«volō» and «hīc» come back in later lessons; here they are words to read.",
        examples: [
          { la: "Optimus sum quod possum legere.", en: "I am the best because I can read." },
          { la: "Hīc labōrō.", en: "I work here." },
        ],
        skills: [],
      },
    ],
    fixes: [
      "The original video calls «Rōmae» in «Rōmae habitō» a dative. It is the locative, an old 'where' case that city names keep (the 2025 video says so); it only looks like the dative and the genitive.",
      "Both videos say «dās» has a short a, like dare. Classical Latin has a long ā in dās and dā only; every other form is short: damus, datis, dare.",
    ],
  },
];

export const LESSONS: Lesson[] = lessons.map((l) => ({
  ...l,
  words: LESSON_WORDS[l.n] ?? [],
  skills: [...new Set(l.rules.flatMap((r) => r.skills))],
}));

export const LESSON_BY_N = new Map(LESSONS.map((l) => [l.n, l]));

export const videoUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
