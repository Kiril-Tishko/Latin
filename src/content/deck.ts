// Discover deck: Latin words with relatives in English, Russian or Ukrainian.
//   from: words borrowed from this Latin word (directly or via French, Italian, Greek…)
//   kin:  words that grew from the same ancient (Indo-European) root, not borrowed
// Cards are listed in the order they are offered. Each word carries full
// grammar, so once added to the dictionary it can be used in exercises.
import { adj, noun, verb } from "../latin/morph";
import { EnVerb, Entry, Gender } from "../latin/types";

export interface Relatives {
  en?: string[];
  ru?: string[];
  uk?: string[];
}

export interface Card {
  id: string;
  entry: Entry;
  from: Relatives;
  kin: Relatives;
  /** How to remember it. */
  hook: string;
}

interface Opts {
  alt?: (string | EnVerb)[];
  tags?: string[];
  from?: Relatives;
  kin?: Relatives;
  hook: string;
  id?: string;
  trans?: boolean;
  intrans?: boolean;
  shortImp?: boolean;
  en?: { s?: string; ing?: string; past?: string; pp?: string; particle?: string };
  enPl?: string;
  note?: string;
  iStem?: boolean;
}

const DECK = { deck: true } as const;

const strings = (xs?: (string | EnVerb)[]) => xs?.map((x) => (typeof x === "string" ? x : x.base));

/** n("aqua, aquae, f", "water", {...}) */
function n(dict: string, en: string, o: Opts): Card {
  const [lemma, gen, g] = dict.split(",").map((s) => s.trim());
  const entry = noun(lemma, gen, g.replace(".", "") as Gender, { id: o.id, en, alt: strings(o.alt), tags: o.tags, enPl: o.enPl, note: o.note, iStem: o.iStem }, DECK);
  return { id: entry.id, entry, from: o.from ?? {}, kin: o.kin ?? {}, hook: o.hook };
}

/** v("portō, portāre, portāvī, portātum", "carry", {...}) */
function v(dict: string, en: string, o: Opts): Card {
  const entry = verb(dict, { id: o.id, en: { base: en, ...o.en }, alt: o.alt, tags: o.tags, trans: o.trans, intrans: o.intrans, shortImp: o.shortImp, note: o.note }, DECK);
  return { id: entry.id, entry, from: o.from ?? {}, kin: o.kin ?? {}, hook: o.hook };
}

/** a("bonus, bona, bonum", "good", {...}) */
function a(dict: string, en: string, o: Opts): Card {
  const [m, f, nt] = dict.split(",").map((s) => s.trim());
  const entry = adj(m, f, nt, { id: o.id, en, alt: strings(o.alt), tags: o.tags, note: o.note }, DECK);
  return { id: entry.id, entry, from: o.from ?? {}, kin: o.kin ?? {}, hook: o.hook };
}

export const CARDS: Card[] = [
  n("ventus, ventī, m", "wind", {
    tags: ["weather", "unseen"],
    from: { en: ["vent", "ventilate"], ru: ["вентилятор", "вентиляция"], uk: ["вентилятор", "вентиляція"] },
    kin: { en: ["wind"], ru: ["ветер"], uk: ["вітер"] },
    hook: "A вентилятор makes ventus. And ventus, ветер, вітер and wind are one ancient word.",
  }),
  n("oculus, oculī, m", "eye", {
    tags: ["body", "thing"],
    from: { en: ["ocular", "binoculars"], ru: ["окуляр"], uk: ["окуляри"] },
    kin: { ru: ["око", "очи"], uk: ["око", "очі"] },
    hook: "Ukrainian окуляри (glasses) come straight from oculus: things for the eyes. Око is its ancient cousin.",
  }),
  n("lūna, lūnae, f", "moon", {
    tags: ["nature", "thing", "sky"],
    from: { en: ["lunar", "lunatic"] },
    kin: { ru: ["луна"], uk: ["луна (echo)"] },
    hook: "Луна! Latin and Russian kept the same old word for 'the shining one'. In Ukrainian луна drifted to mean an echo.",
  }),
  n("nāsus, nāsī, m", "nose", {
    tags: ["body", "thing", "long"],
    from: { en: ["nasal"] },
    kin: { en: ["nose"], ru: ["нос"], uk: ["ніс"] },
    hook: "nāsus, нос, ніс, nose: the same word in four languages. Nasal sounds come through the nose.",
  }),
  v("sedeō, sedēre, sēdī, sessum", "sit", {
    en: { ing: "sitting", past: "sat", pp: "sat" },
    from: { en: ["sediment", "session", "president"] },
    kin: { en: ["sit"], ru: ["сидеть"], uk: ["сидіти"] },
    hook: "sedeō ~ сидеть / сидіти ~ sit. A president is the one who 'sits in front' (prae-sidet).",
  }),
  a("novus, nova, novum", "new", {
    tags: ["thing", "place", "person"],
    from: { en: ["novel", "novice", "renovate"], ru: ["новелла"], uk: ["новела"] },
    kin: { en: ["new"], ru: ["новый"], uk: ["новий"] },
    hook: "novus = новый / новий = new. A novice is new at something; a novel was once 'a new story'.",
  }),
  n("dōnum, dōnī, n", "gift", {
    tags: ["thing"],
    from: { en: ["donation", "donor"], ru: ["донор"], uk: ["донор"] },
    kin: { ru: ["дар", "дать"], uk: ["дар", "дати"] },
    hook: "A донор gives a dōnum. dōnum and дар both come from the ancient verb 'to give' (дать / дати).",
  }),
  v("stō, stāre, stetī, statum", "stand", {
    en: { past: "stood", pp: "stood" },
    from: { en: ["station", "status", "stable"], ru: ["станция", "статус"], uk: ["станція", "статус"] },
    kin: { en: ["stand"], ru: ["стоять"], uk: ["стояти"] },
    hook: "stō ~ стою / стою ~ stand. A станция is where trains stand.",
  }),
  n("fūmus, fūmī, m", "smoke", {
    tags: ["nature", "thing", "mass"],
    from: { en: ["fume", "fumigate"] },
    kin: { ru: ["дым"], uk: ["дим"] },
    hook: "fūmus and дым / дим are the same ancient word (Latin f often matches Slavic д). Fumes are smoky.",
  }),
  v("amō, amāre, amāvī, amātum", "love", {
    trans: true,
    alt: ["like"],
    from: { en: ["amateur", "amorous"], ru: ["амур", "амурный"], uk: ["амур"] },
    hook: "An amateur does it for love. Amor (Амур) is the god of love. Amō, amās, amat: the classic first verb.",
  }),
  n("via, viae, f", "road", {
    alt: ["way", "street", "path"],
    tags: ["place", "long", "public"],
    from: { en: ["via", "viaduct", "trivia"], ru: ["виадук"], uk: ["віадук"] },
    kin: { en: ["way"], ru: ["везти"], uk: ["везти"] },
    hook: "Trivia: tri-via, the place where three roads meet and people gossip. A виадук carries the road.",
  }),
  a("vīvus, vīva, vīvum", "alive", {
    alt: ["living"],
    tags: ["person", "animal"],
    from: { en: ["vivid", "vivacious"] },
    kin: { ru: ["живой"], uk: ["живий"] },
    hook: "vīvus ~ живой / живий: the same ancient root. Vivid colors look alive.",
  }),
  n("vīta, vītae, f", "life", {
    tags: ["abstract", "mass", "unseen", "beauty"],
    from: { en: ["vital", "vitamin"], ru: ["витамин"], uk: ["вітамін"] },
    kin: { ru: ["жизнь"], uk: ["життя"] },
    hook: "Витамины = 'amines of life'. Vital signs show there is vīta.",
  }),
  v("audiō, audīre, audīvī, audītum", "hear", {
    trans: true,
    intrans: true,
    alt: [{ base: "listen", particle: "to" }],
    from: { en: ["audio", "audience", "auditorium"], ru: ["аудио", "аудитория"], uk: ["аудіо", "аудиторія"] },
    hook: "An аудитория is a room for listening. Audio is literally 'I hear'.",
  }),
  n("rosa, rosae, f", "rose", {
    tags: ["nature", "thing", "plant"],
    from: { en: ["rose", "rosary"], ru: ["роза"], uk: ["роза"] },
    hook: "Роза is simply rosa. The textbook word every Latin student meets first.",
  }),
  v("cantō, cantāre, cantāvī, cantātum", "sing", {
    en: { past: "sang", pp: "sung" },
    trans: true,
    intrans: true,
    from: { en: ["chant", "cantata", "cantor"], ru: ["кантата"], uk: ["кантата"] },
    hook: "A кантата is a piece to be sung. Chant comes from cantō through French.",
  }),
  n("medicus, medicī, m", "doctor", {
    alt: ["physician", "medic"],
    tags: ["person"],
    from: { en: ["medic", "medical", "medicine"], ru: ["медик", "медицина"], uk: ["медик", "медицина"] },
    hook: "Медик = medicus. The doctor of ancient Rome.",
  }),
  a("bonus, bona, bonum", "good", {
    tags: ["person", "animal", "place", "thing", "mass", "beauty"],
    from: { en: ["bonus", "bonanza"], ru: ["бонус"], uk: ["бонус"] },
    hook: "A бонус is 'something good' on top. Bona fide = in good faith.",
  }),
  n("numerus, numerī, m", "number", {
    tags: ["abstract"],
    from: { en: ["number", "numeral", "numerous"], ru: ["номер"], uk: ["номер"] },
    hook: "Номер is numerus that travelled through French (numéro).",
  }),
  v("vocō, vocāre, vocāvī, vocātum", "call", {
    trans: true,
    from: { en: ["vocal", "vocation", "advocate"], ru: ["вокал", "адвокат"], uk: ["вокал", "адвокат"] },
    hook: "An адвокат is someone 'called to' (ad-vocātus) help you. Вокал uses the voice.",
  }),
  n("locus, locī, m", "place", {
    alt: ["spot"],
    tags: ["place", "vague"],
    from: { en: ["local", "location", "locomotive"], ru: ["локация", "локомотив"], uk: ["локація", "локомотив"] },
    hook: "A локомотив moves 'from its place' (locō mōtīvus). Location, local: all about places.",
  }),
  a("plēnus, plēna, plēnum", "full", {
    tags: ["thing"],
    from: { en: ["plenty", "plenary"], ru: ["пленум", "пленарный"], uk: ["пленарний"] },
    kin: { en: ["full"], ru: ["полный"], uk: ["повний"] },
    hook: "plēnus ~ полный / повний ~ full: one ancient word. A пленарное заседание is the full meeting.",
  }),
  n("oleum, oleī, n", "oil", {
    tags: ["thing", "mass"],
    from: { en: ["oil"], uk: ["олія"] },
    kin: { ru: ["елей"] },
    hook: "Ukrainian олія came from oleum through Polish (olej). Russian елей is the same Greek word.",
  }),
  n("signum, signī, n", "sign", {
    alt: ["signal", "mark"],
    tags: ["thing"],
    from: { en: ["sign", "signal", "signature"], ru: ["сигнал"], uk: ["сигнал"] },
    hook: "A сигнал is a signum. Your signature is your sign.",
  }),
  v("moveō, movēre, mōvī, mōtum", "move", {
    trans: true,
    intrans: true,
    from: { en: ["move", "motor", "motive"], ru: ["мотор", "мотив"], uk: ["мотор", "мотив"] },
    hook: "A мотор moves things; a мотив moves you to act. Both from mōtum, a form of moveō.",
  }),
  n("dominus, dominī, m", "master", {
    alt: ["lord", "owner"],
    tags: ["person"],
    from: { en: ["dominate", "domino", "dominion"], ru: ["доминировать", "домино"], uk: ["домінувати", "доміно"] },
    kin: { ru: ["дом"], uk: ["дім"] },
    hook: "The dominus is the master of the house (domus ~ дом / дім). Dominate = act like the master.",
  }),
  a("vērus, vēra, vērum", "true", {
    alt: ["real"],
    tags: ["story", "friend"],
    from: { en: ["very", "verify", "verdict"] },
    kin: { ru: ["вера"], uk: ["віра"] },
    hook: "vērus ~ вера / віра: what you believe is 'true'. A verdict is a 'true saying' (vērē dictum).",
  }),
  n("theātrum, theātrī, n", "theater", {
    alt: ["theatre"],
    tags: ["place", "building", "public"],
    from: { en: ["theater"], ru: ["театр"], uk: ["театр"] },
    hook: "Театр is theātrum, a Greek word the Romans borrowed.",
  }),
  v("teneō, tenēre, tenuī, tentum", "hold", {
    trans: true,
    en: { past: "held", pp: "held" },
    alt: ["keep"],
    from: { en: ["tenant", "tenacious", "tennis"], ru: ["теннис"], uk: ["теніс"] },
    hook: "Tennis: the server shouted 'Tenez!' (hold! take it!), from teneō. A tenant holds a flat.",
  }),
  n("vidua, viduae, f", "widow", {
    tags: ["person"],
    kin: { en: ["widow"], ru: ["вдова"], uk: ["вдова"] },
    hook: "vidua, вдова, widow: inherited, not borrowed. The word is older than all three languages.",
  }),
  n("campus, campī, m", "field", {
    alt: ["plain"],
    tags: ["place", "nature"],
    from: { en: ["campus", "camp", "campaign"], ru: ["кампания", "кемпинг"], uk: ["кампанія", "кемпінг"] },
    hook: "A кампания was first a military 'season in the field'. A campus is the university's field.",
  }),
  a("multus, multa, multum", "much", {
    tags: ["mass"],
    alt: ["many", "a lot of"],
    from: { en: ["multi-", "multiply", "multitude"], ru: ["мультфильм"], uk: ["мультфільм"] },
    hook: "Мультфильм comes from 'multiplication': many drawings multiplied into motion. multus = many.",
  }),
  v("dēleō, dēlēre, dēlēvī, dēlētum", "destroy", {
    trans: true,
    alt: ["delete", "erase", { base: "wipe", particle: "out" }],
    from: { en: ["delete"] },
    hook: "The Delete key. Carthāgō dēlenda est: Carthage must be destroyed.",
  }),
  n("hortus, hortī, m", "garden", {
    tags: ["place", "nature"],
    from: { en: ["horticulture"] },
    kin: { en: ["garden", "yard"], ru: ["огород", "город"], uk: ["город (vegetable garden)"] },
    hook: "hortus, огород and garden share the ancient root 'to fence in'. In Ukrainian a город is still the vegetable garden.",
  }),
  v("vīvō, vīvere, vīxī, vīctum", "live", {
    alt: ["be alive"],
    from: { en: ["survive", "vivid", "revive"] },
    kin: { ru: ["жить"], uk: ["жити"] },
    hook: "vīvō ~ живу / живу: Latin v and Slavic ж from the same ancient sound. Survive = live on.",
  }),
  n("globus, globī, m", "ball", {
    alt: ["sphere", "globe"],
    tags: ["thing"],
    from: { en: ["globe", "global"], ru: ["глобус"], uk: ["глобус"] },
    hook: "Глобус: the ball of the world.",
  }),
  a("tōtus, tōta, tōtum", "whole", {
    tags: ["thing", "place", "mass"],
    alt: ["entire", "all"],
    from: { en: ["total"], ru: ["тотальный"], uk: ["тотальний"] },
    hook: "Total = the whole thing. Тотальный контроль controls everything.",
  }),
  n("focus, focī, m", "hearth", {
    alt: ["fireplace"],
    tags: ["building"],
    from: { en: ["focus", "fuel"], ru: ["фокус"], uk: ["фокус"] },
    hook: "The focus was the fireplace, the centre of a Roman home, where everything converged. Фокус!",
  }),
  v("dīcō, dīcere, dīxī, dictum", "say", {
    trans: true,
    intrans: false,
    shortImp: true,
    en: { s: "says", past: "said", pp: "said" },
    alt: ["tell", "speak"],
    from: { en: ["dictate", "predict", "dictionary"], ru: ["диктант", "диктатор"], uk: ["диктант", "диктатор"] },
    hook: "In a диктант the teacher says (dictat) and you write. A диктатор is the one whose word is law.",
  }),
  n("radius, radiī, m", "ray", {
    alt: ["spoke", "beam"],
    tags: ["light"],
    from: { en: ["radius", "radio", "radiation"], ru: ["радиус", "радио"], uk: ["радіус", "радіо"] },
    hook: "A radius was the spoke of a wheel, a ray from the centre. Радио sends rays.",
  }),
  a("antīquus, antīqua, antīquum", "old", {
    alt: ["ancient", "former"],
    tags: ["thing", "place", "person"],
    from: { en: ["antique", "antiquity"], ru: ["антиквариат"], uk: ["антикваріат"] },
    hook: "Антиквариат: old things. Antīquus is old in the noble sense: ancient.",
  }),
  v("dūcō, dūcere, dūxī, ductum", "lead", {
    trans: true,
    shortImp: true,
    en: { past: "led", pp: "led" },
    alt: ["guide", "take"],
    from: { en: ["duke", "conduct", "produce", "aqueduct"], ru: ["акведук", "продукт"], uk: ["акведук", "продукт"] },
    hook: "An акведук 'leads water'. A duke (dux) leads.",
  }),
  n("stilus, stilī, m", "pen", {
    alt: ["stylus", "writing stick"],
    tags: ["thing", "tool", "long"],
    from: { en: ["style", "stylus"], ru: ["стиль"], uk: ["стиль"] },
    hook: "Romans wrote on wax with a stilus; the way you wrote became your style (стиль).",
  }),
  v("mittō, mittere, mīsī, missum", "send", {
    trans: true,
    en: { ing: "sending", past: "sent", pp: "sent" },
    from: { en: ["mission", "missile", "transmit"], ru: ["миссия"], uk: ["місія"] },
    hook: "A миссия is a 'sending'. A missile is something sent flying.",
  }),
  a("albus, alba, album", "white", {
    tags: ["thing", "animal", "plant"],
    from: { en: ["album", "albino"], ru: ["альбом"], uk: ["альбом"] },
    hook: "An album was a white board for notices. Your альбом still starts with white pages.",
  }),
  n("circus, circī, m", "circle", {
    alt: ["ring", "racetrack"],
    tags: ["abstract"],
    from: { en: ["circus", "circle", "circuit"], ru: ["цирк"], uk: ["цирк"] },
    hook: "The Circus Maximus was a giant ring for chariot races. Цирк kept the name.",
  }),
  v("currō, currere, cucurrī, cursum", "run", {
    en: { ing: "running", past: "ran", pp: "run" },
    tags: ["motion"],
    from: { en: ["current", "courier", "course", "cursor"], ru: ["курьер", "курсор", "курс"], uk: ["кур'єр", "курсор", "курс"] },
    hook: "A курьер runs with your parcel. The курсор runs across the screen.",
  }),
  n("fēmina, fēminae, f", "woman", {
    tags: ["person"],
    enPl: "women",
    from: { en: ["feminine", "female"], ru: ["феминизм"], uk: ["фемінізм"] },
    hook: "Feminine, феминизм: fēmina is the woman.",
  }),
  a("sōlus, sōla, sōlum", "alone", {
    alt: ["only", "lonely"],
    tags: ["person", "animal"],
    from: { en: ["solo", "solitude", "sole"], ru: ["соло"], uk: ["соло"] },
    hook: "A соло is played alone.",
  }),
  v("fīniō, fīnīre, fīnīvī, fīnītum", "finish", {
    trans: true,
    intrans: false,
    alt: ["end"],
    from: { en: ["finish", "final", "infinite"], ru: ["финиш", "финал"], uk: ["фініш", "фінал"] },
    hook: "Финиш, финал, the end: fīnis is the boundary, fīniō puts an end to it.",
  }),
  n("familia, familiae, f", "family", {
    alt: ["household"],
    tags: ["person", "group"],
    enPl: "families",
    from: { en: ["family", "familiar"], ru: ["фамилия"], uk: ["фамільний"] },
    hook: "Careful: Russian фамилия is the family name (surname), while Latin familia is the whole household, slaves included.",
  }),
  v("creō, creāre, creāvī, creātum", "create", {
    trans: true,
    alt: ["make"],
    from: { en: ["create", "creature"], ru: ["креатив", "креатура"], uk: ["креатив"] },
    hook: "Креатив = creativity. A creature is something created.",
  }),
  n("littera, litterae, f", "letter of the alphabet", {
    alt: ["letter"],
    tags: ["writing", "abstract"],
    from: { en: ["letter", "literature", "literal"], ru: ["литера", "литература"], uk: ["літера", "література"] },
    hook: "Літера is a single littera. Litterae (plural) became literature.",
  }),
  a("pūblicus, pūblica, pūblicum", "public", {
    tags: ["public"],
    alt: ["common"],
    from: { en: ["public", "publish"], ru: ["публика", "публичный"], uk: ["публіка", "публічний"] },
    hook: "Публика is the public. Rēs pūblica (the public thing) gave us the republic.",
  }),
  v("arō, arāre, arāvī, arātum", "plough", {
    trans: true,
    intrans: true,
    alt: ["plow"],
    from: { en: ["arable"] },
    kin: { ru: ["орать (old: to plough)"], uk: ["орати"] },
    hook: "Ukrainian орати is arō: farmers have used the same word for ploughing for millennia. Arable land can be ploughed.",
  }),
  n("tabula, tabulae, f", "board", {
    alt: ["tablet", "table", "plank"],
    tags: ["thing", "writing"],
    from: { en: ["table", "tablet", "tabular"], ru: ["таблица", "табель"], uk: ["таблиця", "табель"] },
    hook: "A Roman tabula was a wax-covered board for writing: this site's namesake. Таблица started as a board.",
  }),
  v("respondeō, respondēre, respondī, respōnsum", "answer", {
    trans: true,
    intrans: true,
    alt: ["reply", "respond"],
    from: { en: ["respond", "response"], ru: ["респондент"], uk: ["респондент"] },
    hook: "A респондент answers a survey.",
  }),
  n("forma, formae, f", "shape", {
    alt: ["form", "beauty"],
    tags: ["abstract", "beauty"],
    from: { en: ["form", "format", "formula"], ru: ["форма"], uk: ["форма"] },
    hook: "Форма is forma. In Latin it also meant beauty: a good shape.",
  }),
  v("trahō, trahere, trāxī, tractum", "pull", {
    trans: true,
    alt: ["drag", "draw"],
    from: { en: ["tractor", "attract", "traction"], ru: ["трактор"], uk: ["трактор"] },
    hook: "A трактор is literally 'a puller'. Attract = pull towards.",
  }),
  n("fābula, fābulae, f", "story", {
    alt: ["fable", "tale"],
    tags: ["writing", "abstract", "long", "story", "unseen", "beauty"],
    from: { en: ["fable", "fabulous"], ru: ["фабула"], uk: ["фабула"] },
    hook: "The фабула of a novel is its story. Fabulous = fit for a fable.",
  }),
  v("texō, texere, texuī, textum", "weave", {
    trans: true,
    intrans: true,
    from: { en: ["text", "textile", "texture"], ru: ["текст", "текстиль"], uk: ["текст", "текстиль"] },
    hook: "A текст is woven out of words, like текстиль out of threads.",
  }),
  n("ōvum, ōvī, n", "egg", {
    tags: ["thing", "food"],
    from: { en: ["oval", "ovum"], ru: ["овал"], uk: ["овал"] },
    hook: "An овал is egg-shaped.",
  }),
  n("verbum, verbī, n", "word", {
    tags: ["writing", "abstract", "long", "story", "beauty"],
    from: { en: ["verb", "verbal", "proverb"], ru: ["вербальный"], uk: ["вербальний"] },
    hook: "Verbal = in words. A verb is 'the word' of the sentence.",
  }),
  a("rārus, rāra, rārum", "rare", {
    tags: ["thing", "animal", "plant"],
    alt: ["scattered"],
    from: { en: ["rare", "rarity"], ru: ["раритет"], uk: ["раритет"] },
    hook: "A раритет is a rare thing.",
  }),
  n("officium, officiī, n", "duty", {
    alt: ["office", "service"],
    tags: ["abstract", "unseen"],
    from: { en: ["office", "official"], ru: ["офис", "офицер"], uk: ["офіс", "офіцер"] },
    hook: "An офис is where you do your officium (duty). An офицер holds one.",
  }),
  v("placeō, placēre, placuī, placitum", "please", {
    intrans: true,
    from: { en: ["please", "placebo", "pleasant"], ru: ["плацебо"], uk: ["плацебо"] },
    hook: "Placebo = 'I will please': a sugar pill that pleases the patient.",
  }),
  n("asinus, asinī, m", "donkey", {
    tags: ["animal"],
    from: { en: ["ass"], ru: ["осёл"], uk: ["осел"] },
    hook: "Осёл / осел came from asinus through Gothic. The animal and its name travelled together.",
  }),
  v("petō, petere, petīvī, petītum", "seek", {
    trans: true,
    alt: [{ base: "ask", particle: "for" }, { base: "head", particle: "for" }, "attack"],
    from: { en: ["petition", "compete", "appetite"], ru: ["петиция", "аппетит"], uk: ["петиція", "апетит"] },
    hook: "Аппетит is 'seeking towards' food. A петиция seeks something.",
  }),
  n("porcus, porcī, m", "pig", {
    tags: ["animal"],
    from: { en: ["pork", "porcupine"] },
    kin: { ru: ["поросёнок"], uk: ["порося"] },
    hook: "porcus ~ поросёнок / порося: the same ancient word for a young pig. Pork came through French.",
  }),
  a("clārus, clāra, clārum", "bright", {
    tags: ["sky", "light"],
    alt: ["clear", "famous"],
    from: { en: ["clear", "clarify"], ru: ["кларнет"], uk: ["кларнет"] },
    hook: "The кларнет was named for its clear (clārus) bright sound.",
  }),
  v("terreō, terrēre, terruī, territum", "frighten", {
    trans: true,
    alt: ["scare", "terrify"],
    from: { en: ["terror", "terrible", "terrify"], ru: ["террор"], uk: ["терор"] },
    hook: "Террор = frightening people. Terrible = 'frightening'.",
  }),
  n("iugum, iugī, n", "yoke", {
    tags: ["thing"],
    from: { en: ["conjugate", "conjugation"] },
    kin: { en: ["yoke"], ru: ["иго"], uk: ["іго"] },
    hook: "Conjugation = verb forms 'yoked together'. Иго and yoke share the root.",
  }),
  v("sentiō, sentīre, sēnsī, sēnsum", "feel", {
    trans: true,
    intrans: true,
    en: { past: "felt", pp: "felt" },
    alt: ["sense", "perceive", "think"],
    from: { en: ["sense", "sentiment", "sensor"], ru: ["сенсор", "сентиментальный"], uk: ["сенсор", "сентиментальний"] },
    hook: "A сенсор feels; a сентиментальный person feels a lot.",
  }),
  n("imperium, imperiī, n", "command", {
    alt: ["power", "empire", "rule"],
    tags: ["abstract", "unseen"],
    from: { en: ["empire", "imperial"], ru: ["империя", "император"], uk: ["імперія", "імператор"] },
    hook: "An империя is the area under one imperium (command).",
  }),
  v("crēdō, crēdere, crēdidī, crēditum", "believe", {
    trans: true,
    intrans: true,
    alt: ["trust"],
    from: { en: ["credit", "credible", "creed"], ru: ["кредит"], uk: ["кредит"] },
    hook: "A bank gives you кредит because it believes (crēdit) you'll pay back.",
  }),
  n("monstrum, monstrī, n", "monster", {
    alt: ["omen", "wonder"],
    tags: ["creature", "thing"],
    from: { en: ["monster", "demonstrate"], ru: ["монстр"], uk: ["монстр"] },
    hook: "A monstrum was a sign or warning from the gods: something they 'showed' (monstrāre).",
  }),
  v("struō, struere, strūxī, strūctum", "build", {
    trans: true,
    en: { past: "built", pp: "built" },
    alt: ["construct", { base: "pile", particle: "up" }],
    from: { en: ["structure", "construct", "instruct"], ru: ["структура", "конструктор"], uk: ["структура", "конструктор"] },
    hook: "A конструктор is a builder. Structure = how it's built.",
  }),
  n("praemium, praemiī, n", "reward", {
    alt: ["prize"],
    tags: ["thing"],
    from: { en: ["premium"], ru: ["премия"], uk: ["премія"] },
    hook: "Премия is your praemium.",
  }),
  a("ruber, rubra, rubrum", "red", {
    tags: ["thing", "plant"],
    from: { en: ["ruby", "rubric"], ru: ["рубин"], uk: ["рубін"] },
    hook: "A рубин is a red stone. Ruber declines like pulcher: rubra, rubrum.",
  }),
  v("tangō, tangere, tetigī, tāctum", "touch", {
    trans: true,
    from: { en: ["tangent", "contact", "tactile"], ru: ["контакт"], uk: ["контакт"] },
    hook: "Контакт = 'touching together'. A tangent just touches the circle.",
  }),
  n("plumbum, plumbī, n", "lead", {
    alt: ["metal"],
    note: "lead, the metal",
    tags: ["thing", "mass"],
    from: { en: ["plumber", "plumb", "Pb"], ru: ["пломба"], uk: ["пломба"] },
    hook: "A пломба was a lead seal (and dental fillings once were lead too). Plumbers worked lead pipes.",
  }),
  v("rumpō, rumpere, rūpī, ruptum", "break", {
    trans: true,
    en: { past: "broke", pp: "broken" },
    alt: ["burst"],
    from: { en: ["rupture", "interrupt", "corrupt"], ru: ["коррупция"], uk: ["корупція"] },
    hook: "Коррупция breaks things completely (cor-ruptiō).",
  }),
  a("prīmus, prīma, prīmum", "first", {
    from: { en: ["prime", "primary", "primate"], ru: ["прима"], uk: ["прима"] },
    hook: "A прима-балерина is the first dancer.",
  }),
  n("centrum, centrī, n", "center", {
    alt: ["centre", "middle"],
    tags: ["place", "thing"],
    from: { en: ["center", "central"], ru: ["центр"], uk: ["центр"] },
    hook: "Центр = centrum, the point where the compass stands.",
  }),
  v("iaciō, iacere, iēcī, iactum", "throw", {
    trans: true,
    en: { past: "threw", pp: "thrown" },
    from: { en: ["project", "inject", "object"], ru: ["проект", "объект", "инъекция"], uk: ["проєкт", "об'єкт", "ін'єкція"] },
    hook: "Проект = 'thrown forward', инъекция = 'thrown in', объект = 'thrown in front of you'.",
  }),
  n("collēgium, collēgiī, n", "association", {
    alt: ["guild", "college"],
    tags: ["person", "place"],
    from: { en: ["college", "colleague"], ru: ["коллега", "колледж"], uk: ["колега", "коледж"] },
    hook: "Your коллега belongs to the same collēgium.",
  }),
  a("prīvātus, prīvāta, prīvātum", "private", {
    tags: ["thing", "place"],
    alt: ["personal"],
    from: { en: ["private"], ru: ["приватный"], uk: ["приватний"] },
    hook: "Приватний / приватный = prīvātus, belonging to a single person.",
  }),
  v("cupiō, cupere, cupīvī, cupītum", "desire", {
    trans: true,
    alt: ["want", { base: "long", particle: "for" }],
    from: { en: ["Cupid", "cupidity"], ru: ["купидон"], uk: ["купідон"] },
    hook: "Купидон (Cupid) is Desire itself.",
  }),
  n("līlium, līliī, n", "lily", {
    tags: ["nature", "thing", "plant"],
    from: { en: ["lily"], ru: ["лилия"], uk: ["лілія"] },
    hook: "Лилия / лілія = līlium.",
  }),
  v("cognōscō, cognōscere, cognōvī, cognitum", "get to know", {
    trans: true,
    alt: ["learn", "recognize", { base: "find", particle: "out", past: "found" }],
    en: { s: "gets to know", ing: "getting to know", past: "got to know" },
    from: { en: ["cognition", "recognize"] },
    kin: { en: ["know"], ru: ["знать"], uk: ["знати"] },
    hook: "The -gnō- in cognōscō, the зна- in знать / знати and English know are one ancient root.",
  }),
  a("hūmānus, hūmāna, hūmānum", "human", {
    alt: ["kind", "humane"],
    tags: ["person"],
    from: { en: ["human", "humane"], ru: ["гуманный"], uk: ["гуманний"] },
    hook: "Гуманный = humane, behaving as a human should.",
  }),
  n("exemplum, exemplī, n", "example", {
    alt: ["sample", "model"],
    tags: ["thing", "abstract"],
    from: { en: ["example", "exemplary"], ru: ["экземпляр"], uk: ["екземпляр"] },
    hook: "Экземпляр = one example of a book.",
  }),
  v("moneō, monēre, monuī, monitum", "warn", {
    trans: true,
    alt: ["remind", "advise"],
    from: { en: ["monitor", "admonish"], ru: ["монитор"], uk: ["монітор"] },
    hook: "A монитор warns you of what's happening.",
  }),
];

/** Cards in deck order. */
export const DECK_CARDS: Card[] = CARDS;

export const CARD_BY_ID = new Map(DECK_CARDS.map((c) => [c.id, c]));
