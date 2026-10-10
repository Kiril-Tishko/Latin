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
    const min = wide ? 0.55 : 0.8;
    const doc = document.documentElement;
    let zoom = 1;
    for (let i = 0; i < 8; i++) {
      const over = doc.scrollHeight - window.innerHeight;
      if (over <= 0 || zoom <= min) break;
      const h = el.getBoundingClientRect().height;
      zoom = Math.max(min, zoom * Math.min(0.97, (h - over - 2) / h));
      el.style.setProperty("zoom", zoom.toFixed(3));
    }
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
