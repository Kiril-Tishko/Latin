// Short stories made only of the words of the videos, each with the rules of
// the lessons up to its step and nothing more, so a story can be read at that
// step without a single unknown ending. Every story has a small plot of its own,
// and every line is checked by the tests: the words, the long marks, the rules
// it needs, and that each exercise built on it accepts its own answer.
//   la:     the Latin (word#gen.sg forces a reading of an ambiguous form)
//   en:     the English a reader would write
//   prompt: the English an exercise shows, when it must say more (the friend (f))
//   who:    the speaker, in a dialogue

export interface StoryLine {
  la: string;
  en: string;
  prompt?: string;
  who?: { la: string; en: string };
}

export interface StoryQuestion {
  q: string;
  /** The first option is the right one; the page shuffles them. */
  options: string[];
}

export interface Story {
  id: string;
  /** The lesson whose rules the story needs (the step it belongs to). */
  step: number;
  title: string;
  en: string;
  /** One line: what to notice. */
  notice: string;
  lines: StoryLine[];
  questions: StoryQuestion[];
}

const who = (la: string, en: string) => ({ la, en });

export const STORIES: Story[] = [
  // ------------------------------------------------------------- step I
  {
    id: "qui-docet",
    step: 1,
    title: "Quī docet discit",
    en: "He who teaches learns",
    notice: "-t for one person: «docet», «legit», «discit». And the first proverb.",
    lines: [
      { la: "Magistra docet.", en: "The teacher teaches." },
      { la: "Discipula legit, scrībit et discit.", en: "The student reads, writes and learns.", prompt: "The student (f) reads, writes and learns." },
      { la: "Nunc discipula docet.", en: "Now the student teaches.", prompt: "Now the student (f) teaches." },
      { la: "Et magistra discit!", en: "And the teacher learns!" },
      { la: "Discipula docet et discit.", en: "The student teaches and learns.", prompt: "The student (f) teaches and learns." },
      { la: "Quī docet discit.", en: "He who teaches learns." },
    ],
    questions: [
      { q: "Who teaches in the middle of the story?", options: ["The student", "The teacher", "No one"] },
      { q: "What does the teacher do while the student teaches?", options: ["She learns", "She sleeps", "She writes"] },
    ],
  },
  {
    id: "et-tu",
    step: 1,
    title: "Et tū?",
    en: "And you?",
    notice: "-ō for I, -s for you: «labōrō», «dormīs».",
    lines: [
      { la: "Ego labōrō.", en: "I work." },
      { la: "Ego legō et scrībō.", en: "I read and write." },
      { la: "Ego studeō et discō.", en: "I study and learn." },
      { la: "Et tū?", en: "And you?" },
      { la: "Tū dormīs!", en: "You're asleep!", prompt: "You sleep." },
      { la: "Nunc et ego dormiō.", en: "Now I sleep too." },
    ],
    questions: [
      { q: "What does «tū» do the whole time?", options: ["Sleeps", "Works", "Reads"] },
      { q: "What does «et» mean in «Nunc et ego dormiō»?", options: ["too", "and then", "not"] },
    ],
  },
  {
    id: "poeta",
    step: 1,
    title: "Poēta",
    en: "The poet",
    notice: "Who does it? «Poēta scrībit», «ego legō».",
    lines: [
      { la: "Poēta ambulat.", en: "The poet walks." },
      { la: "Poēta spectat et videt.", en: "The poet looks and sees." },
      { la: "Nunc poēta scrībit.", en: "Now the poet writes." },
      { la: "Poēta scrībit et ego legō.", en: "The poet writes, and I read." },
      { la: "Ego legō et discō.", en: "I read and learn." },
    ],
    questions: [
      { q: "What does the poet do before writing?", options: ["Walks and looks around", "Sleeps", "Reads"] },
      { q: "Who reads what the poet writes?", options: ["I do", "The teacher", "No one"] },
    ],
  },

  // ------------------------------------------------------------ step II
  {
    id: "aqua",
    step: 2,
    title: "Aqua",
    en: "Water",
    notice: "-am: what is wanted, carried and drunk: «aquam».",
    lines: [
      { la: "Agricola labōrat et labōrat.", en: "The farmer works and works." },
      { la: "Aquam dēsīderat.", en: "He longs for water." },
      { la: "Puella aquam portat.", en: "A girl brings water." },
      { la: "Agricola aquam bibit.", en: "The farmer drinks the water." },
      { la: "Nunc agricola bene labōrat.", en: "Now the farmer works well." },
    ],
    questions: [
      { q: "Who brings the water?", options: ["A girl", "The teacher", "The poet"] },
      { q: "How does the farmer work at the end?", options: ["Well", "Not at all", "Badly"] },
    ],
  },
  {
    id: "discipula-dormit",
    step: 2,
    title: "Discipula dormit",
    en: "The student is asleep",
    notice: "-a does it, -am has it done: «magistra discipulam docet».",
    lines: [
      { la: "Magistra discipulam docet.", en: "The teacher teaches the student.", prompt: "The teacher teaches the student (f)." },
      { la: "Sed discipula dormit!", en: "But the student is asleep!", prompt: "But the student (f) sleeps." },
      { la: "Magistra discipulam spectat.", en: "The teacher watches the student.", prompt: "The teacher watches the student (f)." },
      { la: "Nunc discipula nōn dormit.", en: "Now the student is not asleep.", prompt: "Now the student (f) does not sleep." },
      { la: "Epistulam legit et discit.", en: "She reads the letter and learns." },
      { la: "Magistra bene docet et discipula bene discit.", en: "The teacher teaches well, and the student learns well.", prompt: "The teacher teaches well and the student (f) learns well." },
    ],
    questions: [
      { q: "What does the teacher do when the student falls asleep?", options: ["She watches her", "She sleeps too", "She writes a letter"] },
      { q: "What does the student read?", options: ["A letter", "A book", "Nothing"] },
    ],
  },
  {
    id: "epistula-poetae",
    step: 2,
    title: "Epistula poētae",
    en: "The poet's letter",
    notice: "-ae for whose: «epistula poētae#gen.sg», the poet's letter.",
    lines: [
      { la: "Amīca mea poētam dēsīderat.", en: "My friend misses the poet.", prompt: "My friend (f) misses the poet." },
      { la: "Poēta longam epistulam scrībit.", en: "The poet writes a long letter." },
      { la: "Amīca epistulam poētae#gen.sg legit et legit.", en: "My friend reads the poet's letter again and again.", prompt: "The friend (f) reads and reads the poet's letter." },
      { la: "Nunc amīca epistulam scrībit.", en: "Now my friend writes a letter.", prompt: "Now the friend (f) writes a letter." },
      { la: "Poēta epistulam amīcae#gen.sg legit.", en: "The poet reads my friend's letter.", prompt: "The poet reads the letter of the friend (f)." },
      { la: "Nunc et poēta amīcam dēsīderat.", en: "Now the poet misses my friend too.", prompt: "Now the poet too misses the friend (f)." },
    ],
    questions: [
      { q: "Who writes the first letter?", options: ["The poet", "My friend", "The teacher"] },
      { q: "How does the story end?", options: ["The poet misses my friend too", "The poet stops writing", "My friend falls asleep"] },
    ],
  },

  // ----------------------------------------------------------- step III
  {
    id: "amicus-meus",
    step: 3,
    title: "Amīcus meus",
    en: "My friend",
    notice: "«agricola» is masculine: «agricola magnus». And possum: «legere potest».",
    lines: [
      { la: "Amīcus meus agricola est.", en: "My friend is a farmer.", prompt: "My friend (m) is a farmer." },
      { la: "Agricola magnus est et bene labōrat.", en: "The farmer is big and works well." },
      { la: "Sed legere nōn potest.", en: "But he cannot read." },
      { la: "Ego amīcum meum legere doceō.", en: "I teach my friend to read.", prompt: "I teach my friend (m) to read." },
      { la: "Amīcus studet et bene discit.", en: "My friend studies and learns well.", prompt: "The friend (m) studies and learns well." },
      { la: "Nunc epistulam meam legere potest!", en: "Now he can read my letter!" },
    ],
    questions: [
      { q: "What can't the farmer do at first?", options: ["Read", "Work", "Write"] },
      { q: "Why «agricola magnus» and not «agricola magna»?", options: ["agricola is masculine", "agricola is plural", "agricola is the object"] },
    ],
  },
  {
    id: "liber-poetae",
    step: 3,
    title: "Liber poētae",
    en: "The poet's book",
    notice: "-us and -um: «liber», «librum». X est Y: «liber longus est».",
    lines: [
      { la: "Poēta librum scrībit.", en: "The poet is writing a book." },
      { la: "Liber longus est.", en: "The book is long." },
      { la: "Poēta labōrat et labōrat.", en: "The poet works and works." },
      { la: "Nunc liber pulcher est.", en: "Now the book is beautiful." },
      { la: "Sed nēmō librum legit.", en: "But no one reads the book." },
      { la: "Discipulus librum videt et legit.", en: "A student sees the book and reads it.", prompt: "The student (m) sees and reads the book." },
      { la: "Nunc et discipulus poēta est!", en: "Now the student is a poet too!", prompt: "Now the student (m) too is a poet." },
    ],
    questions: [
      { q: "Who reads the book at first?", options: ["No one", "A student", "The teacher"] },
      { q: "What happens to the student?", options: ["He becomes a poet too", "He falls asleep", "He writes a letter"] },
    ],
  },
  {
    id: "possum",
    step: 3,
    title: "Possum!",
    en: "I can!",
    notice: "possum + -re: «legere possum», I can read.",
    lines: [
      { who: who("Discipulus", "The student"), la: "Ego legere possum.", en: "I can read." },
      { who: who("Puella", "The girl"), la: "Et ego scrībere possum.", en: "And I can write." },
      { who: who("Agricola", "The farmer"), la: "Ego bene labōrāre possum.", en: "I can work well." },
      { who: who("Magistra", "The teacher"), la: "Et ego docēre possum.", en: "And I can teach." },
      { who: who("Poēta", "The poet"), la: "Ego legere, scrībere et dormīre possum!", en: "I can read, write and sleep!" },
    ],
    questions: [
      { q: "Who can teach?", options: ["The teacher", "The farmer", "The poet"] },
      { q: "What is funny about the poet's answer?", options: ["He counts sleeping as a skill", "He cannot read", "He says nothing"] },
    ],
  },

  // ------------------------------------------------------------ step IV
  {
    id: "schola-silva",
    step: 4,
    title: "Schola et silva",
    en: "School and forest",
    notice: "Where to and where: «ad scholam», «in scholā», «in silvam», «in silvā». They: -nt.",
    lines: [
      { la: "Discipulae#nom.pl ad scholam ambulant.", en: "The students walk to school.", prompt: "The students (f) walk to school." },
      { la: "In scholā magistra docet et discipulae#nom.pl discunt.", en: "In school the teacher teaches and the students learn.", prompt: "In school the teacher teaches and the students (f) learn." },
      { la: "Nunc magistra et discipulae#nom.pl in silvam ambulant.", en: "Now the teacher and the students walk into the forest.", prompt: "Now the teacher and the students (f) walk into the forest." },
      { la: "In silvā terram et aquam spectant.", en: "In the forest they look at the earth and the water." },
      { la: "Silva magna et pulchra est.", en: "The forest is big and beautiful." },
      { la: "Et silva schola est!", en: "The forest is a school too!" },
    ],
    questions: [
      { q: "Where do they go after school?", options: ["Into the forest", "To the island", "To Olympus"] },
      { q: "What do they look at in the forest?", options: ["The earth and the water", "A letter", "The gods"] },
    ],
  },
  {
    id: "europa-creta",
    step: 4,
    title: "Eurōpa in Crētā",
    en: "Europa on Crete",
    notice: "in + -ā: «in īnsulā», «in Crētā». ad + -am: «ad amīcam».",
    lines: [
      { la: "Eurōpa in īnsulā Crētā habitat.", en: "Europa lives on the island of Crete." },
      { la: "Sed amīcam dēsīderat.", en: "But she misses her friend.", prompt: "But she misses the friend (f)." },
      { la: "Longam epistulam scrībit.", en: "She writes a long letter." },
      { la: "Puella epistulam ad amīcam portat.", en: "A girl carries the letter to her friend.", prompt: "A girl carries the letter to the friend (f)." },
      { la: "Nunc et amīca in Crētā habitat.", en: "Now her friend lives on Crete too.", prompt: "Now the friend (f) too lives on Crete." },
      { la: "Eurōpa et amīca in īnsulā ambulant.", en: "Europa and her friend walk on the island.", prompt: "Europa and the friend (f) walk on the island." },
      { la: "Nunc Eurōpa amīcam nōn dēsīderat.", en: "Now Europa does not miss her friend.", prompt: "Now Europa does not miss the friend (f)." },
    ],
    questions: [
      { q: "Why does Europa write a letter?", options: ["She misses her friend", "She is timid", "The teacher asks her"] },
      { q: "Where does her friend live at the end?", options: ["On Crete", "In the forest", "On Olympus"] },
    ],
  },
  {
    id: "taurus",
    step: 4,
    title: "Taurus timidus",
    en: "The timid bull",
    notice: "«in silvam» (into) and «ad agricolam» (to): the -m of where to.",
    lines: [
      { la: "Agricola taurum magnum habet.", en: "The farmer has a big bull." },
      { la: "Sed taurus timidus est et in silvam fugitat.", en: "But the bull is timid and runs off into the forest." },
      { la: "Agricola taurum dēsīderat.", en: "The farmer misses his bull.", prompt: "The farmer misses the bull." },
      { la: "Puella in silvam ambulat et taurum videt.", en: "A girl walks into the forest and sees the bull." },
      { la: "Puella timida nōn est.", en: "The girl is not timid." },
      { la: "Nunc taurus puellam ad agricolam portat.", en: "Now the bull carries the girl to the farmer." },
      { la: "Et taurus nōn est timidus!", en: "And the bull is not timid any more!", prompt: "And the bull is not timid." },
    ],
    questions: [
      { q: "Why does the bull run into the forest?", options: ["It is timid", "It is thirsty", "The girl calls it"] },
      { q: "How does the bull come back?", options: ["It carries the girl to the farmer", "The farmer pulls it", "It walks back alone"] },
    ],
  },
  // ------------------------------------------------------------- step V
  {
    id: "romam",
    step: 5,
    title: "Rōmam!",
    en: "To Rome!",
    notice: "We: «ambulāmus», «vidēmus», «damus». To a city with no ad: «Rōmam». They are: «timidī sunt».",
    lines: [
      { la: "Amīca et ego Rōmam ambulāmus.", en: "My friend and I walk to Rome.", prompt: "The friend (f) and I walk to Rome." },
      { la: "Via longa et rēcta est.", en: "The road is long and straight." },
      { la: "In viā agricolam et taurum vidēmus.", en: "On the road we see a farmer and a bull." },
      { la: "Agricola et taurus timidī sunt.", en: "The farmer and the bull are timid." },
      { la: "Agricolae#dat.sg et taurō#dat.sg aquam damus.", en: "We give the farmer and the bull water." },
      { la: "Nunc agricola et taurus timidī nōn sunt.", en: "Now the farmer and the bull are not timid." },
      { la: "Nunc agricola, taurus, amīca et ego Rōmam ambulāmus!", en: "Now the farmer, the bull, my friend and I walk to Rome!", prompt: "Now the farmer, the bull, the friend (f) and I walk to Rome!" },
    ],
    questions: [
      { q: "Who is timid on the road?", options: ["The farmer and the bull", "The two friends", "Nobody"] },
      { q: "What do the friends give them?", options: ["Water", "Wine", "A tunic"] },
    ],
  },
  {
    id: "tunica",
    step: 5,
    title: "Tunica magistrī",
    en: "The teacher's tunic",
    notice: "To whom: «magistrō», «agricolae» (-ō and -ae) with «dat» and «damus». The thing given has -m: «tunicam».",
    lines: [
      { la: "Discipulae#nom.pl tunicam pulchram habent.", en: "The students have a beautiful tunic.", prompt: "The students (f) have a beautiful tunic." },
      { who: who("Discipulae", "The students"), la: "Magistrō#dat.sg tunicam damus!", en: "We give the teacher the tunic!", prompt: "We give the tunic to the teacher (m)!" },
      { la: "Magister tunicam spectat.", en: "The teacher looks at the tunic.", prompt: "The teacher (m) looks at the tunic." },
      { la: "Sed tunica longa et magna est!", en: "But the tunic is long and big!" },
      { la: "Magister tunicam agricolae#dat.sg dat.", en: "The teacher gives the tunic to the farmer.", prompt: "The teacher (m) gives the tunic to the farmer." },
      { la: "Agricola magnus est.", en: "The farmer is big." },
      { la: "Et agricola magistrō#dat.sg vīnum dat.", en: "And the farmer gives the teacher wine.", prompt: "And the farmer gives wine to the teacher (m)." },
    ],
    questions: [
      { q: "Why does the teacher give the tunic away?", options: ["It is too big for him", "He has a tunic already", "The farmer asks for it"] },
      { q: "What does the teacher get for it?", options: ["Wine", "Water", "A book"] },
    ],
  },
  {
    id: "vinum-deo",
    step: 5,
    title: "Vīnum deō",
    en: "Wine for the god",
    notice: "To whom: «deō», «agricolae». Romans gave to their gods so that the gods would give back: do ut des, 'I give so that you give'.",
    lines: [
      { la: "Agricola in terrā labōrat.", en: "The farmer works on the land." },
      { la: "Sed terra aquam nōn habet.", en: "But the land has no water." },
      { la: "Agricola deō#dat.sg vīnum dat.", en: "The farmer gives wine to the god." },
      { la: "Deus vīnum bibit.", en: "The god drinks the wine." },
      { la: "Nunc deus agricolae#dat.sg aquam dat.", en: "Now the god gives the farmer water." },
      { la: "Terra aquam habet et agricola bene labōrat.", en: "The land has water and the farmer works well." },
      { la: "Sed vīnum nōn habet!", en: "But he has no wine!", prompt: "But he has no wine." },
    ],
    questions: [
      { q: "Why does the farmer give the god wine?", options: ["The land has no water", "The god is thirsty", "He has too much wine"] },
      { q: "What does the farmer not have at the end?", options: ["Wine", "Water", "Land"] },
    ],
  },
];

export const STORY_BY_ID = new Map(STORIES.map((s) => [s.id, s]));
