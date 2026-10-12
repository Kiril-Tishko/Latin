// Culture in words: short stories of how Roman life and Roman ideas live on in
// words we use every day, as the learner asked ("Latin explains a lot of
// existing things… the cultural influence… reflected in the words and the way
// we perceive things"). Shown on Verba > Orīginēs. Every claim must be sound:
// borrowed vs. cousin (same ancient root) vs. look-alike, as in the deck, and
// "probably" or "the story goes" where scholars are not sure.

export interface CultureStory {
  id: string;
  title: string;
  /** The Latin at the heart of it, shown large: «candidātus». */
  latin: string;
  /** One line that makes you want to read it. */
  teaser: string;
  /** The learner's own words it touches (lesson word ids). */
  words: string[];
  /** Two to four short paragraphs; «Latin» in guillemets, "English" in quotes. */
  text: string[];
  /** Today's words that carry it, borrowed ones (cousins are named in the text). */
  modern: { en: string[]; ru: string[]; uk: string[] };
}

export const CULTURE: CultureStory[] = [
  {
    id: "schola",
    title: "School was free time",
    latin: "«schola»",
    teaser: "The word for school first meant leisure.",
    words: ["schola"],
    text: [
      "Greek «scholē» meant \"free time, leisure\". What free people did with their free time was to talk, listen and learn, so the word came to mean a lecture, then the place of it.",
      "Latin took it as «schola», and from Latin it spread across Europe: English \"school\" and \"scholar\", German \"Schule\", and through Polish «szkoła» the Russian and Ukrainian «школа».",
      "So every school bell rings in a word for leisure: learning was what you did when you did not have to work.",
    ],
    modern: { en: ["school", "scholar", "scholastic"], ru: ["школа", "школьник"], uk: ["школа", "школяр"] },
  },
  {
    id: "magister",
    title: "The master and the minister",
    latin: "«magister» · «minister»",
    teaser: "One was 'the greater', the other 'the lesser'. Guess who runs governments now.",
    words: ["magistra"],
    text: [
      "«Magister» grew from «magis», \"more\": the greater one, the one in charge, a teacher, a ship's master. Its sister word «minister» grew from «minus», \"less\": the lesser one, a servant, a helper.",
      "From «magister» come English \"master\", \"mister\" (a worn-down \"master\"), \"magistrate\" and Italian \"maestro\". Its French form \"maître\" made a feminine, \"maîtresse\", the lady of the house: English \"mistress\", and so \"Mrs\" and \"Miss\".",
      "And the servant rose: a «minister» was the one who served, and today ministers govern. In church, too, a minister is \"one who serves\".",
    ],
    modern: { en: ["master", "mister", "magistrate", "minister", "Mrs"], ru: ["магистр", "маэстро", "министр"], uk: ["магістр", "маестро", "міністр"] },
  },
  {
    id: "doctor",
    title: "Every doctor is a teacher",
    latin: "«doctor» · «disciplīna»",
    teaser: "doceō and discō, two verbs you know, run through hospitals and armies.",
    words: ["doceo", "disco", "discipula", "discipulus"],
    text: [
      "«Doctor» is simply \"teacher\", the one who «docet». A doctor of medicine was first a learned man who could teach it. From «doceō» also come «documentum», \"a lesson, a proof\", our \"document\", and «docēns», \"teaching\", the Russian and Ukrainian «доцент».",
      "«Discipulus», the one who «discit», gave \"disciple\"; «disciplīna» was teaching and learning. The strictness of \"discipline\" came later, from the training of monks and soldiers.",
    ],
    modern: { en: ["doctor", "doctrine", "document", "disciple", "discipline"], ru: ["доктор", "документ", "доцент", "дисциплина"], uk: ["доктор", "документ", "доцент", "дисципліна"] },
  },
  {
    id: "liber",
    title: "A book was tree bark",
    latin: "«liber»",
    teaser: "Your word for book first meant the inside of a tree's bark.",
    words: ["liber"],
    text: [
      "«Liber» first meant the thin inner bark of a tree, which people wrote on before papyrus and parchment, and then a book. French \"livre\" and Spanish \"libro\" still mean book; English kept \"library\" (a place of books) and \"libretto\" (Italian, \"little book\": the text of an opera).",
      "A trap: \"liberty\" and \"liberal\" come from «līber», \"free\", a different word with a long ī. And Russian «библиотека» is Greek, from «biblion», \"book\", named after Byblos, the Phoenician city that sold papyrus; so is the Bible.",
    ],
    modern: { en: ["library", "libretto"], ru: ["либретто"], uk: ["лібрето"] },
  },
  {
    id: "candidate",
    title: "Candidates wore white",
    latin: "«candidātus»",
    teaser: "Why a person running for office is 'dressed in white'.",
    words: [],
    text: [
      "A Roman seeking office rubbed his toga with chalk until it shone: the «toga candida», \"the shining white toga\". So he was «candidātus», \"the one dressed in white\", and every candidate since carries that toga in their name.",
      "«Candidus», \"shining white\", also gave \"candid\" (pure, then honest), and its verb «candēre», \"to shine\", gave «candēla», the candle, and \"incandescent\".",
    ],
    modern: { en: ["candidate", "candid", "candle", "incandescent"], ru: ["кандидат"], uk: ["кандидат"] },
  },
  {
    id: "moneta",
    title: "Money is a goddess's name",
    latin: "«Monēta»",
    teaser: "Your coins are named after Juno.",
    words: [],
    text: [
      "Rome made its coins at the temple of Juno «Monēta» on the Capitoline hill. Her title became the word for the mint and for coins: «monēta». From it come English \"money\" and \"mint\", and the Russian and Ukrainian «монета».",
      "Why \"Monēta\"? The Romans linked it with «monēre», \"to warn\": Juno had warned them, the stories say, of danger. Scholars are not sure. «Monēre» itself lives on in \"monitor\" (the one who warns) and \"admonish\".",
    ],
    modern: { en: ["money", "mint", "monetary", "monitor"], ru: ["монета", "монетный"], uk: ["монета"] },
  },
  {
    id: "salary",
    title: "Paid in salt?",
    latin: "«salārium»",
    teaser: "The famous story about soldiers' salt is probably a legend. The salt is real.",
    words: [],
    text: [
      "English \"salary\" comes from Latin «salārium», a word built on «sāl», salt. A popular story says Roman soldiers were paid in salt; no ancient writer says so. More likely it was money to buy salt, which was precious, or (some think) it had to do with the Via Salaria, the Salt Road into Rome.",
      "Salt is everywhere in Latin food words: «salsus», \"salted\", gave \"sauce\", \"salsa\" and \"sausage\"; salted greens gave \"salad\", Russian and Ukrainian «салат».",
      "A hidden link: English \"salt\", Russian «соль» and Ukrainian «сіль» are not borrowed from «sāl»: they are its cousins, grown from the same ancient word.",
    ],
    modern: { en: ["salary", "sauce", "salsa", "sausage", "salad"], ru: ["салат"], uk: ["салат"] },
  },
  {
    id: "months",
    title: "Why September is the ninth month",
    latin: "«September»",
    teaser: "septem is seven. So why is September the ninth?",
    words: [],
    text: [
      "The oldest Roman year began in March, «Mārtius», the month of Mars. Counting from it, «September» (septem, 7), «Octōber» (8), «November» (9) and «December» (10) were the seventh to tenth months. In 153 BC the year began to start in January, and the names stayed behind.",
      "«Iānuārius» is the month of Janus, the two-faced god of doors and beginnings («iānua», \"door\", gave \"janitor\"). «Iūlius» was «Quīntīlis», \"the fifth\", until it was renamed for Julius Caesar; «Augustus» was «Sextīlis», \"the sixth\", until the emperor Augustus.",
      "Russian took the Latin names through Greek: январь, февраль, сентябрь. Ukrainian kept its own Slavic ones: січень, лютий, вересень (heather), жовтень (yellowing), листопад (falling leaves).",
      "And the first day of every month was the «Kalendae», when debts fell due: an account book was a «calendārium», our \"calendar\", «календарь», «календар».",
    ],
    modern: { en: ["September", "October", "January", "July", "August", "calendar", "janitor"], ru: ["январь", "сентябрь", "календарь"], uk: ["календар"] },
  },
  {
    id: "jovial",
    title: "Gods in your week",
    latin: "«Iuppiter» · «diēs Iovis»",
    teaser: "Jupiter, from Lesson III, is still in your calendar and your mood.",
    words: ["iuppiter", "deus"],
    text: [
      "The Romans named the days after the seven planets, which were gods: «diēs Lūnae» (Moon), «Mārtis», «Mercuriī», «Iovis» (Jupiter), «Veneris», «Sāturnī», «Sōlis». French and Spanish still say them: lundi, mardi, jeudi, vendredi; lunes, martes, jueves, viernes.",
      "English kept Saturn (Saturday), the Sun and the Moon, and swapped the rest for Germanic gods: Thursday is Thor's day, Jupiter's place; Friday is Frigg's, in Venus' place. Tuesday belongs to Tiw, whose name is a cousin of «deus»: \"the god's day\".",
      "Astrologers said that people born under Jupiter's planet were cheerful: «Iovis», Jove, gave \"jovial\" and \"by Jove!\".",
    ],
    modern: { en: ["jovial", "Saturday", "lunar", "martial", "mercurial"], ru: [], uk: [] },
  },
  {
    id: "europa",
    title: "A continent named after a girl on a bull",
    latin: "«Eurōpa»",
    teaser: "The story of Lesson III is printed on a coin you may have in your pocket.",
    words: ["europa", "taurus", "iuppiter", "creta"],
    text: [
      "Jupiter, as a white «taurus», carried the princess «Eurōpa» across the sea to «Crēta». The Greeks gave her name to the lands west of the Aegean, and it became the whole continent: Europe, «Европа», «Європа».",
      "What her name means, nobody knows for sure: perhaps Greek for \"wide-eyed\", perhaps a Semitic word for \"evening, the west\". The bull is in the sky too: the constellation Taurus. And the Greek two-euro coin shows Europa riding the bull.",
    ],
    modern: { en: ["Europe", "Taurus"], ru: ["Европа", "Телец (a calque)"], uk: ["Європа", "Телець (a calque)"] },
  },
  {
    id: "sinister",
    title: "Right is right, left is sinister",
    latin: "«dexter» · «sinister»",
    teaser: "How the left hand got a bad name, in Latin and in Russian.",
    words: [],
    text: [
      "«Dexter» is the right hand, «sinister» the left. Most people are right-handed, so the right hand stood for skill: \"dexterity\", \"ambidextrous\" (\"both hands right\").",
      "«Sinister» first meant only \"left\"; Roman augurs even took signs on the left as lucky. Greek custom made the left the unlucky side, and in English \"sinister\" ended up meaning evil.",
      "Russian and Ukrainian think the same way: «правый», «правий» (right) sit beside «правда» (truth) and «право» (law, a right), while «левый товар» is something shady.",
    ],
    modern: { en: ["dexterity", "ambidextrous", "sinister"], ru: [], uk: [] },
  },
  {
    id: "companion",
    title: "A companion shares your bread",
    latin: "«compāniō»",
    teaser: "com + pānis: the one you eat bread with.",
    words: [],
    text: [
      "Late Latin «compāniō» is «com», \"with\", and «pānis», \"bread\": the one you share your bread with. It gave \"companion\" and \"company\" (companionship, now also a firm), Russian «компания», «компаньон», Ukrainian «компанія».",
      "«Pānis» itself lives on in Spanish \"pan\", French \"pain\" and Italian \"pane\", and in the \"pantry\", once the room for bread.",
    ],
    modern: { en: ["companion", "company", "pantry"], ru: ["компания", "компаньон"], uk: ["компанія"] },
  },
  {
    id: "muscle",
    title: "A muscle is a little mouse",
    latin: "«mūsculus»",
    teaser: "Flex your arm and look: Romans and Slavs saw the same animal.",
    words: [],
    text: [
      "«Mūsculus» means \"little mouse\" (from «mūs»): a muscle moving under the skin looks like a mouse running. It gave \"muscle\", «мускул», and also \"mussel\", the shellfish, for its shape.",
      "Slavic had the same idea on its own: Russian «мышца», \"muscle\", comes from «мышь», \"mouse\". And «mūs», English \"mouse\" and «мышь», «миша» are cousins, one ancient word in three languages.",
    ],
    modern: { en: ["muscle", "mussel", "muscular"], ru: ["мускул"], uk: ["мускул"] },
  },
  {
    id: "vaccine",
    title: "Every vaccine is a cow",
    latin: "«vacca»",
    teaser: "The word comes from a cow in an English village in 1796.",
    words: [],
    text: [
      "Milkmaids who caught cowpox did not catch smallpox. In 1796 Edward Jenner protected a boy with cowpox matter, which doctors called «variolae vaccīnae», \"cow pox\", from «vacca», \"cow\".",
      "Louis Pasteur later called every such protection a \"vaccine\", in Jenner's honour. So the word in English, Russian «вакцина» and Ukrainian «вакцина» still says \"from the cow\".",
    ],
    modern: { en: ["vaccine", "vaccinate"], ru: ["вакцина"], uk: ["вакцина"] },
  },
  {
    id: "pecunia",
    title: "Money was cattle",
    latin: "«pecūnia»",
    teaser: "In Latin, in English and in Old Russian, wealth once walked on four legs.",
    words: [],
    text: [
      "«Pecūnia», \"money\", comes from «pecus», \"cattle\": wealth was counted in herds. It gave \"pecuniary\" and \"impecunious\" (penniless).",
      "English \"fee\" tells the same story: Old English \"feoh\" meant cattle and money, a cousin of «pecus». And in Old Russian «скотъ» meant both cattle and money; the prince's treasury was the «скотница».",
    ],
    modern: { en: ["pecuniary", "impecunious"], ru: [], uk: [] },
  },
  {
    id: "insula",
    title: "Insulin lives on an island",
    latin: "«īnsula»",
    teaser: "What your word for island has to do with diabetes and with a block of flats.",
    words: ["insula"],
    text: [
      "«Īnsula» is an island. In Rome it was also a block of flats, standing alone among streets like an island. «Paenīnsula», \"almost an island\", is a peninsula; Russian «полуостров» and Ukrainian «півострів» are built the same way, half + island.",
      "Through Italian \"isolato\", \"made into an island\", came \"isolate\", «изоляция», «ізоляція»; \"insulate\" came straight from Latin.",
      "And insulin: the hormone is made in small \"islets\" of the pancreas, so it was named after «īnsula».",
    ],
    modern: { en: ["insulin", "isolate", "insulate", "peninsula"], ru: ["инсулин", "изоляция"], uk: ["інсулін", "ізоляція"] },
  },
  {
    id: "terra",
    title: "The sea in the middle of the land",
    latin: "«terra» · «Mediterrāneus»",
    teaser: "terra, from Lesson III, names a sea, a dog and a patio.",
    words: ["terra"],
    text: [
      "«Mediterrāneus» means \"in the middle of the land\": the Romans' sea lay between the lands they knew. Russian «Средиземное море» and Ukrainian «Середземне море» say exactly the same thing, word for word.",
      "A \"terrier\" is the dog that goes into the earth after foxes (French \"chien terrier\"); a \"terrace\" is a heap of earth made flat; a \"territory\" is land that belongs to someone; and an extraterrestrial comes from outside the «terra».",
    ],
    modern: { en: ["Mediterranean", "terrier", "terrace", "territory", "extraterrestrial"], ru: ["территория", "терраса"], uk: ["територія", "тераса"] },
  },
  {
    id: "aqua",
    title: "The water of life",
    latin: "«aqua vītae»",
    teaser: "Whisky, akvavit and a Russian word for 'little water'.",
    words: ["aqua"],
    text: [
      "From «aqua»: aquarium, aqueduct, aquatic and the watercolour \"aquarelle\", Russian «акварель», Ukrainian «акварель».",
      "Medieval alchemists called strong spirits «aqua vītae», \"the water of life\". Scandinavians still say \"akvavit\"; Irish and Scottish Gaelic translated it as \"uisce beatha\", which English shortened to \"whisky\". Russian «водка» is just \"little water\", from «вода»: a different word on the same joke.",
    ],
    modern: { en: ["aquarium", "aqueduct", "aquatic", "aquarelle"], ru: ["аквариум", "акварель"], uk: ["акваріум", "акварель"] },
  },
  {
    id: "video",
    title: "Video means 'I see'",
    latin: "«videō»",
    teaser: "You conjugate it in exercises; it is also on every screen.",
    words: ["video"],
    text: [
      "«Videō» is \"I see\": the word on your screens is a Latin verb in the ego form. Its family: \"vision\", \"visit\" (\"go to see\"), \"evident\" (\"seen clearly\"), \"provide\" (\"see ahead\"), \"survey\".",
      "A cousin, not a borrowing: Russian «видеть» and Ukrainian «видіти» grew from the same ancient root as «videō», and so did English \"wit\" and \"wise\" (the one who has seen).",
    ],
    modern: { en: ["video", "vision", "visit", "evident", "provide"], ru: ["видео", "визит"], uk: ["відео", "візит"] },
  },
  {
    id: "ambulance",
    title: "An ambulance walks",
    latin: "«ambulāre»",
    teaser: "ambulō from Lesson IV is in every hospital.",
    words: ["ambulo"],
    text: [
      "An \"ambulance\" was first a walking hospital: French \"hôpital ambulant\", a field hospital that moved with the army. From «ambulāre» also come \"amble\", \"preamble\" (\"walking in front\") and the baby's \"pram\", short for \"perambulator\", \"the one that walks around\".",
      "Russian «амбулатория» and Ukrainian «амбулаторія» are clinics you walk into and out of the same day.",
    ],
    modern: { en: ["ambulance", "amble", "preamble", "pram"], ru: ["амбулатория"], uk: ["амбулаторія"] },
  },
  {
    id: "gladius",
    title: "A flower named after a sword",
    latin: "«gladiolus»",
    teaser: "The gladiator and the gladiolus are both your word gladius.",
    words: ["gladius"],
    text: [
      "The «gladius» was the short sword of the legions; a «gladiātor» was a swordsman. The «gladiolus», \"little sword\", is the flower with sword-shaped leaves: «гладиолус», «гладіолус».",
    ],
    modern: { en: ["gladiator", "gladiolus"], ru: ["гладиатор", "гладиолус"], uk: ["гладіатор", "гладіолус"] },
  },
];

export const CULTURE_BY_ID = new Map(CULTURE.map((s) => [s.id, s]));
