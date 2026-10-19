// Ācta Diurna: the daily notices of Rome, as the learner asked ("a daily Roman
// newspaper"). The real Ācta were written up on a white board in the Forum:
// the day, the city's news, births and weddings, trials, games, prodigies.
// Here Claude writes the day's board once a Roman day, from the day in Rome
// (calendar.ts), the friends' lives and a notice like those painted on
// Pompeii's walls, with only the learner's words and rules: every title and
// line is vetted like a message. The board lives in the messenger as a channel
// («acta»): one post per item, its lines kept one per line in `la` and `en`.
import { PEOPLE } from "../content/people";
import { romeDay } from "./calendar";
import { clean, Deps, vetAll } from "./engine";
import { Meta, Msg, Thread } from "./model";
import { languageBlock, learnerBlock, PromptCtx } from "./prompts";
import { publicNow } from "./lives";

export const ACTA_ID = "acta";

export type ActaKind = "day" | "city" | "friends" | "notice" | "omen";

/** The kinds of item, with the small rubric each shows (Latin, English in the tooltip). */
export const ACTA_KINDS: Record<ActaKind, { la: string; en: string }> = {
  day: { la: "Diēs", en: "The day" },
  city: { la: "Urbs", en: "The city" },
  friends: { la: "Amīcī", en: "Your friends" },
  notice: { la: "Titulus", en: "A notice painted on a wall" },
  omen: { la: "Prōdigium", en: "A wonder, an omen" },
};

/** Items on a board, and lines in an item. */
export const MAX_ITEMS = 5;
export const MAX_LINES = 3;

/** The Roman day a board belongs to: "20261012". */
export function actaKey(now: number): string {
  const d = romeDay(now);
  return `${d.y}${String(d.m).padStart(2, "0")}${String(d.d).padStart(2, "0")}`;
}

/** The posts of one day's board, in order. */
export const boardOf = (t: Thread, key: string): Msg[] => t.messages.filter((m) => m.id.startsWith(`acta-${key}-`)).sort((a, b) => a.at - b.at);

/** The newest board that has come out by now (its posts in order), for the chat list and Ask Claude. */
export function newestBoard(t: Thread, now: number): Msg[] {
  const out = t.messages.filter((m) => m.at <= now && m.id.startsWith("acta-"));
  const key = out.reduce((k, m) => (m.id.slice(5, 13) > k ? m.id.slice(5, 13) : k), "");
  return key ? boardOf(t, key).filter((m) => m.at <= now) : [];
}

/** The lines of a post, Latin and English side by side. */
export function linesOf(m: Msg): { la: string; en: string }[] {
  const en = (m.en ?? "").split("\n");
  return m.la.split("\n").map((la, i) => ({ la, en: en[i] ?? "" }));
}

/** The boards before today's (newest first, three at most), in a few words each: so Claude does not repeat them, and may follow one up. */
export function earlierBoards(t: Thread, now: number): string[] {
  const today = actaKey(now);
  const days = [...new Set(t.messages.map((m) => /^acta-(\d{8})-/.exec(m.id)?.[1]).filter((k): k is string => !!k && k < today))].sort().reverse().slice(0, 3);
  return days.map((k) => {
    const posts = boardOf(t, k);
    return `- ${k.slice(6)}.${k.slice(4, 6)}.: ${posts.map((m) => `${m.title?.en ?? ""}: ${linesOf(m).map((l) => l.en).join(" ")}`).join(" | ")}`;
  });
}

/** What Claude reads to write today's board. */
export function actaPrompt(meta: Meta, ctx: PromptCtx, earlier: string[]): string {
  const friends = PEOPLE.map((p) => `- ${p.name} (${p.age}, ${p.job}, ${p.city})`).join("\n");
  // only what the neighbours know: public happenings now, and public news of the last days (chat/lives.ts)
  const known = [
    ...new Set([...publicNow(meta, ctx.now), ...(meta.world?.timeline ?? []).filter((e) => e.public && e.at <= ctx.now && ctx.now - e.at < 3 * 86400_000).map((e) => e.en)]),
  ];
  return [
    `You are the scribe of the «Ācta Diurna», the daily notices of Rome written up on a white board in the Forum (the real ones told of the day, the city, births and weddings, trials, the games and prodigies). You write TODAY'S BOARD for a learner of Latin far away, who reads it as their daily Roman newspaper and must understand every word.`,
    learnerBlock(ctx),
    ctx.calendar ?? "",
    `THE LEARNER'S FRIENDS, ordinary people in and around Rome:\n${friends}\nWhat the neighbours know of them now (the board may tell a little of it, as the neighbours would; never anything else about them, nothing private or unkind):\n${known.length ? known.map((l) => `- ${l}`).join("\n") : "- nothing in particular: then a small, harmless neighbourhood item (a friend seen at the market, at the baths, at the races)"}`,
    earlier.length ? `EARLIER BOARDS (do not repeat them; now and then follow one up, as a newspaper would: the lost animal found, the room let):\n${earlier.join("\n")}` : "",
    `TODAY'S BOARD: 4 or 5 short items, in this order:
1. "day": the day itself: its festival, or what an ordinary day in Rome is like now (the season's weather, the market, the baths).
2. "city": the news of Rome from the day above, as a Roman of this year knows it, or everyday life in the city (the new harbour at Portus, building, the games, the aqueducts).
3. "friends": one item about the friends: what the neighbours know, as neighbourhood news.
4. "notice": a notice like those painted on the walls of Pompeii: a lost animal, something for sale, a teacher looking for pupils, a room to let, a candidate to vote for.
5. "omen" (only now and then, not every day): a wonder or an omen, as the real Ācta reported them.
Each item has a title of one to four words and one to three sentences. Something true to Roman life, funny or surprising in every item; never generic, never a lesson.`,
    languageBlock(ctx, false),
    `Reply with only JSON:
{"items": [{"kind": "day" | "city" | "friends" | "notice" | "omen", "title": "<Latin>", "titleEn": "<English>", "lines": [{"la": "<Latin>", "en": "<English>"}]}]}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

interface RawActa {
  items?: { kind?: unknown; title?: unknown; titleEn?: unknown; lines?: { la?: unknown; en?: unknown }[] }[];
}

interface Item {
  kind: ActaKind;
  title: { la: string; en: string };
  lines: { la: string; en: string }[];
}

/** Claude's board as items: known kinds, at most five items of at most three lines, empty ones left out. */
export function itemsOf(raw: RawActa | null | undefined): Item[] {
  return (Array.isArray(raw?.items) ? raw!.items : [])
    .map((x) => ({
      kind: (typeof x?.kind === "string" && x.kind in ACTA_KINDS ? x.kind : "city") as ActaKind,
      title: { la: clean(x?.title), en: clean(x?.titleEn) },
      lines: (Array.isArray(x?.lines) ? x.lines : [])
        .map((l) => ({ la: clean(l?.la), en: clean(l?.en) }))
        .filter((l) => l.la)
        .slice(0, MAX_LINES),
    }))
    .filter((x) => x.lines.length)
    .slice(0, MAX_ITEMS);
}

/**
 * Today's board, written and vetted: one post per item, with ids of the day
 * ("acta-20261012-0"), so a board two devices wrote at once merges into one.
 */
export async function writeActa(meta: Meta, ctx: PromptCtx, deps: Deps, earlier: string[]): Promise<Msg[]> {
  const raw = await deps.ask<RawActa>(actaPrompt(meta, ctx, earlier), { ...deps.opts, cache: false });
  const items = itemsOf(raw);
  // every title and line vetted like a message (one rewrite asked for what slips)
  const drafts = items.flatMap((x, i) => [...(x.title.la ? [{ i, j: -1, ...x.title }] : []), ...x.lines.map((l, j) => ({ i, j, ...l }))]);
  // (a board's lines are rewritten as news, not as texting)
  const vetted = await vetAll(drafts, ctx, deps, false);
  for (const d of vetted) {
    const item = items[d.i];
    if (d.j < 0) item.title = { la: d.la, en: d.en };
    else item.lines[d.j] = { la: d.la, en: d.en };
  }
  const slipped = (i: number) => [...new Set(vetted.filter((d) => d.i === i).flatMap((d) => d.newWords ?? []))];
  const key = actaKey(ctx.now);
  return items.map((x, i) => {
    const newWords = slipped(i);
    return {
      id: `acta-${key}-${i}`,
      from: ACTA_ID,
      la: x.lines.map((l) => l.la.replace(/\n/g, " ")).join("\n"),
      en: x.lines.map((l) => l.en.replace(/\n/g, " ")).join("\n"),
      // the whole board at once, in its order
      at: ctx.now + i,
      src: "own" as const,
      title: x.title,
      tag: x.kind,
      ...(newWords.length ? { newWords } : {}),
    };
  });
}
