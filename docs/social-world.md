# Nūntiī as a social world: plan, checklist, decisions

The learner asked (19 Oct 2026) to turn the messenger into a believable,
evolving social world: distinct people with memories, secrets, goals,
relationships among themselves and with the learner, a group chat that feels
like a group, natural pacing in real time, personal pictures, and the Latin
kept at the learner's level. This file is the working checklist: what is
done, what is partly done, what remains, and why things were built the way
they were. Keep it current after every stage.

- Work branch: `claude/roman-social-world`. The published v37 is preserved on
  `claude/festive-mccarthy-w9czhh` (commit 5205fe8); building that branch and
  publishing it to the same artifact URL brings the old version back.
- The live data (the learner's chats, feelings, lives) stays: new fields are
  added beside the old ones, which keep being read.

## Decisions the learner made

- **Pacing: like real people.** Plenty while the learner is chatting; when
  they go quiet, a message or two, then the people wait, each in their own way
  (some sulk, some worry, the clingy ones try once more the next day).
- **Publishing: each stage goes live** on the same link once it is ready and
  tested.
- **Learning: ignore the learner's struggles.** The people do not adapt to
  weak words or rules; only the coach (Check) deals with mistakes. They keep
  to the learner's words and the rules seen, as before (so their Latin grows
  as the learner learns), with a glossed new word now and then in a strong
  moment.
- **Looks: keep the painted portraits.** Each person gets one fixed look,
  taken from their portrait, that every photo of them follows.

## What the live chats showed (19 Oct, before any change)

- **Flooding.** The hourly phone routine had nothing that stopped it from
  writing every hour to someone who did not answer: Claudia sent ~20
  unanswered messages on 14 Oct, Marcus "Hodiē Mārs!" ~15 times on 15 Oct,
  and 70 more were waiting in the inbox on 19 Oct (31 from Lūcius; Gāius asked
  "Tū aquam bibis?" four times; Iūlia sent one photo four times).
- **Repetition.** The routine saw only the last six messages of a chat and had
  no idea what each person had already said.
- **Everyone circles the learner.** All five ask how he sleeps; every
  conversation leans on the one storyline (Iūlia's letter).
- **Omniscient gossip.** Every prompt carried what the learner said in every
  other chat ("friends talk") and every storyline, even "only Cyrillus knows".
- **Flat memory.** Per chat, the last 24 facts, all equal: "slept a lot on
  Tuesday" pushes out "told Iūlia he misses her".
- **Fixed relationships** among the friends (one sentence each), **no goals**,
  happenings without causes or consequences.
- What works and stays: their voices are distinct (Gāius terse, Lūcius
  theatrical, Claudia motherly), mistakes taken literally, the language
  limits, feelings about the learner in their own words, freedom to act
  (block, leave, groups, storylines), real time and their days.

## Stages (in order; each builds on the ones before)

1. **Pacing** — texting like real people (the flooding fix).
2. **Natures** — what makes each person different, as data the code uses:
   how much they write, how long, how often they reach out, photos, discretion,
   romance, their look.
3. **Minds** — memory (personal, weighted, recalled when relevant) and
   knowledge boundaries (who saw or was told what; secrets; rumours).
4. **Bonds** — the relationship with the learner in several dimensions, and
   relationships among the people that change with what happens.
5. **Lives** — goals and plans, happenings with causes and consequences, a
   timeline of what happened in the world.
6. **The group** — who is around, who talks, replies to each other, natural
   rhythm.
7. **Pictures** — habits per person, fixed looks, photos that fit the moment.
8. **Experience tests** — simulated conversations judged against the
   learner's criteria; tuning.

## Checklist

Status: `[x]` done and tested · `[~]` partly · `[ ]` not yet.

### 1. Pacing
- [x] Rules in one place (`src/chat/pace.ts`): unanswered bursts since the
      learner last wrote, per person's patience; then a wait; then a last try
      or two; then silence until the learner writes. The group gets a daily
      rhythm of its own.
- [x] The same rules in the routine's helper (`scripts/nuntii-routine.py`),
      with a test that both agree (`tests/pace.test.ts` runs the helper).
- [x] The routine's helper vets every planned message (words, pacing,
      repeats, a photo sent lately, blocked, asleep, silent) and makes the
      inbox documents itself (ids, times); it counts the inbox as sent (the
      flood came from runs that could not see their own earlier messages).
- [x] The page applies the rules when it writes on its own, when it takes
      messages from the inbox, and once to unseen messages already in a chat
      (dry run on the live data: Marcus 53 unseen → 7, Claudia 24 → 1, Iūlia
      22 → 9, the group 28 → 19; 6 of the 70 inbox messages arrive).
- [x] People know who is waiting and for how long ("seen and said nothing"
      in the own-writing prompt; on the learner's return, how long they
      waited).
- [x] Nobody repeats themselves: what each said lately is in view, and
      near-duplicates are refused (14 days; photos 21 days).
- [x] Routine prompt updated (19 Oct, 05:44 UTC); page published as v38.

### 2. Natures
- [x] Per person (`src/chat/nature.ts`, `Person.nature`): talkativeness,
      burst length, message length, how they write when it matters, showing
      feelings, discretion, photo habit, romance, interests, look (from the
      portraits). Strangers: from their dice, plus look / love / interests
      from Claude when they are made.
- [x] Used by code: the number of messages in a row per person (replies,
      their own writing, the routine's vet). Used later: talk (stage 6),
      discretion (stage 3), photos and look (stage 7).
- [x] Prompts shape length by person and moment (no fixed 1-8 words for
      all); "their own lives, the learner is not the centre; no asking the
      same questions again".

### 3. Minds
- [x] Per-person memory store (`messenger/minds/<id>`), weighted, merged by id
      across devices, pruned by salience (weight, age, open, outdated).
- [x] Memories formed from conversations and from their own writing, per
      person, in each one's own view ("remember"); "settled" / "outdated".
- [x] Recall: what weighs, what is recent, what is open, what the
      conversation touches (people, chat, words).
- [x] Old thread facts and bond moments migrated (live data: Iūlia 36,
      Marcus 18, Gāius 17, Claudia 16, Lūcius 13 memories).
- [x] Knowledge boundaries: no omniscient gossip or feelings; storylines
      only to those who know (`Drama.knows`); news spreads by "tell"
      (garbled or a lie: `untrue`); secrets flagged, kept or spilled by
      nature. Tests: a secret told to Iūlia stays out of Marcus's prompt
      until she tells someone.
- [x] The phone routine's messages carry what their people will remember
      and what someone told someone; the page applies them when it takes the
      message from the inbox (`routineMinds`; a test runs the helper).
- [x] Published as v40 (19 Oct); the routines got the new helper.

### 4. Bonds
- [x] Relationship with the learner in six levels (warmth, trust, respect,
      desire, hurt, interest; `src/chat/bond.ts`), moved by Claude's small
      steps, growth limited per day, falls sudden; real time heals hurt at
      each one's pace and lets interest, warmth and desire drift back. The
      private inner voice ("feel") kept beside them.
- [x] First measure: anyone never measured is set once by Claude from how
      they feel and what happened (the live friends' week of story).
- [x] Relationships among the people (`Meta.ties`): from each friend's
      starting ties, moved by fights, kindness, jealousy, sparks; each sees
      only their own feelings.
- [x] Romance by each person's own disposition: how fast desire may grow
      (`fall`: Lūcius fast, Iūlia quick, Marcus and Claudia slow, Gāius
      hardly), and their `romance` text.
- [x] Feelings change pacing: the deeply hurt never write first, the
      smitten try once more, the bored stop chasing (also in the routine's
      brief).

### 5. Lives
- [x] Goals per person (`src/chat/lives.ts`): each friend's wants at first,
      moved on by Claude ("goals": a step, got, given up, a new want; four
      open at most); plans are memories with a date (stage 3).
- [x] Happenings with consequences: public or private; a heavy one (grief,
      illness, debt, an engagement) is followed by one of two outcomes;
      a happening that matters is remembered and may bring a want.
- [x] A world timeline (heavy and public happenings, goals got or given up),
      each chat seeing what its people know of; the own-writing prompt and
      the routine see it all, with who knows.
- [x] Surprises paced: a heavy happening only after a calm week in the world
      (three weeks for one person; before, one a day across the five friends
      was likely); after four quiet days life may bring something; Claude
      may make things happen ("happen"), as consequences or out of the blue.
- [x] The Ācta prints only what the neighbours know (public happenings).

### 6. The group
- [x] Who is around (asleep, busy, away) decides who can talk
      (`src/chat/group.ts`): the ones here talk live; the others catch up
      later with a message or two, on their own clock (a sleeper's line no
      longer holds up the others until morning).
- [x] Talkative and quiet people: Gāius says a word or nothing unless named;
      the talkative, the named and the ones who care most are likely to
      answer first; not everyone answers everything.
- [x] Named in the learner's message (any case of the name): they want to
      answer, now or when they come back.

### 7. Pictures
- [x] Photo habits per person (`src/chat/pictures.ts`): often three a day
      (Iūlia), sometimes one (Marcus, Claudia, Lūcius), rarely one in three
      days (Gāius); enforced in replies, their own writing and the routine.
- [x] One fixed look per person in every fresh picture of them (from the
      portraits): named people and a selfie's sender are drawn from their
      look; the routine's helper does the same (a test checks they agree).
- [x] The library's seven photos of the friends made again from their looks.

### 8. Experience tests
- [ ] Simulated multi-turn conversations, judged against the criteria
      (distinct people, memory, privacy, relationships, group rhythm, pacing,
      pictures, Latin level, length, real time).

## Notes and trade-offs

- Claude's calls stay where they were (only on the learner's actions, and
  the routine). New state comes back in the same answers as structured
  fields, so nothing extra is asked.
- Deterministic code decides what must be reliable (pacing, limits, decay,
  who knows what); Claude decides what must feel alive (what they say, how
  they feel, what they remember and do).

## Progress log

- 19 Oct: branch created; code and live chats inspected; four decisions
  asked and answered; stage 1 started.
- 19 Oct: stage 1 (pacing) done: 10 new tests (295 in all), smoke tests of
  the messenger and the learner's abilities, a dry run on the live chats;
  routine updated; published as v38. Next: stage 2 (natures).
- 19 Oct: stage 2 (natures) done: 4 new tests; published as v39.
- 19 Oct: stage 3 (minds) done: 7 new tests (317 in all), smoke tests, a dry
  run of the migration on the live chats, and an experience check (a fresh
  model played Iūlia on her real prompt: the answer parsed into messages, a
  first-person memory of a fight, feelings, a storyline with who knows it).
  Published as v40, then v41 with the routine's memories. Next: stage 4
  (bonds).
