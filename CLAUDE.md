# Tabula Latina

A Latin trainer that follows the YouTube playlist **Easy Latin Lessons**
(https://www.youtube.com/playlist?list=PLjqqMkeHFt1E_lRi9nQvtmP9Od2JokI1J),
published as a private claude.ai artifact.

## The learner

- Native in English, Russian and Ukrainian. Explanations are in English;
  comparisons with Russian / Ukrainian cases are welcome.
- Finished Lessons 1-4 (October 2026). Remembers the words but forgot most of
  the rules, so practice restarted step by step from Lesson I and should feel
  very simple at first ("I want to think little"). Now learns the rules in small
  parts: a very simple explanation, open questions, then a bunch of simple
  exercises before harder ones, and never an exercise on a rule not seen yet.
- Wants: only words and constructions from the videos (plus words they open
  in Discover), lots of written exercises, colored endings, Roman classic look,
  light motivation (daily goal + streak), and only sensible sentences: silly
  pairings ("the bull reads the letter") confused them, so `settings.silly`
  defaults to 0 and progress version 3 switched existing saves to it.
- Follows the original playlist, with corrections from the 2025 "New Easy
  Latin Lessons" playlist (PLjqqMkeHFt1FjCaUrdcdMxF15sKUk9rHs) where they differ.

## Commands

```sh
npm install
npm test            # engine, content and exercise self-tests (vitest)
npm run typecheck
npm run build       # -> dist/tabula-latina.html (the artifact page) and dist/preview.html
npm run smoke       # clicks through the built page in Chromium, saves screenshots to dist/screens
node scripts/build.mjs --dev   # unminified build for debugging
```

## Publishing

The page is `dist/tabula-latina.html`: no doctype/head/body of its own (the
artifact publisher adds the skeleton), `<title>` and `<style>` first, all JS
inlined. Publish with the Artifact tool:

- first publish: `file_path: dist/tabula-latina.html`, `icon: "scroll"`,
  `capabilities: {sample: {}, db: {}, user: {}}`
- updates: same `file_path` plus `url: <artifact url>`, and omit
  `capabilities` so the stored ones are kept.

Artifact URL: https://claude.ai/artifact/3cvi4ofuaPLg6LfXXf7efX (also in README.md).

Runtime capabilities used:
- `sample`: the Ask Claude drawer, "I think my answer is right" (judge), and the
  check of an open answer on a rule's page (`checkUnderstanding`).
  Ask buttons only put a suggested question in the box; nothing goes to Claude
  until the learner presses Ask. A suggestion is added after what the learner
  has typed, never in its place (`withQuestion`); only an earlier untouched
  suggestion is replaced. A new conversation offers four quick questions:
  where the word comes from, which words are related to it, a memory trick,
  and a comparison with Russian / Ukrainian. A question about origins or
  relatives carries the site's checked relatives of each word in its facts
  (borrowed vs. same root vs. look-alike, from `wordInEnglish`), so Claude does
  not invent etymologies. A failed answer shows plain advice, Try again,
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
  into view; reading higher up never shows it). Answers are short and
  structured by default (a bold one-line answer, then 2-4 bullets) and longer
  only when the learner asks (`INSTRUCTIONS` in src/ui/ask.tsx). The profile sends
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
  wrong example or as the learner's own words is left alone). A finding shows
  as a "Grammar check" note under the answer, with "Fix this answer", which
  sends the findings back (a turn of `kind: "fix"`). The learner cannot judge
  answers themselves, so there is no "this is wrong" button. Answers and the
  judge use the balanced model at high effort (`MODEL` in ask.tsx); the most
  capable tier is the next step if answers still slip.
- `db` + `user`: progress in the viewer's private doc `data/users/<id>/progress`.
  The page also keeps a copy in localStorage; the newer `updatedAt` wins.
  Ask Claude conversations: one private doc each at
  `data/users/<id>/chats/threads/<chatId>` (src/ui/chats.ts), followed live with
  `onSnapshot`, so a conversation continues on any device; the question is
  saved before the answer arrives. localStorage keeps a copy of the list, the
  unsent text per conversation and whether the drawer was open, so a reload
  loses nothing. Each saved answer records the model tier that gave it.

## Rules one at a time, then practice

The learner asked for each video's rules in small parts, explained very simply,
with open questions to check understanding before any exercise, and never an
exercise on a rule they have not seen. `src/content/parts.ts` splits Lessons I-IV
into 22 parts (`Part`: `explain` lines, `examples`, a `slavic` comparison, two
open `questions` with a good `answer` and `keys`, and the `skills` it opens;
`practised` when not all of them can show up in exercises, as vīnum is never a
sensible subject). Every lesson skill belongs to exactly one part.

The page `#learn-<lesson>-<n>` (`src/ui/pages/learn.tsx`) shows the explanation,
then the questions one at a time. An answer counts as right when it has a word
of every key group (`meetsKeys` in `src/trainer/path.ts`: lower case, no long
marks, a key of one or two letters must stand alone, "I don't know" never
counts); otherwise Claude judges it (`checkUnderstanding` in ask.tsx: right /
partly / wrong with a short feedback, balanced model at medium effort), and
without Claude the learner compares with the good answer. With both questions
answered the part is seen (`markSeen`) and its exercises open.

The learner values simplicity and obviousness above all ("make it simple, make
it obvious"): one clear way to each thing. Rēgulae (`src/ui/pages/rules.tsx`) is
one short list: every rule of the lessons watched, one line each (`RuleList` in
learn.tsx: ✓ learned, its right answers as dots and "3/10", or new; the rule to
work on now marked "you are here"; the whole line opens the rule), a Continue
button, then the endings at a glance (a ? for forms of rules not learned yet)
and the colors. Lesson pages show the same list. The lessons' full What / How /
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
`Runner.next` in train.tsx), each for the progress at that moment, and every
exercise shows the rule: its weakest piece first in the phase's kinds, a single
form when only a form can show it (to …: -re; vīnī), the videos' and stories'
sentences for et between two verbs (`practiceLines`). Past the simple phase one
in five reviews earlier rules. The round's header shows the exact count
(`PartCount`, ten dots `PartDots`); every answer says "+1 · Rule 3.2: 4 of 10" or
that it stays; the round ends when the rule is learned, and its summary shows
before → after. Home, the practice page, the rule page and the lesson pages show
the same dots. On a later day a round starts with a one-screen reminder of the
part (`PartRecap`), and each exercise's Rule button shows the parts behind it
(`RuleBox`). `tests/parts.test.ts` plays a round of every part as the page does:
each exercise must show the rule, add one when right, need only rules seen, and
ten right answers must learn it.

How rich a sentence is follows the same phases (`sentenceStyle`: bare while
simple, colors on). Elsewhere (videos, stories, weak spots) the kinds follow the
mastery of the skills (`phaseOf`); a fixed sentence is as hard as its newest
rule. The generator makes an "of" phrase whenever s.gen or one of the genitive
endings is the focus (`GEN_SKILLS`, the owner of the ending practised), and a
describing word can be the gap or the choice (`tokenRules`; `wrongForms` offers
its other cases and its other gender: magna for agricola's magnus).

Exercise builders work on any sentence: `writeOn`, `endingOn`, `chooseOn`,
`tilesOn`, `meaningOn` in `src/trainer/exercises.ts` take tokens and an English
text, so generated clauses and fixed sentences share them. Fixed sentences go
through `src/trainer/lines.ts`: `makeLine` reads one into tokens (role and ending
of each word; a neuter with I / you acting is the object), `lineSkills` lists
every rule it needs (its endings and its constructions: an object, "of", nōn,
ego / tū left out, an infinitive after a verb, X est Y, in / ad + a place,
plurals, an adjective that follows gender), and `lineExercise` builds the
exercises. "Sentences from the videos" (`src/trainer/video.ts`) keeps the
lesson sentences whose rules have all been seen; a lesson page's "Practise
them" runs one lesson.

Every exercise shows one plain task line with a sign for how to answer (write,
tap, type in the gap, listen, change: `taskOf` in `src/ui/pages/train.tsx`).
Endings and forms are typed into the sentence itself (`GapInput`), a sentence to
change starts in the answer box, and the infinitive is asked from the tū form
(its vowel decides it: from discō alone it cannot be known). On a phone the
round's header has two rows: what is practised, then the tesserae and
"Exercise 3 of 12 · 2 right".

Stories (`src/content/stories.ts`, pages `#stories` and `#story-<id>` in
`src/ui/pages/stories.tsx`): three per lesson (`step`), each with a small plot,
only lesson words and only the rules up to its lesson. A story opens for practice
once all its rules are seen (`storyOpen`); the others wait, naming the parts they
need (`partsBefore`). `en` is the reader's English,
`prompt` the exercise English when it must say more ("the friend (f)"), `who`
the speaker of a dialogue line; two questions each, the right answer first.
A tap on a line shows its English, a tap on a word its meaning; answering the
questions marks the story read (`Progress.stories`). "Practise this story" and
"Sentences from the stories" build rounds from the lines; Home offers the next
unread open story. `tests/stories.test.ts` checks every word, long mark
and rule, and that each exercise on each line accepts its own answer: write a
new story, then run the tests.

Sensible sentences (`silly` 0) come from rules in `src/latin/generate.ts`: what a
verb takes (`OBJECTS`, strict when sensible), who is taught and what can be
learned (`PUPILS`, `LEARNABLE`), whose things and people are (`OWNED`,
`RELATIONS`, `OWNERS`, `mine` for "my"), where people and gods are and what they
do there (`whoAt`, `doneAt`, `HOMES`, `REFUGES`, `NOT_DIVINE`, `makesSense`), and
the word tags in `words.ts` / `deck.ts` (e.g. `long`, `unseen`, `story`). A
genitive never stands between two nouns (`untangle`). Words whose good uses need
care ("much water", "the school is full") get hand-made Discover examples
(`CURATED` in `src/trainer/discover.ts`). "Fix my mistakes" (`mistakesSession`): unfixed mistakes on rules
seen come back as fresh exercises of the same kind on the same rules and words;
a right answer marks one fixed (`Mistake.fixed`), a wrong one never duplicates
it. Home and the practice chooser show how many wait.

## Audio

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
5. **Discover**: cards in `src/content/deck.ts` unlock by grammar; nouns of a
   new declension become usable once its skills exist. Every relative must be
   correct: `from` = borrowed from Latin, `kin` = same ancient root.
6. Run `npm test` (the content test fails on any misspelled form or missing
   long mark), `npm run build`, `npm run smoke`, then republish to the same URL.
   The learner ticks the new lesson under Settings > Lessons watched (their
   saved progress keeps its own list).

## Conventions

- Latin is stored with long marks (macrons); typing never requires them.
- In content strings, `«…»` marks Latin to color, `word#gen.sg` forces a
  reading of an ambiguous form, and `word#x` leaves a word that only looks like
  a known form uncolored (*fīnis* is not *fīnīs*).
- Famous sayings live in `src/content/sayings.ts`, linked to word ids; the
  Words dialog and Discover cards show them. Check each one's colors with the
  analyzer before adding it.
- Latin in English (`#english`, `src/content/english.ts`, `src/ui/pages/english.tsx`):
  how English took Latin (waves), each known word's English relatives, Latin
  verb forms and plurals inside English, grammar rules English took from Latin,
  word parts, spelling, grammar terms, abbreviations, phrases, Russian /
  Ukrainian parallels. It sits under Lectiōnēs (a card after the lessons) and
  has its own practice mode, "find the Latin" (`derive` exercises: any form of
  the right word counts). Claims there must be etymologically sound: borrowed
  vs. cousin (kin) vs. look-alike (trap), as in the deck.
- Each case owns one color (see `src/styles.css`); nothing else in the UI uses
  those hues.
- Roman touches, in gold and brown only: the hedera (ivy-leaf mark, `Hedera`),
  diamond interpuncts, tabula ansata plaques (`.ansata`) for verdicts and
  notices, tesserae (`Mosaic`, the session strip), the laurel wreath, Roman
  numerals for counts, years, lessons and conjugations, a stylus cursor over
  the wax. Keep them small and quiet.
- Known content gaps: story lines marked `unverified` were rebuilt from the
  narration; Lesson 1's student may be *discipulus* rather than *discipula*.
