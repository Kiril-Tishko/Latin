// Page routing. Only a bare #token survives in an artifact link, so routes
// are plain words: #home, #lessons, #lesson-3, #learn-2-1, #train (a round in
// progress), #words, #origins, #english, #stories, #story-aqua, #nuntii (the messenger)
// and #nuntii-iulia (a chat). The old #rules and #discover lead to the pages
// that hold them now (the lessons, the words).
import { useEffect, useState } from "preact/hooks";

export type Route =
  | { page: "home" }
  | { page: "lessons" }
  | { page: "lesson"; n: number }
  | { page: "learn"; id: string }
  | { page: "train" }
  | { page: "words" }
  | { page: "origins" }
  | { page: "english" }
  | { page: "stories" }
  | { page: "story"; id: string }
  | { page: "messenger"; thread?: string };

export function parse(hash: string): Route {
  const h = hash.replace(/^#/, "");
  const m = h.match(/^lesson-(\d+)$/);
  if (m) return { page: "lesson", n: Number(m[1]) };
  const part = h.match(/^learn-(\d+)-(\d+)$/);
  if (part) return { page: "learn", id: `${part[1]}.${part[2]}` };
  const st = h.match(/^story-([a-z-]+)$/);
  if (st) return { page: "story", id: st[1] };
  const chat = h.match(/^nuntii(?:-([a-z0-9]+))?$/);
  if (chat) return chat[1] ? { page: "messenger", thread: chat[1] } : { page: "messenger" };
  if (h === "rules") return { page: "lessons" };
  if (h === "discover") return { page: "words" };
  if (["lessons", "train", "words", "origins", "english", "stories"].includes(h)) return { page: h as "lessons" };
  return { page: "home" };
}

export function hashOf(r: Route): string {
  if (r.page === "lesson") return `#lesson-${r.n}`;
  if (r.page === "learn") return `#learn-${r.id.replace(".", "-")}`;
  if (r.page === "messenger") return r.thread ? `#nuntii-${r.thread}` : "#nuntii";
  return r.page === "story" ? `#story-${r.id}` : `#${r.page}`;
}

const listeners = new Set<(r: Route) => void>();
let current: Route = parse(location.hash);

export function go(r: Route) {
  current = r;
  try {
    history.replaceState(null, "", hashOf(r));
  } catch {
    /* sandboxed frames may refuse; in-app routing still works */
  }
  window.scrollTo({ top: 0 });
  listeners.forEach((l) => l(r));
}

window.addEventListener("hashchange", () => {
  current = parse(location.hash);
  listeners.forEach((l) => l(current));
});

export function useRoute(): Route {
  const [r, setR] = useState(current);
  useEffect(() => {
    listeners.add(setR);
    return () => void listeners.delete(setR);
  }, []);
  return r;
}
