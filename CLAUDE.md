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
  silly sentences allowed, light motivation (daily goal + streak).
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
exercises are mostly "choose the right word" and reading, with colors on, and
sentences are bare and sensible (`sentenceStyle` in `src/trainer/session.ts`:
richness 0, silliness 0, one extra only when it is the thing practised). As the
rule settles, whole sentences to write, adjectives and "of" phrases, the object
first, and silly pairings come in to test real understanding. The next step is
offered (never forced) when the step's practised skills average 80% and none is
under 60% (`readiness`). Saves from before the steps (version 1) restart at
Lesson I.

## Audio

No browser has a Latin voice. `src/audio/pronounce.ts` respells Latin for a
Spanish voice (Italian as fallback) so the device's own speech engine reads it
with classical sounds: c and g hard (Spanish qu / gu, Italian ch / gh), v as w
(u), ae as "ai", gn as "ngn". For Spanish the Latin stress (penult if long, else
antepenult) is marked with an acute accent, which Spanish voices follow anywhere
in a word. Italian gets no accent marks: Italian voices spell out an accent in
the middle of a word (*videō* came out as "u i accento grave deo").
`src/audio/speech.ts` picks the best Spanish voice and speaks; `speakSequence`
drives Listen & repeat. Audio buttons are hidden when the device has no Spanish
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
