// The people's own voices in their voice messages, as the learner chose (19 Oct):
// Microsoft's voices on Pollinations reading the classical respelling of the
// Latin (src/audio/pronounce.ts), as the site's recorded voice does: Spanish
// voices, and an Italian one for Gāius (the Italian respelling keeps c and g
// hard too). Each voice message wants a recording, a document in
// messenger/pics like a picture, which the pictures routine makes
// (scripts/nuntii-routine.py, `make_voice`); until it comes, the device's voice
// reads the message as before.
import { respell } from "../audio/pronounce";
import { speakable } from "../audio/speakable";
import { withoutEmoji } from "./emoji";
import type { Msg, Pic, Who } from "./model";

export interface Voice {
  /** The voice's name at Pollinations (microsoft/mai-voice-2.1). */
  name: string;
  /** The respelling it reads. */
  lang: "es" | "it";
}

/** The five friends' voices, each their own (the speech recognizer, set to Latin, heard every one of them right). */
export const FRIEND_VOICES: Record<string, Voice> = {
  iulia: { name: "es-MX-Valeria", lang: "es" },
  claudia: { name: "es-ES-Marta", lang: "es" },
  marcus: { name: "es-MX-Alejo", lang: "es" },
  lucius: { name: "es-MX-Grant", lang: "es" },
  gaius: { name: "it-IT-Luca", lang: "it" },
};

/** Anyone else's, by sex, the same every time (from their id). */
const OTHER_VOICES: Record<"m" | "f", Voice[]> = {
  m: [
    { name: "it-IT-Grant", lang: "it" },
    { name: "es-MX-Alejo", lang: "es" },
    { name: "es-MX-Grant", lang: "es" },
    { name: "it-IT-Luca", lang: "it" },
  ],
  f: [
    { name: "es-MX-Harper", lang: "es" },
    { name: "it-IT-Rosa", lang: "it" },
    { name: "es-MX-Valeria", lang: "es" },
    { name: "es-ES-Marta", lang: "es" },
  ],
};

export function voiceOfPerson(who: Pick<Who, "id" | "g">): Voice {
  const own = FRIEND_VOICES[who.id];
  if (own) return own;
  const pool = OTHER_VOICES[who.g] ?? OTHER_VOICES.f;
  const h = [...who.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return pool[h % pool.length];
}

/** What the voice reads: the Latin respelled for it, without emoji. */
export const voiceText = (la: string, v: Voice) =>
  respell(speakable(withoutEmoji(la).replace(/\p{Extended_Pictographic}|‍|️/gu, " ")), v.lang);

/** The recording a voice message wants; its document's id goes on the message as `rec`. */
export function wantedVoice(m: Msg, who: Pick<Who, "id" | "g">, now: number): Pic {
  const v = voiceOfPerson(who);
  return { id: `v${m.id}`.slice(0, 40), by: m.from, en: m.la, prompt: voiceText(m.la, v), kind: "voice", voice: v.name, status: "wanted", at: now };
}

/** The people's voice messages that have no recording yet: each gets one wanted (the learner's own are read by their device). */
export function withRecordings(messages: Msg[], whoOf: (id: string) => Pick<Who, "id" | "g"> | null | undefined, now: number): { messages: Msg[]; wanted: Pic[] } {
  const wanted: Pic[] = [];
  const out = messages.map((m) => {
    if (!m.voice || m.rec || m.from === "me" || !m.la.trim()) return m;
    const who = whoOf(m.from);
    if (!who) return m;
    const pic = wantedVoice(m, who, now);
    if (!pic.prompt) return m;
    wanted.push(pic);
    return { ...m, rec: pic.id };
  });
  return { messages: out, wanted };
}
