// The stories as practice: each story's sentences become lines (see lines.ts),
// and a round on a story draws exercises from them like the video sentences.
import { Part, PARTS } from "../content/parts";
import { STORIES, Story } from "../content/stories";
import { Lexicon } from "../latin/analyze";
import { Ctx, Exercise } from "./exercises";
import { Knowledge } from "../latin/generate";
import { fullLexicon } from "./knowledge";
import { Line, makeLine } from "./lines";
import { seenSkills } from "./path";
import { Progress } from "./progress";
import { linesSession, videoLines } from "./video";

/** A story's sentences as practice lines ("Et tū?", with no verb, is only read). */
export function storyLines(story: Story, lex: Lexicon): Line[] {
  return story.lines
    .map((l) => makeLine({ kind: "story", id: story.id, title: story.title }, l.la, l.en, lex, l.prompt))
    .filter((x): x is Line => !!x);
}

/** The stories of these steps (lessons), in order. */
export const storiesUpTo = (step: number) => STORIES.filter((s) => s.step <= step);

let lexicon: Lexicon | null = null;
const skillsOf = new Map<string, string[]>();

/** Every rule a story's lines need. */
export function storySkills(story: Story): string[] {
  let out = skillsOf.get(story.id);
  if (!out) {
    lexicon ??= fullLexicon();
    out = [...new Set(storyLines(story, lexicon).flatMap((l) => l.skills))];
    skillsOf.set(story.id, out);
  }
  return out;
}

/** A story is open for practice once every rule of its lines has been seen. */
export const storyOpen = (story: Story, seen: Set<string>) => storySkills(story).every((s) => seen.has(s));

/** The parts to learn before a story opens. */
export function partsBefore(story: Story, seen: Set<string>): Part[] {
  const missing = storySkills(story).filter((s) => !seen.has(s));
  return PARTS.filter((part) => part.skills.some((s) => missing.includes(s)));
}

/** The first open story of the step not read yet, else the first open unread one. */
export function nextStory(p: Progress): Story | undefined {
  const seen = seenSkills(p);
  const open = STORIES.filter((s) => !p.stories[s.id] && storyOpen(s, seen));
  return open.find((s) => s.step === p.focusLesson) ?? open[0];
}

/** A round on the sentences of these stories (one story, or all of a step). */
export function storySession(p: Progress, ctx: Ctx, stories: Story[], size?: number): Exercise[] {
  const lines = stories.flatMap((s) => storyLines(s, ctx.lex)).filter((l) => l.skills.every((sk) => ctx.k.skills.has(sk)));
  return linesSession(p, ctx, lines, size ?? Math.min(12, lines.length * 2));
}

/** A word said twice ("legit et legit", again and again) reads well in a story but makes a confusing exercise. */
const saysTwice = (l: Line) => {
  const words = l.tokens.filter((t) => t.role !== "conj" && t.role !== "prep").map((t) => t.text.toLowerCase());
  return new Set(words).size < words.length;
};

/** Every fixed sentence that needs only these rules: the videos' and the stories'. */
export function practiceLines(lex: Lexicon, k: Knowledge): Line[] {
  const stories = STORIES.flatMap((s) => storyLines(s, lex)).filter((l) => l.skills.every((sk) => k.skills.has(sk)));
  return [...videoLines([1, 2, 3, 4], lex, k), ...stories].filter((l) => !saysTwice(l));
}
