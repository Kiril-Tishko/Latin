// How often the people write on their own, like real people (the learner
// chose it): plenty while the learner is there; when the learner goes quiet, a
// message or two, then they wait, each in their own way (Gāius once, then
// nothing for days; Lūcius tries again, theatrically; Claudia checks in once
// after a day and a half), and after that they leave it to the learner. The
// group keeps a rhythm of its own, quieter while the learner is away. Nobody
// says the same thing twice, nor sends the same photo again.
//
// The phone routine's helper (scripts/nuntii-routine.py) has the same rules;
// tests/chat.test.ts checks that both agree.
import { PERSON_BY_ID } from "../content/people";
import { romeDay } from "./calendar";
import { localTime } from "./life";
import { bondPace, standing } from "./bond";
import type { Meta, Msg, Thread } from "./model";
import type { Stranger } from "./strangers";

/** How someone behaves when the learner goes quiet. */
export interface Pace {
  /** Bursts they send without an answer before they stop and wait. */
  patience: number;
  /** Hours they wait after that before trying once more (each further try waits longer). */
  wait: number;
  /** How many more tries after waiting; then they leave it to the learner. */
  nudges: number;
}

/** Messages this close to each other make one burst: one attempt to reach someone. */
export const BURST_GAP = 30 * 60_000;
/** The most messages in one burst written on their own. */
export const BURST_MAX = 4;
/** The most messages in a row in a group's talk among themselves (a lively stretch among five). */
export const GROUP_RUN = 14;
/** Old messages that no longer count as repeating oneself, or a photo as sent lately. */
export const REPEAT_DAYS = 14;
export const PHOTO_DAYS = 21;

const HOUR = 3600_000;

/** A stranger's pace, from their temper: the extreme ones keep trying, the mild ones write once and wait. */
export const strangerPace = (s: Pick<Stranger, "intensity">): Pace =>
  s.intensity === "extreme" ? { patience: 3, wait: 12, nudges: 2 } : s.intensity === "strong" ? { patience: 2, wait: 24, nudges: 1 } : { patience: 1, wait: 48, nudges: 1 };

/** Someone's pace: a friend's own, a stranger's from their temper; with `now`, as their feelings about the learner change it (chat/bond.ts). */
export function paceOf(id: string, meta: Meta, now?: number): Pace {
  const p = PERSON_BY_ID.get(id);
  const s = meta.strangers[id];
  const pace = p ? p.pace : s ? strangerPace(s) : { patience: 1, wait: 48, nudges: 0 };
  if (now === undefined) return pace;
  const st = standing(id, meta, now);
  return st.set ? bondPace(pace, st.lv) : pace;
}

/** Messages in order, split into bursts (one after another, each within BURST_GAP of the one before). */
export function bursts(msgs: Msg[]): Msg[][] {
  const out: Msg[][] = [];
  for (const m of msgs) {
    const cur = out.at(-1);
    if (cur && m.at - cur.at(-1)!.at <= BURST_GAP) cur.push(m);
    else out.push([m]);
  }
  return out;
}

/** Where someone stands in a private chat: how many times they wrote since the learner last did. */
export interface PaceNow {
  /** Their bursts since the learner last wrote here, not counting their answer to it. */
  unanswered: number;
  /** Their last message (ms; 0: none). */
  lastAt: number;
  /** The learner's last message here (ms; 0: never). */
  learnerAt: number;
  /** The learner opened the chat after their last message and wrote nothing. */
  seen: boolean;
}

const spoken = (m: Msg) => m.from !== "me" && m.from !== "sys";

export function paceNow(thread: Thread, who: string, now: number): PaceNow {
  const msgs = thread.messages.filter((m) => m.at <= now).sort((a, b) => a.at - b.at);
  let i = msgs.length - 1;
  while (i >= 0 && msgs[i].from !== "me") i--;
  const learnerAt = i >= 0 ? msgs[i].at : 0;
  const theirs = msgs.slice(i + 1).filter((m) => m.from === who);
  const n = bursts(theirs).length;
  const lastAt = theirs.at(-1)?.at ?? 0;
  return { unanswered: learnerAt ? Math.max(0, n - 1) : n, lastAt, learnerAt, seen: !!lastAt && thread.readAt >= lastAt };
}

/**
 * May they start a new burst now? Yes while they have patience left; then once
 * the wait is over, a last try or two (each waiting longer); then not until
 * the learner writes. `until`: when they may (Infinity: when the learner writes).
 */
export function mayWrite(pace: Pace, p: PaceNow, now: number): { ok: boolean; until: number; last: boolean } {
  if (p.unanswered < pace.patience) return { ok: true, until: now, last: p.unanswered + 1 >= pace.patience && pace.nudges === 0 };
  const tried = p.unanswered - pace.patience;
  if (tried >= pace.nudges) return { ok: false, until: Infinity, last: true };
  const until = p.lastAt + pace.wait * (tried + 1) * HOUR;
  return { ok: now >= until, until, last: tried + 1 >= pace.nudges };
}

/**
 * The group's own rhythm: bursts the people start there on their own, a few a
 * day while the learner takes part, one a day when they have been away for
 * days; three hours apart at least.
 */
export function groupMayWrite(thread: Thread, now: number): { ok: boolean; why: string } {
  const msgs = thread.messages.filter((m) => m.at <= now).sort((a, b) => a.at - b.at);
  const learnerAt = msgs.filter((m) => m.from === "me").at(-1)?.at ?? 0;
  const day = (t: number) => {
    const d = romeDay(t);
    return `${d.y}-${d.m}-${d.d}`;
  };
  // bursts they started on their own (an answer to the learner is not one)
  const started = bursts(msgs.filter(spoken)).filter((b) => b[0].src === "own" || b[0].src === "routine");
  const today = started.filter((b) => day(b[0].at) === day(now)).length;
  const away = now - learnerAt;
  const allowed = away < 24 * HOUR ? 4 : away < 72 * HOUR ? 2 : 1;
  if (today >= allowed) return { ok: false, why: `the group has talked enough today (${today} of ${allowed} stretches of talk; a stretch: messages less than half an hour apart)` };
  const last = started.at(-1)?.at(-1)?.at ?? 0;
  if (now - last < 3 * HOUR) return { ok: false, why: "they talked in the group less than three hours ago" };
  return { ok: true, why: `the group may talk now (${today} of ${allowed} stretches of talk today; a stretch: messages less than half an hour apart)` };
}

/** The words of a message, plain: no long marks, no emoji, no punctuation. */
export function plainWords(text: string): string[] {
  return (
    text
      .replace(/:[a-z]{3,12}:/g, " ")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .match(/\p{L}+/gu) ?? []
  );
}

/** Two messages that say the same thing (one-word ones may come back: "Heu!", "Euge!"). */
export function similar(a: string, b: string): boolean {
  const A = new Set(plainWords(a));
  const B = new Set(plainWords(b));
  if (A.size < 2 || B.size < 2) return false;
  let both = 0;
  for (const w of A) if (B.has(w)) both++;
  return both / (A.size + B.size - both) >= 0.6 || (both === A.size && A.size >= 3) || (both === B.size && B.size >= 3);
}

/** Would this repeat what they wrote in this chat lately? */
export function repeats(thread: Thread, who: string, la: string, now: number): boolean {
  return thread.messages.some((m) => m.from === who && m.at <= now && now - m.at < REPEAT_DAYS * 24 * HOUR && !m.deletedAt && similar(m.la, la));
}

/** Was this photo sent in this chat lately? */
export const photoSentLately = (thread: Thread, photo: string, now: number) => thread.messages.some((m) => m.photo === photo && now - m.at < PHOTO_DAYS * 24 * HOUR);

const when = (t: number, tz: string) => {
  const l = localTime(t, tz);
  return `${l.weekday.slice(0, 3)} ${l.hm}`;
};

/** Where someone stands with the learner in a private chat, for the prompt: may they write, or are they waiting? */
export function paceLine(name: string, pace: Pace, p: PaceNow, now: number, tz: string, learner: string): string {
  const v = mayWrite(pace, p, now);
  const since = p.learnerAt ? `since ${learner} last wrote here (${when(p.learnerAt, tz)})` : `and ${learner} has never written to them`;
  const seen = p.seen && p.unanswered ? ` ${learner} has seen it and said nothing.` : "";
  if (!p.unanswered) return `${name} may write to ${learner} if they have a reason.`;
  const tried = `${name} has written ${p.unanswered === 1 ? "once" : `${p.unanswered} times`} ${since}.${seen}`;
  if (v.ok) return `${tried} ${v.last ? "One last try now, if they want (one burst: a few messages in a row at most); after that they wait for an answer." : "They may write again if they have a reason."}`;
  if (v.until === Infinity) return `${tried} Now they wait for ${learner} to write: nothing more from them here.`;
  return `${tried} They wait: nothing before ${when(v.until, tz)}${v.last ? ", and that would be the last try" : ""}.`;
}

/**
 * May `who` send this message at `at` on their own (not answering)? Within a
 * burst they may go on (a few messages); a new burst must be allowed by their
 * pace (private chat) or by the group's rhythm; and it must not repeat what
 * they said lately, nor send a photo sent there lately.
 */
export function allowOwn(thread: Thread, who: string, msg: { la: string; photo?: string }, at: number, pace: Pace, group: boolean, burst = BURST_MAX): { ok: boolean; why: string } {
  const before = thread.messages.filter((m) => m.at <= at).sort((a, b) => a.at - b.at);
  const last = before.at(-1);
  // going on with a burst: the message before is theirs (or, in a group, anyone's), close enough, and the burst is not too long
  const run: Msg[] = [];
  for (let i = before.length - 1; i >= 0; i--) {
    const m = before[i];
    if (!spoken(m) || (!group && m.from !== who) || (run.length ? run[0].at - m.at : at - m.at) > BURST_GAP) break;
    run.unshift(m);
  }
  const going = !!last && run.length > 0 && run.at(-1) === last;
  // a burst is as long as the person's own (Gāius two at most); a group's talk, a few people's
  if (going && (run.filter((m) => m.from === who).length >= burst || run.length >= (group ? GROUP_RUN : BURST_MAX * 2))) return { ok: false, why: "enough messages in a row" };
  if (!going) {
    if (group) {
      const g = groupMayWrite(thread, at);
      if (!g.ok) return g;
    } else if (!mayWrite(pace, paceNow(thread, who, at), at).ok) return { ok: false, why: "waiting for an answer" };
  }
  if (msg.la && repeats(thread, who, msg.la, at)) return { ok: false, why: "says again what they said lately" };
  if (msg.photo && photoSentLately(thread, msg.photo, at)) return { ok: false, why: "that photo was sent here lately" };
  return { ok: true, why: going ? "goes on" : "may write" };
}

/**
 * The same rules, applied once to what is already in a chat but not seen yet:
 * what someone wrote on their own beyond their pace (or a repeat) goes, as if
 * never sent. What the learner has seen, answers to the learner, and the
 * learner's own messages always stay. Returns the ids to drop.
 */
export function overPace(thread: Thread, meta: Meta, group: boolean, burstOf: (id: string) => number = () => BURST_MAX): string[] {
  const sorted = [...thread.messages].sort((a, b) => a.at - b.at);
  const kept: Msg[] = [];
  const drop: string[] = [];
  for (const m of sorted) {
    const unseen = m.at > thread.readAt && spoken(m) && (m.src === "own" || m.src === "routine");
    if (unseen && !allowOwn({ ...thread, messages: kept }, m.from, m, m.at, paceOf(m.from, meta, m.at), group, burstOf(m.from)).ok) drop.push(m.id);
    else kept.push(m);
  }
  return drop;
}
