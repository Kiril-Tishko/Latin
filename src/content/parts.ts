// The rules of each video in small parts, learned one at a time: a very simple
// explanation with examples, two open questions in the learner's own words,
// then practice that starts with easy exercises and gets harder as the rule
// sinks in. Practice only ever uses the rules of parts the learner has seen.
//
//   explain:   a few short sentences; «Latin» is colored, **bold** for the key ending
//   examples:  sentences that use only this part's rules and earlier ones (tested)
//   questions: open questions. `answer` is a good answer, shown after trying;
//              `keys` are the words that show the idea is there: every group
//              needs one of its words (the good answer always passes; tested).
//              An answer without them goes to Claude to judge, when it is there.

export interface PartQuestion {
  q: string;
  answer: string;
  keys: string[][];
}

export interface Part {
  /** "2.1": lesson, then the part's place in it. */
  id: string;
  lesson: number;
  title: string;
  explain: string[];
  examples: { la: string; en: string }[];
  /** The same thing in Russian and Ukrainian, when it helps. */
  slavic?: string;
  questions: PartQuestion[];
  /** The rules (skill ids) this part opens for practice. */
  skills: string[];
  /** The rules its exercises can show, when not all of `skills` (the part holds when these do). */
  practised?: string[];
}

export const PARTS: Part[] = [
  // ------------------------------------------------------------ Lesson I
  {
    id: "1.1",
    lesson: 1,
    title: "-t: one person does it",
    explain: [
      "In Latin, the end of the verb tells you who is doing the action.",
      "When one person or thing does it (he, she, it, the girl, the poet), the verb ends in **-t**: «Poēta scrībit».",
      "There are no words for 'a' or 'the': «Poēta scrībit» is 'the poet writes' or 'a poet writes'.",
    ],
    examples: [
      { la: "Poēta scrībit.", en: "The poet writes." },
      { la: "Discipula legit.", en: "The student reads." },
      { la: "Agricola labōrat.", en: "The farmer works." },
    ],
    slavic: "Just like пишет / пише: the ending shows the person.",
    questions: [
      {
        q: "In «Agricola labōrat», who is working, and what tells you that one person is doing it?",
        answer: "The farmer is working. The -t at the end of «labōrat» says that one person (he / she / it) does it.",
        keys: [["farmer", "agricola"], ["t"]],
      },
      {
        q: "How would you translate «Discipula dormit»?",
        answer: "The student sleeps (or: a student is sleeping).",
        keys: [["student", "pupil", "discipula"], ["sleep"]],
      },
    ],
    skills: ["v.3sg", "s.sv", "n1.nom.sg"],
  },
  {
    id: "1.2",
    lesson: 1,
    title: "-ō: I",
    explain: [
      "When I do it, the verb ends in **-ō**.",
      "«ego» means I: «Ego scrībō» = I write.",
      "Compare «scrībit» (he writes) and «scrībō» (I write): only the ending changes.",
    ],
    examples: [
      { la: "Ego labōrō.", en: "I work." },
      { la: "Ego legō.", en: "I read." },
      { la: "Ego dormiō.", en: "I sleep." },
    ],
    slavic: "Like пишу / пишу: the ending alone says 'I'.",
    questions: [
      {
        q: "What does the -ō at the end of «legō» tell you?",
        answer: "That I am the one doing it: «legō» = I read.",
        keys: [["i read", "i am", "i m", "i do", "that i", "me", "myself", "ego", "first person", "1st person", "speaker"]],
      },
      {
        q: "«Agricola labōrat» means 'the farmer works'. How would you say 'I work'?",
        answer: "«Ego labōrō.»",
        keys: [["laboro"]],
      },
    ],
    skills: ["v.1sg"],
  },
  {
    id: "1.3",
    lesson: 1,
    title: "-s: you",
    explain: [
      "When you (one person) do it, the verb ends in **-s**.",
      "«tū» means you: «Tū legis» = you read.",
      "Before the -s there is often a long vowel: «labōrās», «docēs», «dormīs».",
    ],
    examples: [
      { la: "Tū labōrās.", en: "You work." },
      { la: "Tū docēs.", en: "You teach." },
      { la: "Tū scrībis.", en: "You write." },
    ],
    slavic: "Like пишешь / пишеш.",
    questions: [
      {
        q: "In «Tū dormīs», which letter at the end shows that it is 'you'?",
        answer: "The -s at the end of «dormīs».",
        keys: [["s"]],
      },
      {
        q: "«Ego scrībō» means 'I write'. How would you say 'you write'?",
        answer: "«Tū scrībis.»",
        keys: [["scribis"]],
      },
    ],
    skills: ["v.2sg"],
  },
  {
    id: "1.4",
    lesson: 1,
    title: "-re: to …",
    explain: [
      "The 'to …' form of a verb (the infinitive) ends in **-re**: «labōrāre» = to work, «dormīre» = to sleep. Dictionaries give it second: «labōrō, labōrāre».",
      "The vowel before -re shows the verb's family, and the same vowel comes back before -s: «labōrāre» → «labōrās», «docēre» → «docēs», «dormīre» → «dormīs».",
      "Only a short e changes, to i: «scrībere» → «scrībis».",
    ],
    examples: [
      { la: "labōrāre", en: "to work" },
      { la: "docēre", en: "to teach" },
      { la: "scrībere", en: "to write" },
      { la: "dormīre", en: "to sleep" },
    ],
    slavic: "Like работать / працювати: the 'to …' form.",
    questions: [
      {
        q: "What does «dormīre» mean?",
        answer: "To sleep.",
        keys: [["sleep"]],
      },
      {
        q: "'To teach' is «docēre». How do you say 'you teach'?",
        answer: "«Tū docēs.»",
        keys: [["doces"]],
      },
    ],
    skills: ["v.inf"],
  },
  {
    id: "1.5",
    lesson: 1,
    title: "et: and",
    explain: ["«et» means and.", "It joins words or whole sentences: «Discipula legit et discit» = the student reads and learns."],
    examples: [
      { la: "Discipula legit et discit.", en: "The student reads and learns." },
      { la: "Ego legō et scrībō.", en: "I read and write." },
    ],
    questions: [
      {
        q: "Translate «Agricola labōrat et dormit».",
        answer: "The farmer works and sleeps.",
        keys: [["farmer"], ["work"], ["sleep"]],
      },
      {
        q: "How would you say 'I read and write'?",
        answer: "«Ego legō et scrībō.»",
        keys: [["lego"], ["et"], ["scribo"]],
      },
    ],
    skills: ["s.et"],
  },

  // ----------------------------------------------------------- Lesson II
  {
    id: "2.1",
    lesson: 2,
    title: "-am: the object",
    explain: [
      "The subject does the action; the object is what the action happens to.",
      "In Latin the object gets an **-m**: «magistra» → «magistram».",
      "«Magistra discipulam docet» = the teacher teaches the student. The -a word does it, the -am word gets it.",
      "Because the endings show who does what, the words can move: «Discipulam magistra docet» means the same.",
    ],
    examples: [
      { la: "Poēta epistulam scrībit.", en: "The poet writes a letter." },
      { la: "Agricola aquam bibit.", en: "The farmer drinks water." },
      { la: "Discipulam magistra docet.", en: "The teacher teaches the student." },
    ],
    slavic: "Like вижу девушку / бачу дівчину: the -у does the job of the Latin -m.",
    questions: [
      {
        q: "In «Discipula magistram videt», which word is the object, and how do you know?",
        answer: "«magistram»: it ends in -m, the object ending. The student sees the teacher.",
        keys: [["magistram"]],
      },
      {
        q: "Why does «epistula» become «epistulam» in «Poēta epistulam scrībit»?",
        answer: "Because the letter is what is being written, the object, and the object ends in -m.",
        keys: [["object", "being written", "is written", "gets written", "receives"]],
      },
    ],
    skills: ["n1.acc.sg", "s.svo"],
  },
  {
    id: "2.2",
    lesson: 2,
    title: "Leave out ego and tū",
    explain: [
      "The ending already says who: -ō is I, -s is you.",
      "So Latin usually leaves out «ego» and «tū»: «Legō» = I read, «Labōrās» = you work.",
      "Say ego or tū only to stress the person: «Ego labōrō, tū dormīs!» = I work, you sleep!",
    ],
    examples: [
      { la: "Legō.", en: "I read." },
      { la: "Labōrās.", en: "You work." },
      { la: "Epistulam scrībō.", en: "I write a letter." },
    ],
    slavic: "Russian and Ukrainian do it too: Читаю. / Читаю.",
    questions: [
      {
        q: "What does «Dormiō» mean, even without «ego»?",
        answer: "I sleep: the -ō means I.",
        keys: [["i sleep", "i am sleeping", "i m sleeping"]],
      },
      {
        q: "Say 'you work' in one Latin word.",
        answer: "«Labōrās.»",
        keys: [["laboras"]],
      },
    ],
    skills: ["s.drop"],
  },
  {
    id: "2.3",
    lesson: 2,
    title: "-ae: of, 's",
    explain: [
      "To say whose something is, the owner gets **-ae**: «poēta» → «poētae#gen.sg».",
      "«epistula poētae#gen.sg» = the poet's letter (the letter of the poet).",
      "The owner can stand before or after: «poētae#gen.sg epistula» means the same.",
    ],
    examples: [
      { la: "Epistulam poētae#gen.sg legō.", en: "I read the poet's letter." },
      { la: "Aquam agricolae#gen.sg bibis.", en: "You drink the farmer's water." },
    ],
    slavic: "Like письмо поэта / лист поета.",
    questions: [
      {
        q: "What does «aqua agricolae#gen.sg» mean?",
        answer: "The farmer's water (the water of the farmer).",
        keys: [["farmer s", "of the farmer", "farmers water"]],
      },
      {
        q: "In «Epistulam magistrae#gen.sg legō», whose letter am I reading?",
        answer: "The teacher's.",
        keys: [["teacher"]],
      },
    ],
    skills: ["n1.gen.sg", "s.gen"],
  },
  {
    id: "2.4",
    lesson: 2,
    title: "Describing words match their noun",
    explain: [
      "A describing word (big, long, beautiful) changes together with its noun.",
      "With «puella» it ends the same way: «puella pulchra» = a beautiful girl; as the object, «puellam pulchram».",
      "If the noun ends in -am, the describing word ends in -am too.",
      "Careful: a few -a words are men, like «agricola» and «poēta». They come in rule 3.3.",
    ],
    examples: [
      { la: "Longam epistulam scrībō.", en: "I write a long letter." },
      { la: "Magistra magna discipulam docet.", en: "The big teacher teaches the student." },
      { la: "Magistra magnam discipulam docet.", en: "The teacher teaches the big student." },
    ],
    slavic: "Same as большая книга → большую книгу / велика книга → велику книгу.",
    questions: [
      {
        q: "Why is it «longam epistulam» and not «longa epistulam»?",
        answer: "Because the describing word changes with its noun: «epistulam» is the object (-am), so «longam» too.",
        keys: [["same", "match", "agree", "changes with", "change with", "changes together", "goes with", "follow", "object", "am too", "am as well"]],
      },
      {
        q: "Who is big in «Magistra magnam discipulam docet», the teacher or the student?",
        answer: "The student: «magnam» has the same ending as «discipulam».",
        keys: [["student", "discipulam"]],
      },
    ],
    skills: ["adj.agree"],
  },
  {
    id: "2.5",
    lesson: 2,
    title: "nōn: not",
    explain: ["«nōn» means not.", "Put it right before the verb: «Discipula nōn dormit» = the student does not sleep.", "No 'do' or 'does' is needed."],
    examples: [
      { la: "Discipula nōn dormit.", en: "The student does not sleep." },
      { la: "Epistulam nōn legō.", en: "I do not read the letter." },
    ],
    slavic: "Just like не: не спит / не спить.",
    questions: [
      {
        q: "Translate «Agricola nōn labōrat».",
        answer: "The farmer does not work.",
        keys: [["farmer"], ["not", "doesn t", "don t", "isn t"], ["work"]],
      },
      {
        q: "Where does «nōn» go in a sentence?",
        answer: "Right before the verb.",
        keys: [["before"], ["verb"]],
      },
    ],
    skills: ["s.non"],
  },
  {
    id: "2.6",
    lesson: 2,
    title: "sed, quod, nēmō, bene",
    explain: [
      "Four small words that never change their endings:",
      "«sed» = but, «quod» = because, «nēmō» = no one, «bene» = well.",
      "«Magistra docet sed nēmō discit» = the teacher teaches, but no one learns.",
    ],
    examples: [
      { la: "Poēta bene scrībit.", en: "The poet writes well." },
      { la: "Magistra docet sed nēmō discit.", en: "The teacher teaches but no one learns." },
      { la: "Agricola aquam bibit quod labōrat.", en: "The farmer drinks water because he works." },
    ],
    questions: [
      {
        q: "What does «bene» mean in «Poēta bene scrībit»?",
        answer: "Well: the poet writes well.",
        keys: [["well"]],
      },
      {
        q: "Translate «Nēmō legit».",
        answer: "No one reads.",
        keys: [["no one", "nobody", "noone", "no body"], ["read"]],
      },
    ],
    skills: ["s.conn"],
  },
  {
    id: "2.7",
    lesson: 2,
    title: "Verb + -re: learns to write",
    explain: [
      "A -re verb ('to …') can finish another verb.",
      "«Scrībere discit» = she learns to write.",
      "«Magistra discipulam legere docet» = the teacher teaches the student to read.",
    ],
    examples: [
      { la: "Scrībere discō.", en: "I learn to write." },
      { la: "Legere discis.", en: "You learn to read." },
      { la: "Magistra agricolam scrībere docet.", en: "The teacher teaches the farmer to write." },
    ],
    slavic: "Like учусь писать / вчуся писати.",
    questions: [
      {
        q: "In «Legere discis», which word means 'to read', and which word tells you who is learning?",
        answer: "«legere» means to read; «discis» (with -s) says that you are learning.",
        keys: [["legere"], ["discis"]],
      },
      {
        q: "Translate «Scrībere discō».",
        answer: "I learn to write.",
        keys: [["learn"], ["to write"]],
      },
    ],
    skills: ["s.inf"],
  },

  // ---------------------------------------------------------- Lesson III
  {
    id: "3.1",
    lesson: 3,
    title: "-us and -um: masculine words",
    explain: [
      "Many masculine words end in **-us**: «amīcus» (friend), «discipulus» (male student), «gladius» (sword).",
      "As the object they end in **-um**: «Amīcum videō» = I see the friend.",
      "So -us works like -a (the subject), and -um like -am (the object).",
    ],
    examples: [
      { la: "Discipulus studet.", en: "The (male) student studies." },
      { la: "Amīcum videō.", en: "I see the friend." },
      { la: "Discipulus amīcam habet.", en: "The (male) student has a (female) friend." },
    ],
    slavic: "Like студентка / студент: a female and a male word.",
    questions: [
      {
        q: "In «Discipulus amīcum habet», which word is the object, and how do you know?",
        answer: "«amīcum»: it ends in -um, the object ending.",
        keys: [["amicum"]],
      },
      {
        q: "How would you say 'I see the bull' («taurus»)?",
        answer: "«Taurum videō.»",
        keys: [["taurum"], ["video"]],
      },
    ],
    skills: ["n2.nom.sg", "n2.acc.sg"],
  },
  {
    id: "3.2",
    lesson: 3,
    title: "-ī: of, for -us words",
    explain: [
      "For -us words, 'of' is **-ī**: «amīcus» → «amīcī#gen.sg».",
      "«liber amīcī#gen.sg» = the friend's book.",
      "Compare the -a words: «epistula poētae#gen.sg» (-ae).",
    ],
    examples: [
      { la: "Gladius amīcī#gen.sg", en: "The friend's sword." },
      { la: "Agricola epistulam discipulī#gen.sg legit.", en: "The farmer reads the (male) student's letter." },
    ],
    questions: [
      {
        q: "What does «gladius amīcī#gen.sg» mean?",
        answer: "The friend's sword (the sword of the friend).",
        keys: [["friend s", "of the friend", "friends sword"]],
      },
      {
        q: "How do you say 'of the (male) student', starting from «discipulus»?",
        answer: "«discipulī»",
        keys: [["discipuli"]],
      },
    ],
    skills: ["n2.gen.sg"],
  },
  {
    id: "3.3",
    lesson: 3,
    title: "agricola is masculine",
    explain: [
      "A few -a words are masculine: «agricola» (farmer), «poēta» (poet).",
      "A describing word follows the gender, not the look of the ending: «agricola magnus», «poēta pulcher».",
      "Like мой папа / мій тато: it ends in -а, but it is masculine.",
    ],
    examples: [
      { la: "Agricola magnus labōrat.", en: "The big farmer works." },
      { la: "Poētam pulchrum videō.", en: "I see the handsome poet." },
    ],
    questions: [
      {
        q: "Why do we say «agricola magnus» and not «agricola magna»?",
        answer: "Because «agricola» is masculine, so the describing word takes its masculine form, «magnus».",
        keys: [["masculine", "male", "a man"]],
      },
      {
        q: "How would you say 'the timid farmer' (as the subject)?",
        answer: "«agricola timidus»",
        keys: [["timidus"]],
      },
    ],
    skills: ["adj.gender"],
  },
  {
    id: "3.4",
    lesson: 3,
    title: "sum, es, est: to be",
    explain: [
      "'To be' is irregular: «sum» = I am, «es» = you are, «est» = he / she / it is.",
      "«est» works like =. Both sides stay in the subject form: «Agricola poēta est» = the farmer is a poet.",
      "A describing word after est matches the subject: «Magistra pulchra est».",
    ],
    examples: [
      { la: "Agricola poēta est.", en: "The farmer is a poet." },
      { la: "Magistra pulchra est.", en: "The teacher is beautiful." },
      { la: "Tū es discipula.", en: "You are a student." },
    ],
    slavic: "Russian and Ukrainian usually leave it out (он поэт / він поет), but Latin keeps «est». «est» and есть / є are the same old word.",
    questions: [
      {
        q: "Translate «Discipula est amīca mea».",
        answer: "The student is my friend.",
        keys: [["student"], ["friend"]],
      },
      {
        q: "Why is it «Agricola poēta est» and not «Agricola poētam est»?",
        answer: "Because «est» works like =: both sides stay in the subject form. There is no object.",
        keys: [["equal", "equals", "same", "subject", "no object", "not an object", "not the object", "nominative"]],
      },
    ],
    skills: ["v.sum", "s.est"],
  },
  {
    id: "3.5",
    lesson: 3,
    title: "possum: I can",
    explain: [
      "'Can' is «possum» (I can), «potes» (you can), «potest» (he / she / it can).",
      "Add a -re verb: «Legere possum» = I can read.",
      "«nōn potest» = cannot.",
    ],
    examples: [
      { la: "Legere possum.", en: "I can read." },
      { la: "Poēta bene scrībere potest.", en: "The poet can write well." },
      { la: "Amīcus meus nōn potest legere.", en: "My friend cannot read." },
    ],
    slavic: "Like могу читать / можу читати.",
    questions: [
      {
        q: "Translate «Scrībere nōn potest».",
        answer: "He (or she) cannot write.",
        keys: [["cannot", "can t", "can not", "not able", "unable"], ["write"]],
      },
      {
        q: "How would you say 'you can sleep'?",
        answer: "«Dormīre potes.»",
        keys: [["dormire"], ["potes"]],
      },
    ],
    skills: ["v.possum"],
  },

  // ----------------------------------------------------------- Lesson IV
  {
    id: "4.1",
    lesson: 4,
    title: "in + -ā, -ō: where",
    explain: [
      "To say where something happens, use «in» and a long vowel at the end.",
      "-a words take **-ā**: «in silvā» = in the forest. -us words take **-ō**: «in Olympō» = on Olympus.",
    ],
    examples: [
      { la: "In silvā ambulō.", en: "I walk in the forest." },
      { la: "Deus in Olympō habitat.", en: "The god lives on Olympus." },
      { la: "In scholā studeō.", en: "I study at school." },
    ],
    slavic: "Like в лесу / у лісі.",
    questions: [
      {
        q: "What does «In scholā studeō» mean?",
        answer: "I study at school (in the school).",
        keys: [["study"], ["school"]],
      },
      {
        q: "How do you say 'in the book' («liber», «librī»)?",
        answer: "«in librō»",
        keys: [["libro"]],
      },
    ],
    skills: ["n1.abl.sg", "n2.abl.sg", "s.loc"],
  },
  {
    id: "4.2",
    lesson: 4,
    title: "in, ad + -m: where to",
    explain: [
      "With movement, the goal takes the -m ending: «in silvam» = into the forest, «ad scholam» = to school.",
      "Same «in», different ending: «in silvā» = inside the forest, «in silvam» = into the forest.",
    ],
    examples: [
      { la: "In silvam ambulō.", en: "I walk into the forest." },
      { la: "Ad scholam ambulās.", en: "You walk to school." },
      { la: "Epistulam ad silvam portās.", en: "You carry the letter to the forest." },
    ],
    slavic: "Like в лесу and в лес / у лісі and у ліс.",
    questions: [
      {
        q: "What is the difference between «in silvā ambulō» and «in silvam ambulō»?",
        answer: "«in silvā»: I walk inside the forest. «in silvam»: I walk into the forest.",
        keys: [["into"]],
      },
      {
        q: "How do you say 'I walk to school'?",
        answer: "«Ad scholam ambulō.»",
        keys: [["ad scholam"], ["ambulo"]],
      },
    ],
    skills: ["s.into", "s.ad"],
  },
  {
    id: "4.3",
    lesson: 4,
    title: "vīnum: neither he nor she",
    explain: [
      "Some words are neither masculine nor feminine (neuter), like «vīnum» (wine).",
      "They look the same as subject and object, with -um: «Vīnum bibō» = I drink wine.",
      "'Of' is -ī («vīnī#gen.sg») and 'in' is -ō («in vīnō»), like the -us words.",
    ],
    examples: [
      { la: "Vīnum bibō.", en: "I drink wine." },
      { la: "Vīnum in silvā bibis.", en: "You drink wine in the forest." },
    ],
    slavic: "Like вино / вино: the same form as subject and object.",
    questions: [
      {
        q: "In «Vīnum bibis», who is drinking, and what is drunk?",
        answer: "You are drinking («bibis», with -s); the wine is what is drunk.",
        keys: [["you"], ["wine"]],
      },
      {
        q: "«vīnum» looks the same as subject and object. In «Vīnum bibō», how do you know it is the object?",
        answer: "«bibō» (with -ō) says I am the one drinking, so the wine is what I drink.",
        keys: [["i drink", "i am", "i m", "that i", "me", "myself", "ego", "bibo", "o", "first person", "speaker"]],
      },
    ],
    skills: ["n2n.nom.sg", "n2n.acc.sg", "n2n.gen.sg", "n2n.abl.sg"],
    // vīnum is the only neuter so far, and wine does nothing by itself: never a subject in practice
    practised: ["n2n.acc.sg", "n2n.gen.sg", "n2n.abl.sg"],
  },
  {
    id: "4.4",
    lesson: 4,
    title: "-nt: they",
    explain: [
      "When several people do it, the verb ends in **-nt**: «labōrat» → «labōrant», «docet» → «docent», «scrībit» → «scrībunt».",
      "Two subjects joined by «et» also take -nt: «Discipulus et discipula student».",
    ],
    examples: [
      { la: "Discipulus et discipula student.", en: "The (male) student and the (female) student study." },
      { la: "Magistra et poēta legunt.", en: "The teacher and the poet read." },
    ],
    slavic: "Like работает → работают / працює → працюють.",
    questions: [
      {
        q: "What is the difference between «Puella fugitat» and «Puella et amīca fugitant»?",
        answer: "In the first one girl runs away; in the second the girl and her friend run away: -nt means they.",
        keys: [["nt", "they", "two", "both", "several", "plural"]],
      },
      {
        q: "How do you say 'they work'?",
        answer: "«Labōrant.»",
        keys: [["laborant"]],
      },
    ],
    skills: ["v.3pl", "s.pl"],
  },
  {
    id: "4.5",
    lesson: 4,
    title: "-ae and -ī: several subjects",
    explain: [
      "Several subjects: -a words take **-ae** («puellae#nom.pl» = the girls), -us words take **-ī** («amīcī#nom.pl» = the friends).",
      "These look like 'of' (-ae, -ī). The verb decides: with -nt, it is plural.",
    ],
    examples: [
      { la: "Puellae#nom.pl fugitant.", en: "The girls run away." },
      { la: "Discipulī#nom.pl in scholā student.", en: "The students study at school." },
    ],
    questions: [
      {
        q: "In «Puellae#nom.pl fugitant», how do you know that «puellae» means 'the girls' and not 'of the girl'?",
        answer: "Because «fugitant» ends in -nt (they): the girls are the ones doing it.",
        keys: [["nt", "they", "plural", "verb"]],
      },
      {
        q: "How do you say 'the (male) friends work'?",
        answer: "«Amīcī labōrant.»",
        keys: [["amici"], ["laborant"]],
      },
    ],
    skills: ["n1.nom.pl", "n2.nom.pl"],
  },
];

export const PART_BY_ID = new Map(PARTS.map((p) => [p.id, p]));

/** The parts of a lesson, in order. */
export const partsOf = (lesson: number) => PARTS.filter((p) => p.lesson === lesson);
