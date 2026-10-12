/**
 * Only Latin words and plain punctuation reach the voice: reading hints go,
 * and separators (the · of a word list, slashes, arrows) become a short pause,
 * so a voice never reads them out as extra words ("punto", "barra").
 */
export function speakable(latin: string): string {
  return latin
    .replace(/#[a-z0-9]+(?:\.[a-z0-9]+)*/g, "")
    .replace(/\s*(?:[·•|/→←+=]|\.\.\.|…)\s*/g, ", ")
    .replace(/[()[\]{}«»"“”‘’*_]/g, "")
    .replace(/(?:,\s*)+/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/^[,\s]+|[,\s]+$/g, "");
}
