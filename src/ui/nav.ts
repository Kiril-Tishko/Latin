// Page routing. Only a bare #token survives in an artifact link, so routes
// are plain words: #home, #lessons, #lesson-3, #train, #words, #discover, #rules, #english.
import { useEffect, useState } from "preact/hooks";

export type Route =
  | { page: "home" }
  | { page: "lessons" }
  | { page: "lesson"; n: number }
  | { page: "train" }
  | { page: "words" }
  | { page: "discover" }
  | { page: "rules" }
  | { page: "english" };

export function parse(hash: string): Route {
  const h = hash.replace(/^#/, "");
  const m = h.match(/^lesson-(\d+)$/);
  if (m) return { page: "lesson", n: Number(m[1]) };
  if (["lessons", "train", "words", "discover", "rules", "english"].includes(h)) return { page: h as "lessons" };
  return { page: "home" };
}

export function hashOf(r: Route): string {
  return r.page === "lesson" ? `#lesson-${r.n}` : `#${r.page}`;
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
