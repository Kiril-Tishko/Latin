// Latin in English: how English came by its Latin (in waves, from Roman
// traders to modern science), which English words each of the learner's words
// gave, and the grammar English took from Latin or was taught to imitate.
// Relatives follow the deck's rule (see deck.ts): from = borrowed from the
// Latin word (directly or through French, Italian…), kin = the same ancient
// root, never borrowed; a trap is a look-alike that is not related.
import type { WordStory } from "../latin/types";
import { CARD_BY_ID, Relatives } from "./deck";

export interface WordInEnglish {
  from: Relatives;
  kin?: Relatives;
  /** A short story behind one of them. */
  note?: string;
  /** A look-alike that is not related. */
  trap?: string;
}

/** The lesson words in English, Russian and Ukrainian (Discover cards carry their own). */
export const LESSON_WORDS_IN_ENGLISH: Record<string, WordInEnglish> = {
  // ------------------------------------------------------------ Lesson I
  poeta: {
    from: { en: ["poet", "poetry", "poetic"], ru: ["поэт", "поэзия"], uk: ["поет", "поезія"] },
    note: "Latin took poēta from Greek poiētēs, 'maker'.",
  },
  discipula: {
    from: { en: ["disciple", "discipline"], ru: ["дисциплина"], uk: ["дисципліна"] },
    note: "Discipline was first what a disciple receives: teaching.",
  },
  agricola: {
    from: { en: ["agriculture", "agricultural"] },
    note: "agri- 'field' + -cola 'who tills'. The -cola part (colere, 'to till') also gave culture and colony.",
  },
  magistra: {
    from: { en: ["master", "mister (Mr)", "mistress (Mrs, Miss)", "magistrate", "maestro"], ru: ["магистр", "маэстро"], uk: ["магістр", "маестро"] },
    note: "magistra is the feminine of magister. Mr, Mrs and Miss are all shortened from master and mistress.",
  },
  scribo: {
    from: { en: ["scribe", "script", "scripture", "describe", "prescription", "manuscript", "postscript"], ru: ["манускрипт", "транскрипция"], uk: ["манускрипт", "транскрипція"] },
    note: "A postscript (P.S.) is post scrīptum, 'written after'.",
  },
  studeo: {
    from: { en: ["student", "study", "studio", "studious"], ru: ["студент", "студия"], uk: ["студент", "студія"] },
    note: "A student is literally 'one who is studying' (studēns).",
  },
  lego: {
    from: { en: ["lecture", "lesson", "legible", "legend", "elect", "select", "collect", "intelligent"], ru: ["лекция", "легенда", "интеллект"], uk: ["лекція", "легенда", "інтелект"] },
    note: "legere first meant 'to gather, to pick': select, elect and collect are about picking, and reading is picking up letters. A lesson (French leçon, from lēctiō) is 'a reading': the Lectiōnēs of this site.",
  },
  dormio: {
    from: { en: ["dormitory", "dormant"] },
    kin: { ru: ["дремать"], uk: ["дрімати"] },
    note: "A dormitory is 'a place for sleeping'.",
  },
  laboro: {
    from: { en: ["labour", "laboratory", "elaborate", "collaborate"], ru: ["лаборатория", "лаборант"], uk: ["лабораторія", "лаборант"] },
    note: "A laboratory is 'a place for working'.",
  },
  disco: {
    from: {},
    note: "Hardly any English word comes from discō. It shares an old root with doceō: 'to learn' and 'to make learn'.",
  },
  doceo: {
    from: { en: ["doctor", "doctrine", "document", "docile"], ru: ["доктор", "доктрина", "документ"], uk: ["доктор", "доктрина", "документ"] },
    note: "A doctor was first a teacher: Ph.D. is philosophiae doctor, 'teacher of philosophy'. A document was 'a lesson, a proof'.",
  },
  ego: {
    from: { en: ["ego", "egoist", "alter ego"], ru: ["эгоист"], uk: ["егоїст"] },
    kin: { en: ["I"], ru: ["я"], uk: ["я"] },
    note: "English I, Russian and Ukrainian я and Latin ego are one ancient word.",
  },
  tu: {
    from: {},
    kin: { en: ["thou"], ru: ["ты"], uk: ["ти"] },
    note: "Old English thou, ты, ти and tū: one ancient word, never borrowed.",
  },
  et: {
    from: { en: ["etc.", "&"] },
    note: "etc. is et cētera, 'and the rest'. The sign & began as the letters e and t written together.",
  },
  qui: {
    from: { en: ["quorum"] },
    note: "quōrum means 'of whom': the number of members needed before a meeting can decide.",
  },

  // ------------------------------------------------------------ Lesson II
  epistula: {
    from: { en: ["epistle", "epistolary"] },
    note: "Latin took it from Greek epistolē, 'something sent'.",
  },
  aqua: {
    from: { en: ["aquarium", "aquatic", "aqueduct", "Aquarius"], ru: ["аквариум", "акведук", "акварель"], uk: ["акваріум", "акведук", "акварель"] },
    note: "An aqueduct is aquae ductus, 'the leading of water': aquae is your genitive -ae.",
  },
  video: {
    from: { en: ["video", "vision", "visible", "visit", "evident", "provide", "view", "review", "envy"], ru: ["видео", "виза", "визит"], uk: ["відео", "віза", "візит"] },
    kin: { en: ["wit", "wise"], ru: ["видеть"] },
    note: "Video is simply 'I see'. Envy (invidia) is 'looking at someone' with an evil eye.",
  },
  bibo: {
    from: { en: ["imbibe", "beverage"] },
    note: "A beverage came through French bevrage, 'drink'.",
    trap: "Bible is Greek biblia, 'books', not bibō.",
  },
  longus: {
    from: { en: ["longitude", "longevity", "prolong", "elongate"] },
    kin: { en: ["long"] },
    note: "English long is not borrowed: long and longus are cousins from one ancient word.",
  },
  magnus: {
    from: { en: ["magnitude", "magnificent", "magnify", "magnate", "magnum"], ru: ["магнат"], uk: ["магнат"] },
    kin: { en: ["much"] },
    note: "Its 'greatest', maximus, gave maximum; its 'greater', māior, gave major and mayor.",
  },
  pulcher: {
    from: { en: ["pulchritude"] },
    note: "Pulchritude is a rare, bookish English word for beauty.",
  },
  non: {
    from: { en: ["non-", "nonsense", "non sequitur"] },
    kin: { en: ["no", "not"], ru: ["не", "нет"], uk: ["не", "ні"] },
    note: "A non sequitur is 'it does not follow': a reply that has nothing to do with what was said.",
  },
  sed: { from: {} },
  nemo: {
    from: { en: ["Captain Nemo"] },
    note: "Jules Verne's captain is called No one, like Odysseus, who told the Cyclops his name was Nobody.",
  },
  quod: {
    from: { en: ["Q.E.D."] },
    note: "Q.E.D. is quod erat dēmōnstrandum, 'which was to be shown': here quod means 'which'.",
  },
  bene: {
    from: { en: ["benefit", "benefactor", "benevolent", "benign", "N.B."], ru: ["бенефис"], uk: ["бенефіс"] },
    note: "N.B. is notā bene, 'note well'.",
  },

  // ------------------------------------------------------------ Lesson III
  discipulus: {
    from: { en: ["disciple", "discipline"], ru: ["дисциплина"], uk: ["дисципліна"] },
  },
  amicus: {
    from: { en: ["amicable", "amiable", "amity", "enemy"] },
    note: "An enemy is inimīcus: in- 'not' + amīcus, 'not a friend'.",
  },
  amica: {
    from: { en: ["amicable", "amiable", "amity"] },
  },
  liber: {
    from: { en: ["library", "librarian", "libretto"], ru: ["либретто"], uk: ["лібрето"] },
    note: "A libretto, Italian 'little book', holds the words of an opera.",
    trap: "liberty comes from a different word, līber 'free', with a long ī.",
  },
  gladius: {
    from: { en: ["gladiator", "gladiolus"], ru: ["гладиатор", "гладиолус"], uk: ["гладіатор", "гладіолус"] },
    note: "The gladiolus is 'a little sword': look at its leaves.",
  },
  puella: { from: {} },
  terra: {
    from: { en: ["territory", "terrain", "terrestrial", "terrace", "Mediterranean", "terrier", "terracotta"], ru: ["территория", "терраса", "терракота"], uk: ["територія", "тераса", "теракота"] },
    note: "The Mediterranean is the sea 'in the middle of the lands', and a terrier is an 'earth dog' that digs.",
    trap: "terrible is not from terra: it comes from terreō, 'frighten'.",
  },
  taurus: {
    from: { en: ["Taurus", "toreador"], ru: ["тореадор"], uk: ["тореадор"] },
    note: "Spanish toro, the bull of the toreador, is taurus.",
  },
  deus: {
    from: { en: ["deity", "deism", "adieu"] },
    note: "French adieu is à Dieu, '(I commend you) to God'. Divine comes from a sister word, dīvus.",
  },
  iuppiter: {
    from: { en: ["Jupiter", "jovial", "By Jove!"], ru: ["Юпитер"], uk: ["Юпітер"] },
    note: "Jovial comes from Iovis, the genitive of the story: people born under the planet Jupiter were said to be cheerful.",
  },
  europa: { from: { en: ["Europe"], ru: ["Европа"], uk: ["Європа"] } },
  olympus: { from: { en: ["Olympus", "Olympian"] } },
  sum: {
    from: { en: ["essence", "essential", "interest", "absent", "present", "future"], ru: ["эссенция", "интерес"], uk: ["есенція", "інтерес"] },
    kin: { en: ["is"], ru: ["есть"], uk: ["є"] },
    note: "Interest is Latin interest, 'it is between, it matters'. Future is futūrus, 'about to be'.",
  },
  possum: {
    from: { en: ["possible", "potent", "potential"], ru: ["потенциал"], uk: ["потенціал"] },
  },
  habeo: {
    from: { en: ["habit", "able", "exhibit", "prohibit", "inhibit"] },
    trap: "have looks like habeō but is not related: its Latin cousin is capiō, 'take'.",
  },
  desidero: {
    from: { en: ["desire", "desideratum"] },
    note: "Perhaps from dē sīdere, 'from the stars', like consider.",
  },
  habito: {
    from: { en: ["habitat", "inhabit", "inhabitant", "habitation"] },
    note: "A habitat is habitat, 'it lives (here)', with your -t.",
  },
  specto: {
    from: { en: ["spectator", "spectacle", "expect"], ru: ["спектакль"], uk: ["спектакль"] },
    note: "Expect is ex-spectāre, 'to look out for'. Inspect, respect and перспектива come from specere, the plain verb behind spectō.",
  },
  transformo: {
    from: { en: ["transform", "transformer"], ru: ["трансформатор"], uk: ["трансформатор"] },
    note: "trāns 'across' + fōrma 'shape'.",
  },
  meus: { from: { en: ["mea culpa"] }, note: "Mea culpa: '(through) my fault'." },
  timidus: { from: { en: ["timid", "timidity", "intimidate"] } },
  se: { from: { en: ["per se"] }, note: "Per se: 'by itself'." },
  "in-prep": {
    from: { en: ["in- (include, inspect, import)"] },
    kin: { en: ["in"] },
  },

  // ------------------------------------------------------------ Lesson IV
  vinum: {
    from: { en: ["wine", "vine", "vinegar", "vintage"], ru: ["вино", "винегрет"], uk: ["вино", "вінегрет"] },
    note: "One of the very first Latin words in English, borrowed before the English came to Britain. Vinegar is French vin aigre, 'sour wine'.",
  },
  silva: {
    from: { en: ["sylvan", "Pennsylvania", "Transylvania", "savage"] },
    note: "Pennsylvania is 'Penn's woods', Transylvania 'the land beyond the forest', and a savage was 'a man of the woods' (silvāticus).",
  },
  dea: { from: {}, note: "Its brother deus gave deity and adieu." },
  schola: {
    from: { en: ["school", "scholar", "scholastic"], ru: ["школа"], uk: ["школа"] },
    note: "Greek scholē, behind Latin schola, meant 'free time': leisure spent on learning.",
  },
  insula: {
    from: { en: ["isle", "insulate", "insular", "peninsula", "isolate"], ru: ["изоляция", "инсулин"], uk: ["ізоляція", "інсулін"] },
    note: "A peninsula is paene īnsula, 'almost an island'.",
    trap: "island is Old English īgland: it only borrowed the s from isle.",
  },
  creta: { from: { en: ["Crete"], ru: ["Крит"], uk: ["Крит"] } },
  ambulo: {
    from: { en: ["ambulance", "amble", "preamble", "pram"], ru: ["амбулатория"], uk: ["амбулаторія"] },
    note: "An ambulance was a 'walking hospital' that followed the army; a pram is a perambulator, a 'walker-through'.",
  },
  porto: {
    from: { en: ["portable", "porter", "import", "export", "report", "support", "transport", "sport", "portfolio"], ru: ["транспорт", "экспорт", "импорт", "репортёр", "портфель", "спорт"], uk: ["транспорт", "експорт", "імпорт", "репортер", "портфель", "спорт"] },
    note: "Sport is short for disport, 'to carry yourself away' from work.",
  },
  fugito: {
    from: { en: ["fugitive", "refuge", "refugee", "centrifugal", "fugue"], ru: ["фуга"], uk: ["фуга"] },
    note: "fugitō is 'keep fleeing', from fugiō, 'flee'. A fugue is a 'flight' of voices chasing each other.",
  },
  "ad-prep": {
    from: { en: ["ad- (adapt, admire, attract)", "ad hoc"] },
    kin: { en: ["at"] },
  },
  nunc: { from: {} },
  // ------------------------------------------------------------ Lesson V
  via: {
    from: { en: ["via", "viaduct", "trivia", "trivial", "deviate", "obvious", "previous", "convey", "voyage", "envoy"], ru: ["виадук", "тривиальный"], uk: ["віадук", "тривіальний"] },
    note: "Perhaps a cousin of English way and of везти, воз (from an old root 'to carry'), but scholars disagree. Trivial is trivium, the place where three roads met, open to everyone, so trivialis came to mean common, everyday; obvious is ob viam, 'lying in your way'; a voyage was first viāticum, the food for the road.",
  },
  roma: {
    from: { en: ["Rome", "Roman", "romance", "romantic", "Romania"], ru: ["Рим", "роман", "романтика", "Румыния"], uk: ["Рим", "роман", "романтика", "Румунія"] },
    note: "A romance was first a story told in the everyday 'Roman' speech (rōmānicē) instead of in Latin: that is why a novel is a роман.",
  },
  italia: {
    from: { en: ["Italy", "Italian", "italics"], ru: ["Италия", "итальянский"], uk: ["Італія", "італійський"] },
    note: "Italics are 'Italian letters': the slanted type Aldus Manutius printed in Venice in 1501. An old explanation, told already by the ancients, makes Italia 'the land of calves' (vitulus).",
  },
  magister: {
    from: { en: ["master", "mister", "magistrate", "magisterial", "maestro"], ru: ["магистр", "маэстро", "магистраль"], uk: ["магістр", "маестро", "магістраль"] },
    note: "magis 'more' + -ter: the master is 'the greater one', and his opposite is minister, from minus, 'the lesser one', the servant. A minister is still, by name, a servant.",
  },
  tunica: {
    from: { en: ["tunic", "tunicate"], ru: ["туника"], uk: ["туніка"] },
    note: "Probably a word from the east, like Greek chitōn and Hebrew kuttōnet. The tunic was what every Roman wore every day; the toga went over it for formal, public days.",
  },
  duco: {
    from: { en: ["duke", "duct", "conduct", "produce", "reduce", "introduce", "deduce", "aqueduct", "ducat"], ru: ["продукт", "кондуктор", "акведук", "дукат"], uk: ["продукт", "кондуктор", "акведук", "дукат"] },
    kin: { en: ["tow", "tug", "team"] },
    note: "A dux was 'a leader', the duke; an aqueduct 'leads water'; a conductor 'leads together'. The ducat, a gold coin, is named for a duchy (ducātus), the land of a dux.",
  },
  do: {
    from: { en: ["data", "date", "donate", "donor", "tradition", "traitor", "edition", "render"], ru: ["дата", "традиция", "донор"], uk: ["дата", "традиція", "донор"] },
    kin: { ru: ["дать", "дар"], uk: ["дати", "дар"] },
    note: "Roman letters ended with where and when they were handed to the messenger: data Rōmae, 'given at Rome': that data became our date. A tradition and a traitor both 'hand over' (trā-dere). And дать, дар are the same ancient word as dare.",
  },
  volo: {
    from: { en: ["voluntary", "volunteer", "volition", "benevolent", "malevolent"], ru: ["волюнтаризм"], uk: ["волюнтаризм"] },
    kin: { en: ["will"], ru: ["воля", "велеть"], uk: ["воля", "веліти"] },
    note: "volō, English will and воля are one ancient word for wanting. A volunteer serves of his own will; benevolent is 'well-wishing'.",
  },
  optimus: {
    from: { en: ["optimal", "optimum", "optimism", "optimist", "optimize"], ru: ["оптимизм", "оптимальный", "оптимист"], uk: ["оптимізм", "оптимальний", "оптиміст"] },
    note: "Jupiter of the Capitol was Iuppiter Optimus Maximus, 'the best and greatest'. In September AD 100 Pliny thanked Trajan in the Senate and called him optimus again and again; in 114 'Optimus' became part of his official name. The word optimism (French optimisme, 1737; English a little later, through Voltaire's Candide) was named for Leibniz's 'best of all possible worlds'.",
  },
  omnis: {
    from: { en: ["omnibus", "bus", "omnipotent", "omniscient", "omnivore", "omnipresent"], ru: ["омнибус", "автобус"], uk: ["омнібус", "автобус"] },
    note: "omnibus is 'for all', the dative plural: the French coaches of the 1820s that took everybody. Cut short it became bus, and автобус keeps only that Latin ending, -bus.",
  },
  clarus: {
    from: { en: ["clear", "clarify", "clarity", "declare", "clarinet", "Clara"], ru: ["кларнет", "Клара"], uk: ["кларнет", "Клара"] },
    note: "clārus is 'bright, clear', and of a person 'famous': a name that shines. The clarinet is 'a little clear one': a diminutive, probably of French clarine (a little bell) or of the clarino, a high bright trumpet; both go back to clārus.",
  },
  rectus: {
    from: { en: ["rectangle", "rectify", "correct", "direct", "erect", "rectum"], ru: ["ректор", "корректный", "директор"], uk: ["ректор", "коректний", "директор"] },
    kin: { en: ["right"] },
    note: "rēctus and English right are the same ancient word: straight, then correct. A rectangle has 'right angles', and the rectum is the 'straight' gut.",
  },
  splendidus: {
    from: { en: ["splendid", "splendour", "resplendent"] },
    note: "From splendēre, 'to shine': something splendid shines.",
  },
  arma: {
    from: { en: ["arms", "army", "armour", "armada", "alarm", "armadillo", "disarm"], ru: ["армия", "армада"], uk: ["армія", "армада"] },
    kin: { en: ["arm (of the body)"] },
    note: "Alarm is Italian all'arme!, 'to arms!'; an armadillo is 'a little armed one'. Your arm is a cousin: both come from an old root 'to fit together'. Vergil's Aeneid begins Arma virumque canō, 'Of arms and the man I sing'.",
  },
  nos: {
    from: { en: ["nostrum", "Pater Noster", "Cosa Nostra"] },
    kin: { en: ["us", "our"], ru: ["нас", "нам"], uk: ["нас", "нам"] },
    note: "A quack's nostrum was 'our own' secret medicine (noster, 'our'). нас and нам are cousins of nōs.",
    trap: "nostalgia is Greek nostos, 'homecoming' + algos, 'pain': not nōs.",
  },
  hic: {
    from: { en: ["hic jacet"] },
    note: "Roman gravestones say H.S.E., hīc situs est, 'here he lies'; later ones say hīc iacet, and English took hic jacet as a word for an epitaph. Hīc sunt dracōnēs, 'here be dragons', is written on just two old globes (about 1504 and 1510), off the coast of Asia.",
  },
};

// ---------------------------------------------------------------- waves

export interface Wave {
  when: string;
  title: string;
  /** Markup: «Latin» is colored. */
  text: string;
  /** English word, the Latin it comes from, and what the Latin meant when it needs saying. */
  words: [string, string, string?][];
}

export const WAVES: Wave[] = [
  {
    when: "1st–5th century",
    title: "Before England: traders and soldiers",
    text: "The Germanic tribes on the edge of the Empire bought, sold and served in the army, and took Latin words home. They brought them to Britain in the 5th century, so these are among the oldest words of English.",
    words: [
      ["wine", "vīnum"],
      ["street", "strāta (via)", "a paved road"],
      ["wall", "vallum"],
      ["mile", "mīlia", "a thousand (paces)"],
      ["pound", "pondō", "by weight"],
      ["inch", "uncia", "a twelfth"],
      ["cheese", "cāseus"],
      ["kitchen", "coquīna"],
      ["cup", "cuppa"],
      ["pepper", "piper"],
      ["mint", "monēta"],
    ],
  },
  {
    when: "43–410",
    title: "Roman Britain: place names",
    text: "Rome ruled Britain for almost four hundred years, but its people spoke Celtic, and the English arrived after the Romans had left. What stayed are the names of Roman forts, which the English called ceaster, from castra, 'camp'.",
    words: [
      ["Manchester", "castra"],
      ["Lancaster", "castra"],
      ["Gloucester", "castra"],
      ["Winchester", "castra"],
      ["Lincoln", "Lindum colōnia", "a settlement"],
    ],
  },
  {
    when: "597 onwards",
    title: "Monks and the Church",
    text: "Missionaries from Rome brought Christianity and its Latin books. Words of the church and the school came with them, among them two of yours.",
    words: [
      ["school", "schola"],
      ["master", "magister", "the masculine of «magistra»"],
      ["epistle", "epistula"],
      ["candle", "candēla"],
      ["altar", "altāre"],
      ["verse", "versus"],
      ["noon", "nōna (hōra)", "the ninth hour: 3 pm, the monks' prayer time, later moved to midday"],
    ],
  },
  {
    when: "1066–1400",
    title: "The Normans: Latin through French",
    text: "After William of Normandy conquered England, French (a daughter of Latin) was spoken at court, in the law courts and in rich houses for three hundred years. About ten thousand French words entered English, and three quarters of them are still used.",
    words: [
      ["government", "gubernāre", "to steer"],
      ["judge", "iūdex"],
      ["justice", "iūstitia"],
      ["people", "populus"],
      ["city", "cīvitās"],
      ["beef", "bōs, bovem", "ox"],
      ["pork", "porcus"],
      ["desire", "dēsīderō"],
      ["study", "studeō"],
      ["labour", "labōrō"],
      ["enemy", "inimīcus", "not a friend"],
    ],
  },
  {
    when: "1500–1700",
    title: "The Renaissance: straight from the books",
    text: "Scholars read Latin every day and borrowed directly from it, often keeping the Latin form. Critics mocked these as 'inkhorn terms' (ink-pot words); many died out, thousands stayed.",
    words: [
      ["area", "ārea", "an open space"],
      ["data", "data", "things given"],
      ["education", "ēducātiō"],
      ["exterior", "exterior", "outer"],
      ["fact", "factum", "a thing done"],
      ["focus", "focus", "a hearth"],
      ["formula", "fōrmula", "a little shape"],
      ["genius", "genius", "a guardian spirit"],
      ["species", "speciēs", "a look, a kind"],
      ["vacuum", "vacuum", "an empty space"],
    ],
  },
  {
    when: "1600 to today",
    title: "Science, law and new words",
    text: "Until the 1700s scholars all over Europe wrote in Latin: Newton's Principia (1687) is in Latin, and Linnaeus gave plants and animals two-part Latin names (Homō sapiēns, 'wise human'). Law and medicine still use it, and new words are still built from Latin parts.",
    words: [
      ["alibi", "alibī", "elsewhere"],
      ["habeas corpus", "habeās corpus", "you may have the body"],
      ["video", "videō", "I see (a word of the 1930s)"],
      ["audio", "audiō", "I hear"],
      ["computer", "computāre", "to reckon"],
      ["television", "tēle + vīsiō", "Greek 'far' + Latin 'sight'"],
    ],
  },
];

/** The same thing in three layers: plain Old English, French, learned Latin. */
export const TRIPLETS: [string, string, string][] = [
  ["kingly", "royal", "regal"],
  ["ask", "question", "interrogate"],
  ["rise", "mount", "ascend"],
  ["fire", "flame", "conflagration"],
  ["fear", "terror", "trepidation"],
  ["holy", "sacred", "consecrated"],
];

/** The animal kept its English name; its meat on the Norman table got a French (Latin) one. */
export const TABLE_PAIRS: { animal: string; meat: string; latin: string }[] = [
  { animal: "cow", meat: "beef", latin: "bōs, bovem" },
  { animal: "pig", meat: "pork", latin: "«porcus»" },
  { animal: "calf", meat: "veal", latin: "vitellus" },
  { animal: "deer", meat: "venison", latin: "vēnātiō, hunting" },
];

// ------------------------------------------------------- frozen verb forms

export interface FrozenVerb {
  /** The English word, ending with the Latin ending. */
  en: string;
  ending: string;
  la: string;
  meaning: string;
  note?: string;
}

export interface VerbGroup {
  ending: string;
  who: string;
  /** The skill that teaches the ending, when the learner has met it. */
  skill?: string;
  items: FrozenVerb[];
}

export const FROZEN_VERBS: VerbGroup[] = [
  {
    ending: "-ō",
    who: "I",
    skill: "v.1sg",
    items: [
      { en: "video", ending: "o", la: "«videō»", meaning: "I see", note: "Your Lesson II verb." },
      { en: "audio", ending: "o", la: "«audiō»", meaning: "I hear" },
      { en: "veto", ending: "o", la: "vetō", meaning: "I forbid", note: "What a tribune of the people said to stop a law in Rome." },
      { en: "credo", ending: "o", la: "«crēdō»", meaning: "I believe", note: "A person's credo: the first word of the Creed." },
    ],
  },
  {
    ending: "-t",
    who: "he / she / it",
    skill: "v.3sg",
    items: [
      { en: "habitat", ending: "t", la: "«habitat»", meaning: "it lives (here)", note: "Old books on plants and animals said, in Latin, where each one lives: «Habitat in Eurōpā», 'it lives in Europe'." },
      { en: "exit", ending: "t", la: "exit", meaning: "he goes out", note: "A stage direction in Shakespeare's plays: Exit Hamlet." },
      { en: "tenet", ending: "t", la: "«tenet»", meaning: "he holds", note: "What someone holds to be true." },
      { en: "deficit", ending: "t", la: "dēficit", meaning: "it is lacking", note: "In old account books, the line for what was missing." },
      { en: "interest", ending: "t", la: "inter «est»", meaning: "it is between, it matters" },
    ],
  },
  {
    ending: "-nt",
    who: "they",
    skill: "v.3pl",
    items: [{ en: "exeunt", ending: "nt", la: "exeunt", meaning: "they go out", note: "Exeunt omnēs: everyone leaves the stage." }],
  },
  {
    ending: "-mus",
    who: "we",
    items: [{ en: "ignoramus", ending: "mus", la: "ignōrāmus", meaning: "we do not know", note: "What a jury wrote on a charge it threw out; then the name of a foolish lawyer in a play of 1615." }],
  },
];

/** Other verb forms you will meet later, frozen in English. */
export const LATER_VERBS: FrozenVerb[] = [
  { en: "recipe", ending: "", la: "recipe", meaning: "take!", note: "The first word of a doctor's prescription, shortened to ℞." },
  { en: "memento", ending: "", la: "mementō", meaning: "remember!" },
  { en: "placebo", ending: "", la: "placēbō", meaning: "I will please", note: "From «placeō»." },
  { en: "affidavit", ending: "", la: "affidāvit", meaning: "he has pledged (on oath)" },
];

// ---------------------------------------------------------------- plurals

export interface PluralGroup {
  sg: string;
  pl: string;
  /** The skill that teaches this plural, when the learner has met it. */
  skill?: string;
  /** The same plural on a word the learner knows (markup). */
  known?: string;
  pairs: [string, string][];
}

export const PLURALS: PluralGroup[] = [
  {
    sg: "a",
    pl: "ae",
    skill: "n1.nom.pl",
    known: "«puella» → «puellae#nom.pl»",
    pairs: [["alga", "algae"], ["larva", "larvae"], ["vertebra", "vertebrae"], ["antenna", "antennae"], ["formula", "formulae"], ["alumna", "alumnae"]],
  },
  {
    sg: "us",
    pl: "i",
    skill: "n2.nom.pl",
    known: "«amīcus» → «amīcī#nom.pl»",
    pairs: [["alumnus", "alumni"], ["cactus", "cacti"], ["fungus", "fungi"], ["nucleus", "nuclei"], ["radius", "radii"], ["stimulus", "stimuli"], ["focus", "foci"]],
  },
  {
    sg: "um",
    pl: "a",
    pairs: [["datum", "data"], ["medium", "media"], ["bacterium", "bacteria"], ["curriculum", "curricula"], ["memorandum", "memoranda"], ["millennium", "millennia"]],
  },
];

/** Plurals of later declensions. */
export const LATER_PLURALS: [string, string][] = [
  ["index", "indices"],
  ["appendix", "appendices"],
  ["matrix", "matrices"],
  ["genus", "genera"],
  ["corpus", "corpora"],
];

/** Markup: plurals that trip people up. */
export const PLURAL_TRAPS: string[] = [
  "**octopus → octopuses.** It is Greek (oktōpous, 'eight-foot'), so *octopi* treats it as Latin by mistake.",
  "**virus → viruses.** Latin vīrus ('poison, slime') had no plural at all.",
  "**data, agenda, media** were plurals ('things given', 'things to be done', 'middles'). English now often treats them as singular: *the data shows*, *the agenda is*.",
  "**criteria, phenomena** are Greek plurals (criterion, phenomenon), not Latin.",
  "**campus, bonus, circus** take English plurals: campuses, bonuses, circuses. In Latin, bonus is not even a noun: it is the adjective 'good'.",
];

// ------------------------------------------------------------ grammar rules

export interface GrammarRule {
  id: string;
  title: string;
  /** Markup: the Latin side. */
  latin: string;
  /** Markup: what English grammarians made of it. */
  english: string;
  /** Markup: how English uses it today. */
  today: string;
  /** Russian / Ukrainian comparison. */
  slavic?: string;
  /** The skill the Latin side rests on. */
  skill?: string;
}

export const GRAMMAR_RULES: GrammarRule[] = [
  {
    id: "it-is-i",
    title: "“It is I”, not “It is me”",
    latin: "Both sides of «est» are nominative: «Agricola poēta est».",
    english: "Eighteenth-century grammarians such as Robert Lowth (1762) applied the Latin rule: after *is*, use the subject forms *I, he, she*.",
    today: "Everyday English says *It's me*; *It is I* sounds very formal.",
    slavic: "Это я / Це я: nominative, as in Latin.",
    skill: "s.est",
  },
  {
    id: "preposition",
    title: "No preposition at the end",
    latin: "A Latin preposition always stands before its noun: «in silvā», «ad scholam». Its very name says so: praepositiō, 'placed before'.",
    english: "In 1672 the poet John Dryden criticized Ben Jonson for ending a line with *from* (\"the bodies that those souls were frighted from\"), and grammar books turned his taste into a rule.",
    today: "*Who are you talking to?* is perfectly good English. A joke often credited to Churchill mocks the rule: *This is the sort of English up with which I will not put.*",
    skill: "s.loc",
  },
  {
    id: "split-infinitive",
    title: "Don't split the infinitive",
    latin: "'To write' is one word in Latin, «scrībere»: nothing can come between *to* and *write*.",
    english: "In the 1800s grammarians began to condemn putting a word between *to* and its verb, as in Star Trek's *to boldly go* (1966). The rule is often blamed on Latin.",
    today: "Most style guides now allow it when it reads better.",
    skill: "v.inf",
  },
  {
    id: "double-negative",
    title: "Two negatives make a positive",
    latin: "In Latin two negatives cancel each other: «Nēmō nōn videt», 'no one does not see', means everyone sees.",
    english: "Grammarians of the 1700s applied this logic to English, so *I don't know nothing* became 'wrong'. Chaucer and Shakespeare had used double negatives freely, for emphasis.",
    today: "Standard English follows the Latin rule; many dialects still double the negative.",
    slavic: "Russian and Ukrainian double it: Никто ничего не видит / Ніхто нічого не бачить. So in Latin, beware: 'no one sees' is just «Nēmō videt», with no «nōn».",
    skill: "s.conn",
  },
  {
    id: "who-whom",
    title: "Who and whom: English cases",
    latin: "Latin marks the subject and the object with endings: «puella», «puellam».",
    english: "English lost its noun endings but kept the cases in a few pronouns, and *'s* is the old genitive. These are not borrowed: Old English had cases too, cousins of the Latin ones. But grammarians kept *whom* alive with Latin as their model.",
    today: "*Whom* is fading in speech; *Who did you see?* is normal.",
    skill: "n1.acc.sg",
  },
];

/** English pronouns that still change for case: nominative, accusative, genitive. */
export const ENGLISH_CASES: [string, string, string][] = [
  ["I", "me", "my"],
  ["he", "him", "his"],
  ["she", "her", "her"],
  ["we", "us", "our"],
  ["they", "them", "their"],
  ["who", "whom", "whose"],
];

// --------------------------------------------------------- building words

/** Latin prepositions living on as English prefixes. */
export const PREFIXES: { prefix: string; meaning: string; examples: string; word?: string }[] = [
  { prefix: "ad-", meaning: "to, toward", examples: "adapt, admire, advent", word: "ad-prep" },
  { prefix: "in-", meaning: "in, into", examples: "include, inspect, import", word: "in-prep" },
  { prefix: "ex-", meaning: "out", examples: "exit, export, expect" },
  { prefix: "re-", meaning: "back, again", examples: "report, review, return" },
  { prefix: "pre-", meaning: "before", examples: "prescribe, preview, preamble" },
  { prefix: "post-", meaning: "after", examples: "postscript, postpone, postwar" },
  { prefix: "sub-", meaning: "under", examples: "submarine, subway, subscribe" },
  { prefix: "super-", meaning: "over, above", examples: "supervise, supermarket" },
  { prefix: "trans-", meaning: "across", examples: "transport, transform, translate" },
  { prefix: "inter-", meaning: "between", examples: "interview, international, interest" },
  { prefix: "con-, com-", meaning: "with, together", examples: "connect, combine, collaborate" },
  { prefix: "de-", meaning: "down, away", examples: "describe, deport, descend" },
  { prefix: "pro-", meaning: "forward, for", examples: "provide, promote, prolong" },
];

/** Latin's sound rule: a prefix changes to suit the next sound. */
export const ASSIMILATION: { parts: string; word: string; rule: string; from?: string }[] = [
  { parts: "in + «portāre»", word: "import", rule: "n → m before p", from: "porto" },
  { parts: "in + possible", word: "impossible", rule: "n → m before p", from: "possum" },
  { parts: "in + «bibere»", word: "imbibe", rule: "n → m before b", from: "bibo" },
  { parts: "in + legible", word: "illegible", rule: "n → l before l", from: "lego" },
  { parts: "sub + «portāre»", word: "support", rule: "b → p before p", from: "porto" },
  { parts: "con + «legere»", word: "collect", rule: "n → l before l", from: "lego" },
  { parts: "con + «labōrāre»", word: "collaborate", rule: "n → l before l", from: "laboro" },
  { parts: "ad + «trahere»", word: "attract", rule: "d → t before t", from: "traho" },
]

/** Latin word endings English uses to build new words. */
export const SUFFIXES: { suffix: string; meaning: string; examples: string }[] = [
  { suffix: "-or", meaning: "the one who does it", examples: "doctor (teacher, «doceō»), spectator («spectō»), narrator" },
  { suffix: "-ory, -orium", meaning: "a place for it", examples: "dormitory («dormiō»), laboratory («labōrō»), auditorium («audiō»)" },
  { suffix: "-able, -ible", meaning: "can be done", examples: "portable («portō»), legible («legō»), visible («videō»)" },
  { suffix: "-tion", meaning: "the act of it", examples: "habitation («habitō»), transformation («trānsfōrmō»), vision («videō»)" },
  { suffix: "-ent, -ant", meaning: "the one doing it", examples: "student («studeō»), agent, inhabitant («habitō»)" },
];

// ---------------------------------------------------------------- spelling

/** Letters added to English words to show their Latin parents (or a wrong one). */
export const SPELLINGS: { word: string; letter: string; before: string; latin: string; wrong?: boolean }[] = [
  { word: "debt", letter: "b", before: "dette", latin: "dēbitum" },
  { word: "doubt", letter: "b", before: "doute", latin: "dubitāre" },
  { word: "receipt", letter: "p", before: "receite", latin: "recepta" },
  { word: "salmon", letter: "l", before: "samoun", latin: "salmō" },
  { word: "subtle", letter: "b", before: "sotil", latin: "subtīlis" },
  { word: "island", letter: "s", before: "iland (Old English īgland)", latin: "«īnsula», by mistake", wrong: true },
  { word: "scissors", letter: "c", before: "sisoures", latin: "scindere, 'cut', by mistake", wrong: true },
];

// ----------------------------------------------------------- grammar words

/** The names of grammar are Latin. */
export const GRAMMAR_TERMS: { term: string; latin: string; meaning: string }[] = [
  { term: "nominative", latin: "nōmināre", meaning: "to name: the naming case, the subject" },
  { term: "accusative", latin: "accūsāre", meaning: "to accuse: a mistranslation of the Greek name, 'the case of what is affected'" },
  { term: "genitive", latin: "genus", meaning: "birth, kind: the case of where something belongs" },
  { term: "ablative", latin: "ablātus", meaning: "carried away: the 'from' case, also 'in' and 'with'" },
  { term: "dative", latin: "dare", meaning: "to give: the 'to whom' case" },
  { term: "vocative", latin: "vocāre", meaning: "to call: the case for calling someone («vocō»)" },
  { term: "case", latin: "cāsus", meaning: "a fall: the forms 'fall away' from the nominative" },
  { term: "declension", latin: "dēclīnātiō", meaning: "a bending aside" },
  { term: "conjugation", latin: "coniugātiō", meaning: "a yoking together («iugum», a yoke)" },
  { term: "verb", latin: "verbum", meaning: "word («verbum»)" },
  { term: "noun", latin: "nōmen", meaning: "name" },
  { term: "pronoun", latin: "prō nōmine", meaning: "instead of a noun" },
  { term: "adjective", latin: "adiectīvum", meaning: "thrown on, added («iaciō», throw)" },
  { term: "preposition", latin: "praepositiō", meaning: "placed before" },
  { term: "infinitive", latin: "īnfīnītīvus", meaning: "not limited: it does not say who («fīniō»)" },
  { term: "person", latin: "persōna", meaning: "an actor's mask, then a role" },
  { term: "singular, plural", latin: "singulāris, plūrālis", meaning: "one by one, of more" },
  { term: "gender", latin: "genus", meaning: "kind" },
  { term: "neuter", latin: "neuter", meaning: "neither (masculine nor feminine)" },
  { term: "tense", latin: "tempus", meaning: "time" },
];

// ---------------------------------------------------------- abbreviations

export const ABBREVIATIONS: { abbr: string; latin: string; meaning: string }[] = [
  { abbr: "e.g.", latin: "exemplī grātiā", meaning: "for the sake of an example («exemplum»)" },
  { abbr: "i.e.", latin: "id «est»", meaning: "that is" },
  { abbr: "etc.", latin: "«et» cētera", meaning: "and the rest" },
  { abbr: "a.m., p.m.", latin: "ante, post merīdiem", meaning: "before, after midday" },
  { abbr: "AD", latin: "annō Dominī", meaning: "in the year of the Lord («dominus»)" },
  { abbr: "P.S.", latin: "post scrīptum", meaning: "written afterwards («scrībō»)" },
  { abbr: "N.B.", latin: "notā «bene»", meaning: "note well!" },
  { abbr: "vs.", latin: "versus", meaning: "turned against" },
  { abbr: "et al.", latin: "«et» aliī", meaning: "and others" },
  { abbr: "cf.", latin: "cōnfer", meaning: "compare!" },
  { abbr: "viz.", latin: "vidēlicet", meaning: "namely: 'one may see' («videō»)" },
  { abbr: "Ph.D.", latin: "philosophiae doctor", meaning: "teacher of philosophy (-ae, and doctor from «doceō»)" },
  { abbr: "CV", latin: "curriculum «vītae#gen.sg»", meaning: "the course of life (genitive -ae)" },
  { abbr: "No.", latin: "«numerō#abl.sg»", meaning: "by number (ablative of «numerus»)" },
  { abbr: "lb, £", latin: "lībra", meaning: "a pound, a pair of scales" },
  { abbr: "&", latin: "«et»", meaning: "and: the two letters written as one" },
  { abbr: "℞", latin: "recipe", meaning: "take!" },
  { abbr: "R.I.P.", latin: "requiēscat in pāce", meaning: "may he or she rest in peace" },
  { abbr: "Q.E.D.", latin: "«quod» erat dēmōnstrandum", meaning: "which was to be shown" },
];

// ---------------------------------------------------------------- phrases

/** Latin English uses every day, with grammar the learner knows (markup). */
export const PHRASES: { la: string; en: string; note?: string }[] = [
  { la: "terra firma", en: "solid ground", note: "The adjective matches its noun: -a, -a." },
  { la: "magnum#nom.sg opus", en: "a great work", note: "«magnus» in the neuter, matching opus." },
  { la: "Magna Carta", en: "the Great Charter (1215)" },
  { la: "alma māter", en: "nourishing mother: your old school or university" },
  { la: "aqua vītae#gen.sg", en: "water of life: strong spirits", note: "Genitive -ae. Whisky is the same phrase in Gaelic." },
  { la: "persōna nōn grāta", en: "an unwelcome person", note: "With your «nōn»." },
  { la: "alter ego", en: "another I" },
  { la: "meā#abl.sg culpā", en: "(through) my fault", note: "Ablative: English writes it mea culpa." },
  { la: "bonā#abl.sg fidē", en: "in good faith", note: "From «bonus»; English writes bona fide." },
  { la: "viā#abl.sg", en: "by way of", note: "The ablative of «via», 'road'; English writes via." },
  { la: "ad hoc", en: "for this (purpose only)" },
  { la: "per sē", en: "by itself" },
  { la: "status quo", en: "the state in which (things are)" },
  { la: "vice versa", en: "the other way round" },
  { la: "deus ex māchinā", en: "a god from the machine: a sudden, too easy rescue" },
  { la: "terra incognita", en: "unknown land" },
  { la: "E plūribus ūnum", en: "out of many, one", note: "On every US coin." },
];

// --------------------------------------------------- Russian and Ukrainian

/** One Latin word in three languages (the learner's words). */
export const THREE_LANGUAGES: { word: string; la: string; en: string; ru: string; uk: string }[] = [
  { word: "studeo", la: "«studeō»", en: "student", ru: "студент", uk: "студент" },
  { word: "lego", la: "«legō» (lēctiō)", en: "lecture", ru: "лекция", uk: "лекція" },
  { word: "doceo", la: "«doceō» (doctor)", en: "doctor", ru: "доктор", uk: "доктор" },
  { word: "schola", la: "«schola»", en: "school", ru: "школа", uk: "школа" },
  { word: "video", la: "«videō»", en: "video", ru: "видео", uk: "відео" },
  { word: "aqua", la: "«aqua»", en: "aquarium", ru: "аквариум", uk: "акваріум" },
  { word: "laboro", la: "«labōrō»", en: "laboratory", ru: "лаборатория", uk: "лабораторія" },
  { word: "porto", la: "«portō»", en: "transport", ru: "транспорт", uk: "транспорт" },
  { word: "terra", la: "«terra»", en: "territory", ru: "территория", uk: "територія" },
  { word: "gladius", la: "«gladius»", en: "gladiator", ru: "гладиатор", uk: "гладіатор" },
  { word: "insula", la: "«īnsula»", en: "insulate", ru: "изоляция", uk: "ізоляція" },
  { word: "magnus", la: "«magnus»", en: "magnate", ru: "магнат", uk: "магнат" },
];

/** What a word gave English: a lesson word's entry here, or a Discover card's relatives. */
export function wordInEnglish(id: string): WordInEnglish | undefined {
  const own = LESSON_WORDS_IN_ENGLISH[id];
  if (own) return own;
  const card = CARD_BY_ID.get(id);
  return card ? { from: card.from, kin: card.kin, note: card.hook } : undefined;
}

/** English words that come from a word, plain enough to quiz ("dormitory" → dormiō). */
export function quizWords(id: string): string[] {
  return (wordInEnglish(id)?.from.en ?? []).filter((w) => /^[a-z]{4,}$/.test(w));
}

/** The site's checked relatives of a word, as a line of facts for Claude: borrowed ones, cousins of the same root, a look-alike to avoid. */
export function relativesFact(e: { id: string; story?: WordStory }): string | undefined {
  const list = (r?: { en?: string[]; ru?: string[]; uk?: string[] }) =>
    r ? [r.en?.length ? `English ${r.en.join(", ")}` : "", r.ru?.length ? `Russian ${r.ru.join(", ")}` : "", r.uk?.length ? `Ukrainian ${r.uk.join(", ")}` : ""].filter(Boolean).join("; ") : "";
  // a word the learner added: what Claude said when it was added (not checked by hand)
  if (e.story) {
    const st = e.story;
    return [
      "The learner added this word themselves; from its card (Claude's notes, not checked by hand):",
      st.origin ? `origin: ${st.origin}` : "",
      st.history ? `history: ${st.history}` : "",
      list(st.from) ? `borrowed from Latin: ${list(st.from)}.` : "",
      list(st.kin) ? `same ancient root, not borrowed: ${list(st.kin)}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }
  const w = wordInEnglish(e.id);
  if (!w) return undefined;
  const from = list(w.from);
  const kin = list(w.kin);
  return [
    "Relatives (checked):",
    from ? `borrowed from Latin: ${from}.` : "",
    kin ? `Same ancient root, not borrowed: ${kin}.` : "",
    w.trap ? `Looks related but is not: ${w.trap}.` : "",
    w.note ? `Note: ${w.note}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
