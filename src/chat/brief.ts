// The brief the phone routine reads (data/users/<id>/messenger/brief/now):
// everything it needs to write as the people while the page is closed, made by
// the page with the same functions it uses itself: the learner, the words and
// rules, who everyone is, and their moods for the next two days, rolled ahead.
import { PEOPLE } from "../content/people";
import { Life, LifeSpec, lifeNow, Rand } from "./life";
import { Meta, Who, whoOf } from "./model";
import { bondBlock, dramaBlock, knownPeople, languageBlock, learnerBlock, natureLines, PromptCtx, worldLine } from "./prompts";
import { groupIds, groupMembers, groupName } from "./model";
import { allowedSpellings, calendarEntry, formsFor } from "./words";
import { calendarBlock, calendarWords, romeDay } from "./calendar";
import { PHOTOS } from "../content/photos";
import { stripMarks } from "../latin/text";
import { specOf } from "./engine";
import { Pace, paceOf } from "./pace";
import { natureOf } from "./nature";
import { memoryLines, Mind, recall } from "./mind";

export interface Brief {
  v: 1;
  updatedAt: number;
  me: { name: string; g: "m" | "f"; tz: string };
  /** The learner, as the people know them. */
  learner: string;
  /** The words, forms and rules allowed, as Claude reads them. */
  language: string;
  /** Every allowed spelling, without long marks, lower case: a quick check of any message. */
  forms: string[];
  /** Who everyone is (without the time of day and mood, which change). */
  people: { id: string; name: string; tz: string; wake: number; sleep: number; busy: [number, number, string][]; sheet: string; pace: Pace; burst: number }[];
  /** Moods and happenings rolled ahead: each from its time on. */
  lives: Record<string, (Life & { from: number })[]>;
  /** The day in Rome for today and the next two days (date in Rome, YYYY-MM-DD): festivals, birthdays, news. */
  calendar: { day: string; text: string }[];
  /** The photos the people may send: id, what it shows, who would send it ("any": anyone). */
  photos: { id: string; en: string; who: string[] | "any" }[];
  /** The groups (their names and members now) and the storylines among them. */
  world: string;
  /** The groups the learner is in, by chat id: their names and members now. */
  groups: Record<string, { name: string; members: string[] }>;
  /** Chats the learner muted (no notification for them) and people the learner blocked (nothing of theirs in private reaches the learner). */
  muted: string[];
  blocked: string[];
}

/** Their lives for the next hours, rolled ahead at random. */
export function rollAhead(spec: LifeSpec, life: Life | undefined, now: number, hours: number, r: Rand): (Life & { from: number })[] {
  const out: (Life & { from: number })[] = [];
  let cur = lifeNow(spec, life, now, r).life;
  out.push({ ...cur, from: now });
  let t = now;
  for (let i = 0; i < 24; i++) {
    t = Math.max(t + 60_000, Math.min(cur.moodUntil, cur.eventUntil && cur.eventUntil > t ? cur.eventUntil : Infinity));
    if (t > now + hours * 3600_000) break;
    cur = lifeNow(spec, cur, t + 1000, r).life;
    out.push({ ...cur, from: t });
  }
  return out;
}

function sheet(w: Who, meta: Meta, now: number, minds?: Record<string, Mind>): string {
  // what they remember that matters most (theirs alone: what they lived, saw in their chats, or were told)
  const memories = recall(minds?.[w.id], { now, with: ["me"], chat: w.id, text: "", k: 10 });
  return [
    `${w.name} (${w.age}, ${w.g === "m" ? "man" : "woman"}; called «${w.voc}»), ${w.city}. ${w.job}.`,
    `Character: ${w.about}`,
    w.traits?.length ? `Temper: ${w.traits.join(", ")}.` : "",
    w.quirk ? `Quirk: ${w.quirk}.` : "",
    w.secret ? `Keeps to themselves at first: ${w.secret}.` : "",
    `How they text: ${w.style}`,
    ...natureLines(w, meta),
    w.heart ? `With people they care about: ${w.heart}` : "",
    w.ties ? `With the others: ${Object.entries(w.ties).map(([id, t]) => `${PEOPLE.find((p) => p.id === id)?.name ?? id}: ${t}`).join("; ")}.` : "",
    knownPeople(w, meta),
    // how they feel about the learner now, and a silent treatment going on; blocked, away, a status line, the group
    bondBlock(w, meta.bonds?.[w.id], now, !memories.length),
    memories.length ? `What ${w.name} remembers (theirs alone; ${w.name} knows only this, their chats, and their own life):\n${memoryLines(memories, (id) => whoOf(id, meta)?.name ?? (id === "me" ? "the learner" : id)).join("\n")}` : "",
    worldLine(w, meta, now),
  ]
    .filter(Boolean)
    .join("\n");
}

export function makeBrief(meta: Meta, ctx: PromptCtx, strangerIds: string[], r: Rand = Math.random): Brief {
  const ids = [...PEOPLE.map((p) => p.id), ...strangerIds];
  const people = ids
    .map((id) => whoOf(id, meta))
    .filter((w): w is Who => !!w)
    .map((w) => ({ id: w.id, name: w.name, tz: w.tz, wake: w.day.wake, sleep: w.day.sleep, busy: w.day.busy, sheet: sheet(w, meta, ctx.now, ctx.minds), pace: paceOf(w.id, meta), burst: natureOf(w.id, meta)?.burst ?? 4 }));
  const lives: Brief["lives"] = {};
  for (const id of ids) {
    const spec = specOf(id, meta);
    if (spec) lives[id] = rollAhead(spec, meta.life[id], ctx.now, 48, r);
  }
  // the next days in Rome, and the names they bring (allowed while they are near)
  const days = [0, 1, 2].map((n) => ctx.now + n * 86400000);
  const calendar = days.map((t) => {
    const d = romeDay(t);
    return { day: `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`, text: calendarBlock(t) };
  });
  const forms = allowedSpellings(ctx.words);
  for (const t of days) for (const w of calendarWords(t)) for (const f of formsFor(calendarEntry(w), ctx.seen)) forms.add(stripMarks(f).toLowerCase());
  return {
    v: 1,
    updatedAt: ctx.now,
    me: { name: ctx.me.name, g: ctx.me.g, tz: ctx.tz },
    learner: learnerBlock(ctx).replace(/ For .* it is .*$/, ""),
    language: languageBlock(ctx),
    forms: [...forms].sort(),
    people,
    lives,
    calendar,
    photos: PHOTOS.map((p) => ({ id: p.id, en: p.en, who: p.who })),
    world: [
      ...groupIds(meta).map((g) => `THE GROUP «${groupName(meta, g)}» (chat id "${g}"): ${groupMembers(meta, g).map((id) => whoOf(id, meta)?.name ?? id).join(", ")} and the learner.`),
      dramaBlock(meta),
    ]
      .filter(Boolean)
      .join("\n"),
    groups: Object.fromEntries(groupIds(meta).map((g) => [g, { name: groupName(meta, g), members: groupMembers(meta, g) }])),
    muted: meta.mine?.muted ?? [],
    blocked: meta.mine?.blocked ?? [],
  };
}
