# Tabula Latina

A Latin trainer that follows the YouTube playlist **Easy Latin Lessons**
(https://www.youtube.com/playlist?list=PLjqqMkeHFt1E_lRi9nQvtmP9Od2JokI1J),
published as a private claude.ai artifact.

## The learner

- Native in English, Russian and Ukrainian. Explanations are in English;
  comparisons with Russian / Ukrainian cases are welcome.
- Finished Lessons 1-4 (October 2026). Remembers the words but forgot most of
  the rules, so practice restarted step by step from Lesson I and should feel
  very simple at first ("I want to think little").
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
- `sample`: the Ask Claude drawer and "I think my answer is right" (judge).
  Ask buttons only put a suggested question in the box; nothing goes to Claude
  until the learner presses Ask. A failed answer shows plain advice, Try again,
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
  each learned rule's own text, and the instructions forbid invented rules,
  keep «» for Latin only and name the trap Claude once fell into (agricola
  timidus, not timida). The learner's saved conversations can be read with
  ArtifactData at `data/users/me/chats/threads` to see how answers land.
- `db` + `user`: progress in the viewer's private doc `data/users/<id>/progress`.
  The page also keeps a copy in localStorage; the newer `updatedAt` wins.
  Ask Claude conversations: one private doc each at
  `data/users/<id>/chats/threads/<chatId>` (src/ui/chats.ts), followed live with
  `onSnapshot`, so a conversation continues on any device; the question is
  saved before the answer arrives. localStorage keeps a copy of the list, the
  unsent text per conversation and whether the drawer was open, so a reload
  loses nothing. Each saved answer records the model tier that gave it.

## Practice, step by step

`focusLesson` is the learner's step. Practice uses every known word but only the
rules of the lessons up to the step (`derived().stepKnowledge`; "All lessons
mixed" and the check-up use everything). A step session opens with a one-screen
rule refresher (the step's endings table and its two main rules, once a day),
and each exercise has a Rule button. While a rule is new (mastery < 0.4) the
exercises are mostly "choose the right word", "what does it mean?" (pick the
English) and word tiles (build the sentence from its words plus a wrong form or
two), with colors on, and sentences are bare (`sentenceStyle` in
`src/trainer/session.ts`: richness 0, one extra only when it is the thing
practised). As the rule settles, whole sentences to write, adjectives and "of"
phrases and the object first come in to test real understanding. The next step is
offered (never forced) when the step's practised skills average 80% and none is
under 60% (`readiness`). Saves from before the steps (version 1) restart at
Lesson I.

Exercise builders work on any sentence: `writeOn`, `endingOn`, `chooseOn`,
`tilesOn`, `meaningOn` in `src/trainer/exercises.ts` take tokens and an English
text, so generated clauses and fixed sentences share them. Fixed sentences go
through `src/trainer/lines.ts`: `makeLine` reads one into tokens (role and ending
of each word; a neuter with I / you acting is the object), `lineSkills` lists
every rule it needs (its endings and its constructions: an object, "of", nōn,
ego / tū left out, an infinitive after a verb, X est Y, in / ad + a place,
plurals, an adjective that follows gender), and `lineExercise` builds the
exercises. "Sentences from the videos" (`src/trainer/video.ts`) keeps the
lesson sentences whose rules are within the step; a lesson page's "Practise
them" runs one lesson.

Every exercise shows one plain task line with a sign for how to answer (write,
tap, type in the gap, listen, change: `taskOf` in `src/ui/pages/train.tsx`).
Endings and forms are typed into the sentence itself (`GapInput`), a sentence to
change starts in the answer box, and the infinitive is asked from the tū form
(its vowel decides it: from discō alone it cannot be known). On a phone the
round's header has two rows: what is practised, then the tesserae and
"Exercise 3 of 12 · 2 right".

Stories (`src/content/stories.ts`, pages `#stories` and `#story-<id>` in
`src/ui/pages/stories.tsx`): three per step, each with a small plot, only
lesson words and only the rules up to its step. `en` is the reader's English,
`prompt` the exercise English when it must say more ("the friend (f)"), `who`
the speaker of a dialogue line; two questions each, the right answer first.
A tap on a line shows its English, a tap on a word its meaning; answering the
questions marks the story read (`Progress.stories`). "Practise this story" and
"Sentences from the stories" build rounds from the lines; Home offers the next
unread story of the step. `tests/stories.test.ts` checks every word, long mark
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
(`CURATED` in `src/trainer/discover.ts`). "Fix my mistakes" (`mistakesSession`): unfixed mistakes within the
step come back as fresh exercises of the same kind on the same rules and words;
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
