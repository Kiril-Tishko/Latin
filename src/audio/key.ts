// The key of a Latin text for its recording: what is read, in lower case,
// without long marks or punctuation ("Puella in silvā ambulat." and
// "puella in silva ambulat" are one recording). The page and the script that
// records the fixed texts (scripts/audio) share it.
import { speakable } from "./speakable";

export function audioKey(latin: string): string {
  return speakable(latin)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
