// What the people do besides writing, as real people on a messenger do: they
// block the learner and unblock them, leave the group and come back, add
// someone, rename it, take back a message, set a status line, go away for a
// while, bring someone new into their lives, and live storylines among
// themselves. Claude decides (the learner asked for people with freedom, "no
// scenario, no script", who surprise them); this file checks what Claude said
// and applies it, and the page shows it the way a messenger would.
import { PEOPLE } from "../content/people";
import { knownEmojiOnly } from "./emoji";
import { Rand } from "./life";
import { Drama, groupMembers, Meta, Msg, msgId, SYS, Thread, whoOf } from "./model";
import { inventStranger, NewPerson, Stranger } from "./strangers";

const clean = (s: unknown) => knownEmojiOnly(String(s ?? "").replace(/\s+/g, " ").trim());

export const ACT_KINDS = ["block", "unblock", "leave", "join", "add", "rename", "delete", "status", "away", "back"] as const;
export type ActKind = (typeof ACT_KINDS)[number];

export interface Act {
  who: string;
  do: ActKind;
  /** The group's new name, a status line, where they go. */
  text?: string;
  /** Whom they add to the group (a person's id, or a new person's name). */
  whom?: string;
  /** The message they delete (its id). */
  msg?: string;
  /** How long they are away. */
  hours?: number;
}

export interface DramaUpdate {
  id: string;
  en: string;
  who: string[];
  over?: boolean;
}

export interface NewPersonSpec extends NewPerson {
  joinGroup?: boolean;
  /** Their first messages to the learner, if they write at once. */
  firstMessages?: { la: string; en: string }[];
}

/** What a reply or a turn of writing on their own did besides the messages. */
export interface Deeds {
  acts: Act[];
  dramas: DramaUpdate[];
  newPeople: NewPersonSpec[];
}

export const noDeeds = (): Deeds => ({ acts: [], dramas: [], newPeople: [] });

const MAX_DRAMAS = 6;
const HOUR = 3600_000;

/** Everyone who can act: the five friends and the strangers. */
export const allPeople = (meta: Meta) => new Set([...PEOPLE.map((p) => p.id), ...Object.keys(meta.strangers)]);

/**
 * Claude's deeds, checked: known kinds, people who exist (`actors`), a message
 * of their own to delete (by its number in the conversation shown), at most a
 * few of each.
 */
export function deedsOf(raw: { acts?: unknown; drama?: unknown; newPerson?: unknown }, actors: Set<string>, everyone: Set<string>, shown: Msg[] = []): Deeds {
  const list = (x: unknown) => (Array.isArray(x) ? x : x && typeof x === "object" ? [x] : []) as Record<string, unknown>[];
  const acts: Act[] = [];
  for (const x of list(raw.acts).slice(0, 8)) {
    const who = String(x?.who ?? "");
    const kind = String(x?.do ?? "") as ActKind;
    if (!actors.has(who) || !ACT_KINDS.includes(kind)) continue;
    const act: Act = { who, do: kind };
    const text = clean(x.text).slice(0, 60);
    if (text) act.text = text;
    if ((kind === "rename" || kind === "status") && !text) continue;
    if (kind === "add") {
      const whom = String(x.whom ?? "").trim();
      if (!whom) continue;
      act.whom = whom;
    }
    if (kind === "delete") {
      const n = Number(x.msg);
      const m = Number.isInteger(n) && n >= 1 ? shown[n - 1] : undefined;
      if (!m || m.from !== who) continue;
      act.msg = m.id;
    }
    if (kind === "away") act.hours = Math.max(1, Math.min(24 * 30, Number(x.hours) || 48));
    acts.push(act);
  }
  const dramas: DramaUpdate[] = list(raw.drama)
    .slice(0, 4)
    .map((x) => ({
      id: clean(x?.id).toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40),
      en: clean(x?.en).slice(0, 500),
      who: (Array.isArray(x?.who) ? x.who : []).map(String).filter((id) => everyone.has(id)),
      over: x?.over === true,
    }))
    .filter((d) => d.id && (d.en || d.over));
  const newPeople: NewPersonSpec[] = list(raw.newPerson)
    .slice(0, 2)
    .map((x) => {
      const link = x?.link as { to?: unknown; how?: unknown } | undefined;
      const to = String(link?.to ?? "");
      return {
        name: clean(x?.name).slice(0, 30),
        g: x?.g === "f" ? ("f" as const) : ("m" as const),
        age: Number(x?.age) || 30,
        job: clean(x?.job).slice(0, 80),
        city: clean(x?.city).slice(0, 60) || "Rome",
        about: clean(x?.about).slice(0, 400),
        ...(PEOPLE.some((p) => p.id === to) ? { link: { to, how: clean(link?.how).slice(0, 160) } } : {}),
        ...(clean(x?.first) ? { first: clean(x?.first).slice(0, 300) } : {}),
        joinGroup: x?.joinGroup === true,
        firstMessages: (Array.isArray(x?.messages) ? x.messages : [])
          .map((m: { la?: unknown; en?: unknown }) => ({ la: clean(m?.la), en: clean(m?.en) }))
          .filter((m: { la: string }) => m.la)
          .slice(0, 3),
      };
    })
    .filter((p) => /^\p{Lu}\p{L}+$/u.test(p.name));
  return { acts, dramas, newPeople };
}

/** A line of the messenger itself in a chat ("Lūcius left the group"). */
export const sysLine = (en: string, by: string, at: number): Msg => ({ id: msgId(), from: SYS, la: "", en, by, at });

const nameOf = (meta: Meta, id: string) => whoOf(id, meta)?.name ?? id;

/**
 * Makes the new people real: a face, a day, a time zone from the dice, the
 * rest as Claude described them. They join the strangers (hidden from the
 * chat list until they write).
 */
export function welcome(meta: Meta, specs: NewPersonSpec[], r: Rand, now: number): Stranger[] {
  const used = Object.values(meta.strangers);
  const out: Stranger[] = [];
  for (const spec of specs) {
    const taken = new Set([...PEOPLE.map((p) => p.name), ...used.map((s) => s.name), ...out.map((s) => s.name)]);
    if (taken.has(spec.name)) continue;
    const s = inventStranger(spec, r, { names: [...taken], portraits: [...used, ...out].map((x) => x.portrait) }, now);
    out.push({ ...s, invented: true });
  }
  meta.strangers = { ...meta.strangers, ...Object.fromEntries(out.map((s) => [s.id, s])) };
  return out;
}

/**
 * Applies the deeds: the world changes (the group, blocks, travels, status
 * lines, storylines), and the chats get the lines a messenger shows (left,
 * joined, added, renamed) and the deleted messages. Returns the threads that
 * changed, for saving. New people must be welcomed first (`welcome`), so that
 * "add" can find them by name.
 */
export function applyDeeds(meta: Meta, threads: Record<string, Thread>, deeds: Deeds, now: number, groupId: string, joining: Stranger[] = []): Thread[] {
  const world = { ...(meta.world ?? { updatedAt: 0 }) };
  const changed = new Map<string, Thread>();
  const thread = (id: string) => changed.get(id) ?? threads[id];
  const push = (id: string, m: Msg) => {
    const t = thread(id);
    if (t) changed.set(id, { ...t, messages: [...t.messages, m] });
  };
  let members = [...groupMembers(meta)];
  let at = now;
  const tick = () => (at += 1500);
  const byName = (name: string) => Object.values(meta.strangers).find((s) => s.name.toLowerCase() === name.toLowerCase())?.id ?? (whoOf(name, meta) ? name : undefined);
  for (const a of deeds.acts) {
    const who = nameOf(meta, a.who);
    switch (a.do) {
      case "block":
        world.blocked = { ...world.blocked, [a.who]: now };
        break;
      case "unblock": {
        const { [a.who]: _, ...rest } = world.blocked ?? {};
        world.blocked = rest;
        break;
      }
      case "leave":
        if (members.includes(a.who)) {
          members = members.filter((id) => id !== a.who);
          push(groupId, sysLine(`${who} left the group.`, a.who, tick()));
        }
        break;
      case "join":
        if (!members.includes(a.who)) {
          members.push(a.who);
          push(groupId, sysLine(`${who} joined the group.`, a.who, tick()));
        }
        break;
      case "add": {
        const id = byName(a.whom!);
        if (id && !members.includes(id) && members.includes(a.who)) {
          members.push(id);
          push(groupId, sysLine(`${who} added ${nameOf(meta, id)}.`, a.who, tick()));
        }
        break;
      }
      case "rename":
        if (members.includes(a.who)) {
          world.group = { ...world.group, name: a.text };
          push(groupId, sysLine(`${who} renamed the group «${a.text}».`, a.who, tick()));
        }
        break;
      case "delete":
        for (const [id, t] of Object.entries(threads)) {
          const cur = thread(id)!;
          if (t.messages.some((m) => m.id === a.msg)) changed.set(id, { ...cur, messages: cur.messages.map((m) => (m.id === a.msg ? { ...m, deletedAt: Math.min(m.deletedAt ?? Infinity, now) } : m)) });
        }
        break;
      case "status":
        world.status = { ...world.status, [a.who]: { text: a.text!, at: now } };
        break;
      case "away":
        world.away = { ...world.away, [a.who]: { until: now + a.hours! * HOUR, where: a.text ?? "away" } };
        break;
      case "back": {
        const { [a.who]: _, ...rest } = world.away ?? {};
        world.away = rest;
        break;
      }
    }
  }
  // new people who join the group at once, brought in by the friend they know
  for (const s of joining) {
    if (members.includes(s.id)) continue;
    members.push(s.id);
    push(groupId, sysLine(s.link ? `${nameOf(meta, s.link.to)} added ${s.name}.` : `${s.name} joined the group.`, s.link?.to ?? s.id, tick()));
  }
  // storylines: new ones start, going ones move on, finished ones end
  const dramas = new Map((world.dramas ?? []).map((d) => [d.id, d]));
  for (const d of deeds.dramas) {
    if (d.over) dramas.delete(d.id);
    else {
      const old = dramas.get(d.id);
      dramas.set(d.id, { id: d.id, en: d.en || old?.en || "", who: d.who.length ? d.who : old?.who ?? [], since: old?.since ?? now, updatedAt: now } satisfies Drama);
    }
  }
  world.dramas = [...dramas.values()].sort((x, y) => y.updatedAt - x.updatedAt).slice(0, MAX_DRAMAS);
  world.group = { ...world.group, members };
  world.updatedAt = now;
  meta.world = world;
  return [...changed.values()];
}
