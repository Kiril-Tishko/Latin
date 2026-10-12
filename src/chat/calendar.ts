// The day in Rome as the people of the messenger live it: the Roman date
// (a.d. IV Īd. Oct.), the year (AD 100 is this year: YEAR_OFFSET), the
// festivals near today, the friends' birthdays and the news of Trajan's reign,
// for Claude to weave in now and then, and the names they bring, which may be
// written while they are near.
import { BIRTHDAYS, Festival, FESTIVALS, HISTORY, HistoryEvent, YEAR_OFFSET, YEARS } from "../content/calendar";
import { PERSON_BY_ID } from "../content/people";
import { roman } from "../latin/text";

const MONTH_LA = ["Iān.", "Feb.", "Mart.", "Apr.", "Māi.", "Iūn.", "Iūl.", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
const MONTH_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** The planetary week, known in Rome by now (Pompeii's walls list it). */
const WEEKDAY_LA = ["diēs Sōlis", "diēs Lūnae", "diēs Mārtis", "diēs Mercuriī", "diēs Iovis", "diēs Veneris", "diēs Sāturnī"];
const WEEKDAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface Ymd {
  y: number;
  m: number;
  d: number;
}

let fmt: Intl.DateTimeFormat | null = null;
/** The date in Rome at a moment. */
export function romeDay(now: number): Ymd {
  fmt ??= new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });
  const [y, m, d] = fmt.format(new Date(now)).split("-").map(Number);
  return { y, m, d };
}

/** Days since 1970 for a date: to count days between dates. */
const dayNo = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m - 1, d) / 86400000);
const leapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const monthDays = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** The Nones and the Ides of a month: the 7th and 15th in March, May, July and October, else the 5th and 13th. */
const nones = (m: number) => ([3, 5, 7, 10].includes(m) ? 7 : 5);
const ides = (m: number) => nones(m) + 8;

/** The Roman name of a date: Kal. Oct., a.d. IV Īd. Oct., prīdiē Kal. Nov. */
export function romanDate({ y, m, d }: Ymd): string {
  const mon = MONTH_LA[m - 1];
  if (d === 1) return `Kal. ${mon}`;
  if (d === nones(m)) return `Nōn. ${mon}`;
  if (d === ides(m)) return `Īd. ${mon}`;
  const count = (n: number, mark: string, month: string) => (n === 2 ? `prīdiē ${mark} ${month}` : `a.d. ${roman(n)} ${mark} ${month}`);
  if (d < nones(m)) return count(nones(m) - d + 1, "Nōn.", mon);
  if (d < ides(m)) return count(ides(m) - d + 1, "Īd.", mon);
  // after the Ides: counted to the Kalends of the next month (in a leap year the 24th of February is said twice)
  const next = MONTH_LA[m % 12];
  if (m === 2 && leapYear(y)) {
    if (d === 24) return `a.d. bis VI Kal. ${next}`;
    if (d > 24) return count(monthDays(y, m) - d + 2, "Kal.", next);
    return count(28 - d + 2, "Kal.", next);
  }
  return count(monthDays(y, m) - d + 2, "Kal.", next);
}

/** The year the people live in (AD), for a real year. */
export const adYear = (y: number) => y - YEAR_OFFSET;

/** A festival's days this year (and its neighbours), as day numbers. */
function festivalDays(f: Festival, y: number): [number, number] {
  const [fm, fd] = f.from;
  const [tm, td] = f.to ?? f.from;
  const start = dayNo(y, fm, fd);
  const end = dayNo(tm < fm ? y + 1 : y, tm, td);
  return [start, end];
}

export interface Near<T> {
  item: T;
  /** Days from today: negative = past, 0 = today (or going on). */
  days: number;
}

/** Festivals going on, coming within a week, or just past (two days). */
export function festivalsNear(day: Ymd): Near<Festival>[] {
  const today = dayNo(day.y, day.m, day.d);
  const out: Near<Festival>[] = [];
  for (const f of FESTIVALS) {
    for (const y of [day.y - 1, day.y, day.y + 1]) {
      const [start, end] = festivalDays(f, y);
      if (today >= start && today <= end) out.push({ item: f, days: 0 });
      else if (start > today && start - today <= 7) out.push({ item: f, days: start - today });
      else if (end < today && today - end <= 2) out.push({ item: f, days: end - today });
    }
  }
  return out.sort((a, b) => a.days - b.days);
}

/** The friends' birthdays within three days. */
export function birthdaysNear(day: Ymd): Near<string>[] {
  const today = dayNo(day.y, day.m, day.d);
  const out: Near<string>[] = [];
  for (const [id, [m, d]] of Object.entries(BIRTHDAYS)) {
    for (const y of [day.y - 1, day.y, day.y + 1]) {
      const n = dayNo(y, m, d) - today;
      if (Math.abs(n) <= 3) out.push({ item: id, days: n });
    }
  }
  return out;
}

/** The news: what Rome heard in the last six weeks (newest first, two at most), and what is planned for the next two weeks. */
export function newsNear(day: Ymd): { lately: Near<HistoryEvent>[]; coming: Near<HistoryEvent>[] } {
  const today = dayNo(day.y, day.m, day.d);
  const at = (e: HistoryEvent) => dayNo(e.year + YEAR_OFFSET, e.month, e.day) - today;
  const lately = HISTORY.map((e) => ({ item: e, days: at(e) })).filter((x) => x.days <= 0 && x.days >= -42).sort((a, b) => b.days - a.days).slice(0, 2);
  const coming = HISTORY.filter((e) => e.planned).map((e) => ({ item: e, days: at(e) })).filter((x) => x.days > 0 && x.days <= 14);
  return { lately, coming };
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const inDays = (n: number) => (n === 0 ? "today" : n === 1 ? "tomorrow" : n === -1 ? "yesterday" : n > 0 ? `in ${n} days` : `${-n} days ago`);

/** Today in Rome for the top of the messenger: "a.d. IV Īd. Oct. · Augustālia". */
export function todayLine(now: number): { la: string; en: string } {
  const day = romeDay(now);
  const fest = festivalsNear(day).find((x) => x.days === 0)?.item;
  const ad = adYear(day.y);
  const weekday = new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay();
  return {
    la: `${romanDate(day)}${fest ? ` · ${fest.la}` : ""}`,
    en: `${WEEKDAY_EN[weekday]} ${day.d} ${MONTH_EN[day.m - 1]}, AD ${ad} (${roman(ad + 753)} years since Rome was founded)${fest ? `: ${fest.en}, ${fest.what}` : ""}`,
  };
}

const festLine = (x: Near<Festival>) => {
  const f = x.item;
  const when = x.days === 0 ? (f.to ? "going on now" : "today") : inDays(x.days);
  return `${when}, ${f.en} («${f.la}»): ${f.what}`;
};

/** The day in Rome, for the people to live in (what Claude reads). */
export function calendarBlock(now: number): string {
  const day = romeDay(now);
  const ad = adYear(day.y);
  const weekday = new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay();
  const fests = festivalsNear(day);
  const births = birthdaysNear(day);
  const { lately, coming } = newsNear(day);
  const lines = [
    `THE DAY IN ROME: ${WEEKDAY_EN[weekday]} ${day.d} ${MONTH_EN[day.m - 1]} (${WEEKDAY_LA[weekday]}, ${romanDate(day)}), AD ${ad}, the ${ordinal(ad + 753)} year since Rome was founded. Trajan is emperor${YEARS[ad] ? `; ${YEARS[ad]}` : ""}.`,
    fests.length ? `Festivals: ${fests.map(festLine).join("; ")}.` : "",
    births.length ? `Birthdays: ${births.map((x) => `${PERSON_BY_ID.get(x.item)?.name}'s birthday is ${inDays(x.days)}`).join("; ")}.` : "",
    lately.length ? `News in Rome: ${lately.map((x) => `${x.item.en} (${inDays(x.days)})`).join("; ")}.` : "",
    coming.length ? `Coming soon, everyone talks of it: ${coming.map((x) => `${x.item.en} (${inDays(x.days)})`).join("; ")}.` : "",
    "They live through these days as real Romans would: a festival, a birthday or the news comes up now and then when it fits (plans, crowds, food, omens, gossip, worry for soldiers far away), never in every message; they know only what people of their time could know.",
  ];
  return lines.filter(Boolean).join("\n");
}

/** Names and words the day brings (a festival near, the news), allowed in the messages while they are near. */
export function calendarWords(now: number): { word: string; g?: "m" | "f"; en: string; decline: boolean }[] {
  const day = romeDay(now);
  const out = new Map<string, { word: string; g?: "m" | "f"; en: string; decline: boolean }>();
  for (const x of festivalsNear(day)) for (const w of x.item.words) out.set(w, { word: w, en: x.item.en, decline: false });
  const { lately, coming } = newsNear(day);
  for (const x of [...lately, ...coming]) for (const [name, g, en] of x.item.names ?? []) out.set(name, { word: name, g, en, decline: true });
  return [...out.values()];
}
