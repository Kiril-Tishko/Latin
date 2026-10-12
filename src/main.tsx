import { render } from "preact";
import "./styles.css";
import { ROMAN_EMOJI_FONT } from "./content/roman-emoji";
import { App } from "./ui/app";

// the messenger's hand-drawn Roman emoji: a color font for its own characters only
try {
  const face = new FontFace("Roman Emoji", `url(${ROMAN_EMOJI_FONT})`, { unicodeRange: "U+E100-E1FF" });
  document.fonts.add(face);
  void face.load();
} catch {
  /* a browser without FontFace shows the emoji as small boxes */
}

const root = document.getElementById("app");
if (root) render(<App />, root);
