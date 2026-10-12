// The phrasebook beside the emoji (the messenger's ＋), as the learner chose:
// ready phrases to tap into a message: yes and no, hello and goodbye to one
// friend or to all of them, thanks, how are you, a friend called by name, good
// night. Classical Latin, made of the learner's own words and the chat words; a
// phrase with a word the lessons have not taught says what that word is
// (`note`), and once sent the word is offered to add (strangeWords).

export interface Phrase {
  la: string;
  en: string;
  /** The word in it the lessons have not taught, and what it is. */
  note?: string;
}

export interface PhraseGroup {
  title: string;
  phrases: Phrase[];
}

/** Someone the phrases speak to: a friend, a stranger, or each member of the group. */
export interface Hearer {
  name: string;
  /** The name when speaking to them: Marce, Lūcī, Iūlia. */
  voc: string;
  g: "m" | "f";
}

/** The phrasebook for a chat: greetings to the person by name, or to everyone in the group. */
export function phrasebook(people: Hearer[], group: boolean): PhraseGroup[] {
  const one = !group && people.length === 1 ? people[0] : null;
  const hello: Phrase[] = one
    ? [
        { la: `Salvē, ${one.voc}!`, en: `Hello, ${one.name}!` },
        { la: "Quid agis?", en: "How are you?" },
        { la: "Et tū?", en: "And you?" },
        { la: `Valē, ${one.voc}!`, en: `Bye, ${one.name}!` },
        { la: "Bene dormī!", en: "Good night! (sleep well)", note: "dormī: «sleep!», said to one person" },
      ]
    : [
        { la: "Salvēte, amīcī!", en: "Hello, friends!" },
        { la: "Quid agitis?", en: "How are you all?" },
        { la: "Valēte, amīcī!", en: "Bye, friends!" },
        { la: "Bene dormīte!", en: "Good night, all! (sleep well)", note: "dormīte: «sleep!», said to several people" },
        ...people.map((p) => ({ la: `${p.voc}!`, en: `${p.name}! (calling ${p.g === "f" ? "her" : "him"})` })),
      ];
  return [
    { title: "Hello and bye", phrases: hello },
    {
      title: "Answers",
      phrases: [
        { la: "Ita.", en: "Yes." },
        { la: "Minimē.", en: "No." },
        { la: "Bene, grātiās!", en: "Fine, thanks!" },
        { la: "Optimē!", en: "Great!" },
        { la: "Nōn male.", en: "Not bad." },
        { la: "Male…", en: "Not well…" },
        { la: "Ego quoque.", en: "Me too." },
        { la: "Ita est.", en: "That's right." },
        { la: "Grātiās!", en: "Thanks!" },
        { la: "Euge!", en: "Hooray! Well done!" },
        { la: "Heu!", en: "Oh no!" },
        { la: "Hahae!", en: "Haha!" },
      ],
    },
    {
      title: "Questions",
      phrases: [
        { la: one ? "Ubi es?" : "Ubi estis?", en: one ? "Where are you?" : "Where are you all?" },
        { la: "Quid novī?", en: "What's new?", note: "novī: «new», from novus" },
        ...(one ? [{ la: "Quid legis?", en: "What are you reading?" }] : []),
        { la: "Quid nunc?", en: "What now?" },
        { la: "Cūr?", en: "Why?" },
        { la: "Ecce!", en: "Look!" },
      ],
    },
    {
      title: "About me",
      phrases: [
        { la: "Labōrō.", en: "I'm working." },
        { la: "Studeō.", en: "I'm studying." },
        { la: "Nunc nōn possum.", en: "I can't right now." },
        ...(one ? [{ la: "Tē dēsīderō.", en: "I miss you.", note: "tē: «you» as the object (tū → tē)" }] : [{ la: "Vōs dēsīderō.", en: "I miss you all.", note: "vōs: «you all» as the object" }]),
        { la: "Nesciō.", en: "I don't know.", note: "nesciō: I don't know" },
      ],
    },
  ];
}
