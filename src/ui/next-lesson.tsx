// The next video of the playlist, with one tap to say it is watched: its rules
// then join the path and Continue opens the first of them.
import { LESSONS, videoUrl } from "../content/lessons";
import { roman } from "../latin/text";
import { updatePath } from "../trainer/path";
import { Icon } from "./components";
import { update, useProgress } from "./store";

/** Ticks a lesson as watched (as Settings does). */
export function markWatched(n: number) {
  update((x) => {
    x.lessonsDone = [...new Set([...x.lessonsDone, n])].sort((a, b) => a - b);
    updatePath(x);
  });
}

export function NextLesson({ note }: { note?: string }) {
  const p = useProgress();
  const next = LESSONS.find((l) => !p.lessonsDone.includes(l.n));
  if (!next) return null;
  return (
    <div class="panel next-lesson stack" id="next-lesson">
      <span class="eyebrow">Next video</span>
      <h2>
        Lesson {roman(next.n)}: {next.title}
      </h2>
      <p class="muted small">{note ?? "Watch it, then tick it here: its rules join your path one at a time, and its stories and words come with them."}</p>
      <div class="row">
        <a class="btn ghost" href={videoUrl(next.videoId)} target="_blank" rel="noopener">
          <Icon.play /> Watch Lesson {roman(next.n)}
        </a>
        <button id="watched-next" class="btn" onClick={() => markWatched(next.n)}>
          <Icon.check /> I have watched it
        </button>
      </div>
    </div>
  );
}
