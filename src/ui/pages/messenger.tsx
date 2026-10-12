// Nūntiī: the messenger. Five friends in and around Rome, their group chat, and
// strangers met at random write to the learner in Latin, only with the words
// and rules the learner knows. Tap a message for its English, a word for its
// meaning; Check asks the coach about the learner's own Latin. The look follows
// the learner's own picture: parchment panels in a scene of old engravings
// (Piranesi's Forum, Corinthian capitals, Livy's bust), big faces, laurels.
import { Fragment } from "preact";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { ENGRAVINGS } from "../../content/engravings";
import { ROMAN_EMOJI } from "../../content/roman-emoji";
import { emojiCodes, onlyEmoji, showEmoji } from "../../chat/emoji";
import { GROUP, PEOPLE } from "../../content/people";
import { phrasebook } from "../../content/phrases";
import { PORTRAIT_BY_ID } from "../../content/portraits";
import { localTime, moodText, statusAt } from "../../chat/life";
import { arrived, Check, CoachTurn, membersOf, Msg, preview, Thread, unreadCount, voiceOf, Who, whoOf } from "../../chat/model";
import { romanDate, romeDay, todayLine } from "../../chat/calendar";
import { PHOTO_BY_ID, photoSrc } from "../../content/photos";
import { speak, stopSpeaking, useSpeaking, useVoices } from "../../audio/speech";
import { allowedWords, CHAT_WORD_LIST, headword, notLatin, strangeWords } from "../../chat/words";
import { Analysis, annotate } from "../../latin/analyze";
import { plain, roman } from "../../latin/text";
import { CASE_NAMES, Entry, PN, PN_NAMES } from "../../latin/types";
import { enterSends, Icon, Modal, useSwipeAway } from "../components";
import { LatinText } from "../latin";
import { audioReady, Speak } from "../speak";
import { Inline, Markup } from "../markup";
import { fixRequest, GrammarCheck } from "../ask";
import { go } from "../nav";
import { useScreen } from "../screen";
import {
  allThreads,
  answer,
  askCoach,
  chatWords,
  check,
  composing,
  connectMessenger,
  errorOf,
  findSomeone,
  forget,
  getMeta,
  getThread,
  markRead,
  opened,
  presence,
  send,
  touchLives,
  typingIn,
  useMessenger,
} from "../messenger";
import { derived, update, useProgress } from "../store";
import { storage } from "../platform";
import { WordModal } from "./words";
import { knownWord, openAddWord } from "../addword";
import { NO_CORRECTION } from "../keyboard";

// ---------------------------------------------------------------- pieces

/** A round portrait (mirrored for a stranger who shares one), with a dot when they are online or not. */
export function Avatar({ who, size = 44, dot }: { who: Pick<Who, "portrait" | "name"> & { flip?: boolean }; size?: number; dot?: "on" | "off" }) {
  const p = PORTRAIT_BY_ID.get(who.portrait);
  return (
    <span class="avatar-wrap" style={{ "--av-size": `${size}px` }}>
      <span class="avatar">
        {p ? <img src={p.src} alt={who.name} style={who.flip ? { transform: "scaleX(-1)" } : undefined} /> : <span class="avatar-letter">{who.name[0]}</span>}
      </span>
      {dot && <i class={`presence-dot ${dot}`} aria-label={dot === "on" ? "online" : "offline"} />}
    </span>
  );
}

/** The group's picture: four of its faces. */
function GroupAvatar({ size = 44 }: { size?: number }) {
  return (
    <span class="avatar group-avatar" style={{ "--av-size": `${size}px` }} aria-label={GROUP.name}>
      {PEOPLE.slice(0, 4).map((p) => (
        <img key={p.id} src={PORTRAIT_BY_ID.get(p.portrait)?.src} alt="" />
      ))}
    </span>
  );
}

/** A laurel sprig: a curved stem with paired leaves, in gold. */
export function Sprig({ flip, cls = "" }: { flip?: boolean; cls?: string }) {
  const leaves: [number, number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const x = 6 + t * 44;
    const y = 54 - t * 44 + Math.sin(t * Math.PI) * -6;
    leaves.push([x, y, -40 - t * 10]);
  }
  return (
    <svg class={`sprig ${cls}`} viewBox="0 0 64 64" aria-hidden="true" style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M4 60 C 20 44, 34 28, 54 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      {leaves.map(([x, y, rot], i) => (
        <g key={i}>
          <ellipse cx={x - 4} cy={y - 5} rx="7" ry="2.7" transform={`rotate(${rot - 35} ${x - 4} ${y - 5})`} fill="currentColor" />
          <ellipse cx={x + 5} cy={y + 3} rx="7" ry="2.7" transform={`rotate(${rot + 35} ${x + 5} ${y + 3})`} fill="currentColor" />
        </g>
      ))}
      <ellipse cx="56" cy="6" rx="6.5" ry="2.6" transform="rotate(-48 56 6)" fill="currentColor" />
    </svg>
  );
}

/** The scene behind the messenger: Piranesi's Forum behind the top bar, Corinthian capitals at the page sides. */
function Scene() {
  return (
    <div
      class="msgr-scene"
      aria-hidden="true"
      style={{ "--rome": `url(${ENGRAVINGS.rome.src})`, "--capital": `url(${ENGRAVINGS.capital.src})` } as Record<string, string>}
    >
      <i class="scene-col left" />
      <i class="scene-col right" />
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const daysAgo = (t: number, now: number) => Math.round((new Date(new Date(now).toDateString()).getTime() - new Date(new Date(t).toDateString()).getTime()) / 86400000);

/** "21:40", "Yesterday", "Mon", "12 Oct" for the chat list. */
function when(t: number, now: number): string {
  const days = daysAgo(t, now);
  const d = new Date(t);
  if (days === 0) return clock(t);
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-GB", { weekday: "short" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** The day line in a chat, in Latin for today and yesterday (Hodiē, Heri), with the Roman date. */
function dayLabel(t: number, now: number): { la: string; en: string; roman: string } {
  const days = daysAgo(t, now);
  const d = new Date(t);
  const roman = romanDate(romeDay(t));
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  if (days === 0) return { la: "Hodiē", en: `Today, ${date}`, roman };
  if (days === 1) return { la: "Heri", en: `Yesterday, ${date}`, roman };
  const en = days < 7 ? d.toLocaleDateString("en-GB", { weekday: "long" }) : date;
  return { la: en, en: `${en}${days < 7 ? `, ${date}` : ""}`, roman };
}

const nameOf = (id: string) => (id === "me" ? "You" : whoOf(id, getMeta())?.name ?? id);

/** Online (a green dot) or not, for a person's chat. */
function dotOf(who: Who, t: Thread, now: number): "on" | "off" {
  const p = presence(who, t, now, statusAt(who.day, who.tz, now));
  return p === "online" || p === "typing…" ? "on" : "off";
}

// ------------------------------------------------------------------ page

export function Messenger({ thread }: { thread?: string }) {
  const p = useProgress();
  const now = useMessenger();
  const me = p.settings.me;
  useEffect(() => {
    void connectMessenger();
    if (me) void opened();
  }, [!!me]);
  const t = thread ? getThread(thread) : null;
  const known = t && (thread === GROUP.id || PEOPLE.some((x) => x.id === thread) || getMeta().strangers[thread!]) && !t.gone;
  useScreen("page", known ? `Messenger: chat with ${thread === GROUP.id ? `the group ${GROUP.name}` : nameOf(thread!)}` : "Messenger", () => (known ? screenText(t!, now) : "The list of chats in the messenger."));
  return (
    <>
      <Scene />
      {!me ? (
        <Setup />
      ) : (
        <div class={`msgr${known ? " in-chat" : ""}`}>
          <ChatList active={known ? thread! : null} now={now} />
          {known ? <ChatView key={thread} id={thread!} now={now} /> : <EmptyChat />}
        </div>
      )}
    </>
  );
}

/** What Ask Claude sees of an open chat: the last messages, with their English. */
function screenText(t: Thread, now: number): string {
  const last = arrived(t, now).slice(-10);
  return `A chat in the Latin messenger. Last messages:\n${last.map((m) => `${nameOf(m.from)}: ${m.la}${m.en ? ` (${m.en})` : ""}`).join("\n") || "(none yet)"}`;
}

function EmptyChat() {
  return (
    <section class="chat chat-empty msgr-panel">
      <Sprig cls="empty-sprig" />
      <p class="muted ui">Choose a chat, or find someone new.</p>
    </section>
  );
}

// ----------------------------------------------------------------- setup

function Setup() {
  const [name, setName] = useState("");
  const [g, setG] = useState<"m" | "f" | null>(null);
  const ok = name.trim().length > 0 && g;
  return (
    <section class="msgr-panel msgr-setup stack">
      <div class="row" style={{ gap: "10px" }}>
        <h1 class="msgr-title">Nūntiī</h1>
        <Sprig cls="title-sprig" />
      </div>
      <div class="setup-faces">
        {PEOPLE.map((x) => (
          <Avatar key={x.id} who={x} size={64} />
        ))}
      </div>
      <p>
        Five people in and around Rome will text you in Latin, now and then on their own, at their own hours, and in their own moods. They write
        only with the words and rules you have learned, so you understand everything; as you learn more, they can say more. Tap a message for its
        English, a word for its meaning.
      </p>
      <label class="stack" style={{ gap: "6px" }}>
        <span class="ui"><b>What should they call you?</b></span>
        <input id="me-name" class="input" value={name} maxLength={24} placeholder="Your name" {...NO_CORRECTION} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      </label>
      <div class="stack" style={{ gap: "6px" }}>
        <span class="ui"><b>Latin words about you end in…</b></span>
        <div class="seg">
          <button id="me-m" aria-pressed={g === "m"} onClick={() => setG("m")}>-us · <i lang="la">amīcus</i> (a man)</button>
          <button id="me-f" aria-pressed={g === "f"} onClick={() => setG("f")}>-a · <i lang="la">amīca</i> (a woman)</button>
        </div>
      </div>
      <button id="me-start" class="btn gold" disabled={!ok} onClick={() => ok && update((x) => void (x.settings.me = { name: name.trim(), g: g! }))}>
        Salvēte! Start
      </button>
    </section>
  );
}

// ------------------------------------------------------------------ list

function lastOf(t: Thread, now: number): Msg | undefined {
  return arrived(t, now).at(-1);
}

/** Does a chat match a search: a name, or any message, Latin or English (long marks never needed)? */
function matches(t: Thread, who: Who | null, q: string, now: number): boolean {
  if (!q) return true;
  const hay = [who?.name ?? GROUP.name, ...(who ? [] : PEOPLE.map((p) => p.name)), ...arrived(t, now).flatMap((m) => [m.la, m.en ?? ""])];
  return hay.some((s) => plain(s).includes(q));
}

function ChatList({ active, now }: { active: string | null; now: number }) {
  const meta = getMeta();
  const [finding, setFinding] = useState<{ ctl: AbortController } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const q = plain(query.trim());
  const rows = allThreads()
    .map((t) => ({ t, last: lastOf(t, now), who: t.kind === "group" ? null : whoOf(t.id, meta) }))
    .filter((r) => matches(r.t, r.who, q, now))
    .sort((a, b) => (b.last?.at ?? 0) - (a.last?.at ?? 0));
  const find = async () => {
    const ctl = new AbortController();
    setFinding({ ctl });
    setError(null);
    const res = await findSomeone(ctl.signal);
    setFinding(null);
    if ("id" in res) go({ page: "messenger", thread: res.id });
    else if (res.error && res.error !== "Stopped.") setError(res.error);
  };
  return (
    <aside class="chat-list msgr-panel" aria-label="Chats">
      <div class="chat-list-head">
        <div class="row" style={{ gap: "8px", flexWrap: "nowrap" }}>
          <h1 class="msgr-title">Nūntiī</h1>
          <Sprig cls="title-sprig" />
        </div>
        <button id="find-someone" class="btn gold find-btn" onClick={() => void find()} disabled={!!finding} title="Meet someone new from anywhere in the Roman world">
          <Icon.plus /> Someone new
        </button>
      </div>
      {/* the day in Rome, where the friends live: the Roman date and a festival */}
      <p class="msgr-date" lang="la" title={todayLine(now).en}>{todayLine(now).la}</p>
      <label class="list-search">
        <Icon.search />
        <input id="chat-search" type="search" value={query} placeholder="Quaere nūntiōs…" aria-label="Search chats and messages" {...NO_CORRECTION} autocapitalize="off" onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
      </label>
      {finding && <Finding onStop={() => finding.ctl.abort()} />}
      {error && <p class="small well list-note">{error}</p>}
      <div class="chat-rows" role="list">
        {rows.map(({ t, last, who }) => {
          const unread = unreadCount(t, now);
          const typing = typingIn(t, now);
          return (
            <button key={t.id} role="listitem" class={`chat-row${active === t.id ? " active" : ""}${unread ? " unread" : ""}`} onClick={() => go({ page: "messenger", thread: t.id })} id={`chat-${t.id}`}>
              {who ? <Avatar who={who} size={64} dot={dotOf(who, t, now)} /> : <GroupAvatar size={64} />}
              <span class="chat-row-main">
                <span class="chat-row-top">
                  <span class="chat-row-name" lang="la">{who?.name ?? GROUP.name}</span>
                  {last && <span class="chat-row-time">{when(last.at, now)}</span>}
                </span>
                <span class="chat-row-bottom">
                  <span class="chat-row-preview">
                    {typing ? (
                      <i class="typing-text">{t.kind === "group" ? `${nameOf(typing)} is typing…` : "typing…"}</i>
                    ) : last ? (
                      <>
                        {(t.kind === "group" || last.from === "me") && <span>{nameOf(last.from)}: </span>}
                        <span lang="la">{showEmoji(preview(last))}</span>
                      </>
                    ) : (
                      <span>{who ? `${who.job}, ${who.city}` : PEOPLE.map((x) => x.name).join(", ")}</span>
                    )}
                  </span>
                  {unread > 0 && <span class="unread-badge" aria-label={`${unread} unread`}>{roman(unread)}</span>}
                </span>
              </span>
              <span class="chat-row-go" aria-hidden="true"><Icon.chevron /></span>
            </button>
          );
        })}
        {!rows.length && <p class="muted small list-note">Nothing found for "{query.trim()}".</p>}
        <ListFoot />
      </div>
    </aside>
  );
}

/** Under the chats: a laurel, a motto, and Livy's bust (B. Beatrizet, 1582). */
function ListFoot() {
  return (
    <div class="list-foot" aria-hidden="true">
      <Sprig cls="foot-sprig" />
      <span class="list-motto" lang="la" title="Learning by speaking opens the world">
        DISCERE<br />LOQVENDO<br />MVNDVM APERIT.
      </span>
      <img class="list-bust" src={ENGRAVINGS.bust.src} alt="" />
    </div>
  );
}

/** While someone new is being found: faces shuffling, as on a market day. */
function Finding({ onStop }: { onStop: () => void }) {
  const faces = useMemo(() => [...PORTRAIT_BY_ID.values()].map((p) => p.src), []);
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => x + 1), 380);
    return () => clearInterval(t);
  }, []);
  return (
    <div class="finding well row" role="status">
      <span class="avatar" style={{ width: "44px", height: "44px" }}>
        <img src={faces[(i * 7) % faces.length]} alt="" />
      </span>
      <span class="ui small" style={{ flex: 1 }}>Looking for someone somewhere in the Roman world…</span>
      <button class="btn ghost small" onClick={onStop}>Stop</button>
    </div>
  );
}

// ------------------------------------------------------------------ chat

/** What a tapped word is: "librum — accusative singular of liber (book)"; a word not among the learner's words can be added. */
function wordNote(a: Analysis, text: string): { text: string; entry?: Entry; add?: string } {
  const e = a.entry;
  const name = e.tags.includes("name");
  const mine = !!knownWord(headword(e));
  if (!mine && !name && !("chat" in e.source)) return { ...wordNoteText(a, text, e, name), add: headword(e) };
  return { ...wordNoteText(a, text, e, name), entry: !("chat" in e.source) && !name ? e : undefined };
}

function wordNoteText(a: Analysis, text: string, e: Entry, name: boolean): { text: string } {
  if (e.kind === "noun" || e.kind === "adj") {
    const [c, n] = a.key.split(".");
    const caseName = c === "voc" ? "calling form" : `${CASE_NAMES[c as keyof typeof CASE_NAMES]} ${n === "pl" ? "plural" : "singular"}`;
    return { text: `${text} — ${caseName} of ${headword(e)}${name ? " (a name)" : ` (${e.en})`}` };
  }
  if (e.kind === "verb") {
    const head = headword(e);
    if (a.key === "inf") return { text: `${text} — infinitive of ${head} (to ${e.env.base})` };
    const pn = a.key.split(".")[1] as PN;
    return { text: `${text} — the "${PN_NAMES[pn] ?? pn}" form of ${head} (${e.env.base})` };
  }
  return { text: `${text} — ${name ? "a name" : e.en}` };
}

function ChatView({ id, now }: { id: string; now: number }) {
  const meta = getMeta();
  const t = getThread(id);
  const members = membersOf(id, meta);
  const group = t.kind === "group";
  const who = group ? null : members[0];
  const [profile, setProfile] = useState<Who | null>(null);
  const [openEn, setOpenEn] = useState<string[]>([]);
  const [allEn, setAllEn] = useState(false);
  const [card, setCard] = useState<{ msg: string; index: number } | null>(null);
  // voice messages whose words are shown, and the photo opened large
  const [voiceText, setVoiceText] = useState<string[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [wordOpen, setWordOpen] = useState<Entry | null>(null);
  const [words, setWords] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState<string | null>(null);
  const [hit, setHit] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const shown = arrived(t, now);
  const firstUnread = useRef<string | null | undefined>(undefined);
  if (firstUnread.current === undefined) firstUnread.current = shown.find((m) => m.from !== "me" && m.at > t.readAt)?.id ?? null;
  const lex = chatWords().lex;

  // seen: everything that has arrived while the chat is open
  const count = shown.length;
  useEffect(() => {
    markRead(id);
  }, [id, count]);
  useEffect(() => {
    touchLives(members.map((w) => w.id));
  }, [id]);

  const typing = typingIn(t, now);
  const comp = composing(id);
  const typingWho = typing ?? (comp && comp.at <= now ? comp.who : null);

  // stay at the newest message unless the learner scrolled up to read, also when
  // something below grows (a font that loads late, a word card, the typing dots)
  const flow = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = list.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [count, typingWho, id]);
  useEffect(() => {
    const el = list.current;
    if (!el || !flow.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (atBottom.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(flow.current);
    ro.observe(el); // the box itself: a note in the composer, a phone keyboard
    return () => ro.disconnect();
  }, []);
  // the menu closes on a tap anywhere else
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => !(e.target as HTMLElement).closest?.(".menu-wrap") && setMenu(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);
  // a word card that opens below the screen comes into view
  useEffect(() => {
    if (card) list.current?.querySelector(".word-card")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [card?.msg, card?.index]);
  const onScroll = () => {
    const el = list.current;
    if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // find in this chat: the messages that match, the current one in view
  const q = plain((search ?? "").trim());
  const hits = q ? shown.filter((m) => plain(m.la).includes(q) || plain(m.en ?? "").includes(q)).map((m) => m.id) : [];
  const current = hits.length ? hits[((hit % hits.length) + hits.length) % hits.length] : null;
  useEffect(() => {
    if (current) document.getElementById(`msg-${current}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [current]);

  const status = who ? statusAt(who.day, who.tz, now) : null;
  const sub = who ? presence(who, t, now, status!) : typingWho ? `${nameOf(typingWho)} is typing…` : members.map((w) => w.name).join(", ");
  const error = errorOf(id);

  /** A tap on a word shows what it is under the message; elsewhere on the message, its English. */
  const onBubble = (m: Msg, e: MouseEvent) => {
    const w = (e.target as HTMLElement).closest<HTMLElement>(".w");
    const bubble = (e.currentTarget as HTMLElement) ?? null;
    if (w && bubble) {
      const index = [...bubble.querySelectorAll(".bubble-text .w")].indexOf(w);
      if (index >= 0) {
        setCard(card?.msg === m.id && card.index === index ? null : { msg: m.id, index });
        return;
      }
    }
    setOpenEn(openEn.includes(m.id) ? openEn.filter((x) => x !== m.id) : [...openEn, m.id]);
  };

  /** The word card for a message, if one of its words was tapped (with the word itself, to hear it). */
  const cardOf = (m: Msg) => {
    if (card?.msg !== m.id) return null;
    const tok = annotate(showEmoji(m.la), lex).filter((x) => x.isWord)[card.index];
    const a = tok?.analysis ?? tok?.readings?.[0];
    if (!tok) return null;
    return { word: tok.text, ...(a ? wordNote(a, tok.text) : { text: `${tok.text} — a word you have not learned yet`, add: tok.text }) };
  };

  let lastDay = "";
  const lastMine = shown.filter((m) => m.from === "me").at(-1)?.id;
  return (
    <section class="chat msgr-panel" aria-label={`Chat with ${who?.name ?? GROUP.name}`}>
      <header class="chat-head">
        <button class="btn ghost small chat-back" onClick={() => go({ page: "messenger" })} aria-label="Back to the chats">←</button>
        <button class="chat-head-who" onClick={() => who && setProfile(who)} disabled={!who} id="chat-profile">
          {who ? <Avatar who={who} size={72} dot={dotOf(who, t, now)} /> : <GroupAvatar size={72} />}
          <span class="stack" style={{ gap: 0, minWidth: 0 }}>
            <span class="chat-head-name" lang="la">{who?.name ?? GROUP.name}</span>
            <span class={`chat-head-sub${typingWho ? " typing-text" : ""}`}>{who && typingWho ? "typing…" : sub}</span>
          </span>
        </button>
        {group && (
          <div class="group-faces">
            {members.map((w) => (
              <button key={w.id} class="linkish" onClick={() => setProfile(w)} title={w.name} aria-label={`${w.name}'s profile`}>
                <Avatar who={w} size={30} />
              </button>
            ))}
          </div>
        )}
        <div class="chat-tools">
          <button class="round-btn" aria-label="Find in this chat" aria-pressed={search !== null} onClick={() => { setSearch(search === null ? "" : null); setHit(0); }}>
            <Icon.search />
          </button>
          <button class="round-btn" aria-label="Your words" onClick={() => setWords(true)}>
            <Icon.book />
          </button>
          <div class="menu-wrap">
            <button class="round-btn" aria-label="More" aria-expanded={menu} onClick={() => setMenu(!menu)}>
              <Icon.more />
            </button>
            {menu && (
              <div class="menu-pop" role="menu" onClick={() => setMenu(false)}>
                {who && <button role="menuitem" onClick={() => setProfile(who)}>Profile</button>}
                <button role="menuitem" onClick={() => setAllEn(!allEn)}>{allEn ? "Hide the English" : "Show the English of all"}</button>
                {who?.stranger && <button role="menuitem" onClick={() => setProfile(who)}>Say goodbye…</button>}
              </div>
            )}
          </div>
        </div>
        <Sprig cls="head-sprig" flip />
      </header>

      {search !== null && (
        <div class="chat-find">
          <Icon.search />
          <input
            id="chat-find"
            type="search"
            value={search}
            placeholder="Find in this chat (Latin or English)…"
            autoFocus
            {...NO_CORRECTION}
            autocapitalize="off"
            onInput={(e) => { setSearch((e.target as HTMLInputElement).value); setHit(0); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") setHit(hit + (e.shiftKey ? -1 : 1));
              if (e.key === "Escape") setSearch(null);
            }}
          />
          <span class="small muted">{q ? (hits.length ? `${(((hit % hits.length) + hits.length) % hits.length) + 1} of ${hits.length}` : "none") : ""}</span>
          <button class="btn ghost small" disabled={hits.length < 2} onClick={() => setHit(hit - 1)} aria-label="Previous">↑</button>
          <button class="btn ghost small" disabled={hits.length < 2} onClick={() => setHit(hit + 1)} aria-label="Next">↓</button>
        </div>
      )}

      <div class="chat-msgs" ref={list} onScroll={onScroll} data-ask="Messages">
        <div class="chat-flow" ref={flow}>
          {who && shown.length === 0 && <Intro who={who} />}
          {shown.map((m, i) => {
            const day = dayLabel(m.at, now);
            const newDay = day.la !== lastDay;
            lastDay = day.la;
            const mine = m.from === "me";
            const sender = mine ? null : whoOf(m.from, meta);
            const prev = shown[i - 1];
            // a new run (face, tail, name) after someone else, a new day, the "New" line or a pause of ten minutes
          const firstOfRun = !prev || prev.from !== m.from || newDay || m.id === firstUnread.current || m.at - prev.at > 10 * 60_000;
            const note = cardOf(m);
            return (
              <Fragment key={m.id}>
                {newDay && (
                  <div class="chat-day" title={day.en}>
                    <Sprig cls="day-sprig" />
                    <span class="day-pill">
                      <span lang={/^(Hodiē|Heri)$/.test(day.la) ? "la" : "en"}>{day.la}</span>
                      <span class="day-roman" lang="la">{day.roman}</span>
                    </span>
                    <Sprig cls="day-sprig" flip />
                  </div>
                )}
                {m.id === firstUnread.current && <div class="chat-new"><span>New</span></div>}
                <div class={`bubble-row${mine ? " mine" : ""}${firstOfRun ? " first" : ""}`} id={`msg-${m.id}`}>
                  {!mine &&
                    (firstOfRun && sender ? (
                      <button class="linkish bubble-face" onClick={() => setProfile(sender)} aria-label={`${sender.name}'s profile`}>
                        <Avatar who={sender} size={56} />
                      </button>
                    ) : (
                      <span class="bubble-face" />
                    ))}
                  <div class={`bubble${mine ? " mine" : ""}${firstOfRun ? " tail" : ""}${onlyEmoji(m.la) ? " emoji-only" : ""}${current === m.id ? " hit" : hits.includes(m.id) ? " found" : ""}`} onClick={(e) => onBubble(m, e as unknown as MouseEvent)}>
                    {group && sender && firstOfRun && <span class="bubble-name" lang="la">{sender.name}</span>}
                    {m.photo && photoSrc(m.photo) && (
                      <button class="bubble-photo" onClick={(e) => { e.stopPropagation(); setPhoto(m.photo!); }} aria-label={`Photo: ${PHOTO_BY_ID.get(m.photo)?.en ?? ""}`}>
                        <img src={photoSrc(m.photo)} alt={PHOTO_BY_ID.get(m.photo)?.en ?? ""} loading="lazy" />
                      </button>
                    )}
                    {m.voice && (
                      <VoiceNote m={m} who={sender} open={voiceText.includes(m.id)} onText={() => setVoiceText(voiceText.includes(m.id) ? voiceText.filter((x) => x !== m.id) : [...voiceText, m.id])} />
                    )}
                    {m.la && (!m.voice || voiceText.includes(m.id) || !audioReady()) && (
                      <span class="bubble-text">
                        <LatinText text={showEmoji(m.la)} lex={lex} />
                      </span>
                    )}
                    {(allEn || openEn.includes(m.id)) && m.en && <span class="bubble-en">{showEmoji(m.en)}</span>}
                    {m.newWords && (allEn || openEn.includes(m.id)) && <span class="bubble-en small">New to you: {m.newWords.join(", ")}</span>}
                    <span class="bubble-meta">
                      {clock(m.at)}
                      {mine && t.kind !== "group" && <Ticks m={m} now={now} />}
                    </span>
                  </div>
                </div>
                {note && (
                  <div class={`word-card-row${mine ? " mine" : ""}`}>
                    <div class="word-card">
                      {/* hear the word, known or not */}
                      <Speak text={note.word} id={`word-${m.id}-${card!.index}`} label={`Hear «${note.word}»`} />
                      <button
                        class="word-card-main"
                        onClick={() => (note.entry ? setWordOpen(note.entry) : note.add && openAddWord(note.add, "messenger"))}
                        disabled={!note.entry && !note.add}
                        aria-label={note.entry ? `${note.text}: open the word` : note.add ? `${note.text}: add it to my words` : note.text}
                      >
                        <span class="word-card-text">{note.text}</span>
                        {note.entry && <span class="word-card-go"><Icon.chevron /></span>}
                        {note.add && <span class="word-card-add"><Icon.plus /> Add</span>}
                      </button>
                    </div>
                  </div>
                )}
                {mine && !onlyEmoji(m.la) && (m.check || m.id === lastMine || openEn.includes(m.id)) && <Checked m={m} id={id} />}
                {mine && m.id === lastMine && <NewWords m={m} />}
              </Fragment>
            );
          })}
          {typingWho && (
            <div class="bubble-row first">
              <span class="bubble-face"><Avatar who={whoOf(typingWho, meta)!} size={56} /></span>
              <div class="bubble typing tail" aria-label={`${nameOf(typingWho)} is typing`}>
                <i /><i /><i />
              </div>
            </div>
          )}
          {error && (
            <div class="chat-error well small">
              {error} <button class="linkish" onClick={() => void answer(id)}>Try again</button>
            </div>
          )}
        </div>
      </div>

      <Composer id={id} />
      {profile && <Profile who={profile} t={getThread(profile.id)} now={now} onClose={() => setProfile(null)} />}
      {words && <WordsSheet onClose={() => setWords(false)} onPick={(f) => insertIntoComposer(id, f)} />}
      {wordOpen && <WordModal e={wordOpen} onClose={() => setWordOpen(null)} />}
      {photo && <PhotoView id={photo} onClose={() => setPhoto(null)} />}
    </section>
  );
}

/** A made-up but steady waveform for a voice message (the same every time). */
function waveform(id: string, n: number): number[] {
  let h = [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return Array.from({ length: n }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    const edge = Math.min(1, (i + 1) / 4, (n - i) / 4);
    return Math.round(22 + edge * ((h >>> 16) % 78));
  });
}

/** How long a voice message lasts, about (seconds). */
const voiceSeconds = (la: string, rate: number) => Math.max(1, Math.round((la.split(/\s+/).length * 0.55 + 0.6) / rate));

/**
 * A voice message: ▶ plays it with the device's Latin voice in the sender's own
 * pitch and pace; Aa shows its words (tap them as in any message). Without a
 * Latin voice on the device, the words show at once.
 */
function VoiceNote({ m, who, open, onText }: { m: Msg; who: Who | null; open: boolean; onText: () => void }) {
  useVoices();
  const speaking = useSpeaking();
  const id = `voice-${m.id}`;
  const on = speaking === id;
  const ready = audioReady();
  const v = who ? voiceOf(who) : { g: "m" as const, pitch: 1, rate: 0.9 };
  const bars = useMemo(() => waveform(m.id, 26), [m.id]);
  const secs = voiceSeconds(m.la, v.rate);
  return (
    <span class={`voice-note${on ? " playing" : ""}`}>
      {ready ? (
        <button
          class="voice-play"
          aria-label={on ? "Stop" : "Play the voice message"}
          onClick={(e) => {
            e.stopPropagation();
            if (on) stopSpeaking();
            else void speak(m.la, { id, g: v.g, pitch: v.pitch, rate: v.rate });
          }}
        >
          {on ? <Icon.stop /> : <Icon.play />}
        </button>
      ) : (
        <span class="voice-play off" title="This device has no Spanish or Italian voice to play it: here are its words"><Icon.speaker /></span>
      )}
      <span class="voice-wave" aria-hidden="true">
        {bars.map((h, i) => <i key={i} style={{ height: `${h}%`, animationDelay: `${(i % 7) * 0.09}s` }} />)}
      </span>
      <span class="voice-time">0:{String(secs).padStart(2, "0")}</span>
      {ready && (
        <button class="voice-text" aria-pressed={open} title={open ? "Hide the words" : "Show the words"} onClick={(e) => { e.stopPropagation(); onText(); }}>
          Aa
        </button>
      )}
    </span>
  );
}

/** A photo, large, with what it shows and where the picture comes from. */
function PhotoView({ id, onClose }: { id: string; onClose: () => void }) {
  const p = PHOTO_BY_ID.get(id);
  return (
    <Modal wide onClose={onClose} label="Photo" screen={`A photo in the chat: ${p?.en ?? id}. ${p?.what ?? ""}`}>
      <div class="stack photo-view">
        <div class="spread">
          <span class="eyebrow">Photo</span>
          <button class="btn ghost small" onClick={onClose} aria-label="Close"><Icon.close /></button>
        </div>
        <img src={photoSrc(id)} alt={p?.en ?? ""} />
        {p && (
          <div class="stack" style={{ gap: "4px" }}>
            <p style={{ margin: 0 }}>{p.en}</p>
            <p class="small muted" style={{ margin: 0 }}>{p.what}</p>
            <p class="small muted" style={{ margin: 0 }}>{p.credit}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Read receipts: ✓ sent, ✓✓ read. */
function Ticks({ m, now }: { m: Msg; now: number }) {
  const read = m.readAt !== undefined && m.readAt <= now;
  return (
    <span class={`ticks${read ? " read" : ""}`} aria-label={read ? "read" : "sent"} title={read ? `read ${clock(m.readAt!)}` : "sent"}>
      {read ? "✓✓" : "✓"}
    </span>
  );
}

/** Someone's first page: who they are, before anyone has written. */
function Intro({ who }: { who: Who }) {
  return (
    <div class="chat-intro stack">
      <Avatar who={who} size={96} />
      <p class="ui">
        <b lang="la">{who.name}</b>, {who.age} · {who.job} · {who.city}
      </p>
      {who.stranger && <p class="small muted">{who.about}</p>}
      <p class="small muted">Say «Salvē!»</p>
    </div>
  );
}

/**
 * Under the learner's last message: the words in it the site does not know
 * yet, each one tap from their dictionary (Claude fills in the card). Once
 * added, the friends may use them back, and practice reviews them.
 */
function NewWords({ m }: { m: Msg }) {
  useProgress();
  const fresh = strangeWords(m.la, chatWords().lex).filter((w) => !knownWord(w)).slice(0, 4);
  if (!fresh.length) return null;
  return (
    <div class="new-words" role="note">
      <span class="small muted">New words:</span>
      {fresh.map((w) => (
        <button key={w} class="chip new-word" lang="la" onClick={() => openAddWord(w, "messenger")} title={`Add «${w}» to your words: then your friends can use it too`}>
          <Icon.plus /> {w}
        </button>
      ))}
    </div>
  );
}

/** The coach's check of a sent message, under it (asked for by tapping Check). */
function Checked({ m, id }: { m: Msg; id: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (m.check) return <CheckNote c={m.check} onAsk={() => askAbout(id, m.la, m.check!)} />;
  return (
    <div class="check-row">
      {err && <span class="small bad">{err} </span>}
      <button
        class="linkish small"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          const res = await check(id, m.la, m.id);
          setBusy(false);
          if (res && "error" in res) setErr(res.error);
        }}
      >
        {busy ? "Checking…" : "Check"}
      </button>
    </div>
  );
}

function CheckNote({ c, onUse, onAsk }: { c: Check; onUse?: (s: string) => void; onAsk?: () => void }) {
  const lex = chatWords().lex;
  return (
    <div class={`check-note ${c.verdict}`} role="note">
      <span class="check-verdict">{c.verdict === "good" ? "✓ Good Latin" : c.verdict === "almost" ? "Almost" : c.verdict === "say" ? "In Latin" : "Not quite"}</span>
      {c.better && (
        <span class="check-better">
          <LatinText text={showEmoji(c.better)} lex={lex} />
          {onUse && <button class="linkish small" onClick={() => onUse(showEmoji(c.better!))}>Use this</button>}
        </span>
      )}
      {c.note && <span class="check-text small"><Inline text={showEmoji(c.note)} /></span>}
      {onAsk && <button class="linkish small check-ask" onClick={onAsk}>Ask the coach about it</button>}
    </div>
  );
}

// ------------------------------------------------------------ the coach

// The coach's window above the message box: checks of the learner's Latin and
// questions about them, kept per chat (also over a reload) until it is closed.
const COACH_KEY = (id: string) => `tabula-latina-coach-${id}`;
const coachTurns = new Map<string, CoachTurn[]>();
const coachListeners = new Set<() => void>();

function coachOf(id: string): CoachTurn[] {
  if (!coachTurns.has(id)) {
    let turns: unknown = [];
    try {
      turns = JSON.parse(storage.get(COACH_KEY(id)) ?? "[]");
    } catch {
      /* nothing kept */
    }
    coachTurns.set(id, Array.isArray(turns) ? (turns as CoachTurn[]) : []);
  }
  return coachTurns.get(id)!;
}

function setCoach(id: string, turns: CoachTurn[]) {
  const kept = turns.slice(-30);
  coachTurns.set(id, kept);
  if (kept.length) storage.set(COACH_KEY(id), JSON.stringify(kept));
  else storage.remove(COACH_KEY(id));
  coachListeners.forEach((l) => l());
}

function useCoach(id: string): CoachTurn[] {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((x) => x + 1);
    coachListeners.add(l);
    return () => void coachListeners.delete(l);
  }, []);
  return coachOf(id);
}

/** Opens the coach's window on a check (one shown under a sent message), ready for a question. */
function askAbout(id: string, draft: string, res: Check) {
  const turns = coachOf(id);
  const last = turns.at(-1);
  if (!(last?.kind === "check" && last.draft === draft)) setCoach(id, [...turns, { kind: "check", draft, res, at: Date.now() }]);
  requestAnimationFrame(() => document.getElementById("coach-ask")?.focus());
}

/** The coach's window: the checks and the questions so far, and a box to ask the next one. */
function CoachPanel({ id, draft, checking, onUse }: { id: string; draft: string; checking: boolean; onUse: (s: string) => void }) {
  const turns = useCoach(id);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ q: string; error: string } | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => () => ctl.current?.abort(), []);
  // the newest entry in view (the window is small)
  useLayoutEffect(() => {
    const el = body.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length, busy !== null, checking, failed]);
  if (!turns.length && !checking) return null;

  const ask = async (question: string, shown = question) => {
    const text = question.trim();
    if (!text || busy !== null) return;
    setFailed(null);
    const before = coachOf(id);
    const asked: CoachTurn = { kind: "q", text: shown.trim(), at: Date.now() };
    setCoach(id, [...before, asked]);
    setQ("");
    setBusy("");
    ctl.current = new AbortController();
    const res = await askCoach(id, emojiCodes(text), before, emojiCodes(draft), (t) => setBusy(t), ctl.current.signal);
    ctl.current = null;
    setBusy(null);
    if ("error" in res) {
      if (res.error === "Stopped.") return;
      // the question goes back into the box; Try again asks it once more
      setFailed({ q: text, error: res.error });
      setCoach(id, coachOf(id).filter((t) => t !== asked));
      setQ(shown);
      return;
    }
    setCoach(id, [...coachOf(id), { kind: "a", text: res.text, at: Date.now() }]);
  };

  return (
    <section class="coach-panel" aria-label="The coach">
      <header class="coach-head">
        <span class="coach-title"><Icon.check /> Coach</span>
        <span class="small muted coach-hint">Your Latin checked; ask anything about it</span>
        <button class="btn ghost small coach-close" aria-label="Close the coach" onClick={() => { ctl.current?.abort(); setCoach(id, []); setFailed(null); }}>
          <Icon.close />
        </button>
      </header>
      <div class="coach-body" ref={body}>
        {turns.map((t, i) =>
          t.kind === "check" ? (
            <div key={i} class="coach-check">
              <span class="coach-draft small muted">You wrote <LatinText text={showEmoji(t.draft)} lex={chatWords().lex} /></span>
              <CheckNote c={t.res} onUse={onUse} />
            </div>
          ) : t.kind === "q" ? (
            <p key={i} class="coach-q">{t.text}</p>
          ) : (
            <div key={i} class="coach-a">
              <Markup text={showEmoji(t.text)} />
              <GrammarCheck text={t.text} canFix={i === turns.length - 1 && busy === null} onFix={(found) => void ask(fixRequest(found), "Please correct that.")} />
            </div>
          ),
        )}
        {checking && <p class="coach-a muted small">Checking…</p>}
        {busy !== null && <div class="coach-a">{busy ? <Markup text={showEmoji(busy)} /> : <span class="muted small">Thinking…</span>}</div>}
        {failed && (
          <p class="small bad">
            {failed.error} <button class="linkish" onClick={() => void ask(failed.q)}>Try again</button>
          </p>
        )}
      </div>
      <form
        class="coach-ask-row"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(q);
        }}
      >
        <input id="coach-ask" class="coach-ask" value={q} placeholder="Ask the coach… (why -m? what does it mean?)" {...NO_CORRECTION} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        {busy !== null ? (
          <button type="button" class="btn ghost small" onClick={() => ctl.current?.abort()}>Stop</button>
        ) : (
          <button type="submit" class="btn small" disabled={!q.trim()}>Ask</button>
        )}
      </form>
    </section>
  );
}

// -------------------------------------------------------------- composer

const DRAFT_KEY = (id: string) => `tabula-latina-draft-${id}`;

/** Something to add to a chat's box from elsewhere (the words sheet): the composer listens. */
const inserts = new Map<string, (s: string) => void>();
const insertIntoComposer = (id: string, s: string) => inserts.get(id)?.(s);

/** Real emoji with a Roman feel, after the hand-drawn ones. */
const ROMAN_REAL = [
  "🏛️", "🏟️", "⚔️", "🗡️", "🛡️", "🪖", "🏹", "🦅", "🐺", "🐎", "🐘", "🦁", "🌋", "🔱", "⚡", "🦉",
  "🕊️", "🦚", "🪔", "🏺", "⚱️", "🪙", "⚖️", "👑", "📜", "🪶", "🎭", "♨️", "⛲", "🛣️", "🌉", "⛵",
  "🫒", "🍇", "🍷", "🍯", "🦪", "🫓", "🌾", "🌿", "🐓", "🐍", "🌕", "☀️",
];
const EVERYDAY = [
  "😊", "😂", "🙂", "😉", "😍", "🥰", "😘", "😎", "🤔", "😴", "😩", "😢", "😭", "😡", "😱", "🤗",
  "👍", "👋", "🙏", "💪", "❤️", "💔", "🔥", "✨", "⭐", "🌙", "🌧️", "🍞", "🧀", "🐐", "🐂", "🐈",
  "✍️", "📚", "🌹", "🎶", "🏇", "🙈", "🥲", "😅", "🤨", "😤", "🥳", "💤", "🎉", "👀", "💯", "🤝",
];

type PickerTab = "roman" | "everyday" | "phrases";
const PICKER_TABS: PickerTab[] = ["roman", "everyday", "phrases"];

/**
 * The ＋: the Roman emoji (drawn for this site, then real ones), everyday faces
 * and things, and the phrasebook (greetings to this chat's person by name).
 */
function EmojiPicker({ id, onPick, onPhrase, onClose }: { id: string; onPick: (s: string) => void; onPhrase: (s: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState<PickerTab>(() => {
    const saved = storage.get("tabula-latina-emoji-tab") as PickerTab | null;
    return saved && PICKER_TABS.includes(saved) ? saved : "roman";
  });
  // a tap anywhere else closes it (the ＋ itself toggles it)
  useEffect(() => {
    const away = (e: PointerEvent) => !(e.target as HTMLElement).closest?.(".emoji-pop, .plus-btn") && onClose();
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, []);
  const choose = (t: PickerTab) => {
    setTab(t);
    storage.set("tabula-latina-emoji-tab", t);
  };
  return (
    <div class="emoji-pop" role="dialog" aria-label="Emoji and phrases">
      <div class="emoji-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "roman"} onClick={() => choose("roman")}>
          <span class="emoji-tab-icon">{ROMAN_EMOJI[0].char}</span> Roman
        </button>
        <button role="tab" aria-selected={tab === "everyday"} onClick={() => choose("everyday")}>
          <span class="emoji-tab-icon">😊</span> Everyday
        </button>
        <button id="phrases-tab" role="tab" aria-selected={tab === "phrases"} onClick={() => choose("phrases")}>
          <span class="emoji-tab-icon">💬</span> Phrases
        </button>
      </div>
      {tab === "phrases" ? (
        <Phrasebook id={id} onPick={onPhrase} />
      ) : (
        <div class="emoji-grid">
          {tab === "roman" && ROMAN_EMOJI.map((e) => (
            <button key={e.code} class="emoji-btn roman" onClick={() => onPick(e.char)} aria-label={`Add ${e.en}`} title={e.en}>{e.char}</button>
          ))}
          {(tab === "roman" ? ROMAN_REAL : EVERYDAY).map((e) => (
            <button key={e} class="emoji-btn" onClick={() => onPick(e)} aria-label={`Add ${e}`}>{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Ready phrases with their English: a tap puts one into the message. */
function Phrasebook({ id, onPick }: { id: string; onPick: (s: string) => void }) {
  const groups = phrasebook(membersOf(id, getMeta()), id === GROUP.id);
  return (
    <div class="phrase-list">
      {groups.map((g) => (
        <div key={g.title} class="phrase-group">
          <span class="eyebrow">{g.title}</span>
          <div class="phrase-grid">
            {g.phrases.map((ph) => (
              <button key={ph.la} class="phrase-btn" onClick={() => onPick(ph.la)} title={ph.note}>
                <span class="phrase-la" lang="la">{ph.la}</span>
                <span class="phrase-en">{ph.en}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Composer({ id }: { id: string }) {
  const [text, setText] = useState(() => storage.get(DRAFT_KEY(id)) ?? "");
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [emoji, setEmoji] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  // typing never closes the coach's window: the learner fixes the message with the correction in view
  const change = (v: string) => {
    setText(v);
    storage.set(DRAFT_KEY(id), v);
  };
  /** Puts something in at the cursor (an emoji; a phrase, spaced from the words around it), or after what is written (a word). */
  const put = (s: string, atCursor: boolean, spaced = false) => {
    const el = box.current;
    const cur = el?.value ?? text;
    if (atCursor && el) {
      const a = el.selectionStart ?? cur.length;
      const b = el.selectionEnd ?? cur.length;
      if (spaced) {
        if (a > 0 && !/\s$/.test(cur.slice(0, a))) s = ` ${s}`;
        if (b < cur.length && !/^\s/.test(cur.slice(b))) s = `${s} `;
      }
      change(cur.slice(0, a) + s + cur.slice(b));
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(a + s.length, a + s.length);
      });
    } else change(`${cur.trimEnd()}${cur.trim() ? " " : ""}${s}`);
  };
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || CSS.supports?.("field-sizing", "content")) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 3, 160)}px`;
  }, [text]);
  useEffect(() => {
    inserts.set(id, (s) => put(s, false));
    return () => void inserts.delete(id);
  });
  const doSend = () => {
    if (!text.trim()) return;
    send(id, emojiCodes(text));
    change("");
    setEmoji(false);
    box.current?.focus();
  };
  const doCheck = async () => {
    const draft = emojiCodes(text.trim());
    if (!draft) return;
    setChecking(true);
    setErr(null);
    const res = await check(id, draft);
    setChecking(false);
    if (res && "error" in res) setErr(res.error);
    else if (res) setCoach(id, [...coachOf(id), { kind: "check", draft, res, at: Date.now() }]);
  };
  return (
    <div class="composer">
      <CoachPanel id={id} draft={text} checking={checking} onUse={(s) => change(s)} />
      {err && <p class="small bad">{err}</p>}
      {!checking && notLatin(text) && <p class="composer-hint small ui">English? Tap ✓ and the coach writes it in Latin.</p>}
      <div class="composer-row">
        {emoji && <EmojiPicker id={id} onPick={(e) => put(e, true)} onPhrase={(ph) => put(ph, true, true)} onClose={() => setEmoji(false)} />}
        <button class="plus-btn" aria-label="Emoji and phrases" aria-expanded={emoji} onClick={() => setEmoji(!emoji)}>
          <Icon.plus />
        </button>
        <textarea
          ref={box}
          id="composer"
          class="composer-box"
          rows={1}
          lang="la"
          placeholder="Write in Latin…"
          {...NO_CORRECTION}
          value={text}
          onInput={(e) => change((e.target as HTMLTextAreaElement).value)}
          enterkeyhint={enterSends() ? "send" : "enter"}
          onKeyDown={(e) => {
            // a keyboard sends with Enter; on a phone Enter is a new line and the arrow sends
            if (e.key === "Enter" && !e.shiftKey && enterSends()) {
              e.preventDefault();
              doSend();
            }
            if (e.key === "Escape") setEmoji(false);
          }}
        />
        <button id="composer-check" class="check-btn" onClick={() => void doCheck()} disabled={!text.trim() || checking} title="Ask the coach whether it is right, or how to say it in Latin">
          {checking ? "…" : <><Icon.check /><span class="check-label"> Check</span></>}
        </button>
        <button id="composer-send" class="send-btn" onClick={doSend} disabled={!text.trim()} aria-label="Send">
          <Icon.send />
        </button>
      </div>
    </div>
  );
}

/** The words the learner can use, in the forms they know: tap one to add it to the message. */
function WordsSheet({ onPick, onClose }: { onPick: (w: string) => void; onClose: () => void }) {
  const seen = derived().seenKnowledge.skills;
  const all = allowedWords(chatWords().entries, seen);
  const chat = new Set(CHAT_WORD_LIST.map((w) => w.id));
  const groups: [string, typeof all][] = [
    ["Chat words", all.filter((w) => chat.has(w.id))],
    ["Your words", all.filter((w) => !w.chat && !w.name)],
    ["Names", all.filter((w) => w.name)],
  ];
  return (
    <Modal onClose={onClose} label="Your words" wide>
      <div class="stack">
        <div class="spread">
          <h2>Your words</h2>
          <button class="btn ghost small" onClick={onClose} aria-label="Close"><Icon.close /></button>
        </div>
        <p class="small muted">Only the forms of the rules you have learned. Tap a form to add it to your message.</p>
        {groups.map(([title, ws]) => (
          <div key={title} class="stack" style={{ gap: "6px" }}>
            <span class="eyebrow">{title}</span>
            <div class="words-sheet">
              {ws.map((w) => (
                <div key={w.id} class="words-sheet-row">
                  <span class="words-forms">
                    {w.forms.map((f) => (
                      <button key={f} class="chip word-chip" lang="la" onClick={() => onPick(f)}>{f}</button>
                    ))}
                  </span>
                  <span class="small muted">{w.en}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// --------------------------------------------------------------- profile

function Profile({ who, t, now, onClose }: { who: Who; t: Thread; now: number; onClose: () => void }) {
  const meta = getMeta();
  const life = meta.life[who.id];
  const local = localTime(now, who.tz);
  const status = statusAt(who.day, who.tz, now);
  const p = PORTRAIT_BY_ID.get(who.portrait);
  const [bye, setBye] = useState(false);
  return (
    <Modal onClose={onClose} label={`${who.name}'s profile`}>
      <div class="stack profile">
        <div class="spread">
          <span class="eyebrow">{who.stranger ? "Met by chance" : who.g === "f" ? "Amīca" : "Amīcus"}</span>
          <button class="btn ghost small" onClick={onClose} aria-label="Close"><Icon.close /></button>
        </div>
        <div class="profile-top">
          <Avatar who={who} size={132} dot={dotOf(who, t, now)} />
          <div class="stack" style={{ gap: "4px" }}>
            <h2 lang="la">{who.name}</h2>
            <span class="ui">{who.age} · {who.job}</span>
            <span class="ui muted">{who.city}</span>
            <span class="ui small">
              {local.hm} there · {status.state === "asleep" ? "asleep" : status.state === "busy" ? status.what : "free"}
            </span>
          </div>
        </div>
        <p>{who.about}</p>
        <div class="well stack" style={{ gap: "2px" }}>
          <span class="eyebrow">Today</span>
          <span class="ui">
            {life ? (
              <>
                In a{/^[aeiou]/.test(moodText(life)) ? "n" : ""} <b>{moodText(life)}</b> mood{life.event ? <> · {life.event}</> : " · nothing special going on"}
              </>
            ) : (
              "An ordinary day."
            )}
          </span>
        </div>
        {t.memory.length > 0 && (
          <details class="small">
            <summary>What {who.name} remembers about you</summary>
            <ul>{t.memory.map((m) => <li key={m}>{m}</li>)}</ul>
          </details>
        )}
        {p && (
          <p class="small muted">
            Portrait: {p.title}, {p.date}. <a href={p.url} target="_blank" rel="noreferrer">{p.museum}</a>, {p.license}.
          </p>
        )}
        {who.stranger &&
          (!bye ? (
            <button class="linkish" style={{ alignSelf: "flex-start" }} onClick={() => setBye(true)}>Say goodbye (remove this chat)…</button>
          ) : (
            <div class="well row">
              <span class="ui small">Remove the chat with {who.name}?</span>
              <button class="btn small" onClick={() => { forget(who.id); onClose(); go({ page: "messenger" }); }}>Valē!</button>
              <button class="btn ghost small" onClick={() => setBye(false)}>Keep</button>
            </div>
          ))}
        <p class="small muted">
          Engravings here: {[ENGRAVINGS.rome, ENGRAVINGS.capital, ENGRAVINGS.bust].map((x, i) => (
            <Fragment key={x.url}>
              {i > 0 && "; "}
              <a href={x.url} target="_blank" rel="noreferrer">{x.title}</a>
            </Fragment>
          ))}{" "}
          (The Met, CC0).
        </p>
      </div>
    </Modal>
  );
}

/** The newest message that just arrived somewhere else in the app, for a notice. */
export function useArrivals(onArrive: (t: Thread, m: Msg) => void, current: string | null) {
  const now = useMessenger();
  const last = useRef(Date.now());
  useEffect(() => {
    const from = last.current;
    last.current = now;
    for (const t of allThreads()) {
      if (t.id === current) continue;
      const m = t.messages.filter((x) => x.from !== "me" && x.at > from && x.at <= now && x.at > t.readAt).at(-1);
      if (m) onArrive(t, m);
    }
  }, [now]);
}

/** A small notice when a message arrives while the learner is elsewhere: tap it to open the chat. */
export function ArrivalNotice({ current }: { current: string | null }) {
  const [shown, setShown] = useState<{ t: Thread; m: Msg } | null>(null);
  useArrivals((t, m) => setShown({ t, m }), current);
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(null), 6000);
    return () => clearTimeout(timer);
  }, [shown]);
  // swipe it away like a phone notification; a tap opens the chat
  const swipe = useSwipeAway(
    () => setShown(null),
    () => {
      if (shown) go({ page: "messenger", thread: shown.t.id });
      setShown(null);
    },
  );
  if (!shown) return null;
  const who = whoOf(shown.m.from, getMeta());
  return (
    <button key={shown.m.id} class="arrival ansata" role="status" aria-label={`New message from ${who?.name ?? ""}: tap to open, swipe to dismiss`} {...swipe}>
      {who && <Avatar who={who} size={34} />}
      <span class="stack" style={{ gap: 0, minWidth: 0 }}>
        <b class="ui small" lang="la">{who?.name ?? nameOf(shown.m.from)}{shown.t.kind === "group" ? ` · ${GROUP.name}` : ""}</b>
        <span class="arrival-text" lang="la">{showEmoji(preview(shown.m))}</span>
      </span>
    </button>
  );
}
