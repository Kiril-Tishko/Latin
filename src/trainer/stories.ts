// The stories as practice: each story's sentences become lines (see lines.ts),
// and a round on a story draws exercises from them like the video sentences.
import { STORIES, Story } from "../content/stories";
import { Lexicon } from "../latin/analyze";
import { Ctx, Exercise } from "./exercises";
import { Line, makeLine } from "./lines";
import { Progress } from "./progress";
import { linesSession } from "./video";

/** A story's sentences as practice lines ("Et tū?", with no verb, is only read). */
export function storyLines(story: Story, lex: Lexicon): Line[] {
  return story.lines
    .map((l) => makeLine({ kind: "story", id: story.id, title: story.title }, l.la, l.en, lex, l.prompt))
    .filter((x): x is Line => !!x);
}

/** The stories the learner's step covers, in order. */
export const storiesUpTo = (step: number) => STORIES.filter((s) => s.step <= step);

/** The first story of the step not read yet, else the first unread one before it. */
export function nextStory(p: Progress): Story | undefined {
  const open = storiesUpTo(p.focusLesson).filter((s) => !p.stories[s.id]);
  return open.find((s) => s.step === p.focusLesson) ?? open[0];
}

/** A round on the sentences of these stories (one story, or all of a step). */
export function storySession(p: Progress, ctx: Ctx, stories: Story[], size?: number): Exercise[] {
  const lines = stories.flatMap((s) => storyLines(s, ctx.lex)).filter((l) => l.skills.every((sk) => ctx.k.skills.has(sk)));
  return linesSession(p, ctx, lines, size ?? Math.min(12, lines.length * 2));
}
