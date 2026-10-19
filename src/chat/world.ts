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
import { GROUP } from "../content/people";
import { Drama, GroupInfo, groupMembers, Meta, Msg, msgId, newThread, SYS, Thread, whoOf } from "./model";
import { inventStranger, NewPerson, Stranger } from "./strangers";
import { Tell, tellsOf } from "./mind";

const clean = (s: unknown) => knownEmojiOnly(String(s ?? "").replace(/\s+/g, " ").trim());

export const ACT_KINDS = ["block", "unblock", "leave", "join", "add", "remove", "rename", "newGroup", "delete", "status", "away", "back"] as const;
export type ActKind = (typeof ACT_KINDS)[number];

export interface Act {
  who: string;
  do: ActKind;
  /** The group's new name, a status line, where they go. */
  text?: string;
  /** Whom they add to the group or take out of it (a person's id, or a new person's name). */
  whom?: string;
  /** Which group (its chat id); the chat it happened in, or the friends' group. */
  group?: string;
  /** A new group: who else is in it (person ids; "me" for the learner), and its first messages. */
  with?: string[];
  messages?: { from: string; la: string; en: string }[];
  /** The message they delete (its id). */
  msg?: string;
  /** How long they are away. */
  hours?: number;
}

export interface DramaUpdate {
  id: string;
  en: string;
  who: string[];
  /** Who knows of it now. */
  knows?: string[];
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
  /** What someone told someone else, out of the learner's sight (chat/mind.ts). */
  tells: Tell[];
}

export const noDeeds = (): Deeds => ({ acts: [], dramas: [], newPeople: [], tells: [] });

const MAX_DRAMAS = 6;
const HOUR = 3600_000;

/** Everyone who can act: the five friends and the strangers. */
export const allPeople = (meta: Meta) => new Set([...PEOPLE.map((p) => p.id), ...Object.keys(meta.strangers)]);

/**
 * Claude's deeds, checked: known kinds, people who exist (`actors`), a message
 * of their own to delete (by its number in the conversation shown), at most a
 * few of each.
 */
export function deedsOf(raw: { acts?: unknown; drama?: unknown; newPerson?: unknown; tell?: unknown }, actors: Set<string>, everyone: Set<string>, shown: Msg[] = [], groups: Set<string> = new Set([GROUP.id])): Deeds {
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
    if (kind === "add" || kind === "remove") {
      const whom = String(x.whom ?? "").trim();
      if (!whom) continue;
      act.whom = whom;
    }
    if (x.group !== undefined && ["leave", "join", "add", "remove", "rename"].includes(kind)) {
      if (!groups.has(String(x.group))) continue;
      act.group = String(x.group);
    }
    if (kind === "newGroup") {
      if (!text) continue;
      act.with = [...new Set((Array.isArray(x.with) ? x.with : []).map(String).filter((id) => id === "me" || everyone.has(id)))].filter((id) => id !== who).slice(0, 8);
      if (!act.with.length) continue;
      act.messages = (Array.isArray(x.messages) ? x.messages : [])
        .map((m: { from?: unknown; la?: unknown; en?: unknown }) => ({ from: String(m?.from ?? who), la: clean(m?.la), en: clean(m?.en) }))
        .filter((m: { from: string; la: string }) => m.la && (m.from === who || act.with!.includes(m.from)))
        .slice(0, 4);
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
      ...(Array.isArray(x?.knows) ? { knows: x.knows.map(String).filter((id) => everyone.has(id)) } : {}),
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
  return { acts, dramas, newPeople, tells: tellsOf(raw.tell, actors, everyone) };
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
  const groups: Record<string, GroupInfo> = { ...(world.groups ?? {}) };
  const changed = new Map<string, Thread>();
  const thread = (id: string) => changed.get(id) ?? threads[id];
  const push = (id: string, m: Msg) => {
    const t = thread(id) ?? (groups[id] ? newThread(id, "group") : undefined);
    if (t) changed.set(id, { ...t, messages: [...t.messages, m] });
  };
  // each group's members as the deeds change them
  const members = new Map<string, string[]>();
  const membersIn = (g: string) => members.get(g) ?? (g === GROUP.id ? [...groupMembers(meta)] : [...(groups[g]?.members ?? [])]);
  const setMembers = (g: string, list: string[]) => members.set(g, list);
  let at = now;
  const tick = () => (at += 1500);
  const byName = (name: string) => Object.values(meta.strangers).find((s) => s.name.toLowerCase() === name.toLowerCase())?.id ?? (whoOf(name, meta) ? name : undefined);
  for (const a of deeds.acts) {
    const who = nameOf(meta, a.who);
    const g = a.group ?? groupId;
    const inGroup = membersIn(g);
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
        if (inGroup.includes(a.who)) {
          setMembers(g, inGroup.filter((id) => id !== a.who));
          push(g, sysLine(`${who} left the group.`, a.who, tick()));
        }
        break;
      case "join":
        if (!inGroup.includes(a.who)) {
          setMembers(g, [...inGroup, a.who]);
          push(g, sysLine(`${who} joined the group.`, a.who, tick()));
        }
        break;
      case "add": {
        const id = byName(a.whom!);
        if (id && !inGroup.includes(id) && inGroup.includes(a.who)) {
          setMembers(g, [...inGroup, id]);
          push(g, sysLine(`${who} added ${nameOf(meta, id)}.`, a.who, tick()));
        }
        break;
      }
      case "remove": {
        const id = a.whom === "me" ? "me" : byName(a.whom!);
        if (id === "me" && g !== GROUP.id && groups[g] && groups[g].by === a.who) {
          // thrown out of a group by the one who made it
          groups[g] = { ...groups[g], gone: true, updatedAt: now };
          push(g, sysLine(`${who} removed you.`, a.who, tick()));
        } else if (id && id !== "me" && inGroup.includes(id) && inGroup.includes(a.who)) {
          setMembers(g, inGroup.filter((x) => x !== id));
          push(g, sysLine(`${who} removed ${nameOf(meta, id)}.`, a.who, tick()));
        }
        break;
      }
      case "rename":
        if (inGroup.includes(a.who)) {
          if (g === GROUP.id) world.group = { ...world.group, name: a.text };
          else if (groups[g]) groups[g] = { ...groups[g], name: a.text!, updatedAt: now };
          push(g, sysLine(`${who} renamed the group «${a.text}».`, a.who, tick()));
        }
        break;
      case "newGroup": {
        // a group of their own, with the learner in it (or a group about the learner they are added to by mistake)
        if (!a.with!.includes("me")) break;
        const id = `g-${now.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
        const list = [a.who, ...a.with!.filter((x) => x !== "me")];
        groups[id] = { name: a.text!, members: list, by: a.who, at: now, updatedAt: now };
        push(id, sysLine(`${who} created the group «${a.text}» and added you.`, a.who, tick()));
        let t = tick();
        for (const m of a.messages ?? []) push(id, { id: msgId(), from: m.from, la: m.la, en: m.en, at: (t += 6000 + m.la.length * 90), src: "own" });
        break;
      }
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
    const inGroup = membersIn(groupId);
    if (inGroup.includes(s.id)) continue;
    setMembers(groupId, [...inGroup, s.id]);
    push(groupId, sysLine(s.link ? `${nameOf(meta, s.link.to)} added ${s.name}.` : `${s.name} joined the group.`, s.link?.to ?? s.id, tick()));
  }
  // storylines: new ones start, going ones move on, finished ones end
  const dramas = new Map((world.dramas ?? []).map((d) => [d.id, d]));
  for (const d of deeds.dramas) {
    if (d.over) dramas.delete(d.id);
    else {
      const old = dramas.get(d.id);
      const knows = d.knows ?? old?.knows;
      dramas.set(d.id, { id: d.id, en: d.en || old?.en || "", who: d.who.length ? d.who : old?.who ?? [], ...(knows ? { knows } : {}), since: old?.since ?? now, updatedAt: now } satisfies Drama);
    }
  }
  world.dramas = [...dramas.values()].sort((x, y) => y.updatedAt - x.updatedAt).slice(0, MAX_DRAMAS);
  for (const [g, list] of members) {
    if (g === GROUP.id) world.group = { ...world.group, members: list };
    else if (groups[g]) groups[g] = { ...groups[g], members: list, updatedAt: now };
  }
  world.groups = groups;
  world.updatedAt = now;
  meta.world = world;
  return [...changed.values()];
}
