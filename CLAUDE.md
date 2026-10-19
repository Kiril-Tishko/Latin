# Tabula Latina

A Latin trainer that follows the YouTube playlist **Easy Latin Lessons**
(https://www.youtube.com/playlist?list=PLjqqMkeHFt1E_lRi9nQvtmP9Od2JokI1J),
published as a private claude.ai artifact.

## The learner

- Native in English, Russian and Ukrainian. Explanations are in English;
  comparisons with Russian / Ukrainian cases are welcome.
- Finished Lessons 1-4 (October 2026). Remembers the words but forgot most of
  the rules, so practice restarted step by step from Lesson I and should feel
  very simple at first ("I want to think little"). Lesson V is on the site,
  waiting to be watched: the "Next video" card (`NextLesson` in
  src/ui/next-lesson.tsx, on Lectiōnēs, and on Domus once every rule watched is
  learned) links the video and ticks it with "I have watched it". Now learns the rules in small
  parts: a very simple explanation, open questions, then a bunch of simple
  exercises before harder ones, and never an exercise on a rule not seen yet.
- Wants: only words and constructions from the videos (plus words they open
  on the mystery cards), lots of written exercises, colored endings, Roman classic look,
  light motivation (daily goal + streak), and only sensible sentences: silly
  pairings ("the bull reads the letter") confused them, so `settings.silly`
  defaults to 0 and progress version 3 switched existing saves to it.
- Follows the original playlist, with corrections from the 2025 "New Easy
  Latin Lessons" playlist (PLjqqMkeHFt1FjCaUrdcdMxF15sKUk9rHs) where they differ.
- Wants to be asked questions before something big is built (AskUserQuestion),
  then left to build.
- Loves etymology and related words: every answer about a word tells where it
  comes from and one interesting bit of history; a word sent alone gets a word
  card (they chose the card over a little story). Adds words of their own to
  the dictionary (from the Words page, Ask Claude and the messenger).
- Committed to the messenger (Nūntiī) as a main feature: people who feel real
  and natural, text on their own at their own hours, a group chat, someone
  random at the press of a button, portraits, the best model, phone
  notifications, and personalities "random and extreme and weird and normal",
  whose moods change with time and with what goes on in their lives (or not).
  They chose: only words they know plus ~20 chat words, mistakes pointed out only
  on Check, Kyiv time, separate model choices for the coach and the chats.
  Later they asked for genuine, humanlike relationships rather than strict
  instructions: people who can be trolled, who get emotional and form opinions
  and feelings about the learner. They chose: feelings never shown (only felt
  in how people write), reactions like a real person's (grudges, the silent
  treatment, complaining to the others, forgiving), and bonds that can grow
  into anything, "the wilder the better" (crushes, passion, rivalry, hatred);
  anything sexual stays off the page (Claude does not write it). Then: a new
  word or two in a strong moment (glossed), every kind of trolling (they fall
  for lies, troll first, test the learner, the smart ones see through it), the
  friends' own dramas with the learner dragged in, anything real life has
  (illness, debt, grief, a wedding), adult themes within limits, much more
  texting, blocks, leaving, people appearing, moving or vanishing, strangers
  fully tied into the friends' lives, the learner still a foreigner far away.
  Above all: "don't make the rules/prompts very strict… let them have freedom,
  no scenario/script", things they do that the learner did not expect, and new
  abilities added over time for the learner to discover. For themselves they
  asked to send voice messages and photos, to block, mute and delete, to make
  groups of their own and to write to anyone in the story; for the people's
  photos, "something wild, something they would send… no limits" made by an AI
  generator instead of a museum's collection (no nudity or gore: the generator's
  filter is on, and the prompts say so). Pace: "let it come naturally". Their
  Latin stays out of it: the people know nothing of lessons.

## Commands

```sh
npm install
npm test            # engine, content and exercise self-tests (vitest)
npm run typecheck
npm run build       # -> dist/tabula-latina.html (the artifact page), its files, dist/publish.json, dist/preview.html
npm run smoke       # clicks through the built page in Chromium, saves screenshots to dist/screens
SMOKE_ONLY=messenger npm run smoke   # one part only (messenger, abilities, ownWords, learn, stories, conversations, chatScroll, askClaude, audio, pages)
python3 -I scripts/content/photos.py  # makes any of the people's photos that is missing (AI Horde, free; anonymous jobs wait 2-15 min each)
node scripts/build.mjs --dev   # unminified build for debugging
```

## Publishing

The page is `dist/tabula-latina.html`: no doctype/head/body of its own (the
artifact publisher adds the skeleton), `<title>` and `<style>` first, then
`<script src="tabula-<hash>.js">`. The code and the messenger's pictures
(photos, portraits, engravings: src/content/<dir>/*.webp, `MEDIA` in the build)
are files beside the page: `dist/publish.json` is the `files` map for them (the
script is named by its content, so a browser never runs an old copy). Publish
with the Artifact tool:

- first publish: `file_path: dist/tabula-latina.html`, `files`: the map in
  dist/publish.json, `icon: "scroll"`, `capabilities: {sample: {images: true}, db: {}, user: {},
  mcp: {servers: [{server: "Claude Code Remote", tools: ["fire_trigger"]}]}}`
- updates: the same plus `url: <artifact url>`, with the script the artifact
  holds now set to `null` in `files` (list them: `action: "list"`,
  `scope: "files"`), and omit `capabilities` so the stored ones are kept.
  Files that are gone (old photos) are set to `null` too.

Why the code is not inlined: with the minified code in the page, the publisher
took the page for a code-review page ("carries the artifact-pr-review
machinery", then "too large for a review page" or "supporting files are not
allowed alongside a review page") and refused it, set off by nothing more than
the minifier's names in Preact's code. It also reads `id="data…` anywhere in a
page as that mark; the build refuses such a page.

Artifact URL: https://claude.ai/artifact/3cvi4ofuaPLg6LfXXf7efX (also in README.md).

Runtime capabilities used:
- `sample`: the Ask Claude drawer, "I think my answer is right" (judge), the
  check of an open answer on a rule's page (`checkUnderstanding`), Answer in
  Latin's fresh questions and judgments (src/ui/coach.ts), and the messenger
  (below). Which model answers is the learner's choice in Settings: `settings.coach`
  for Ask Claude, the checks and Answer in Latin (default Sonnet, high effort),
  `settings.chat` for the people in the messenger (default Opus, high), each a
  tier (Haiku = quick, Sonnet = default, Opus = complex) and an effort
  (`coachOpts()` / `chatOpts()` in src/ui/models.ts; every call goes through them).
  Ask buttons only put a suggested question in the box; nothing goes to Claude
  until the learner presses Ask. A suggestion is added after what the learner
  has typed, never in its place (`withQuestion`); only an earlier untouched
  suggestion is replaced. A new conversation offers four quick questions:
  where the word comes from, which words are related to it, a memory trick,
  and a comparison with Russian / Ukrainian. A question about origins or
  relatives carries the site's checked relatives of each word in its facts
  (borrowed vs. same root vs. look-alike, from `wordInEnglish`; `relativesFact`
  in src/content/english.ts), so Claude does not invent etymologies; any
  question naming a word carries that word's relatives, as every word question
  gets its origin and a bit of history (`INSTRUCTIONS`). A word sent alone
  (`bareWord`: Latin, English, Russian or Ukrainian, or a dictionary line) is
  read as Latin even when it is also English ("aqua"), carries the note
  "[Just a word: answer with its word card.]", and the answer is a word card:
  a bold headline, then **Origin:**, **History:**, **Family:**, **Hidden link:**,
  **Use:** lines, which `Markup` shows one per line with small gold labels (`p.labelled`).
  The learner loves surprising connections (they asked about «euge» and were
  delighted to find Greek eu → Eugene, "Євген" → "eugenics"), so every word
  answer, the card's Hidden link, the messenger's coach and an added word's card
  (`WordStory.link`) look for one real link: a name, a modern word, a term of
  science, a brand, a place; never a look-alike. Under
  such a card, a word the learner does not have yet gets "Add «gladius» to my
  words" (`AddFromAnswer`, the headline's word: `cardWord`); any other answer
  offers the words it marks «…» (new) as "New words here" chips (`newWordsIn`;
  these helpers live in src/ui/answer-words.ts, where the tests reach them).
  The profile lists the chat words, so "how do I say yes?" gets «ita», the
  site's word, not «sīc». A failed answer shows plain advice, Try again,
  and the error code under "Details" (ask the learner for it when debugging).
  Keep the sample function in state as `setSample(() => fn)`: Preact calls a
  function given to a state setter, which once broke every question.
  Claude knows what is on screen, so "here" and "this sentence" work
  (src/ui/screen.ts): pages call `useScreen("page", label, () => detail)`, every
  `Modal` registers itself as a dialog, and the topmost wins. Long pages mark
  their parts with `data-ask="name"`; a question carries the lines of those parts
  that are in view and the last line or Latin word tapped. Each question is saved
  with its screen (the full description only on the newest, older ones keep the
  label), and the drawer shows "Claude sees: …". A new page or dialog should
  register itself the same way. The eye in that line switches sharing off for
  the conversation (`Chat.share`); unset, the page decides, and the home page
  registers with `{ share: false }`. A question asked with sharing off is sent
  as general: no screen, no "asked on" notes, and Claude is told not to steer
  back to the screen. Asking from a thing's own button (Why?, a word, a card)
  switches sharing on.
  The chat never scrolls by itself while the learner reads or types: it opens
  at the latest message, a sent question glides to the top with room below
  that its answer fills (`.chat-space`), and only a new message that arrives
  below the screen, unseen, shows a "New message" button (gone once it comes
  into view; reading higher up never shows it). Answers are short by default
  but shaped by the question, not by a template (the learner asked that they not
  always look the same: a sentence, a bold point with bullets, a short
  paragraph), and longer only when the learner asks (`INSTRUCTIONS` in src/ui/ask.tsx). The profile sends
  which parts are learned, in practice and not met yet, and each met rule's own
  text; the instructions forbid invented rules,
  keep «» for Latin only and name the trap Claude once fell into (agricola
  timidus, not timida). The learner's saved conversations can be read with
  ArtifactData at `data/users/me/chats/threads` to see how answers land.
  Claude does not answer Latin grammar from memory alone (`src/latin/facts.ts`):
  the newest question carries `engineFacts`, the grammar engine's facts about
  every Latin word in the question, the last answer and the screen (what each
  form can be, gender, group, known forms, how an adjective goes with it), and
  every answer is read back by `checkAnswer` (adjective agreement, subject and
  verb, in / ad with the right case, long marks in endings; Latin quoted as a
  wrong example or as the learner's own words is left alone; with sum / es a
  noun is the complement: «Discipulus sum»). A finding shows
  as a "Grammar check" note under the answer, with "Fix this answer", which
  sends the findings back (a turn of `kind: "fix"`). The learner cannot judge
  answers themselves, so there is no "this is wrong" button.
- `db` + `user`: progress in the viewer's private doc `data/users/<id>/progress`.
  The page also keeps a copy in localStorage; the newer `updatedAt` wins.
  Ask Claude conversations: one private doc each at
  `data/users/<id>/chats/threads/<chatId>` (src/ui/chats.ts), followed live with
  `onSnapshot`, so a conversation continues on any device; the question is
  saved before the answer arrives. localStorage keeps a copy of the list, the
  unsent text per conversation and whether the drawer was open, so a reload
  loses nothing. Each saved answer records the model tier that gave it.
  The messenger: `data/users/<id>/messenger` (meta: seenAt, plannedAt, the
  people's lives, the strangers met), `…/messenger/threads/<chat>` (one doc per
  chat, merged by message id with `dropped` tombstones, followed live),
  `…/messenger/inbox/<id>` (messages the phone routine wrote; the page moves them
  into their chats and deletes them) and `…/messenger/brief/now` (what the
  routine needs, written by the page). The Ācta Diurna is the thread
  `…/messenger/threads/acta` (kind "channel"; `meta.actaAt` marks a board being
  written, so two devices do not both write it). Pictures (the people's fresh
  ones and the learner's photos) are documents of their own,
  `…/messenger/pics/<id>` (under the store's 256 KiB per document).
- `sample` with `images: true`: the learner's photos in the messenger are shown
  to Claude with the next answer.
- `mcp` (the built-in "Claude Code Remote" connector, `fire_trigger` only): the
  page fires the pictures routine when someone sends a fresh picture.

## The site: four tabs, one Continue

The learner asked for a site "for a stupid person - obvious and no thinking
required": as few places as possible, one obvious next step. Four tabs, with
Latin names (English in the tooltip; `TABS` in src/ui/app.tsx, routes in nav.ts):

- **Domus** (`src/ui/pages/home.tsx`): one card, one button. Continue
  (`continueLearning` in train.tsx) leads through everything, so the learner
  never chooses an activity (they asked for it): `todayStep` in
  src/trainer/today.ts starts the day with the rule (`nextStep` in path.ts: a new
  rule opens its page, the rule in practice starts its round, everything learned
  starts a round of everything); once something is done that day, a story that
  has opened and is not read comes first (one between two rounds: `Day.story`),
  then today's Ācta Diurna when it is out and unread (`actaUnread`, Nūntiī below),
  then, once a day and with ten or more due, a round of twelve words (`Day.words`).
  The card says what Continue will do (`StepCard`), with the day's goal and
  streak. Nothing else (no cards for Answer in Latin, stories or messages, no
  practice chooser; `#train` without a round goes home).
- **Lectiōnēs** (`src/ui/pages/lessons.tsx`): the whole path. Each lesson
  watched with its rules one line each (`RuleList`) and its three stories under
  them; a lesson fully learned folds into its title line. Then the endings at a
  glance (closed). A lesson's own page
  (`#lesson-n`: the video's sentences with Listen & repeat, its story, phrases,
  differences from the video) is reached from the line under its stories; its
  rules are on Lectiōnēs and its words on Verba. `#rules` and `#stories` land here.
- **Verba** (`src/ui/pages/words.tsx`): two halves under one tab, switched at
  the top (`VerbaSwitch`): the words, and Orīginēs, where they come from.
  The words: search (any form, or English), Add a
  word, the five mystery cards (`CardStrip` in src/ui/cards.tsx: opened cards turn
  face up in place; five more come when all five are open), the filters All /
  lessons / Cards / Yours / Chat on one sideways-scrolling line, and the word
  grid (reviews come through Continue). `#discover` lands here.
  **Orīginēs** (`#origins`, src/ui/pages/origins.tsx): etymology is "one of the
  main reasons" the learner learns Latin, with the culture it carries, and they
  chose it inside Verba. One page: the Latin in English reader's card (moved here
  from Lectiōnēs; the reader's back link leads here), Culture in words (twenty
  short stories in src/content/culture.ts: schola was leisure, magister and
  minister, salary and salt, why September is the ninth month, Monēta, the white
  toga of the candidate, Europa on the bull, muscle the little mouse…, each
  tied to the learner's words where it can be, with today's words in English,
  Russian and Ukrainian, "Ask Claude about it"; `tests/origins.test.ts` checks the
  long marks of known words in them), Hidden links (`hiddenLinks` in
  src/trainer/origins.ts: every link Claude found, from the learner's added
  words and from Ask Claude's "**Hidden link:**" lines, newest first, each once),
  and Word families (`wordFamilies`: every word's relatives, borrowed / same root /
  not related, with its note, searchable by a relative in any language).
  Claims there follow the deck's rule: borrowed vs. cousin vs. look-alike, and
  "probably" where scholars are unsure.
- **Nūntiī**: the messenger (below).

Typing on a phone (src/ui/keyboard.ts), as the learner asked: while a text
field is focused on a touch screen the keyboard is taken to be up, `<html>` gets
`kb-open`, and the top bar and the tabs step aside (the chat then fills the
screen; notices come from the top). A keyboard closed with the field still
focused (Android's back button) shows as the page growing back, and the bars
return (`watchKeyboard`). Every text field has `NO_CORRECTION` (no spellcheck,
autocorrect or autocomplete): a tap on a Latin word underlined as wrong opened
suggestions instead of moving the cursor. The smoke test checks both on a phone.

Latin in English is a reader (`src/ui/pages/english.tsx`, the screens built by
`englishSteps` in src/content/english-steps.ts): one short screen at a time (a
text, a table, a list, the learner's own words, a quick question with three
answers that must be answered before Next), every screen fitting a phone without
scrolling (`fitToWindow` zooms down a little at most), the place kept in
`Progress.english`. `tests/english.test.ts` checks its questions and screen sizes.

## Rules one at a time, then practice

The learner asked for each video's rules in small parts, explained very simply,
with open questions to check understanding before any exercise, and never an
exercise on a rule they have not seen. `src/content/parts.ts` splits Lessons I-V
into 26 parts (`Part`: `explain` lines, `examples`, a `slavic` comparison, two
open `questions` with a good `answer` and `keys`, and the `skills` it opens;
`practised` when not all of them can show up in exercises, as vīnum is never a
sensible subject). Every lesson skill belongs to exactly one part.

The page `#learn-<lesson>-<n>` (`src/ui/pages/learn.tsx`) shows the explanation,
then the questions one at a time. An answer counts as right when it has a word
of every key group (`meetsKeys` in `src/trainer/path.ts`: lower case, no long
marks, a key of one or two letters must stand alone, "I don't know" never
counts); otherwise Claude judges it (`checkUnderstanding` in ask.tsx: right /
partly / wrong with a short feedback, the coach's model), and
without Claude the learner compares with the good answer. With both questions
answered the part is seen (`markSeen`) and its exercises open.

The learner values simplicity and obviousness above all ("make it simple, make
it obvious"): one clear way to each thing. Lectiōnēs lists every rule of the
lessons watched, one line each (`RuleList` in learn.tsx: ✓ learned, its right
answers as dots and "3/10", or new; the rule to work on now marked "you are
here"; the whole line opens the rule), then the endings at a glance (a ? for
forms of rules not learned yet) and the colors (`NounTable`, `VerbTable` in
src/ui/tables.tsx). Lesson pages show the same list. The lessons' full What / How /
When texts live only on each rule's page, under a closed "More detail"
(`rulesOfPart`; general notes that teach no skill are attached with
`Part.more`, and a test checks that every full rule is under some part).

`src/trainer/path.ts` keeps the path: `Progress.parts[id]` = `{ seen, right,
learned? }`. Practice uses every known word but only the rules of the parts seen
(`seenSkills`, `derived().seenKnowledge`). The learner chose the count: every
right answer on a part's rule adds one, in any kind of practice (`countsFor`:
not wrong, and the rule's own credit at least 0.85), a wrong one adds nothing,
and ten (`PART_GOAL`) make the part learned for good. The first five right
answers come from simple exercises, then mixed ones, the last two from the
hardest (`partPhase`, `PART_PHASES`). The current part is the first one not
learned, and `focusLesson` follows it. The next part is offered, never forced
("Or learn the next one now"). Version 4 marked the lessons before the step as
learned; version 5 switched to counting right answers (parts in practice
started from 0: the learner's 17 exercises on rule 3.2 had never shown its -ī).

A part's round is made one exercise at a time (`partExercise`, from
`Runner.next` in train.tsx, which passes the round so far), each for the
progress at that moment, and every exercise shows the rule and counts when
answered right (`countsFor` on its right answer, `rightAnswer`): its weakest
piece first, a single form when only a form can show it (to …: -re; vīnī), the
videos' and stories' sentences for et between two verbs (`practiceLines`; lines
that say a word twice and verbless phrases are left out). The learner asked for
coherent rounds: exercises come in blocks of three of one kind (`BLOCK`,
`blockKind`): a simple or mixed round starts with its easiest kind and climbs one
or two steps at a time (`EASY_TO_HARD`; the last phase starts with its main
kinds), only of kinds that can show the rule (`countingKinds`: "in / ad + -m"
never shows in one ending). After a wrong answer nothing harder comes (the
learner asked, "not strict"): one miss keeps the kind, two in a row step down,
the sentence is plainer (a phase back), no earlier-rule review comes between,
and the fallbacks stay at or below the kind missed (`missed` in `partExercise`,
counted from the round's own exercises in `Runner.next`). Past the simple phase every fifth reviews an earlier rule in the same
kind (`earlier`). The day's review comes between: up to two mistakes (the
rule's own first, then the oldest: `mistakesSession(…, prefer)`) and two words
that are due, every fourth exercise (`dayReview`, marked `aside`, so they don't
break a block); a mixed round (everything learned) gets the same.
The round's header is one compact block: what is practised, "3 / 12" and an ✕,
then the rule's ten dots (`PartCount`, `PartDots`) or, in other rounds, the
tesserae. Every answer says "+1 · Rule 3.2: 4 of 10" or that it stays; the round
ends when the rule is learned, and its summary shows before → after, with
Continue and Done for now. Domus, the rule page and the lesson lines show the
same dots. On a later day a round starts with a one-screen reminder of the
part (`PartRecap`, Start at the bottom). Under each exercise: one Help button
(the rule behind it, `RuleBox`, the hint and the colors at once) and Show
answer. `tests/parts.test.ts` plays a round of every part as the page does:
each exercise must show the rule, add one when right, need only rules seen, ten
right answers must learn it, and the round must come in blocks.

How rich a sentence is follows the same phases (`sentenceStyle`: bare while
simple, colors on). Elsewhere (videos, stories, weak spots) the kinds follow the
mastery of the skills (`phaseOf`); a fixed sentence is as hard as its newest
rule. The generator makes an "of" phrase only when s.gen or one of the genitive
endings is the focus (`GEN_SKILLS`, the owner of the ending practised; anywhere
else it read two ways to the learner: «Dea amīcam discipulae nōn habet» as "the
student's goddess has no friends"), and a
describing word can be the gap or the choice (`tokenRules`; `wrongForms` offers
its other cases and its other gender: magna for agricola's magnus).

Answer in Latin (`src/trainer/answers.ts`, questions in `src/content/questions.ts`):
open questions in Latin that the learner answers with their own words, as they
asked ("questions I can answer with my known vocab"). Three kinds, all of which
they chose: about themselves ("Quid legis?": `YOU_QUESTIONS`, each with the rules
it needs and an example), about the stories they have read (made from story
lines: quis / quid / ubi / quō in place of the subject, the object, the place or
where to; the answer must say what the story says), and small scenes (two
sentences about a person). The question words are not in the videos, so each
shows its meaning ("quid = what"); until rule 2.2 the questions say tū and the
examples ego. `judgeAnswer` checks with the engine: unknown words, grammar
(`checkAnswer`; long marks never needed), the person (-ō about yourself), the
question's own verb, what the question asks for (a thing with -m, in + -ā / -ō,
ad / in + -m, who, to …, quod …), and a correct but odd pair ("I read the water")
is "almost" (`sensibleObject`). A right answer adds one to the rules it used;
open answers are not logged as mistakes. Every round (a rule's, or everything)
ends with one of them, "your turn" (`Exercise.last`, `Session.finale`): a
ready-made question on the round's rule when one fits (`closingQuestion`), which
a fresh one from Claude replaces when it comes in time (`freshFinale` in
train.tsx). A round that learns its rule ends at once, without it.
Fresh questions, as the learner asked ("really open ended… so AI should check
it"): `freshQuestions` in src/ui/coach.ts (about the learner, the five friends of
the messenger, imagined scenes; on the round's rule when given one; only their
words, each vetted by `vetMessage`; the last 60 asked are kept so they do not
repeat; `openExercise`, slot `free`).
Every answer goes to the coach (`judgeOpen`): the engine's findings go along as
facts, any correct, sensible answer counts, inventive ones most of all, and the
coach's note and corrected version ("Your idea, corrected") are shown; without
Claude the engine's verdict stands.

Exercise builders work on any sentence: `writeOn`, `endingOn`, `chooseOn`,
`tilesOn`, `meaningOn` in `src/trainer/exercises.ts` take tokens and an English
text, so generated clauses and fixed sentences share them. Fixed sentences go
through `src/trainer/lines.ts`: `makeLine` reads one into tokens (role and ending
of each word; a neuter with I / you acting is the object), `lineSkills` lists
every rule it needs (its endings and its constructions: an object, "of", nōn,
ego / tū left out, an infinitive after a verb, X est Y, in / ad + a place,
plurals, an adjective that follows gender), and `lineExercise` builds the
exercises. The videos' and stories' own sentences whose rules have all been
seen (`practiceLines`, `videoLines` in src/trainer/video.ts) show a rule's
constructions in its round (et between two verbs), and five of them are mixed
into every round of everything (`linesSession`, `LINES_IN_MIX`).

Every exercise shows one plain task line with a sign for how to answer (write,
tap, type in the gap, listen, change: `taskOf` in `src/ui/pages/train.tsx`),
and under it what the answer is to be (`expect`: "only the missing letters",
"the whole new sentence", "1 word is extra: leave it out"): the learner asked
never to have to guess the task, only to think about words and rules. A gap
exercise (ending, choose) always shows its English above the Latin (hidden
behind Translate, the doer was a guess when ego / tū was left out), with the
gap's word marked in both lines (`englishMark` in exercises.ts, `Exercise.mark`:
the noun, describing word or verb, the right one of two by its role); a
sentence to change shows what it is to say ("Make it say: I do not write the
book", `answerEnglish`); word tiles say how many are extra (`Exercise.extra`);
an open question shows its English under it.
Endings and forms are typed into the sentence itself (`GapInput`), a sentence to
change starts in the answer box, and the infinitive is asked from the tū form
(its vowel decides it: from discō alone it cannot be known). Only an exercise
between the rule's own says where it is from ("an earlier mistake, once more",
"a word to review", "an earlier rule"). After an answer the card is short, as
the learner chose (`Feedback`): the verdict (with "deus, not deum" when the
answer was one word), the right sentence and its English, one line why, and +1
or "stays". The rest waits under Why? (`WhyBox`): what was written, every slip,
the rule, Ask Claude, and "I think mine is right".

Stories (`src/content/stories.ts`, listed on Lectiōnēs, each on `#story-<id>` in
`src/ui/pages/stories.tsx`): three per lesson (`step`), each with a small plot,
only lesson words and only the rules up to its lesson. A story opens for practice
once all its rules are seen (`storyOpen`); the others wait, naming the parts they
need (`partsBefore`). `en` is the reader's English,
`prompt` the exercise English when it must say more ("the friend (f)"), `who`
the speaker of a dialogue line; two questions each, the right answer first.
A tap on a line shows its English, a tap on a word its meaning; answering the
questions marks the story read (`Progress.stories`), and the story ends with
Continue (`#story-continue`), which goes on with the day; Continue brings each
open story in turn. `tests/stories.test.ts` checks every word, long mark
and rule, and that each exercise on each line accepts its own answer: write a
new story, then run the tests.

Sensible sentences (`silly` 0) come from rules in `src/latin/generate.ts`: what a
verb takes (`OBJECTS`, strict when sensible), who is taught and what can be
learned (`PUPILS`, `LEARNABLE`), whose things and people are (`OWNED`,
`RELATIONS`, `OWNERS`, `mine` for "my"), where people and gods are and what they
do there (`whoAt`, `doneAt`, `HOMES`, `REFUGES`, `NOT_DIVINE`, `makesSense`), and
the word tags in `words.ts` / `deck.ts` (e.g. `long`, `unseen`, `story`). A
genitive never stands between two nouns (`untangle`); in plain sentences (until
a rule is hard) it stays after its noun and the other noun goes after the verb
(«Magistra amīcae legit epistulam», `untangle(out, plain)`; `possFirst` only in
rich sentences), since a genitive in front was read as the subject. The learner found odd
sentences in practice, so `makesSense` also refuses: a teacher's work done by
anyone but a teacher or a poet (`TEACHERS`; the taught are `PUPILS`), "has the
farmer" (`HAD`), "writes the poet's letter", a place with an owner, "the poet is
a student" (`TRADES`), a predicate noun with an adjective, the same adjective
twice, "well" with a verb it doesn't suit (`WELL`), a verb that needs more
standing alone ("they see", `NEEDS_MORE`), and "teaches in the forest"; "in +
an island" reads "to the island". A swap exercise is offered only when the
swapped sentence makes sense too. Words whose good uses need care ("much
water", "the school is full") get hand-made card examples (`CURATED` in
`src/trainer/discover.ts`). Mistakes (`mistakesSession`): unfixed mistakes on
rules seen come back as fresh exercises of the same kind on the same rules and
words, between a rule's exercises; a right answer marks one fixed
(`Mistake.fixed`), a wrong one never duplicates it.

## Words the learner adds

"+ Add a word" on the Words page (and the "Add" of a word card in Ask Claude or
in the messenger) opens one window (src/ui/addword.tsx, `openAddWord`): the
learner types a Latin word in any form, or an English, Russian or Ukrainian
one. A word they have already (any form; lesson words, cards, chat words) is
shown as it is; a mystery card not added yet is added as the card; anything
else Claude fills in (`lookupPrompt` in src/trainer/own.ts, the coach's model:
dictionary line with long marks, meaning, English verb forms, tags from
`NOUN_TAGS`, for a verb the tags of nouns that make sense as its object,
relatives borrowed / same root, origin, history, a hidden link, two examples). The grammar
engine builds the word from the dictionary line (`fromClaude` → `ownEntry`:
noun / verb / adj / adj3 / fixed) and refuses what it cannot read yet
(deponent and irregular verbs). The learner sees the card (forms of the rules
learned, a ? for the rest, origin, history, family, examples) before "Add to
my words". A line typed by hand ("hasta, hastae, f. = spear", `fromLine`)
needs no Claude but is for reading and reviews only (`practice: false`).

Saved in `Progress.own` (`OwnWord`; ids kept apart from other words with
`freeId`: līber next to liber is "liber-adj"); `derived()` builds them into
`own`, `words` and the lexicon, and practice (`buildKnowledge`) uses those
with `practice`. Made-up sentences stay sensible: an added noun goes by its
tags, an added verb takes only objects of the tags Claude named and none when
it named none (`objectsOf` in src/latin/generate.ts), and endings not learned
keep a word out (a third-declension noun waits for its lesson). The Words page
lists them under "Yours", their dialog shows the story (`OwnStory`) and
"Remove from my words"; Ask Claude gets an added word's story as its facts
(Claude's notes, marked as not checked by hand); the people in the messenger
may use them. `tests/own.test.ts` covers all of this.

## Nūntiī: the messenger

`#nuntii`, `#nuntii-<chat>` (src/ui/pages/messenger.tsx, state and sync in
src/ui/messenger.ts, pure logic in src/chat/). Five friends (src/content/people.ts:
character, way of texting, a day in Rome's time with sleep and busy hours, moods
with weights and how strongly they swing, happenings with their durations, ties
to the others): Iūlia (21, poetry student, the girl the learner asked for),
Marcus (23, scribe), Gāius (52, farmer near Tibur), Claudia (38, teacher in
Ostia), Lūcius (29, poet and night owl), and their group «Amīcī».
Portraits (src/content/portraits.ts, generated by scripts/content/portraits.py
from downloaded museum images: painted mummy portraits and a Boscoreale fresco,
CC0 and CC BY 4.0, credited in each profile).

The look follows a picture the learner liked (only the messenger has it):
parchment panels in a scene of real old engravings (src/content/engravings.ts,
generated by scripts/content/engravings.py from CC0 prints at The Met, as
transparent sepia line art, inverted in dark mode): Piranesi's Forum behind the
top bar, Corinthian capitals on columns at the page sides, Livy's bust with the
motto «Discere loquendo mundum aperit» under the chat list. Big faces with a
green / gray presence dot, a search over names and messages ("Quaere nūntiōs…"),
round buttons in a chat's header (find in this chat, the learner's words, a
menu), laurel day lines in Latin for today and yesterday (Hodiē, Heri), bubbles
with tails and a face at the start of each run (a new run after someone else, a
new day, the "New" line or ten minutes), a word tapped shows a card under its
message ("librum — accusative singular of liber (book)", opening the word), and
the composer's ＋ gives emoji and phrases: a Roman tab (the hand-drawn Roman emoji,
then real emoji with a Roman feel), an Everyday tab, and Phrases, the
phrasebook the learner chose (src/content/phrases.ts, `phrasebook`: hello and
bye to the person by name, Salvē, Marce!, or to all, Valēte, amīcī!, each
friend's name in the group, ita / minimē, thanks, how are you, good night, a few
questions and "about me"; each with its English; a word the lessons have not
taught is named in `note`, and the test checks that no other word is new). A
tap puts the phrase in at the cursor. The hand-drawn ones
(src/content/roman-emoji.ts, generated by scripts/content/roman_emoji.py: SPQR,
a laurel wreath, the legion's eagle, the she-wolf with the twins, a gladius, a
crested helmet, a scutum, the Colosseum, a column, an oil lamp, a wax tablet, a
lyre, a gold coin, cave canem) are a small COLR color font ("Roman Emoji",
first in every font stack, loaded in main.tsx) drawing characters U+E100…:
they behave like real emoji in the message box. Messages keep them as codes
(":lupa:", src/chat/emoji.ts: `showEmoji` to show, `emojiCodes` to keep and
send); the people may use them (listed in the language block), vetting and
`withMacrons` leave codes alone, made-up codes are dropped, and a phone
notification shows a plain emoji instead. A message of emoji alone shows big. Avatar sizes come from where they sit
(`--av`, smaller on a phone). The chat stays at its newest message while the
learner is there, also when something below grows (fonts, a card, Check's note).

- Words: the learner's own (lesson words, added cards and their own words, no story-only ones),
  in the forms of the rules seen (`formsFor`), plus the chat words (`CHAT_WORDS`:
  salvē, valē, ita, minimē, quid, quis, ubi, quō, cūr, hodiē, crās, quoque, male,
  optimē, grātiās, heu, euge, ecce, ō, hahae, agō for "quid agis?"; shown on the
  Words page under Chat, glossed in questions) and names (declined; called with
  the vocative: Marce, Gāī, Lūcī). Every message Claude writes is vetted
  (src/chat/vet.ts: unknown words, forms and constructions not met, the engine's
  grammar checks); one rewrite is asked for (`vetAll`), and what still slips is
  kept with its new words marked. Long marks are put back (`withMacrons`).
  A word the learner just wrote may be echoed back in the same form
  (`PromptCtx.echo`: no rewrite for it, though it is still offered to their
  dictionary); «sunt» waits for its own rule (`v.sunt`, Lesson V), «possunt»
  comes with the plural. The literal reading of the learner's message is
  certain only about the words the engine knows: a word it does not know may
  be correct Latin learned elsewhere, never mocked for that. The rules not
  learned yet are named as constructions, not as banned words (models had
  read "Rōmam, Rōmae: a city needs no in" as banning the forms).
- Lives (src/chat/life.ts): `lifeNow` rolls a mood (slightly / plainly /
  extremely, by the person's swing) and maybe a happening (their own, an everyday
  one, or now and then an odd one) and keeps them for hours; the profile shows
  "Today". What lives add up to is in src/chat/lives.ts: a happening is
  `public` (the neighbours know: others' prompts carry it as neighbourhood
  news, `neighbourhoodBlock`, and the Ācta may print it) or theirs alone; a
  `heavy` one (grief, illness, debt, an engagement, two of each friend's own)
  starts only after a calm week in the world and three weeks for that person
  (`heavyOk`, `CALM_DAYS`), their own heavy ones seldom even then, and what
  comes after it always comes (`then`: one of two consequences, e.g. Titus
  home with a wild story, or still no news). A happening that matters is
  remembered by its person (`noteHappening`: lasts 12 h, public or heavy),
  goes on the timeline (heavy, or public for a day) and may bring a want.
  Goals (`Meta.goals`, `goalsOf`: each friend's `wants` at first; `goalsLine`
  in every person block with ids): Claude reports "goals" (a step, done,
  dropped, or a new want; four open at most); done or dropped goes on the
  timeline. What they do goes on it too (`applyDeeds`: a storyline begun or
  ended, someone leaving, joining or thrown out of a group, a group started,
  a block, going away, someone new joining), each known to those who would
  know. A happening's mood keeps coming back while it lasts (`eventMood`: a
  late ship keeps Claudia anxious). The timeline (`Meta.world.timeline`, 60 kept, merged by id) is
  the world's shared history, shown to a chat only as far as its people know
  of it (`timelineBlock`, `knowsOf`), all of it with who knows in the
  own-writing prompt and the brief; after four quiet days the own-writing
  prompt says life may bring something (`quietDays`). Claude may make
  something happen ("happen": a consequence of what went on, or out of the
  blue; `applyHappen`: their life now, the timeline, a memory; 72 h or more
  is heavy). `applyFeelings` applies goals and happenings and returns the
  memories they leave; `refreshLives(…, out)` collects what began.
  `tests/lives.test.ts`. `statusAt` says asleep / busy / free in their time zone;
  `replyTiming` decides when they read and answer (a sleeper answers after waking,
  one in twenty is woken up; busy people answer in between or later).
- Strangers (src/chat/strangers.ts): "Someone new" rolls the dice (sex, age,
  portrait, name, city across the empire with its time zone, job, temper from
  mild to extreme, a quirk or none, why they write, how they text, their day,
  whether they write first) and Claude makes a person of it (`meetStranger`:
  about, secret, their own happenings, first messages). A stranger leaves the
  list with "Say goodbye".
- Connected, as the learner asked ("most of them are interconnected"): seven in
  ten strangers know one of the friends (`LINKS`: Marcus's landlord, a sailor on
  Titus's ship, Gāius's neighbour…, living where the link needs them), and that
  friend knows them too (`knownPeople` in their sheet). In a private chat the
  prompt carries what was said lately in the group, if the person is in it
  (`groupLately`); the others' news reach them only as memories (told or seen).
- They live through the Roman year in real time (src/chat/calendar.ts, content
  in src/content/calendar.ts): 2026 is AD 100 (`YEAR_OFFSET`), so the friends
  live under Trajan and next spring he leaves for the Dacian war. Every prompt
  carries the day (`calendarBlock`: the Roman date, a.d. IV Īd. Oct.; festivals
  going on, coming within a week or just past, from the Kalends of January to
  the Saturnalia; the friends' birthdays (`BIRTHDAYS`); the news of `HISTORY`,
  each on the day Rome hears it, planned ones talked of two weeks ahead). The
  names the day brings (Sāturnālia, Trāiānus, Dācia…) may be written while they
  are near (`calendarWords` → `calendarEntry`). The list shows today's Roman
  date and festival (`todayLine`), each day line its Roman date.
- They take the learner's mistakes literally (the learner asked): the reply
  prompt carries the learner's last messages read word by word by the engine
  (`literalReading` in src/latin/facts.ts: what each form is, sentence by
  sentence slips), and Claude reacts in character to what it literally says
  («Aqua tē bibit?! 😂») without explaining grammar.
- Voice messages: Claude marks about one message in eight `"voice": true`; it
  shows as a player (▶, a waveform, its length, Aa for its words) and plays with
  the device's Latin voice in the sender's own pitch and pace (`Person.voice`,
  `voiceOf`; a man's or a woman's voice by name when the device has one,
  `voiceFor`). No free online voice reads classical Latin, so the device's
  respelled voice it is; without one the words show at once.
- Photos: what a Roman of AD 100 with a camera in their pocket would send
  (selfies, lunch, the mess after a party, a goat on the roof, a chariot crash).
  Each looks like themselves (the learner chose the painted portraits):
  `withLooks` (src/chat/pictures.ts, and `with_looks` in the routine's helper,
  tested to agree) makes a fresh picture's prompt with the fixed look of
  whoever is in it (`Nature.look`: anyone named, their name left out, and a
  selfie's sender), while the chat shows what Claude said it shows; the
  library's seven photos of the friends were made again from their looks.
  Each sends photos by their habit (`photoRoom`, `photoHabits`: often three a
  day, sometimes one, rarely one in three days; a photo beyond it is taken off
  its message, and the prompt offers photos only to those with room; the
  routine's vet refuses it).
  A message carries `"photo": "<id>"` from the library (src/content/photos.ts:
  130 phone photos, each with what it shows and who would send it; made by AI
  Horde, aihorde.net, free volunteers' generators that need no key, from the
  scenes in scripts/content/photos.json by scripts/content/photos.py: small WebP
  files published beside the page; not one sent lately), or `"picture": "<what
  it shows>"` for a fresh one when nothing fits (`PICTURE`, only while
  `PromptCtx.canMake`: eight a day, `MAKE_PER_DAY`). A fresh picture is a `Pic`
  (model.ts) in its own document `…/messenger/pics/<id>` ("wanted" with its
  prompt, then "done" with the image in base64, or "failed"); the message holds
  `pic` and `picEn` and shows "Photo on its way…" until it is made
  (`PicInBubble`, `picOf` follows the document). The page cannot reach the
  internet (its network is closed), so a routine makes them: the page fires
  "Nūntiī: pictures" (trig_01UuDAZrviveDMPR1sjce698, no schedule, a fresh
  session per firing, no notification; scripts/pictures-routine.md with the
  same helper embedded: it queries the wanted pictures, makes them with
  `nuntii.py pictures` and updates their documents) through the Claude Code
  Remote connector (`callConnector` in platform.ts, `firePictures`, at most once
  in 90 s); without the connector the hourly routine makes them. The routine
  also makes fresh pictures for its own messages (`nuntii.py picture`).
- Natures (src/chat/nature.ts; the friends' in `Person.nature`): what makes
  each person different, as data the code uses, so they are not variations of
  one assistant: how much they talk in a group (`talk`), how many messages in a
  row (`burst`: Gāius two, Marcus four; enforced in replies, in writing on
  their own and by the routine's vet), how long they write (`length`) and how
  when something matters (`deep`), showing feelings (`open`), keeping secrets
  (`discretion`), photos (`photos.rate`, `what`), love (`romance`), what fills
  their days (`interests`), their fixed look for pictures (`look`, from
  their portrait), and their way with feelings: where they start with the
  learner (`start`), how fast hurt heals (`forgive`: Gāius 0.3 a day, Marcus
  3) and how fast they may fall for someone (`fall`: Lūcius 2 a day, Gāius
  0.3). A stranger's comes from their rolled style and temper
  (`strangerNature`, steady by id), with the look, love and interests Claude
  gives when making them (`naturePartsOf`). `natureLines` puts it into every
  person block and the routine's sheets; the language block lets length follow
  the person and the moment (short small talk, more when it matters, never a
  paragraph).
- Minds (src/chat/mind.ts): what each person remembers and how they know it,
  one document each, `messenger/minds/<id>` (merged by memory id across
  devices; a thread's old `memory` facts and a bond's `moments` were moved in
  once, `migrateMinds`, with steady ids). A `Memory` is in their own words,
  with whom it concerns (`about`), a kind (moment, fact, promise, plan,
  secret, joke, conflict, news), a weight (1-5), how they know it (`from`:
  "saw" = was there or lived it, a person's id = told by them, "rumour"), the
  chat, and flags: `secret`, `untrue` (believed but false), `done` (settled),
  `outdated`. `recall` picks for a prompt what weighs, what is recent, what is
  open (promises, plans, fights), and what the conversation touches (its
  people, its chat, its words), and beside what they were told in the last
  three days, a couple of their own memories of the same people (so a
  two-faced compliment can be caught: "he called Lūcius a bad poet to me");
  `prune` keeps 80, the most salient. Replies and
  their own writing return `remember` (per person: in a group each may
  remember it differently), `settled`, `outdated`, and `tell` (someone passes
  something on out of the learner's sight; it may be garbled or a lie;
  `applyMinds` gives the one told the memory, and the teller the memory of
  telling). What someone remembers of a message of their own goes with it
  (the own-writing prompt's per-message "remember", the routine's; `Memory.msg`):
  a message not sent is not remembered, and one that never reaches the learner
  (taken back by the learner's Send while on its way, or cut by `overPace`)
  takes its memories along (`forgetWith`: marked outdated, so another device's
  copy does not bring them back). Where the learner lives (Kyiv) the five
  friends know; anyone else only once told (`learnerBlock`). Knowledge has boundaries: a prompt carries only its people's own
  memories (`memoryBlock`); the old blocks that let every friend know what the
  learner said to the others, and how the others feel, are gone; storylines
  carry who knows of them (`Drama.knows`) and show only to them (`dramaBlock`
  with viewers; the own-writing prompt, which decides for everyone, sees all
  with their knowers); a private chat sees the group's recent talk only if its
  person is in the group. The routine's sheets carry each person's memories,
  and its messages may carry `remember` and `tell` too (kept on the inbox
  document; the page applies them, checked by `routineMinds`, when it takes
  the message in).
- Pacing, as the learner chose ("like real people"; src/chat/pace.ts): plenty
  while the learner is chatting; when they go quiet, each person sends a burst
  or two (`Person.pace.patience`), waits (`wait` hours, longer each time), tries
  once or twice more (`nudges`) and then leaves it to the learner. A burst is
  messages within 30 minutes; their answer to the learner's last message does
  not count (`paceNow`, `mayWrite`). Strangers wait by their temper
  (`strangerPace`). The group has a rhythm of its own (`groupMayWrite`: up to
  four talks a day while the learner takes part, one a day when they have been
  away for days, three hours apart; a stretch of talk among them may run to 14
  messages, `GROUP_RUN`, a private burst to the person's own `burst`). Their
  feelings change it too (`bondPace`, Bonds below). Nobody says again what they said in that
  chat lately (`similar`, `repeats`), nor sends a photo sent there lately
  (`photoSentLately`). `allowOwn` applies all of it to every message written on
  their own: in `writeOwn`, to the routine's messages when they come in from
  the inbox (in the order written), and once per page load to what is already
  in a chat but not seen yet (`overPace`, as tombstones). The prompts say who
  may write and who is waiting (`paceLine`), and when the learner comes back
  the person knows how long they waited (`returnLine`). The routine's helper
  has the same rules (`may_write`, `allow_own`; `tests/pace.test.ts` checks
  both decide alike). On 19 Oct the routine had sent 70 messages unanswered
  (Marcus's "Hodiē Mārs!" fifteen times): that is what this stops.
- Claude is asked only on the learner's actions: Send (one answer per burst:
  2.5 s pause; answers still on their way are taken back and written again),
  opening the messenger (at most every 3 hours, `writeOwn`: what they write on
  their own in the next three hours, each at its time), Someone new, Check
  (the coach: verdict, corrected Latin, a note), and a question to the coach.
  Check on English, Russian or Ukrainian gives the Latin to send (verdict
  "say", shown as "In Latin" with Use this), since the learner kept asking "how
  do I say…"; a hint under the box says so when it holds no Latin (`notLatin` in
  src/chat/words.ts).
  The coach's window (`CoachPanel` above the message box) collects the checks
  and the learner's questions about them (`askCoach`, `coachPrompt`: short,
  «Latin», a word's origin and story when asked about a word); it stays open
  while the learner types (they fix the message with the correction in view)
  and over a reload (localStorage per chat) until closed; a check under a sent
  message has "Ask the coach about it". The coach judges the Latin, never the
  vocabulary: any word is welcome and never pointed out as new unless asked
  (`ANY_WORD`; the engine's unknown-word note is no longer sent). Prompts: src/chat/prompts.ts
  (who they are, their day and mood now, the learner, the conversation, when the
  answer arrives, how to be real, and the strict language block).
- The learner's own abilities: "New chat" (`NewChat` in messenger.tsx) writes
  to anyone: the people they know; someone from the story (`SIDE_PEOPLE` in
  people.ts, or any name typed: `storyPerson` → `meetFromStory` in engine.ts
  with `storyPersonPrompt`: Claude makes them from the story, a face and a day
  from the dice, `Stranger.story`, shown at once; someone already there is
  found, not made again; anyone made is 18 or older); a group of their own
  (`NewGroup`, `createGroup`: chat id "g-…", kept in `World.groups` as a
  `GroupInfo` with its name, members and maker; the people find themselves in
  it and answer); or Someone new. A group's sheet (`GroupSheet`, tap its name)
  renames it, adds and removes people (someone removed remembers it: a bond
  moment), mutes it and leaves it (not the friends' group). The people can
  start groups too (act "newGroup", with "me" in it and its first messages),
  remove someone and rename any group ("group": its chat id). The menu of a
  chat: Mute (`Meta.mine.muted`: no notice, a grey count, nothing on the tab,
  no phone notification), Clear chat (`Thread.clearedAt`: hidden on the
  learner's side, remembered by them), Block (`Meta.mine.blocked`: the message
  box gives way to Unblock; what they send in private never arrives; they are
  told in their sheet and may suspect it). A tap on the learner's own message:
  Reply, or Delete (a second tap: "Delete for everyone?"); the people are told
  whether they had read it first. The ＋ holds Photo (only where Claude can be
  shown pictures: `canSendPhotos`; shrunk to a JPEG under the store's limit and
  kept as a `Pic`; the next answer shows Claude the learner's new photos, its
  `saw` is kept as the message's `picEn`) and Voice message (the next message
  goes as a voice note, read in the learner's voice). `tests/chat.test.ts`
  ("the learner's own abilities") and the smoke test's `abilities` part.
- Relationships (src/chat/model.ts `Bond`, `Meta.bonds`): each person keeps
  how they feel about the learner in their own words (`feel`, first person,
  private: never shown on the page) and the silent treatment (`silentUntil`);
  what happened between them is in their memories now (Minds above; the old
  `moments` were moved in). Friends start from `first` and have a
  `heart` (src/content/people.ts: what stings them, what wins them over, how
  they fight, sulk, make up and show love); a stranger's first impression comes
  from Claude (`Stranger.first`). The prompts read `bondBlock` in every person
  block (and in the routine's sheets); how the others feel reaches someone only
  if told; the persona text (`HOW_TO_BE_REAL`, "BE THEM") describes people, not
  rules. A reply may be no answer at all, and returns `feel`, `mood`
  (lasts four hours) and `silent` (hours, 0 ends it) per person
  (`feelingsOf`, kept by `applyFeelings` after each answer); writing on their
  own, feelings drift too (missing the learner, cooling off), and someone
  ignoring the learner writes nothing in private (`writeOwn`). Bonds merge per
  person, the newer winning (`mergeBonds`).
- Bonds in levels (src/chat/bond.ts), beside the words: where each person
  stands with the learner, 0-10, in six levels (warmth, trust, respect,
  desire, hurt, interest: `Bond.lv` as at `lvAt`). Claude reports changes in
  "bond", by small steps (±1, ±2 what matters, ±3 a shock; `stepLevels`):
  growth has a daily limit (warmth, trust, respect and interest 2, desire
  the person's `fall`: a crush takes days, at each one's pace), a fall is
  sudden, and real time does the rest (`levelsNow`: hurt heals at `forgive` a
  day, interest returns to their usual after two days apart, warmth and desire
  fade slowly after a week). Someone never measured shows NOT SET YET in the
  prompt, and Claude's "levels" set them once (where they stood just before
  that moment), read from how they feel and what happened (the live friends
  had a week of story before levels existed), within four of where their
  nature starts (`FIRST_REACH`: first impressions are not extremes);
  after that only steps move them. `standingLine` puts them in every person
  block in words ("desire 6 (falling for)"); the routine's sheets show them
  without asking. They change the pace (`bondPace`, via `paceOf(id, meta,
  now)`, also in the brief): deeply hurt (7+) never writes first, hurt (4+)
  chases less, in love or devoted tries once more and waits less, bored stops
  chasing. Among themselves: ties (`Meta.ties`, "from>to": levels, a `note`
  in their own words) start from each friend's `feels` (content/people.ts:
  Lūcius → Iūlia warmth 9, desire 8) and move with Claude's "ties" (fights,
  kindness, betrayal, jealousy, a spark), the same limits and healing;
  `tiesLine` shows each person only their own (Marcus does not see how Lūcius
  feels about him). Merged per pair (`mergeTies`), 80 kept. Never shown on the
  page. `tests/bond.test.ts`.
- The group as a group (src/chat/group.ts): for a group answer, `sceneOf`
  reads when each member reads the learner's message (`timingFor`): those
  within ten minutes of the first reader are here for the live talk, the
  others (asleep, busy with no time to look, away) catch up later; it finds
  whom the learner named (any case of the name, `namedIn`: «Iūliam», «Gāī»)
  and who is likely to answer first (talkativeness, named, interest, desire,
  hurt, a little chance). `sceneBlock` says it in the group's prompt.
  `groupCaps`: someone not around sends two messages at most (`CATCH_UP`), a
  quiet one (talk under 0.3: Gāius) one, unless named. Someone not around is
  scheduled on their own clock, from when they read it: before, a sleeper's
  line held up every message after it until morning. Not everyone looks at
  the same minute (`timingFor`): after the first two readers of a group
  message, most of those who would read it at once read it 10 to 90 minutes
  later (the experience test's welcome came as a chorus of four in a
  minute). The live talk keeps eight messages; a latecomer's are not counted
  in it. `tests/group.test.ts`.
- Freedom (src/chat/world.ts): the persona text describes people, not a plot
  ("BE THEM"), and `CAN_DO` lists what they may do, never must; Claude chooses.
  Besides messages a reply or their own writing may carry `acts` (block /
  unblock the learner, leave / join / add to the group, rename it, delete a
  message of theirs, a status line, away for hours to days and back),
  `drama` (storylines among them with who knows what, kept in
  `Meta.world.dramas`, six at most) and `newPerson` (someone they bring in: a
  face and a day from the dice, `inventStranger`; hidden from the chat list
  until they write; may join the group or write first); a message may carry
  `gloss` (one or two new words in a strong moment, kept by `vetAll` instead
  of rewritten, shown on tap) and `unsend` (taken back seconds later:
  `deletedAt`, shown as a deleted message). `deedsOf` checks what Claude said,
  `welcome` and `applyDeeds` make it real, `enact` (src/ui/messenger.ts) saves
  it; the group's name and members are `groupName` / `groupMembers` (the five
  to begin with). The messenger's own lines ("Lūcius left the group") are
  messages from `SYS` with their text in `en` and the actor in `by`.
  Blocked: the learner's messages are not answered (one tick), presence says
  "last seen a long time ago", and their profile shows nothing they set; a
  message from them (or an "unblock") ends it. Away: they read much later.
  Heavy happenings (`HEAVY_HAPPENINGS`, and two of each friend's own) come
  rarely, last days and have consequences (Lives above). Opening the messenger lets them act every hour
  (`PLAN_EVERY`). Add a new ability by adding it to `ACT_KINDS`, `applyDeeds`,
  `CAN_DO` and the page.
- Like a real messenger (the learner asked for it to feel even more like real
  people): a tap on someone's message shows its English and a row of reactions
  (❤️ 😂 👍 😮 😢 🙏) with Reply. A reply carries `re` and shows the message it
  answers quoted above it (a tap on the quote brings that message into view).
  The people react too (`"react"` in the reply JSON: one emoji per person, a
  moment after they read it, `Reply.reactions`; now and then a reaction is the
  whole answer) and quote an earlier message by its number (`"re"`: the
  conversation block numbers its lines, `shownMessages`, and shows quotes and
  reactions). Reactions merge per person, the newer winning, a taken-back one
  included (`mergeReactions`). Friends talk, but only as people do: what one
  was told in private reaches another only if they pass it on (`tell`, by
  their nature: Marcus spills, Gāius keeps; see Minds), and when they write
  on their own they see what they remember, to follow up.
- Feels real: typing dots (from reading, while Claude writes, until each
  message), read ticks, "online" / "last seen", day separators, a "New" line,
  a notice for a message arriving elsewhere in the app, an unread count (Roman
  numerals) on the tab. Tap a message for its English, a word for what it is
  (with a speaker to hear it; a word not among the learner's words, or unknown,
  gets "+ Add"). Words the learner wrote that the site does not know (cor,
  timēs) show under their last message as "New words" chips (`strangeWords` in
  src/chat/words.ts: a capital that only starts a sentence goes), one tap from
  Add a word; once added, the friends may write them back and practice reviews
  them. The notice of a message arriving elsewhere (and any toast) can
  be swiped away like a phone notification (`useSwipeAway`); a tap opens the
  chat. On a phone Enter makes a new line in the message box and in Ask Claude,
  and the arrow sends (`enterSends`); the box grows with its lines.
- Ācta Diurna (src/chat/acta.ts, the learner chose "a daily Roman newspaper"):
  Rome's board of the day, pinned on top of the chats (`ActaRow`, `#nuntii-acta`,
  `ActaView`). Once a Roman day (`actaKey`) Claude writes it with the chat
  model (`ensureActa` in src/ui/messenger.ts: when the page opens and when the
  messenger opens, after the account's chats have come in; Try again after a
  failure): 4-5 items, each a kind (Diēs the day and its festival, Urbs the news
  of Trajan's Rome from the calendar, Amīcī what the neighbours know of the
  friends (only their public happenings and public news of the last days:
  `publicNow`, the timeline), Titulus a notice like those painted on Pompeii's walls, now and then a
  Prōdigium), a title and one to three short lines, only in the learner's words
  and rules (`actaPrompt` with `languageBlock(ctx, false)`; every title and line
  vetted with `vetAll`), earlier boards given so it does not repeat and may
  follow one up (`earlierBoards`). Each item is a post with the id of the day
  (`acta-20261012-0`: two devices writing at once merge into one board), its
  lines one per line in `la` / `en`, `title` and `tag`. A tap on a line shows
  its English, on a word what it is (`WordCard`, shared with the chats); each
  item's speaker reads it with the device's voice; the eye shows all the
  English; Ask Claude sees the board; Continue goes on with the day.
  A new board counts one on the tab and comes in Continue (`todayStep`'s "acta").
  `tests/acta.test.ts`; the smoke test reads one on two devices.
- Phone notifications: a Claude Code routine (trigger "Nūntiī: Roman friends
  write", trig_01QU7TocqJanmp7LVdamvvdJ, a fresh session per run, push
  notifications, CRON_TZ=Europe/Kyiv every hour from 7:51 to 23:51, as the learner asked for much more texting) follows scripts/messenger-routine.md (with
  its helper scripts/nuntii-routine.py embedded, as a routine's session may not
  have this repo: who is awake, moods, the chats; the word check; the
  notification line): it reads the brief (src/chat/brief.ts: the learner, the language block, every
  allowed spelling, everyone's sheet and their lives rolled 48 h ahead, the day
  in Rome for today and the next two days, the photos, the groups, whom the
  learner blocked and muted, each person's pace, the groups' members), and the
  inbox (messages it wrote earlier that the page has not moved in yet count as
  sent), makes the pictures still wanted, plans 0-3 messages (a voice message,
  a photo or a fresh picture now and then), and passes them through
  `nuntii.py vet`: words, pace, repeats, a photo sent lately, asleep, blocked
  or giving the silent treatment; only what passes is saved, as the inbox
  documents vet makes (ids and times). It ends with one line about what arrived
  since its last run (`last_run`, from the trigger's schedule: what the people
  wrote on their own and this run's messages; each message is told of once, so
  unread old ones do not come back every hour; muted chats left out), which
  becomes the notification ("No new messages." when nothing came). Change its
  schedule or prompt with update_trigger (keep the prompt in sync with that
  file).

## Audio

Two voices, as the learner chose. **The recorded voice** reads every fixed text
(the videos' sentences, phrases and stories, the stories of Lectiōnēs, the rules'
examples, the sayings, the open questions, every word: `fixedTexts` in
src/audio/fixed.ts): recorded once with Piper, an open-source neural voice
(es_MX-claude-high, the clearest in a speech-recognizer test against
es_ES-davefx), from the Spanish respelling below, with two Latin touches on
the phonemes: a hard b, and the h Spanish leaves silent (habet). A hard d and g
were tried and dropped («videō» came out as "cuidado"). The same voice on every
device. `scripts/audio/record.py` (a venv with piper-tts, a model from
huggingface.co/rhasspy/piper-voices) writes src/content/audio/<pack>-<hash>.js,
small scripts setting `window.__tabulaAudio[pack]` to an MP3 in base64 (one
pack per lesson, per step of stories, the rules, the words; files beside the
page, `MEDIA` in the build), and src/audio/recorded-index.json (key → pack,
start, length; `audioKey` in src/audio/key.ts: lower case, no long marks or
punctuation). The page loads a pack the first time a clip of it is needed and
plays the clip with Web Audio (`playRecorded` in src/audio/recorded.ts: started
inside the tap, `navigator.audioSession.type = "playback"` so an iPhone's silent
switch does not mute it, the device's voice when it cannot start, a timer when
its end never comes). `speak()` uses it whenever a text has a recording
(Settings: "Recorded voice", on by default; never for a person's voice message),
and a speaker shows for a recorded text even on a device with no Spanish voice.
`tests/recorded.test.ts` fails when a fixed text has no recording or the texts
or their respelling changed since (`fingerprint`): run the script again (after
adding a lesson too). Piper reads a little differently on every run, so the
script keeps a pack whose texts and respellings are unchanged (`hashes` in the
index) and records only the others (`--fresh` records all); publish the packs
whose names changed and set the old names to `null`. The smoke test's
`recorded` part plays one.

**The device's voice** reads everything else (new sentences, messages). Settings
lists only Spanish and Italian voices, picks the best by name (Premium, then
Enhanced, then Natural / Online, then Google), and "Get a better voice on this
device" says how to install a free premium voice on each kind of device.

No browser has a Latin voice. `src/audio/pronounce.ts` respells Latin for a
Spanish voice (Italian as fallback) so the device's own speech engine reads it
with classical sounds: c and g hard (Spanish qu / gu, Italian ch / gh), v as w
(u), ae as "ai", gn as "ngn". For Spanish the Latin stress (penult if long, else
antepenult) is marked with an acute accent, which Spanish voices follow anywhere
in a word. Italian gets no accent marks: Italian voices spell out an accent in
the middle of a word (*videō* came out as "u i accento grave deo").
`src/audio/speech.ts` picks the best Spanish voice and speaks; `speakSequence`
drives Listen & repeat and stops as soon as anything else is read (an utterance
cut short resolves as stopped). Only Spanish and Italian voices, without Apple's
novelty ones (Grandpa, Bells…), are listed in Settings or ever used. Only Latin words reach the voice (`speakable`: reading
hints go, separators such as the · of a word list become pauses), and a word's
speaker says just the word, never its whole dictionary entry. Audio buttons are hidden when the device has no Spanish
or Italian voice (Settings explains how to add one). The smoke test fakes an
Italian and a Spanish voice to exercise the audio paths.

## Adding a lesson (e.g. "add lesson 5")

1. **Get the content.** YouTube blocks video downloads from cloud IPs, but
   auto-captions work with yt-dlp's embedded web client (needs youtube.com and
   GitHub allowed in the environment's network settings):

   ```sh
   python3 -m venv /tmp/venv && /tmp/venv/bin/pip install yt-dlp
   /tmp/venv/bin/yt-dlp --js-runtimes node --remote-components ejs:github \
     --extractor-args youtube:player_client=web_embedded --ignore-no-formats-error \
     --skip-download --write-auto-subs --sub-langs en-orig --sub-format vtt \
     -o "lesson5.%(ext)s" https://www.youtube.com/watch?v=GnoqpwWFjQA
   python3 -I scripts/content/vtt2txt.py lesson5.en-orig.vtt > lesson5.txt
   ```

   Captions carry the English narration well but garble the Latin; rebuild the
   Latin from context and mark anything uncertain (`unverified: true` on story
   lines). Stories are read in Latin without narration, so ask the learner for
   a screenshot or text. Also check the 2025 re-recording for corrections.
   Lesson video ids: 5 GnoqpwWFjQA, 6 rP9X3gaD0uY, 7 -Dn--UN-PSA, 8 CSCfD1yiG5I,
   9 etJy99U1YBc, 10 _O360QTciZo, 11 Z6YCvOnWyi4, 12 ARW59NnVttE.
2. **Words**: add them to `LESSON_WORDS[n]` in `src/content/words.ts` with
   full grammar (`noun`, `verb`, `adj`, `adj3`, `fixed`). Story-only words go
   in `STORY_ONLY`. Give each one its English (and Russian / Ukrainian)
   relatives in `LESSON_WORDS_IN_ENGLISH` (`src/content/english.ts`): the test
   fails on a lesson word without an entry, and the "find the Latin" exercise
   quizzes the plain English words listed there.
3. **Skills**: new endings or constructions get ids in `src/latin/skills.ts`
   (e.g. `n1.acc.pl`, `v.1pl`, `n3.nom.sg`). The generator only uses a form when
   its skill is unlocked; add templates in `src/latin/generate.ts` for new
   constructions, and teach `english()` to render them.
4. **Lesson page**: add the lesson to `src/content/lessons.ts`: sentences from
   the video, story, phrases, rules as What / How / When with examples, a
   Russian / Ukrainian comparison where it helps, and `fixes` where this site
   departs from the video.
   (The What / How / When texts appear under "More detail" on the parts; a rule
   that teaches no skill needs a `more` entry on the part it belongs to.)
   Then split its rules into parts in `src/content/parts.ts` (`5.1`, `5.2`, …):
   each in a few very simple lines, with examples that need only the rules met
   so far, and two open questions whose good answer passes its own keys. Every
   new skill belongs to one part (`tests/parts.test.ts` checks all of this, and
   that each part's practice reaches every rule it opens).
5. **Mystery cards**: cards in `src/content/deck.ts` unlock by grammar; nouns of a
   new declension become usable once its skills exist. Every relative must be
   correct: `from` = borrowed from Latin, `kin` = same ancient root.
6. **Stories**: three for the new step in `src/content/stories.ts`, only words
   and rules up to it (`tests/stories.test.ts`).
7. Run `npm test` (the content test fails on any misspelled form or missing
   long mark), record the audio again (`scripts/audio/record.py`: only the packs
   whose texts changed), `npm run build`, `npm run smoke`, then republish to the
   same URL. The learner ticks the new lesson with "I have watched it" (the Next
   video card) or under Settings > Lessons watched (their saved progress keeps
   its own list).

Lesson V, as built: -mus with nōs (`v.1pl`; "Poēta et ego legimus" is 1pl),
sunt with a plural describing word (`v.sunt`; while it is practised the `est`
template takes a plural subject, `onlyPlural`, and a predicate adjective
follows the subject's number), the dative -ae / -ō with dō, dare (short a but
dās) in the `dat` template (`GIVING`: someone gives a portable thing to a
person; `s.dat`), and a city without in / ad (`s.city`: «Rōmam ambulat»; the
locative «Rōmae» is not a case the engine reads, so it is marked `Rōmae#x`).
volō, omnis, clārus, rēctus, splendidus and arma are story-only. A mystery
card a later lesson teaches (via, dūcō, clārus) stays in the deck and is left
out once that lesson is watched (`deck()`, `derived()`, `fullLexicon` count it
once).

## Conventions

- Latin is stored with long marks (macrons); typing never requires them.
- In content strings, `«…»` marks Latin to color, `word#gen.sg` forces a
  reading of an ambiguous form, and `word#x` leaves a word that only looks like
  a known form uncolored (*fīnis* is not *fīnīs*).
- Famous sayings live in `src/content/sayings.ts`, linked to word ids; the
  Words dialog and the mystery cards show them. Check each one's colors with the
  analyzer before adding it.
- Latin in English (`#english`, `src/content/english.ts`, `src/ui/pages/english.tsx`):
  how English took Latin (waves), each known word's English relatives, Latin
  verb forms and plurals inside English, grammar rules English took from Latin,
  word parts, spelling, grammar terms, abbreviations, phrases, Russian /
  Ukrainian parallels. It sits under Verba > Orīginēs (a card at the top) and
  is read one screen at a time, with quick questions (`englishSteps`; the old
  "find the Latin" `derive` exercises remain only for mistakes made in them).
  Claims there must be etymologically sound: borrowed vs. cousin (kin) vs.
  look-alike (trap), as in the deck.
- Each case owns one color (see `src/styles.css`); nothing else in the UI uses
  those hues.
- Roman touches, in gold and brown only: the hedera (ivy-leaf mark, `Hedera`),
  diamond interpuncts, tabula ansata plaques (`.ansata`) for verdicts and
  notices, tesserae (`Mosaic`, the session strip), the laurel wreath, Roman
  numerals for counts, years, lessons and conjugations, a stylus cursor over
  the wax. Keep them small and quiet.
- Known content gaps: story lines marked `unverified` were rebuilt from the
  narration; Lesson 1's student may be *discipulus* rather than *discipula*.
