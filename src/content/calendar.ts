// The Roman year the people of the messenger live through, in real time: the
// festivals on their days (every year), the friends' birthdays, and what
// happens in Rome as Trajan's reign goes on (2026 is AD 100, so next spring
// Trajan leaves for the Dacian war). Dates are the days Rome hears of an event;
// "about" marks a date the sources give only roughly.

/** Real year minus this = the year AD the people live in. */
export const YEAR_OFFSET = 1926;

export interface Festival {
  /** First and last day: [month 1-12, day]. */
  from: [number, number];
  to?: [number, number];
  /** Its Latin name, as shown. */
  la: string;
  en: string;
  /** What people do, for Claude. */
  what: string;
  /** Single words people may write while it is near (names, a cheer), besides their own words. */
  words: string[];
}

export const FESTIVALS: Festival[] = [
  { from: [1, 1], la: "Kalendae Iānuāriae", en: "the Kalends of January", what: "New Year: the new consuls take office, people give each other honey, dates, figs and coins (strēnae) and wish each other luck; the first words of the year are meant to be good ones", words: ["Kalendae"] },
  { from: [2, 13], to: [2, 21], la: "Parentālia", en: "the Parentalia", what: "days for the family's dead: temples close, families bring flowers, bread and wine to the tombs; quiet days", words: ["Parentālia"] },
  { from: [2, 15], la: "Lupercālia", en: "the Lupercalia", what: "young men in goatskins run round the Palatine striking women with strips of goat hide, for luck and children; a wild, noisy, laughing day", words: ["Lupercālia"] },
  { from: [2, 22], la: "Cāristia", en: "the Caristia", what: "a family dinner where quarrels are made up", words: ["Cāristia"] },
  { from: [3, 1], la: "Mātrōnālia", en: "the Matronalia", what: "the women's festival (and the old New Year): husbands give their wives gifts, mistresses serve their slave women a meal", words: ["Mātrōnālia"] },
  { from: [3, 15], la: "Anna Perenna", en: "the feast of Anna Perenna", what: "a picnic by the Tiber on the Ides of March: people drink one cup for each year they hope to live, sing and come home tipsy", words: ["Anna", "Perenna"] },
  { from: [3, 19], to: [3, 23], la: "Quīnquātrūs", en: "the Quinquatrus", what: "Minerva's festival: schools are on holiday, and pupils bring their teacher the year's fee", words: ["Quīnquātrūs", "Minerva"] },
  { from: [4, 4], to: [4, 10], la: "Megalēnsia", en: "the Megalesia", what: "games and plays for the Great Mother, with her priests dancing in the streets to drums", words: ["Megalēnsia"] },
  { from: [4, 12], to: [4, 19], la: "Cereālia", en: "the Cerealia", what: "Ceres' festival: races in the Circus, white clothes, foxes with torches let loose", words: ["Cereālia", "Cerēs"] },
  { from: [4, 21], la: "Parīlia", en: "the Parilia", what: "Rome's birthday: shepherds clean their flocks with smoke and jump over bonfires; everyone feasts outdoors", words: ["Parīlia"] },
  { from: [4, 23], la: "Vīnālia", en: "the Vinalia", what: "last year's wine is opened, its first cup for Jupiter", words: ["Vīnālia"] },
  { from: [4, 28], to: [5, 3], la: "Flōrālia", en: "the Floralia", what: "flowers everywhere, bright clothes, merry and saucy plays, games with hares and goats", words: ["Flōrālia", "Flōra"] },
  { from: [5, 9], to: [5, 13], la: "Lemūria", en: "the Lemuria", what: "the ghosts of the dead walk: at midnight the father throws black beans over his shoulder to send them away", words: ["Lemūria"] },
  { from: [6, 9], la: "Vestālia", en: "the Vestalia", what: "the bakers' holiday: millstones and donkeys wear garlands of flowers and little loaves", words: ["Vestālia", "Vesta"] },
  { from: [6, 24], la: "Fors Fortūna", en: "the feast of Fors Fortuna", what: "boat trips down the Tiber with flowers and drinking", words: ["Fortūna"] },
  { from: [7, 6], to: [7, 13], la: "Lūdī Apollinārēs", en: "the Games of Apollo", what: "plays and races for Apollo, the god of poets", words: ["Lūdī", "Apollō"] },
  { from: [8, 13], la: "Nemorālia", en: "Diana's day", what: "a holiday for slaves; women wash their hair; torches at Lake Nemi", words: ["Nemorālia", "Diāna"] },
  { from: [8, 19], la: "Vīnālia Rūstica", en: "the country Vinalia", what: "the grape harvest begins", words: ["Vīnālia"] },
  { from: [8, 23], la: "Volcānālia", en: "the Volcanalia", what: "little fish thrown into fires for Vulcan, against fires in the dry season", words: ["Volcānālia"] },
  { from: [9, 5], to: [9, 19], la: "Lūdī Rōmānī", en: "the Roman Games", what: "the great games: chariot races in the Circus Maximus and plays; the whole city goes", words: ["Lūdī", "Circus"] },
  { from: [10, 11], la: "Meditrīnālia", en: "the Meditrinalia", what: "the new wine is tasted, mixed with old, for health", words: ["Meditrīnālia"] },
  { from: [10, 12], la: "Augustālia", en: "the Augustalia", what: "the last day of the games for Augustus", words: ["Augustālia", "Augustus"] },
  { from: [10, 13], la: "Fontinālia", en: "the Fontinalia", what: "garlands thrown into springs and wells", words: ["Fontinālia"] },
  { from: [10, 15], la: "Equus Octōber", en: "the October Horse", what: "a chariot race on the Field of Mars; the right-hand horse of the winning team is sacrificed to Mars and two quarters of Rome fight over its head", words: ["Mārs"] },
  { from: [10, 19], la: "Armilustrium", en: "the Armilustrium", what: "the soldiers' weapons are purified and put away for the winter", words: ["Armilustrium"] },
  { from: [11, 4], to: [11, 17], la: "Lūdī Plēbēiī", en: "the Plebeian Games", what: "games of the people: plays and races", words: ["Lūdī"] },
  { from: [12, 17], to: [12, 23], la: "Sāturnālia", en: "the Saturnalia", what: "the merriest days of the year: gifts (candles, little clay figures), dice allowed, masters serve their slaves, a mock king at every party, and everyone shouts «Iō Sāturnālia!»", words: ["Sāturnālia", "iō"] },
];

/** The friends' birthdays: [month, day]. */
export const BIRTHDAYS: Record<string, [number, number]> = {
  iulia: [5, 2], // in the Floralia
  marcus: [9, 10], // in the Roman Games
  gaius: [4, 21], // on the Parilia, the shepherds' day
  claudia: [3, 20], // in Minerva's festival, the teachers' days
  lucius: [7, 8], // in the Games of Apollo, the poets' god
};

export interface HistoryEvent {
  /** Year AD, month, day (when Rome hears of it). */
  year: number;
  month: number;
  day: number;
  en: string;
  /** Known before it happens (a festival of state, a departure, an opening): talked about as coming. */
  planned?: boolean;
  /** Names it brings into talk, allowed as names while it is news: [name, gender, English]. */
  names?: [string, "m" | "f", string][];
}

const TRAJAN: [string, "m" | "f", string] = ["Trāiānus", "m", "Trajan (the emperor)"];
const DACIA: [string, "m" | "f", string] = ["Dācia", "f", "Dacia (the land beyond the Danube)"];
const DECEBALUS: [string, "m" | "f", string] = ["Decebalus", "m", "Decebalus (king of the Dacians)"];

export const HISTORY: HistoryEvent[] = [
  { year: 100, month: 1, day: 1, planned: true, en: "Trajan becomes consul for the third time, with old Frontinus, the water commissioner, as his colleague", names: [TRAJAN, ["Frontīnus", "m", "Frontinus (consul)"]] },
  { year: 100, month: 1, day: 20, en: "in the Senate Pliny the Younger and Tacitus prosecute Marius Priscus, a governor of Africa who took bribes; he is condemned (about this date)", names: [["Plīnius", "m", "Pliny (a senator and writer)"], ["Tacitus", "m", "Tacitus (a senator and historian)"]] },
  { year: 100, month: 6, day: 1, en: "Trajan founds a colony for veterans in Africa, Thamugadi (about this date)", names: [TRAJAN] },
  { year: 100, month: 9, day: 1, planned: true, en: "Pliny the Younger, consul for September and October, thanks Trajan in the Senate with a very long speech (the Panegyricus); people joke about its length", names: [["Plīnius", "m", "Pliny (consul)"], TRAJAN] },
  { year: 100, month: 11, day: 1, en: "talk in Rome of the Dacian king Decebalus, who grows strong beyond the Danube and keeps the money Domitian paid him; people expect war (about this date)", names: [DECEBALUS, DACIA, TRAJAN] },
  { year: 101, month: 1, day: 1, planned: true, en: "Trajan becomes consul for the fourth time; soldiers march north towards the Danube", names: [TRAJAN] },
  { year: 101, month: 3, day: 25, planned: true, en: "Trajan leaves Rome for the war against Decebalus of Dacia; the Arval priests pray for his safe return", names: [TRAJAN, DECEBALUS, DACIA] },
  { year: 101, month: 10, day: 1, en: "news from the Danube: Trajan has beaten the Dacians at Tapae, in a battle fought in a storm (about this date)", names: [TRAJAN, DACIA, ["Tapae", "f", "Tapae (a battlefield in Dacia)"]] },
  { year: 102, month: 2, day: 1, en: "the Dacians and their allies crossed the frozen Danube into Moesia; Trajan drove them back after hard fighting (about this date)", names: [TRAJAN, DACIA] },
  { year: 102, month: 10, day: 1, en: "Decebalus asks for peace and accepts Trajan's terms (about this date)", names: [DECEBALUS, TRAJAN] },
  { year: 102, month: 12, day: 15, planned: true, en: "Trajan comes home and celebrates a triumph over the Dacians, and takes the name Dacicus (about this date)", names: [TRAJAN, DACIA] },
  { year: 103, month: 6, day: 1, en: "Apollodorus of Damascus begins a great stone bridge over the Danube for Trajan (about this date)", names: [TRAJAN, ["Apollodōrus", "m", "Apollodorus (an architect)"]] },
  { year: 104, month: 6, day: 1, en: "a fire destroys what was left of Nero's Golden House on the Esquiline (about this date)", names: [["Nerō", "m", "Nero (the emperor long ago)"]] },
  { year: 105, month: 6, day: 4, planned: true, en: "Trajan leaves Rome again: Decebalus broke the peace, and a second Dacian war begins", names: [TRAJAN, DECEBALUS, DACIA] },
  { year: 106, month: 3, day: 22, en: "Arabia, the land of Petra, becomes a Roman province", names: [["Arabia", "f", "Arabia"]] },
  { year: 106, month: 8, day: 15, en: "the Dacian capital Sarmizegetusa has fallen; Decebalus killed himself rather than be taken; Dacia is a province now, full of gold (about this date)", names: [TRAJAN, DECEBALUS, DACIA] },
  { year: 107, month: 6, day: 1, planned: true, en: "Trajan's victory games begin: 123 days, ten thousand gladiators, eleven thousand animals (about this date)", names: [TRAJAN] },
  { year: 109, month: 6, day: 22, planned: true, en: "Trajan opens his great baths on the Esquiline", names: [TRAJAN] },
  { year: 109, month: 6, day: 24, planned: true, en: "the new aqueduct, the Aqua Traiana, brings fresh water to the Janiculum", names: [TRAJAN] },
  { year: 112, month: 1, day: 1, planned: true, en: "Trajan's Forum is dedicated, with the Basilica Ulpia and its two libraries", names: [TRAJAN] },
  { year: 113, month: 5, day: 12, planned: true, en: "Trajan's Column is dedicated: a spiral of pictures of the Dacian wars, as tall as the hill dug away for the Forum", names: [TRAJAN, DACIA] },
  { year: 113, month: 10, day: 27, planned: true, en: "Trajan leaves Rome for the East: war with Parthia", names: [TRAJAN, ["Parthia", "f", "Parthia"]] },
  { year: 116, month: 2, day: 20, en: "Trajan has reached the Persian Gulf; the Senate names him Parthicus (about this date)", names: [TRAJAN, ["Parthia", "f", "Parthia"]] },
  { year: 117, month: 8, day: 11, en: "Trajan has died at Selinus in Cilicia; Hadrian is the new emperor", names: [TRAJAN, ["Hadriānus", "m", "Hadrian (the new emperor)"]] },
];

/** What a year is like in Rome, besides the news of the day. */
export const YEARS: Record<number, string> = {
  100: "Rome is at peace and Trajan is popular; a huge new harbour is being dug at Portus, beside Ostia, and there is building everywhere",
  101: "Trajan and the legions are away at war in Dacia",
  102: "the Dacian war goes on until peace in the autumn",
  103: "peace; the bridge over the Danube is being built",
  104: "peace, and building in Rome",
  105: "the second Dacian war",
  106: "the end of the Dacian wars",
  107: "Rome celebrates the victory over Dacia with games",
};
