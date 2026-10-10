// Famous Latin sayings, each linked to the learner's words it shows. The Words
// dialog and Discover cards show a word's saying. Forms the colorer could
// misread carry a #case.number hint (see CLAUDE.md conventions).

export interface Saying {
  la: string;
  en: string;
  /** Who said it, or where it comes from. */
  source: string;
  /** Word ids (lesson words and Discover cards) the saying illustrates. */
  words: string[];
  /** A short note linking it to what the learner knows. */
  note?: string;
}

export const SAYINGS: Saying[] = [
  // ------------------------------------------------------------ lesson words
  { la: "Quī docet discit.", en: "He who teaches, learns.", source: "proverb", words: ["qui", "doceo", "disco"] },
  { la: "Docendō discimus.", en: "We learn by teaching.", source: "proverb, after Seneca", words: ["doceo", "disco"], note: "discimus: 'we learn' (-mus means 'we')." },
  {
    la: "Nōn scholae#dat.sg sed vītae#dat.sg discimus.",
    en: "We learn not for school but for life.",
    source: "after Seneca, Letters 106",
    words: ["schola", "disco", "non", "sed", "vita"],
    note: "Seneca wrote it the other way round, as a complaint about schools.",
  },
  { la: "In vīnō vēritās.", en: "In wine there is truth.", source: "proverb", words: ["vinum", "in-prep", "verus"], note: "vīnō: ablative after in, the 'where' of Lesson IV." },
  { la: "In vīnō vēritās, in aquā sānitās.", en: "In wine there is truth, in water there is health.", source: "proverb", words: ["aqua", "vinum", "in-prep"] },
  { la: "Nunc est bibendum.", en: "Now we must drink.", source: "Horace, Odes 1.37", words: ["nunc", "bibo"] },
  { la: "Ars longa, vīta brevis.", en: "Art is long, life is short.", source: "after Hippocrates", words: ["longus", "vita"] },
  { la: "Vēnī, vīdī, vīcī.", en: "I came, I saw, I conquered.", source: "Julius Caesar", words: ["video"], note: "vīdī: 'I saw', the past of videō." },
  { la: "Verba volant, scrīpta manent.", en: "Spoken words fly away, written ones stay.", source: "proverb", words: ["verbum", "scribo"], note: "scrīpta: 'written things', from scrībō." },
  { la: "Littera scrīpta manet.", en: "The written letter remains.", source: "proverb", words: ["littera", "scribo"] },
  { la: "Tolle, lege.", en: "Pick it up and read.", source: "Augustine, Confessions 8.12", words: ["lego"], note: "lege: 'read!', a command." },
  { la: "Ōrā et labōrā.", en: "Pray and work.", source: "motto of the Benedictine monks", words: ["laboro", "et"], note: "labōrā: 'work!', a command." },
  { la: "Labor omnia vincit.", en: "Work conquers everything.", source: "after Virgil, Georgics 1.145", words: ["laboro"], note: "labor: 'work', the noun behind labōrō." },
  { la: "Et tū, Brūte?", en: "You too, Brutus?", source: "Shakespeare, Julius Caesar", words: ["et", "tu"] },
  { la: "Ego sum via et vēritās et vīta.", en: "I am the way, the truth and the life.", source: "John 14:6", words: ["ego", "sum", "via", "vita", "et"] },
  { la: "Cōgitō, ergō sum.", en: "I think, therefore I am.", source: "Descartes", words: ["sum"] },
  { la: "Errāre hūmānum est.", en: "To err is human.", source: "proverb", words: ["humanus"] },
  { la: "Homō sum: hūmānī nihil ā mē aliēnum putō.", en: "I am human: I count nothing human foreign to me.", source: "Terence, The Self-Tormentor", words: ["humanus", "sum"] },
  { la: "Amīcus certus in rē incertā cernitur.", en: "A true friend is seen when things are uncertain.", source: "Ennius, quoted by Cicero", words: ["amicus", "in-prep"] },
  { la: "Amīcus Platō, sed magis amīca vēritās.", en: "Plato is a friend, but truth is a better friend.", source: "after Aristotle", words: ["amica", "amicus", "sed"] },
  { la: "Meā#abl.sg culpā.", en: "Through my fault.", source: "from a prayer", words: ["meus"], note: "Both words are ablative: 'through my fault'." },
  { la: "Omnia mea#acc.pl mēcum portō.", en: "I carry everything I own with me.", source: "Bias of Priene, in Cicero", words: ["porto", "meus"] },
  { la: "Deus ex māchinā.", en: "A god from the machine.", source: "ancient theatre", words: ["deus"], note: "At the end of a play a god was lowered by a crane to sort everything out." },
  { la: "Terra incognita.", en: "Unknown land.", source: "old maps", words: ["terra"] },
  { la: "Possunt, quia posse videntur.", en: "They can, because they think they can.", source: "Virgil, Aeneid 5.231", words: ["possum", "video"] },
  { la: "Habeās corpus.", en: "You may have the body.", source: "English law", words: ["habeo"], note: "A court order: bring the prisoner before the judge." },
  { la: "Tempus fugit.", en: "Time flies.", source: "after Virgil, Georgics 3.284", words: ["fugito"], note: "fugit, from fugiō 'flee'; fugitō means 'keep fleeing'." },
  { la: "Solvitur ambulandō.", en: "It is solved by walking.", source: "said of Diogenes", words: ["ambulo"] },
  { la: "In silvam nōn ligna ferās.", en: "Don't carry wood into the forest.", source: "Horace, Satires 1.10", words: ["silva", "in-prep", "non"], note: "in silvam: into the forest, accusative after in (Lesson IV)." },
  { la: "Quī gladiō#abl.sg ferit, gladiō#abl.sg perit.", en: "Who strikes with the sword dies by the sword.", source: "proverb, after Matthew 26:52", words: ["gladius", "qui"] },
  { la: "Nēmō sine vitiō est.", en: "No one is without a fault.", source: "Seneca the Elder", words: ["nemo", "sum"] },
  { la: "Ūsus magister optimus.", en: "Practice is the best teacher.", source: "proverb", words: ["magistra"], note: "magister is the masculine of magistra." },
  { la: "Historia magistra vītae.", en: "History is the teacher of life.", source: "Cicero, On the Orator 2.36", words: ["magistra", "vita"] },
  { la: "Repetītiō est māter studiōrum.", en: "Repetition is the mother of learning.", source: "proverb", words: ["studeo"], note: "studium 'study, eagerness' comes from studeō." },
  { la: "Nōn est discipulus super magistrum.", en: "The student is not above the teacher.", source: "Matthew 10:24", words: ["discipulus", "discipula", "non"] },
  { la: "Poēta nāscitur, nōn fit.", en: "A poet is born, not made.", source: "proverb", words: ["poeta"] },
  { la: "Ō fortūnātōs nimium, sua sī bona#acc.pl nōrint, agricolās!", en: "O farmers, too lucky, if only they knew their blessings!", source: "Virgil, Georgics 2.458", words: ["agricola"] },
  { la: "Quandōque bonus dormītat Homērus.", en: "Even good Homer sometimes nods off.", source: "Horace, Art of Poetry 359", words: ["dormio", "bonus"], note: "dormītō 'to be sleepy' comes from dormiō." },
  { la: "Epistula enim nōn ērubēscit.", en: "A letter does not blush.", source: "Cicero, Letters to Friends 5.12", words: ["epistula"] },
  {
    la: "Quod licet Iovī, nōn licet bovī.",
    en: "What is allowed to Jupiter is not allowed to an ox.",
    source: "proverb",
    words: ["iuppiter", "taurus", "quod"],
    note: "Iovī: 'to Jupiter'. A fitting saying for the god who became a bull. Here quod means 'what'.",
  },
  { la: "Nota bene.", en: "Note well.", source: "the N.B. in notes", words: ["bene"] },
  { la: "Per aspera ad astra.", en: "Through hardships to the stars.", source: "motto", words: ["ad-prep"] },
  { la: "Magnum opus.", en: "A great work.", source: "", words: ["magnus"] },
  { la: "Dē gustibus nōn est disputandum.", en: "There is no arguing about taste.", source: "proverb", words: ["non"] },
  { la: "Experientia docet.", en: "Experience teaches.", source: "proverb", words: ["doceo"] },
  { la: "Verba docent, exempla trahunt.", en: "Words teach, examples lead.", source: "proverb", words: ["exemplum", "traho", "verbum", "doceo"] },
  { la: "Vōx populī, vōx deī.", en: "The voice of the people is the voice of God.", source: "proverb", words: ["deus"] },
  { la: "Aqua vītae.", en: "Water of life (strong spirits).", source: "", words: ["aqua"] },
  { la: "Mēns sāna in corpore sānō.", en: "A healthy mind in a healthy body.", source: "Juvenal, Satires 10.356", words: ["in-prep"] },
  { la: "Bis dat quī citō dat.", en: "He gives twice who gives quickly.", source: "proverb", words: ["qui"] },
  { la: "Spectātum veniunt, veniunt spectentur ut ipsae.", en: "They come to watch, and they come to be watched.", source: "Ovid, The Art of Love 1.99", words: ["specto"] },
  { la: "Habent sua fāta libellī.", en: "Books have their own fates.", source: "Terentianus Maurus", words: ["liber"], note: "libellus: 'little book', from liber." },

  // ---------------------------------------------------------- Discover words
  { la: "Omnia vincit amor.", en: "Love conquers all.", source: "Virgil, Eclogues 10.69", words: ["amo"], note: "amor 'love' is the noun behind amō." },
  { la: "Ōdī et amō.", en: "I hate and I love.", source: "Catullus 85", words: ["amo"] },
  { la: "Oculum prō oculō#abl.sg, dentem prō dente.", en: "An eye for an eye, a tooth for a tooth.", source: "Exodus 21:24", words: ["oculus"] },
  { la: "Timeō Danaōs et dōna#acc.pl ferentēs.", en: "I fear the Greeks even when they bring gifts.", source: "Virgil, Aeneid 2.49", words: ["donum"] },
  { la: "Stat rosa prīstina nōmine, nōmina nūda tenēmus.", en: "The rose of old lives on in its name; we hold only bare names.", source: "Bernard of Cluny", words: ["rosa", "sto", "teneo"] },
  { la: "Medice, cūrā tē ipsum.", en: "Doctor, heal yourself.", source: "Luke 4:23", words: ["medicus"], note: "medice: the form for calling someone." },
  { la: "Novus ōrdō sēclōrum.", en: "A new order of the ages.", source: "Great Seal of the United States", words: ["novus"] },
  { la: "Bonā fidē.", en: "In good faith.", source: "", words: ["bonus"] },
  { la: "Numerus clausus.", en: "A closed number: a fixed quota.", source: "", words: ["numerus"] },
  { la: "Genius locī.", en: "The spirit of the place.", source: "", words: ["locus"] },
  { la: "In hōc signō#abl.sg vincēs.", en: "In this sign you will conquer.", source: "Constantine's vision", words: ["signum"] },
  { la: "Dominus vōbīscum.", en: "The Lord be with you.", source: "from the Mass", words: ["dominus"] },
  { la: "Rem tenē, verba sequentur.", en: "Hold on to the subject, and the words will follow.", source: "Cato the Elder", words: ["teneo", "verbum"] },
  { la: "Nōn multa#acc.pl, sed multum#acc.sg.", en: "Not many things, but much.", source: "after Pliny the Younger", words: ["multus"], note: "Read a few good things deeply rather than many things quickly." },
  { la: "Carthāgō dēlenda est.", en: "Carthage must be destroyed.", source: "Cato the Elder", words: ["deleo"] },
  { la: "Vīvere est cōgitāre.", en: "To live is to think.", source: "Cicero", words: ["vivo"] },
  { la: "Tōtus tuus.", en: "Totally yours.", source: "motto of Pope John Paul II", words: ["totus"] },
  { la: "Dictum, factum.", en: "No sooner said than done.", source: "Terence", words: ["dico"] },
  { la: "Dūcunt volentem fāta, nōlentem trahunt.", en: "Fate leads the willing and drags the unwilling.", source: "Seneca, Letters 107", words: ["duco", "traho"] },
  { la: "Īte, missa est.", en: "Go, you are sent away.", source: "end of the Mass", words: ["mitto"], note: "missa, from mittō 'send', gave the Mass its name." },
  { la: "Fīnis#x corōnat opus.", en: "The end crowns the work.", source: "proverb", words: ["finio"], note: "fīnis 'end' is the noun behind fīniō." },
  { la: "Rēs pūblica.", en: "The public thing: the state, a republic.", source: "", words: ["publicus"] },
  { la: "Tabula rāsa.", en: "A scraped tablet: a blank slate.", source: "", words: ["tabula"], note: "A wax tablet smoothed flat, ready to be written on again." },
  { la: "Ācta est fābula.", en: "The play is over.", source: "said to be Augustus' last words", words: ["fabula"] },
  { la: "Omne vīvum ex ōvō#abl.sg.", en: "Every living thing comes from an egg.", source: "William Harvey", words: ["ovum", "vivus"] },
  { la: "Verbum sapientī satis est.", en: "A word to the wise is enough.", source: "proverb", words: ["verbum"] },
  { la: "Rāra avis.", en: "A rare bird.", source: "Juvenal, Satires 6.165", words: ["rarus"] },
  { la: "Placēbō.", en: "I will please.", source: "", words: ["placeo"], note: "A pill that helps only because you believe in it." },
  { la: "Asinus ad lyram.", en: "A donkey at the lyre.", source: "proverb", words: ["asinus"], note: "Said of someone who will never get it." },
  { la: "Imperium in imperiō.", en: "A state within a state.", source: "", words: ["imperium"] },
  { la: "Crēdō in ūnum Deum.", en: "I believe in one God.", source: "the Creed", words: ["credo"] },
  { la: "Nōlī mē tangere.", en: "Do not touch me.", source: "John 20:17", words: ["tango"] },
  { la: "Prīmus inter parēs.", en: "First among equals.", source: "", words: ["primus"] },
  { la: "Ālea iacta est.", en: "The die is cast.", source: "Julius Caesar at the Rubicon", words: ["iacio"] },
  { la: "Nōsce tē ipsum.", en: "Know yourself.", source: "the oracle at Delphi", words: ["cognosco"], note: "nōscō is the simple form of cognōscō." },
  { la: "Audiātur et altera pars.", en: "Let the other side be heard too.", source: "a rule of fair judging", words: ["audio"] },
  { la: "Vīvōs vocō, mortuōs plangō, fulgura frangō.", en: "I call the living, I mourn the dead, I break the lightning.", source: "an old church bell", words: ["voco", "vivus"] },
  { la: "Avē Marīa, grātiā plēna.", en: "Hail Mary, full of grace.", source: "the Ave Maria", words: ["plenus"] },
  { la: "Oleum#acc.sg et operam perdidī.", en: "I have wasted the oil and the work.", source: "Plautus", words: ["oleum"], note: "Lamp oil burned for nothing: all that effort for nothing." },
  { la: "Flectere sī nequeō superōs, Acheronta movēbō.", en: "If I cannot bend the gods above, I will move the underworld.", source: "Virgil, Aeneid 7.312", words: ["moveo"] },
  { la: "Theātrum mundī.", en: "The theatre of the world.", source: "", words: ["theatrum"] },
  { la: "Campus Mārtius.", en: "The Field of Mars, in Rome.", source: "", words: ["campus"] },
  { la: "Hortus conclūsus.", en: "An enclosed garden.", source: "Song of Songs 4:12", words: ["hortus"] },
  { la: "Saepe stilum vertās.", en: "Turn your stylus often.", source: "Horace, Satires 1.10", words: ["stilus"], note: "The flat end of the stylus smoothed the wax: revise often." },
  { la: "Pānem et circēnsēs.", en: "Bread and circus games.", source: "Juvenal, Satires 10.81", words: ["circus"] },
  { la: "Pater familiās#x.", en: "The father of the family.", source: "Roman law", words: ["familia"], note: "familiās is an old form of familiae (of the family)." },
];

/** Sayings that show a word, in list order. */
export function sayingsFor(wordId: string): Saying[] {
  return SAYINGS.filter((s) => s.words.includes(wordId));
}
