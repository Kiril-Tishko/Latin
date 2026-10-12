// On a phone, a focused text field means the on-screen keyboard is up: <html>
// gets the class kb-open, and the top bar and the tabs step aside (styles.css)
// so the typing and what it answers have the room left above the keyboard.

/** Input types that bring up a keyboard (not a checkbox, a button or a slider). */
const TYPED = new Set(["text", "search", "email", "url", "tel", "number", "password"]);

export function typesText(el: EventTarget | null): boolean {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) return TYPED.has(el.type) && !el.readOnly && !el.disabled;
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * Every text field: no spellcheck underlines (a tap on an underlined word opens
 * suggestions instead of moving the cursor), no autocorrect, no earlier entries.
 * autoCorrect in camel case goes in as the attribute autocorrect="off"; the
 * property, where a browser has one, is a boolean that "off" would switch on.
 */
export const NO_CORRECTION = { spellcheck: false, autoCorrect: "off", autocomplete: "off" } as const;

export const touchScreen = () => typeof matchMedia !== "undefined" && matchMedia("(hover: none) and (pointer: coarse)").matches;

export function watchKeyboard(): void {
  if (!touchScreen()) return;
  const root = document.documentElement;
  const open = (on: boolean) => root.classList.toggle("kb-open", on);
  const typing = () => typesText(document.activeElement);
  // the page's height before the keyboard took its share, and whether it did
  let tall = window.innerHeight;
  let shrunk = false;
  document.addEventListener("focusin", (e) => {
    if (typesText(e.target)) open(true);
  });
  document.addEventListener("focusout", () => {
    // from one field straight to the next the keyboard stays up
    setTimeout(() => {
      if (typing()) return;
      open(false);
      shrunk = false;
    }, 60);
  });
  // A keyboard closed while its field keeps the focus (Android's back button)
  // shows only as the page growing back, and one opened again by a tap on the
  // same field as the page shrinking.
  window.addEventListener("resize", () => {
    const h = window.innerHeight;
    if (!typing()) {
      tall = h;
    } else if (h < tall * 0.8) {
      shrunk = true;
      open(true);
    } else if (shrunk) {
      shrunk = false;
      open(false);
    }
  });
}
