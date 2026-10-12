// Hand-drawn Roman emoji in messages. They are stored, and read by Claude, as
// codes (":lupa:"); the page shows them with its color font, which draws them
// from characters in the Private Use Area; a phone notification gets a plain emoji.
import { ROMAN_EMOJI } from "../content/roman-emoji";

const BY_CODE = new Map(ROMAN_EMOJI.map((e) => [e.code, e]));
const BY_CHAR = new Map(ROMAN_EMOJI.map((e) => [e.char, e]));
const CODE = /:([a-z]{3,12}):/g;
const CHARS = new RegExp(`[${ROMAN_EMOJI.map((e) => e.char).join("")}]`, "gu");

/** ":lupa:" becomes the font's character, for showing. */
export const showEmoji = (text: string) => text.replace(CODE, (m, c: string) => BY_CODE.get(c)?.char ?? m);

/** The font's characters become codes again, for keeping and for Claude. */
export const emojiCodes = (text: string) => text.replace(CHARS, (ch) => `:${BY_CHAR.get(ch)!.code}:`);

/** Without the Roman emoji (codes or characters): the words alone, for checking the Latin. */
export const withoutEmoji = (text: string) => text.replace(CODE, " ").replace(CHARS, " ");

/** Codes that are not ours (Claude made one up) are dropped. */
export const knownEmojiOnly = (text: string) =>
  text.replace(CODE, (m, c: string) => (BY_CODE.has(c) ? m : "")).replace(/ {2,}/g, " ").trim();

/** For places without the font (a phone notification): each code becomes a plain emoji. */
export const plainEmoji = (text: string) => text.replace(CODE, (m, c: string) => BY_CODE.get(c)?.fallback ?? m);

/** A message that is only emoji (any kind): shown big, as in other messengers. */
export const onlyEmoji = (text: string) => {
  const t = showEmoji(text).replace(/\s+/g, "");
  return t.length > 0 && t.length <= 24 && /^(?:[\p{Extended_Pictographic}\p{Emoji_Component}‍️-])+$/u.test(t) && !/^[\d#*]+$/.test(t);
};

/** The codes with what they show, for Claude. */
export const emojiList = () => ROMAN_EMOJI.map((e) => `:${e.code}: ${e.en}`).join("; ");

/** Splits text around codes, so the words between them can be read on their own. */
export const splitCodes = (text: string) => text.split(/(:[a-z]{3,12}:)/);
