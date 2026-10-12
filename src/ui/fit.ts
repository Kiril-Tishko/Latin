// Keeps a screen-sized panel (an exercise, the rule refresher) inside the window.

/**
 * Scales a panel down (CSS zoom) until the page no longer scrolls.
 * On narrow screens the answer sits below the sentence and the page scrolls to
 * it, so only the question is fitted there.
 */
export function fitToWindow(el: HTMLElement | null, answered: boolean) {
  if (!el) return;
  const run = () => {
    el.style.removeProperty("zoom");
    const wide = window.innerWidth > 980;
    if (!wide && answered) return;
    const doc = document.documentElement;
    const fits = (z: number) => {
      el.style.setProperty("zoom", z.toFixed(3));
      return doc.scrollHeight <= window.innerHeight;
    };
    if (doc.scrollHeight <= window.innerHeight) return;
    // text reflows when zoomed (lines get longer), so search for the largest zoom that fits
    let lo = wide ? 0.55 : 0.8;
    let hi = 1;
    if (!fits(lo)) return;
    for (let i = 0; i < 6; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    el.style.setProperty("zoom", lo.toFixed(3));
  };
  run();
  let frame = 0;
  const again = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(run);
  };
  window.addEventListener("resize", again);
  void document.fonts?.ready.then(again);
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", again);
  };
}
