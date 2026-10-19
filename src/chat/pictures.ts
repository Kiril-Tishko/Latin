// Pictures that look like their senders, and photo habits per person. The
// learner chose to keep the painted portraits: each person has one fixed look,
// taken from their portrait (Nature.look), and every fresh picture that shows
// them is made with it (a selfie shows its sender; anyone named in it, as they
// look). Each sends photos by their habit (Nature.photos.rate): someone who
// often does sends a few a day, someone who rarely does one in three days.
import { stripMarks } from "../latin/text";
import { natureOf } from "./nature";
import { Meta, Thread, whoOf } from "./model";
import { allPeople } from "./world";

/** Photos someone sends at most, library or fresh, in so many hours, by their habit. */
export const PHOTO_LIMIT: Record<"often" | "sometimes" | "rarely", { n: number; hours: number }> = {
  often: { n: 3, hours: 24 },
  sometimes: { n: 1, hours: 24 },
  rarely: { n: 1, hours: 72 },
};

/** How many more photos someone may send now, by their habit (what they sent in these chats counts). */
export function photoRoom(who: string, meta: Meta, threads: (Thread | undefined)[], now: number): number {
  const { n, hours } = PHOTO_LIMIT[natureOf(who, meta)?.photos.rate ?? "sometimes"];
  const sent = threads
    .flatMap((t) => t?.messages ?? [])
    .filter((m) => m.from === who && (m.photo || m.pic) && m.at <= now && now - m.at < hours * 3600_000);
  return Math.max(0, n - new Set(sent.map((m) => m.id)).size);
}

/**
 * Keeps photos within each sender's habit: a photo or picture beyond it is
 * taken off its message (which goes if nothing else is left). In order.
 */
export function photoHabits<T extends { from?: string; la: string; photo?: string; picture?: string }>(drafts: T[], meta: Meta, threads: (Thread | undefined)[], now: number): T[] {
  const room = new Map<string, number>();
  return drafts.flatMap((d) => {
    if (!d.from || !(d.photo || d.picture)) return [d];
    const left = room.get(d.from) ?? photoRoom(d.from, meta, threads, now);
    if (left > 0) {
      room.set(d.from, left - 1);
      return [d];
    }
    const { photo: _p, picture: _q, ...rest } = d;
    return rest.la ? [rest as T] : [];
  });
}

/** A name with or without its long marks, as a whole word. */
const nameRe = (name: string, flags = "i") =>
  new RegExp(
    `(?<![\\p{L}])${[...stripMarks(name)].map((c) => ({ a: "[aā]", e: "[eē]", i: "[iī]", o: "[oō]", u: "[uū]" })[c.toLowerCase()] ?? c).join("")}(?![\\p{L}])`,
    `${flags}u`,
  );

/**
 * The prompt for a fresh picture: the people in it as they look. Anyone named
 * in what it shows (two at most) is drawn from their fixed look, their name
 * left out (the generator does not know them); a selfie shows its sender.
 */
export function withLooks(text: string, by: string, meta: Meta): string {
  const shown: string[] = [];
  let out = text;
  for (const id of allPeople(meta)) {
    const w = whoOf(id, meta);
    if (!w || !natureOf(id, meta)?.look || !nameRe(w.name).test(out)) continue;
    shown.push(id);
    out = out.replace(nameRe(`${w.name}'s`, "gi"), w.g === "m" ? "his" : "her").replace(nameRe(w.name, "gi"), w.g === "m" ? "the man" : "the woman");
  }
  if (/selfie/i.test(text) && !shown.includes(by) && natureOf(by, meta)?.look) shown.unshift(by);
  const looks = shown.slice(0, 2).map((id) => natureOf(id, meta)!.look);
  return looks.length ? `${looks.join("; and ")}. ${out}` : out;
}
