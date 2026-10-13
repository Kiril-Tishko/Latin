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
import { emojiCodes, onlyEmoji, showEmoji, withoutEmoji } from "../../chat/emoji";
import { GROUP, PEOPLE, SIDE_PEOPLE } from "../../content/people";
import { phrasebook } from "../../content/phrases";
import { PORTRAIT_BY_ID } from "../../content/portraits";
import { localTime, moodText, statusAt } from "../../chat/life";
import { arrived, awayNow, Check, CoachTurn, deletedNow, groupMembers, groupName, iBlocked, isBlocked, isMuted, membersOf, Msg, preview, REACTIONS, reactionsOf, SYS, Thread, unreadCount, voiceOf, Who, whoOf } from "../../chat/model";
import { romanDate, romeDay, todayLine } from "../../chat/calendar";
import { PHOTO_BY_ID, PHOTO_CREDIT, photoSrc } from "../../content/photos";
import { speak, stopSpeaking, useSpeaking, useVoices } from "../../audio/speech";
import { allowedWords, CHAT_WORD_LIST, headword, notLatin, strangeWords } from "../../chat/words";
import { Analysis, annotate } from "../../latin/analyze";
import { plain, roman } from "../../latin/text";
import { CASE_NAMES, Entry, PN, PN_NAMES } from "../../latin/types";
import { enterSends, Icon, Modal, useSwipeAway } from "../components";
import { LatinText } from "../latin";
import { audioReady, Speak } from "../speak";
import { Inline, Markup } from "../markup";
import { fixRequest, GrammarCheck, openAsk } from "../ask";
import { ACTA_ID, ACTA_KINDS, ActaKind, linesOf, newestBoard } from "../../chat/acta";
import { go } from "../nav";
import { useScreen } from "../screen";
import {
  actaState,
  addToGroup,
  allThreads,
  answer,
  askCoach,
  canSendPhotos,
  chatExists,
  chatWords,
  check,
  clearChat,
  composing,
  connectMessenger,
  createGroup,
  deleteMine,
  ensureActa,
  errorOf,
  findSomeone,
  forget,
  getMeta,
  getThread,
  leaveGroup,
  markRead,
  opened,
  picOf,
  picSrc,
  presence,
  reactTo,
  removeFromGroup,
  renameGroup,
  send,
  sendPhoto,
  sendVoice,
  setBlocked,
  setMuted,
  storyPerson,
  touchLives,
  typingIn,
  useMessenger,
} from "../messenger";
import { derived, getProgress, update, useProgress } from "../store";
import { storage } from "../platform";
import { WordModal } from "./words";
import { knownWord, openAddWord } from "../addword";
import { NO_CORRECTION } from "../keyboard";
import { continueLearning } from "./train";

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

/** A group's picture: four of its faces. */
function GroupAvatar({ id = GROUP.id, size = 44 }: { id?: string; size?: number }) {
  const meta = getMeta();
  return (
    <span class="avatar group-avatar" data-n={Math.min(4, membersOf(id, meta).length)} style={{ "--av-size": `${size}px` }} aria-label={groupName(meta, id)}>
      {membersOf(id, meta).slice(0, 4).map((p) => (
        <img key={p.id} src={PORTRAIT_BY_ID.get(p.portrait)?.src} alt="" style={p.flip ? { transform: "scaleX(-1)" } : undefined} />
      ))}
    </span>
  );
}

/** The Ācta Diurna's face: SPQR on a round seal. */
function ActaAvatar({ size = 44 }: { size?: number }) {
  return (
    <span class="avatar acta-avatar" style={{ "--av-size": `${size}px` }} aria-label="Ācta Diurna">
      <span class="acta-seal" aria-hidden="true">{showEmoji(":spqr:")}</span>
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
  const acta = thread === ACTA_ID;
  const known = t && (acta || chatExists(thread!)) && !t.gone;
  useScreen(
    "page",
    acta ? "Messenger: the Ācta Diurna (Rome's daily board of news)" : known ? `Messenger: chat with ${t!.kind === "group" ? `the group ${groupName(getMeta(), thread!)}` : nameOf(thread!)}` : "Messenger",
    () => (acta ? boardText(t!, now) : known ? screenText(t!, now) : "The list of chats in the messenger."),
  );
  return (
    <>
      <Scene />
      {!me ? (
        <Setup />
      ) : (
        <div class={`msgr${known ? " in-chat" : ""}`}>
          <ChatList active={known ? thread! : null} now={now} />
          {acta ? <ActaView now={now} /> : known ? <ChatView key={thread} id={thread!} now={now} /> : <EmptyChat />}
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
      <p class="muted ui">Choose a chat, or start a new one.</p>
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

/** The messages that show: arrived, and not cleared away by the learner. */
const visible = (t: Thread, now: number) => arrived(t, now).filter((m) => !t.clearedAt || m.at > t.clearedAt);

function lastOf(t: Thread, now: number): Msg | undefined {
  return visible(t, now).at(-1);
}

/** Does a chat match a search: a name, or any message, Latin or English (long marks never needed)? */
function matches(t: Thread, who: Who | null, q: string, now: number): boolean {
  if (!q) return true;
  const hay = [who?.name ?? groupName(getMeta(), t.id), ...(who ? [] : membersOf(t.id, getMeta()).map((p) => p.name)), ...visible(t, now).flatMap((m) => [m.la, m.en ?? ""])];
  return hay.some((s) => plain(s).includes(q));
}

function ChatList({ active, now }: { active: string | null; now: number }) {
  const meta = getMeta();
  const [finding, setFinding] = useState<{ ctl: AbortController } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [newChat, setNewChat] = useState(false);
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
        <button id="new-chat" class="btn gold find-btn" onClick={() => setNewChat(true)} disabled={!!finding} title="Write to anyone: a friend, someone from the story, someone new, or a group of your own">
          <Icon.plus /> New chat
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
        {(!q || actaMatches(q, now)) && <ActaRow active={active === ACTA_ID} now={now} />}
        {rows.map(({ t, last, who }) => {
          const unread = unreadCount(t, now);
          const typing = typingIn(t, now);
          return (
            <button key={t.id} role="listitem" class={`chat-row${active === t.id ? " active" : ""}${unread ? " unread" : ""}`} onClick={() => go({ page: "messenger", thread: t.id })} id={`chat-${t.id}`}>
              {who ? <Avatar who={who} size={64} dot={dotOf(who, t, now)} /> : <GroupAvatar id={t.id} size={64} />}
              <span class="chat-row-main">
                <span class="chat-row-top">
                  <span class="chat-row-name" lang="la">{who?.name ?? groupName(meta, t.id)}</span>
                  {isMuted(meta, t.id) && <span class="muted-mark" title="Muted" aria-label="muted">🔕</span>}
                  {last && <span class="chat-row-time">{when(last.at, now)}</span>}
                </span>
                <span class="chat-row-bottom">
                  <span class="chat-row-preview">
                    {typing ? (
                      <i class="typing-text">{t.kind === "group" ? `${nameOf(typing)} is typing…` : "typing…"}</i>
                    ) : last ? (
                      <>
                        {(t.kind === "group" || last.from === "me") && <span>{nameOf(last.from)}: </span>}
                        <span lang="la">{showEmoji(preview(last, now))}</span>
                      </>
                    ) : (
                      <span>{who ? `${who.job}, ${who.city}` : membersOf(t.id, meta).map((x) => x.name).join(", ")}</span>
                    )}
                  </span>
                  {unread > 0 && <span class={`unread-badge${isMuted(meta, t.id) ? " quiet" : ""}`} aria-label={`${unread} unread`}>{roman(unread)}</span>}
                </span>
              </span>
              <span class="chat-row-go" aria-hidden="true"><Icon.chevron /></span>
            </button>
          );
        })}
        {!rows.length && <p class="muted small list-note">Nothing found for "{query.trim()}".</p>}
        <ListFoot />
      </div>
      {newChat && <NewChat onClose={() => setNewChat(false)} onSomeoneNew={() => { setNewChat(false); void find(); }} />}
    </aside>
  );
}

/** Does the board match a search: its name, or any title or line, Latin or English? */
const actaMatches = (q: string, now: number) =>
  plain("Ācta Diurna").includes(q) || arrived(getThread(ACTA_ID), now).some((m) => [m.la, m.en ?? "", m.title?.la ?? "", m.title?.en ?? ""].some((x) => plain(x).includes(q)));

/** The Ācta Diurna, pinned at the top of the chats: today's first title, or the scribe at work. */
function ActaRow({ active, now }: { active: boolean; now: number }) {
  const t = getThread(ACTA_ID);
  const board = newestBoard(t, now);
  const last = board.at(-1);
  const unread = unreadCount(t, now);
  const { writing } = actaState();
  return (
    <button role="listitem" id="chat-acta" class={`chat-row acta-row${active ? " active" : ""}${unread ? " unread" : ""}`} onClick={() => go({ page: "messenger", thread: ACTA_ID })}>
      <ActaAvatar size={64} />
      <span class="chat-row-main">
        <span class="chat-row-top">
          <span class="chat-row-name" lang="la">Ācta Diurna</span>
          {last && <span class="chat-row-time">{when(last.at, now)}</span>}
        </span>
        <span class="chat-row-bottom">
          <span class="chat-row-preview">
            {writing ? (
              <i class="typing-text">The scribe is writing today's board…</i>
            ) : board.length ? (
              <span lang="la">{showEmoji(board.map((m) => preview(m)).join(" · "))}</span>
            ) : (
              <span>Rome's daily news, in your words</span>
            )}
          </span>
          {unread > 0 && <span class="unread-badge" aria-label={`${unread} unread`}>{roman(unread)}</span>}
        </span>
      </span>
      <span class="chat-row-go" aria-hidden="true"><Icon.chevron /></span>
    </button>
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

/** The word tapped in a text (its index among the words), as a card says it. */
function tappedWord(text: string, index: number, lex: ReturnType<typeof chatWords>["lex"], gloss?: Record<string, string>): { word: string; text: string; entry?: Entry; add?: string } | null {
  const tok = annotate(showEmoji(text), lex).filter((x) => x.isWord)[index];
  if (!tok) return null;
  const a = tok.analysis ?? tok.readings?.[0];
  if (a) return { word: tok.text, ...wordNote(a, tok.text) };
  // a new word someone used in a strong moment, with the meaning they gave
  const meant = Object.entries(gloss ?? {}).find(([w]) => plain(w) === plain(tok.text))?.[1];
  return { word: tok.text, text: meant ? `${tok.text} — ${meant} (a new word)` : `${tok.text} — a word you have not learned yet`, add: tok.text };
}

/** What a tapped word is, under its message: hear it, open it, or add it to the learner's words. */
function WordCard({ note, id, mine, onOpen }: { note: { word: string; text: string; entry?: Entry; add?: string }; id: string; mine?: boolean; onOpen: (e: Entry) => void }) {
  return (
    <div class={`word-card-row${mine ? " mine" : ""}`}>
      <div class="word-card">
        {/* hear the word, known or not */}
        <Speak text={note.word} id={`word-${id}`} label={`Hear «${note.word}»`} />
        <button
          class="word-card-main"
          onClick={() => (note.entry ? onOpen(note.entry) : note.add && openAddWord(note.add, "messenger"))}
          disabled={!note.entry && !note.add}
          aria-label={note.entry ? `${note.text}: open the word` : note.add ? `${note.text}: add it to my words` : note.text}
        >
          <span class="word-card-text">{note.text}</span>
          {note.entry && <span class="word-card-go"><Icon.chevron /></span>}
          {note.add && <span class="word-card-add"><Icon.plus /> Add</span>}
        </button>
      </div>
    </div>
  );
}

function ChatView({ id, now }: { id: string; now: number }) {
  const meta = getMeta();
  const t = getThread(id);
  const members = membersOf(id, meta);
  const group = t.kind === "group";
  const who = group ? null : members[0];
  const [profile, setProfile] = useState<Who | null>(null);
  const [groupSheet, setGroupSheet] = useState(false);
  const [openEn, setOpenEn] = useState<string[]>([]);
  const [allEn, setAllEn] = useState(false);
  const [card, setCard] = useState<{ msg: string; index: number } | null>(null);
  // voice messages whose words are shown, and the photo opened large (a photo of theirs, or a picture by its id)
  const [voiceText, setVoiceText] = useState<string[]>([]);
  const [photo, setPhoto] = useState<{ photo?: string; pic?: string; en?: string } | null>(null);
  // a message of the learner's about to be deleted (the second tap deletes it), and the chat about to be cleared
  const [deleting, setDeleting] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [wordOpen, setWordOpen] = useState<Entry | null>(null);
  const [words, setWords] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState<string | null>(null);
  const [hit, setHit] = useState(0);
  // the message the learner is answering (quoted above their next message), and one flashing after a jump to it
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const shown = visible(t, now);
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

  /** A tap on a quote: the message it quotes comes into view and flashes. */
  const jumpTo = (msg: string) => {
    const el = document.getElementById(`msg-${msg}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlash(msg);
    setTimeout(() => setFlash((f) => (f === msg ? null : f)), 1600);
  };

  const status = who ? statusAt(who.day, who.tz, now) : null;
  const sub = who ? presence(who, t, now, status!) : typingWho ? `${nameOf(typingWho)} is typing…` : [...members.map((w) => w.name), "you"].join(", ");
  const muted = isMuted(meta, id);
  const blockedByMe = !!who && iBlocked(meta, who.id);
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
  const cardOf = (m: Msg) => (card?.msg === m.id ? tappedWord(m.la, card.index, lex, m.gloss) : null);

  let lastDay = "";
  const lastMine = shown.filter((m) => m.from === "me").at(-1)?.id;
  return (
    <section class="chat msgr-panel" aria-label={`Chat with ${who?.name ?? groupName(meta, id)}`}>
      <header class="chat-head">
        <button class="btn ghost small chat-back" onClick={() => go({ page: "messenger" })} aria-label="Back to the chats">←</button>
        <button class="chat-head-who" onClick={() => (who ? setProfile(who) : setGroupSheet(true))} id="chat-profile">
          {who ? <Avatar who={who} size={72} dot={dotOf(who, t, now)} /> : <GroupAvatar id={id} size={72} />}
          <span class="stack" style={{ gap: 0, minWidth: 0 }}>
            <span class="chat-head-name" lang="la">{who?.name ?? groupName(meta, id)}{muted && <span class="muted-mark" aria-label="muted"> 🔕</span>}</span>
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
                {who ? <button role="menuitem" onClick={() => setProfile(who)}>Profile</button> : <button role="menuitem" id="group-info" onClick={() => setGroupSheet(true)}>Group: name and people</button>}
                <button role="menuitem" onClick={() => setAllEn(!allEn)}>{allEn ? "Hide the English" : "Show the English of all"}</button>
                <button role="menuitem" id="mute-chat" onClick={() => setMuted(id, !muted)}>{muted ? "Unmute" : "Mute (no notices, no count)"}</button>
                <button role="menuitem" id="clear-chat" onClick={() => setClearing(true)}>Clear chat…</button>
                {who && (
                  <button role="menuitem" id="block-who" onClick={() => setBlocked(who.id, !blockedByMe)}>
                    {blockedByMe ? `Unblock ${who.name}` : `Block ${who.name}`}
                  </button>
                )}
                {who?.stranger && <button role="menuitem" onClick={() => setProfile(who)}>Say goodbye…</button>}
              </div>
            )}
          </div>
        </div>
        <Sprig cls="head-sprig" flip />
      </header>

      {clearing && (
        <div class="chat-confirm well row" role="alertdialog" aria-label="Clear this chat?">
          <span class="ui small" style={{ flex: 1 }}>Clear this chat? Its messages disappear on your side; {group ? "they" : who?.name} still remember{group ? "" : "s"} them.</span>
          <button class="btn small" id="clear-yes" onClick={() => { clearChat(id); setClearing(false); }}>Clear</button>
          <button class="btn ghost small" onClick={() => setClearing(false)}>Keep</button>
        </div>
      )}
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
                {m.from === SYS ? (
                  <div class="chat-sys" id={`msg-${m.id}`}><span>{m.en}</span></div>
                ) : deletedNow(m, now) ? (
                  <div class={`bubble-row${mine ? " mine" : ""}${firstOfRun ? " first" : ""}`} id={`msg-${m.id}`}>
                    {!mine && (firstOfRun && sender ? <span class="bubble-face"><Avatar who={sender} size={56} /></span> : <span class="bubble-face" />)}
                    <div class={`bubble deleted${mine ? " mine" : ""}${firstOfRun ? " tail" : ""}`}>
                      {group && sender && firstOfRun && <span class="bubble-name" lang="la">{sender.name}</span>}
                      <span class="bubble-text"><i>🚫 Message deleted</i></span>
                      <span class="bubble-meta">{clock(m.at)}</span>
                    </div>
                  </div>
                ) : (
                <div class={`bubble-row${mine ? " mine" : ""}${firstOfRun ? " first" : ""}${reactionsOf(m, now).length ? " reacted" : ""}`} id={`msg-${m.id}`}>
                  {!mine &&
                    (firstOfRun && sender ? (
                      <button class="linkish bubble-face" onClick={() => setProfile(sender)} aria-label={`${sender.name}'s profile`}>
                        <Avatar who={sender} size={56} />
                      </button>
                    ) : (
                      <span class="bubble-face" />
                    ))}
                  <div class={`bubble${mine ? " mine" : ""}${firstOfRun ? " tail" : ""}${onlyEmoji(m.la) && !m.re ? " emoji-only" : ""}${current === m.id || flash === m.id ? " hit" : hits.includes(m.id) ? " found" : ""}`} onClick={(e) => onBubble(m, e as unknown as MouseEvent)}>
                    {group && sender && firstOfRun && <span class="bubble-name" lang="la">{sender.name}</span>}
                    {m.re && <Quote msg={t.messages.find((x) => x.id === m.re)} onJump={() => jumpTo(m.re!)} />}
                    {m.photo && photoSrc(m.photo) && (
                      <button class="bubble-photo" onClick={(e) => { e.stopPropagation(); setPhoto({ photo: m.photo }); }} aria-label={`Photo: ${PHOTO_BY_ID.get(m.photo)?.en ?? ""}`}>
                        <img src={photoSrc(m.photo)} alt={PHOTO_BY_ID.get(m.photo)?.en ?? ""} loading="lazy" />
                      </button>
                    )}
                    {m.pic && <PicInBubble m={m} onOpen={() => setPhoto({ pic: m.pic, en: m.picEn })} />}
                    {m.voice && (
                      <VoiceNote m={m} who={mine ? learnerVoice() : sender} open={voiceText.includes(m.id)} onText={() => setVoiceText(voiceText.includes(m.id) ? voiceText.filter((x) => x !== m.id) : [...voiceText, m.id])} />
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
                    <Reactions m={m} id={id} now={now} />
                  </div>
                </div>
                )}
                {mine && openEn.includes(m.id) && (
                  <div class="react-row mine" role="group" aria-label="Your message">
                    <button
                      class="react-reply"
                      onClick={() => {
                        setReplyTo(m.id);
                        setOpenEn(openEn.filter((x) => x !== m.id));
                        document.getElementById("composer")?.focus();
                      }}
                    >
                      <Icon.reply /> Reply
                    </button>
                    <button
                      class={`react-reply delete-mine${deleting === m.id ? " sure" : ""}`}
                      onClick={() => {
                        if (deleting !== m.id) return setDeleting(m.id);
                        deleteMine(id, m.id);
                        setDeleting(null);
                        setOpenEn(openEn.filter((x) => x !== m.id));
                      }}
                    >
                      {deleting === m.id ? "Delete for everyone?" : "Delete"}
                    </button>
                  </div>
                )}
                {!mine && openEn.includes(m.id) && (
                  <div class="react-row" role="group" aria-label="React or reply">
                    {LEARNER_REACTIONS.map((e) => (
                      <button key={e} class={`react-btn${m.reactions?.me?.e === e ? " on" : ""}`} aria-pressed={m.reactions?.me?.e === e} aria-label={`React with ${e}`} onClick={() => reactTo(id, m.id, e)}>
                        {e}
                      </button>
                    ))}
                    <button
                      class="react-reply"
                      onClick={() => {
                        setReplyTo(m.id);
                        setOpenEn(openEn.filter((x) => x !== m.id));
                        document.getElementById("composer")?.focus();
                      }}
                    >
                      <Icon.reply /> Reply
                    </button>
                  </div>
                )}
                {note && <WordCard note={note} id={`${m.id}-${card!.index}`} mine={mine} onOpen={setWordOpen} />}
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

      {blockedByMe ? (
        <div class="composer blocked-bar ui">
          <span>You blocked {who!.name}. Nothing they send reaches you.</span>
          <button class="btn small" id="unblock" onClick={() => setBlocked(who!.id, false)}>Unblock</button>
        </div>
      ) : (
        <Composer id={id} replyTo={replyTo ? t.messages.find((m) => m.id === replyTo) ?? null : null} onReplied={() => setReplyTo(null)} />
      )}
      {profile && <Profile who={profile} t={getThread(profile.id)} now={now} onClose={() => setProfile(null)} />}
      {groupSheet && <GroupSheet id={id} onClose={() => setGroupSheet(false)} />}
      {words && <WordsSheet onClose={() => setWords(false)} onPick={(f) => insertIntoComposer(id, f)} />}
      {wordOpen && <WordModal e={wordOpen} onClose={() => setWordOpen(null)} />}
      {photo && <PhotoView {...photo} onClose={() => setPhoto(null)} />}
    </section>
  );
}

/** What Ask Claude sees of the board: the newest board's items, Latin with English. */
function boardText(t: Thread, now: number): string {
  const board = newestBoard(t, now);
  if (!board.length) return "The Ācta Diurna, Rome's daily board of news in the learner's words: no board yet.";
  return `The Ācta Diurna, Rome's daily board of news, written in the learner's words (${romanDate(romeDay(board[0].at))}):\n${board
    .map((m) => `[${ACTA_KINDS[m.tag as ActaKind]?.en ?? "News"}] ${m.title?.la ?? ""} (${m.title?.en ?? ""})\n${linesOf(m).map((l) => `  ${l.la} = ${l.en}`).join("\n")}`)
    .join("\n")}`;
}

/**
 * The Ācta Diurna: Rome's board of the day, an item to a post (its kind, its
 * title, its lines). A tap on a line shows its English, a tap on a word what it
 * is; the newest board opens at its first item.
 */
function ActaView({ now }: { now: number }) {
  const t = getThread(ACTA_ID);
  const posts = arrived(t, now);
  const lex = chatWords().lex;
  const { writing, error } = actaState();
  const [open, setOpen] = useState<string[]>([]);
  const [allEn, setAllEn] = useState(false);
  const [card, setCard] = useState<{ key: string; index: number } | null>(null);
  const [wordOpen, setWordOpen] = useState<Entry | null>(null);
  const count = posts.length;
  useEffect(() => {
    markRead(ACTA_ID);
  }, [count]);
  // the newest board, from its first item
  const firstOfNewest = newestBoard(t, now)[0]?.id;
  useLayoutEffect(() => {
    if (firstOfNewest) document.getElementById(`msg-${firstOfNewest}`)?.scrollIntoView({ block: "start" });
  }, [firstOfNewest]);
  useEffect(() => {
    if (card) document.querySelector(".acta .word-card")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [card?.key, card?.index]);

  /** A tap on a word: what it is, under its line; elsewhere on the line: its English. */
  const onLine = (key: string, e: MouseEvent) => {
    const w = (e.target as HTMLElement).closest<HTMLElement>(".w");
    if (w) {
      const index = [...(e.currentTarget as HTMLElement).querySelectorAll(".w")].indexOf(w);
      if (index >= 0) {
        setCard(card?.key === key && card.index === index ? null : { key, index });
        return;
      }
    }
    setOpen(open.includes(key) ? open.filter((x) => x !== key) : [...open, key]);
  };
  const shows = (key: string) => allEn || open.includes(key);
  const cardFor = (key: string, text: string) => (card?.key === key ? tappedWord(text, card.index, lex) : null);

  let lastDay = "";
  return (
    <section class="chat msgr-panel acta" aria-label="Ācta Diurna">
      <header class="chat-head">
        <button class="btn ghost small chat-back" onClick={() => go({ page: "messenger" })} aria-label="Back to the chats">←</button>
        <span class="chat-head-who">
          <ActaAvatar size={72} />
          <span class="stack" style={{ gap: 0, minWidth: 0 }}>
            <span class="chat-head-name" lang="la">Ācta Diurna</span>
            <span class="chat-head-sub">Rome's daily board, in your words</span>
          </span>
        </span>
        <div class="chat-tools">
          <button class="round-btn" id="acta-english" aria-label={allEn ? "Hide the English" : "Show the English of all"} aria-pressed={allEn} onClick={() => setAllEn(!allEn)}>
            <Icon.eye />
          </button>
        </div>
        <Sprig cls="head-sprig" flip />
      </header>
      <div class="chat-msgs acta-msgs" data-ask="The board">
        <div class="chat-flow">
          {!posts.length && !writing && !error && (
            <p class="acta-empty muted">
              Once a day the scribe writes up Rome's news on this board, only with your words: the day, the city, your friends, a notice from the walls.
            </p>
          )}
          {posts.map((m) => {
            const day = dayLabel(m.at, now);
            const newDay = day.la !== lastDay;
            lastDay = day.la;
            const kind = ACTA_KINDS[m.tag as ActaKind] ?? ACTA_KINDS.city;
            const titleKey = `${m.id}:t`;
            const titleCard = m.title?.la ? cardFor(titleKey, m.title.la) : null;
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
                <article class={`acta-post acta-${m.tag ?? "city"}`} id={`msg-${m.id}`}>
                  <span class="acta-top">
                    <span class="acta-kind" lang="la" title={kind.en}>{kind.la}</span>
                    {/* hear the item read out (the device's voice) */}
                    <Speak text={withoutEmoji([m.title?.la, ...linesOf(m).map((l) => l.la)].filter(Boolean).join(". ").replace(/([.!?])\./g, "$1"))} id={`acta-${m.id}`} label="Hear it read" />
                  </span>
                  {m.title?.la && (
                    <h3 class="acta-title" onClick={(e) => onLine(titleKey, e as unknown as MouseEvent)}>
                      <LatinText text={showEmoji(m.title.la)} lex={lex} />
                    </h3>
                  )}
                  {m.title?.en && shows(titleKey) && <p class="acta-en">{showEmoji(m.title.en)}</p>}
                  {titleCard && <WordCard note={titleCard} id={`${m.id}-t-${card!.index}`} onOpen={setWordOpen} />}
                  {linesOf(m).map((l, j) => {
                    const key = `${m.id}:${j}`;
                    const note = cardFor(key, l.la);
                    return (
                      <Fragment key={key}>
                        <p class="acta-line" onClick={(e) => onLine(key, e as unknown as MouseEvent)}>
                          <LatinText text={showEmoji(l.la)} lex={lex} />
                        </p>
                        {l.en && shows(key) && <p class="acta-en">{showEmoji(l.en)}</p>}
                        {note && <WordCard note={note} id={`${m.id}-${j}-${card!.index}`} onOpen={setWordOpen} />}
                      </Fragment>
                    );
                  })}
                  {m.newWords && allEn && <p class="acta-en small">New to you: {m.newWords.join(", ")}</p>}
                </article>
              </Fragment>
            );
          })}
          {writing && (
            <div class="acta-writing well small" role="status">
              <Icon.quill /> <span lang="la">Scrība scrībit…</span> The scribe is writing today's board.
            </div>
          )}
          {error && !writing && (
            <div class="chat-error well small">
              {error} <button class="linkish" onClick={() => void ensureActa(true)}>Try again</button>
            </div>
          )}
        </div>
      </div>
      <div class="acta-foot">
        <span class="small muted ui">Tap a line for its English, a word for what it is.</span>
        <span class="row" style={{ gap: "8px" }}>
          <button class="btn ghost small" onClick={() => openAsk(null, "Help me read today's board: is there a word or an ending I should look at twice?")}>
            <Icon.quill /> Ask Claude
          </button>
          <button class="btn small" id="acta-continue" onClick={continueLearning}>
            <Icon.play /> Continue
          </button>
        </span>
      </div>
      {wordOpen && <WordModal e={wordOpen} onClose={() => setWordOpen(null)} />}
    </section>
  );
}

/** The emoji the learner can react with (the people may also use 😡 and 🔥). */
const LEARNER_REACTIONS = REACTIONS.slice(0, 6);

/** The message a message answers, quoted above it: who wrote it and its start; a tap shows it. */
function Quote({ msg, onJump }: { msg: Msg | undefined; onJump: () => void }) {
  return (
    <button class="bubble-quote" onClick={(e) => { e.stopPropagation(); onJump(); }} disabled={!msg} aria-label={msg ? `Answering ${nameOf(msg.from)}: show that message` : "Answering an earlier message"}>
      <span class="quote-name">{msg ? nameOf(msg.from) : "An earlier message"}</span>
      {msg && <span class="quote-text" lang="la">{showEmoji(preview(msg))}</span>}
    </button>
  );
}

/** The reactions on a message, at its corner; a tap on the learner's own takes it back. */
function Reactions({ m, id, now }: { m: Msg; id: string; now: number }) {
  const list = reactionsOf(m, now);
  if (!list.length) return null;
  return (
    <span class="reacts">
      {list.map((r) => {
        const mineToo = r.who.includes("me");
        const names = r.who.map(nameOf).join(", ");
        return (
          <button
            key={r.e}
            class={`react${mineToo ? " mine" : ""}`}
            title={names}
            aria-label={`${r.e} from ${names}${mineToo ? ": tap to take yours back" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              if (mineToo) reactTo(id, m.id, r.e);
            }}
          >
            {r.e}
            {r.who.length > 1 && <span class="react-n">{r.who.length}</span>}
          </button>
        );
      })}
    </span>
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
  const v = who ? voiceOf(who) : myVoice();
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
function PhotoView({ photo, pic, en, onClose }: { photo?: string; pic?: string; en?: string; onClose: () => void }) {
  const p = photo ? PHOTO_BY_ID.get(photo) : undefined;
  const made = pic ? picOf(pic) : undefined;
  const src = photo ? photoSrc(photo) : picSrc(made);
  const what = p?.en ?? en ?? made?.en ?? "";
  const mine = made?.by === "me";
  return (
    <Modal wide onClose={onClose} label="Photo" screen={`A photo in the chat${what ? `: ${what}` : ""}.`}>
      <div class="stack photo-view">
        <div class="spread">
          <span class="eyebrow">Photo</span>
          <button class="btn ghost small" onClick={onClose} aria-label="Close"><Icon.close /></button>
        </div>
        {src && <img src={src} alt={what} />}
        <div class="stack" style={{ gap: "4px" }}>
          {what && <p style={{ margin: 0 }}>{mine ? `What they saw: ${what}` : what}</p>}
          {!mine && <p class="small muted" style={{ margin: 0 }}>{PHOTO_CREDIT}</p>}
        </div>
      </div>
    </Modal>
  );
}

/**
 * A picture in a message: a fresh one the people asked for (it shows as
 * "sending" until it is made), or a photo the learner sent.
 */
function PicInBubble({ m, onOpen }: { m: Msg; onOpen: () => void }) {
  const p = picOf(m.pic!);
  const src = picSrc(p);
  if (src)
    return (
      <button class="bubble-photo" onClick={(e) => { e.stopPropagation(); onOpen(); }} aria-label={`Photo${m.picEn ? `: ${m.picEn}` : ""}`}>
        <img src={src} alt={m.picEn ?? "a photo"} />
      </button>
    );
  // still being made, or it never came: what it shows, in words
  const failed = p?.status === "failed";
  return (
    <span class={`bubble-photo pic-wait${failed ? " failed" : ""}`} role="img" aria-label={failed ? "A photo that did not come through" : "A photo, still coming"}>
      <span class="pic-wait-icon" aria-hidden="true">📷</span>
      <span class="pic-wait-text small">{failed ? "The photo did not come through" : "Photo on its way…"}</span>
      {m.picEn && m.from !== "me" && <i class="pic-wait-en small">{m.picEn}</i>}
    </span>
  );
}

/** The learner's own voice in their voice messages: the device's voice, as a man or a woman. */
const learnerVoice = (): Who | null => null;
const myVoice = () => ({ g: getProgress().settings.me?.g ?? ("m" as const), pitch: 1, rate: 0.9 });

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
function EmojiPicker({ id, onPick, onPhrase, onClose, actions }: { id: string; onPick: (s: string) => void; onPhrase: (s: string) => void; onClose: () => void; actions?: preact.ComponentChildren }) {
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
    <div class="emoji-pop" role="dialog" aria-label="Photo, voice, emoji and phrases">
      {actions && <div class="emoji-actions">{actions}</div>}
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
  const groups = phrasebook(membersOf(id, getMeta()), getThread(id).kind === "group");
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

function Composer({ id, replyTo, onReplied }: { id: string; replyTo: Msg | null; onReplied: () => void }) {
  const [text, setText] = useState(() => storage.get(DRAFT_KEY(id)) ?? "");
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [emoji, setEmoji] = useState(false);
  // a photo picked to send (with the text as its caption), and the next message sent as a voice message
  const [photo, setPhoto] = useState<{ file: Blob; url: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [asVoice, setAsVoice] = useState(false);
  const [canPhoto, setCanPhoto] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => void canSendPhotos().then((c) => setCanPhoto(!!c)), []);
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
  const doSend = async () => {
    if (photo) {
      setSending(true);
      const res = await sendPhoto(id, photo.file, emojiCodes(text), replyTo?.id);
      setSending(false);
      if (res) return setErr(res.error);
      setPhoto(null);
    } else if (!text.trim()) return;
    else if (asVoice) sendVoice(id, emojiCodes(text), replyTo?.id);
    else send(id, emojiCodes(text), replyTo?.id);
    onReplied();
    change("");
    setEmoji(false);
    setAsVoice(false);
    box.current?.focus();
  };
  const pick = (f: File | undefined) => {
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => setPhoto({ file: f, url: String(fr.result) });
    fr.readAsDataURL(f);
    setEmoji(false);
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
      {replyTo && (
        <div class="reply-banner" role="status">
          <Icon.reply />
          <span class="reply-what">
            <span class="quote-name">Answering {nameOf(replyTo.from)}</span>
            <span class="quote-text" lang="la">{showEmoji(preview(replyTo))}</span>
          </span>
          <button class="btn ghost small" onClick={onReplied} aria-label="Do not answer that message">
            <Icon.close />
          </button>
        </div>
      )}
      {photo && (
        <div class="photo-draft" role="status">
          <img src={photo.url} alt="Your photo" />
          <span class="small ui">{sending ? "Sending…" : "Your photo. Write a caption if you like, then send."}</span>
          <button class="btn ghost small" onClick={() => setPhoto(null)} aria-label="Do not send the photo" disabled={sending}><Icon.close /></button>
        </div>
      )}
      {asVoice && !photo && (
        <div class="voice-draft small ui" role="status">
          <Icon.mic /> Your next message goes as a voice message, read aloud in Latin.
          <button class="linkish" onClick={() => setAsVoice(false)}>Cancel</button>
        </div>
      )}
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => { pick((e.target as HTMLInputElement).files?.[0]); (e.target as HTMLInputElement).value = ""; }} />
      <div class="composer-row">
        {emoji && (
          <EmojiPicker
            id={id}
            onPick={(e) => put(e, true)}
            onPhrase={(ph) => put(ph, true, true)}
            onClose={() => setEmoji(false)}
            actions={
              <>
                {canPhoto && (
                  <button id="attach-photo" class="emoji-action" onClick={() => fileInput.current?.click()}>
                    <Icon.camera /> Photo
                  </button>
                )}
                <button id="as-voice" class="emoji-action" aria-pressed={asVoice} onClick={() => { setAsVoice(!asVoice); setEmoji(false); box.current?.focus(); }}>
                  <Icon.mic /> Voice message
                </button>
              </>
            }
          />
        )}
        <button class="plus-btn" aria-label="Photo, voice message, emoji and phrases" aria-expanded={emoji} onClick={() => setEmoji(!emoji)}>
          <Icon.plus />
        </button>
        <textarea
          ref={box}
          id="composer"
          class="composer-box"
          rows={1}
          lang="la"
          placeholder={photo ? "A caption (or nothing)…" : asVoice ? "Say it in Latin…" : "Write in Latin…"}
          {...NO_CORRECTION}
          value={text}
          onInput={(e) => change((e.target as HTMLTextAreaElement).value)}
          enterkeyhint={enterSends() ? "send" : "enter"}
          onKeyDown={(e) => {
            // a keyboard sends with Enter; on a phone Enter is a new line and the arrow sends
            if (e.key === "Enter" && !e.shiftKey && enterSends()) {
              e.preventDefault();
              void doSend();
            }
            if (e.key === "Escape") setEmoji(false);
          }}
        />
        <button id="composer-check" class="check-btn" onClick={() => void doCheck()} disabled={!text.trim() || checking} title="Ask the coach whether it is right, or how to say it in Latin">
          {checking ? "…" : <><Icon.check /><span class="check-label"> Check</span></>}
        </button>
        <button id="composer-send" class={`send-btn${asVoice && !photo ? " voice" : ""}`} onClick={() => void doSend()} disabled={(!text.trim() && !photo) || sending} aria-label={asVoice && !photo ? "Send as a voice message" : "Send"}>
          {asVoice && !photo ? <Icon.mic /> : <Icon.send />}
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
  // what they set for themselves; someone who blocked the learner shows nothing of it
  const blocked = isBlocked(meta, who.id);
  const statusLine = blocked ? "" : meta.world?.status?.[who.id]?.text ?? "";
  const away = blocked ? undefined : awayNow(meta, who.id, now);
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
            {statusLine && <span class="profile-status" lang="la">«{showEmoji(statusLine)}»</span>}
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
          {away && (
            <span class="ui small">
              Away: {away.where}, until {new Date(away.until).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </span>
          )}
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
        <div class="row profile-actions">
          <button class="btn ghost small" id="profile-mute" onClick={() => setMuted(who.id, !isMuted(meta, who.id))}>{isMuted(meta, who.id) ? "Unmute" : "Mute"}</button>
          <button class="btn ghost small" id="profile-block" onClick={() => setBlocked(who.id, !iBlocked(meta, who.id))}>{iBlocked(meta, who.id) ? `Unblock ${who.name}` : `Block ${who.name}`}</button>
        </div>
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
      if (t.id === current || isMuted(getMeta(), t.id)) continue;
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
  const who = whoOf(shown.m.from === SYS ? shown.m.by ?? "" : shown.m.from, getMeta());
  return (
    <button key={shown.m.id} class="arrival ansata" role="status" aria-label={`New message from ${who?.name ?? ""}: tap to open, swipe to dismiss`} {...swipe}>
      {who && <Avatar who={who} size={34} />}
      <span class="stack" style={{ gap: 0, minWidth: 0 }}>
        <b class="ui small" lang="la">{who?.name ?? nameOf(shown.m.from)}{shown.t.kind === "group" ? ` · ${groupName(getMeta(), shown.t.id)}` : ""}</b>
        <span class="arrival-text" lang="la">{showEmoji(preview(shown.m, Date.now()))}</span>
      </span>
    </button>
  );
}

// ------------------------------------------------------- new chats, groups

/** Everyone the learner can write to: the five friends, and the people met or brought into the story. */
function everyone(): Who[] {
  const meta = getMeta();
  return [...PEOPLE.map((p) => p.id), ...Object.keys(meta.strangers).filter((id) => !getThread(id).gone)].map((id) => whoOf(id, meta)).filter((w): w is Who => !!w);
}

/** A person in a list: face, name, what they do. */
function PersonRow({ who, children, onClick, id }: { who: Who; children?: preact.ComponentChildren; onClick?: () => void; id?: string }) {
  const inner = (
    <>
      <Avatar who={who} size={44} />
      <span class="stack" style={{ gap: 0, minWidth: 0, flex: 1 }}>
        <b lang="la">{who.name}</b>
        <span class="small muted person-row-job">{who.job}, {who.city}</span>
      </span>
      {children}
    </>
  );
  return onClick ? (
    <button class="person-row" id={id} onClick={onClick}>{inner}</button>
  ) : (
    <div class="person-row" id={id}>{inner}</div>
  );
}

/**
 * New chat: write to anyone. A friend or someone met; someone from the story
 * (anyone the friends have mentioned, or any other name: Claude makes them
 * real); a group of the learner's own; or someone random from anywhere.
 */
function NewChat({ onClose, onSomeoneNew }: { onClose: () => void; onSomeoneNew: () => void }) {
  const [mode, setMode] = useState<"list" | "group">("list");
  const [story, setStory] = useState("");
  const [busy, setBusy] = useState<{ ctl: AbortController; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = (id: string) => {
    onClose();
    go({ page: "messenger", thread: id });
  };
  const seek = async (text: string) => {
    if (!text.trim() || busy) return;
    const ctl = new AbortController();
    setBusy({ ctl, text });
    setError(null);
    const res = await storyPerson(text.trim(), ctl.signal);
    setBusy(null);
    if ("id" in res) open(res.id);
    else if (res.error && res.error !== "Stopped.") setError(res.error);
  };
  if (mode === "group") return <NewGroup onBack={() => setMode("list")} onClose={onClose} onMade={open} />;
  return (
    <Modal onClose={() => { busy?.ctl.abort(); onClose(); }} label="New chat" wide>
      <div class="stack new-chat">
        <div class="spread">
          <h2>New chat</h2>
          <button class="btn ghost small" onClick={onClose} aria-label="Close"><Icon.close /></button>
        </div>
        <div class="new-chat-actions">
          <button id="new-group" class="btn" onClick={() => setMode("group")}><Icon.plus /> New group</button>
          <button id="find-someone" class="btn" onClick={onSomeoneNew} title="Meet someone new from anywhere in the Roman world">🎲 Someone new</button>
        </div>
        <div class="stack" style={{ gap: "6px" }}>
          <span class="eyebrow">Someone from the story</span>
          <p class="small muted" style={{ margin: 0 }}>Anyone the friends have mentioned, or anyone else in their lives: say who, and they become real.</p>
          <div class="chips">
            {SIDE_PEOPLE.map((x) => (
              <button key={x.text} class="chip" disabled={!!busy} onClick={() => void seek(x.text)}>{x.en}</button>
            ))}
          </div>
          <form class="row story-seek" onSubmit={(e) => { e.preventDefault(); void seek(story); }}>
            <input id="story-who" class="input" value={story} placeholder="e.g. Tertia, Iūlia's sister; Marcus's landlord…" {...NO_CORRECTION} onInput={(e) => setStory((e.target as HTMLInputElement).value)} />
            <button class="btn gold" disabled={!story.trim() || !!busy}>Write to them</button>
          </form>
          {busy && (
            <p class="small ui well row" role="status">
              <span style={{ flex: 1 }}>Finding {busy.text}…</span>
              <button class="btn ghost small" onClick={() => busy.ctl.abort()}>Stop</button>
            </p>
          )}
          {error && <p class="small bad">{error}</p>}
        </div>
        <div class="stack" style={{ gap: "4px" }}>
          <span class="eyebrow">People you know</span>
          {everyone().map((w) => (
            <PersonRow key={w.id} who={w} id={`new-${w.id}`} onClick={() => open(w.id)}>
              {iBlocked(getMeta(), w.id) && <span class="small muted">blocked</span>}
            </PersonRow>
          ))}
        </div>
      </div>
    </Modal>
  );
}

/** A group of the learner's own: a name and whom to bring together. */
function NewGroup({ onBack, onClose, onMade }: { onBack: () => void; onClose: () => void; onMade: (id: string) => void }) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  return (
    <Modal onClose={onClose} label="New group" wide>
      <div class="stack new-chat">
        <div class="spread">
          <button class="btn ghost small" onClick={onBack} aria-label="Back">←</button>
          <h2 style={{ flex: 1 }}>New group</h2>
          <button class="btn ghost small" onClick={onClose} aria-label="Close"><Icon.close /></button>
        </div>
        <label class="stack" style={{ gap: "4px" }}>
          <span class="ui small"><b>Its name</b> (Latin, English, anything)</span>
          <input id="group-name" class="input" value={name} maxLength={40} placeholder="e.g. Cēna, Nova turba, Secret plan" {...NO_CORRECTION} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        </label>
        <span class="eyebrow">Who is in it</span>
        <div class="stack" style={{ gap: "4px" }}>
          {everyone().map((w) => (
            <PersonRow key={w.id} who={w} id={`pick-${w.id}`} onClick={() => toggle(w.id)}>
              <span class={`pick-mark${picked.includes(w.id) ? " on" : ""}`} aria-label={picked.includes(w.id) ? "in the group" : "not in the group"}>{picked.includes(w.id) ? "✓" : ""}</span>
            </PersonRow>
          ))}
        </div>
        <button id="group-create" class="btn gold" disabled={!picked.length} onClick={() => onMade(createGroup(name, picked))}>
          Create the group{picked.length ? ` (${picked.length + 1} with you)` : ""}
        </button>
      </div>
    </Modal>
  );
}

/** A group's name and people: rename it, add or remove people, mute it, leave it. */
function GroupSheet({ id, onClose }: { id: string; onClose: () => void }) {
  useMessenger();
  const meta = getMeta();
  const [name, setName] = useState(groupName(meta, id));
  const [removing, setRemoving] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const members = membersOf(id, meta);
  const others = everyone().filter((w) => !groupMembers(meta, id).includes(w.id));
  const info = meta.world?.groups?.[id];
  const muted = isMuted(meta, id);
  return (
    <Modal onClose={onClose} label={`The group ${groupName(meta, id)}`} wide>
      <div class="stack group-sheet">
        <div class="spread">
          <span class="eyebrow">Group{info ? (info.by === "me" ? " · made by you" : ` · started by ${nameOf(info.by)}`) : ""}</span>
          <button class="btn ghost small" onClick={onClose} aria-label="Close"><Icon.close /></button>
        </div>
        <GroupAvatar id={id} size={96} />
        <form class="row" onSubmit={(e) => { e.preventDefault(); if (name.trim() && name.trim() !== groupName(meta, id)) renameGroup(id, name); }}>
          <input id="group-rename" class="input" value={name} maxLength={40} {...NO_CORRECTION} aria-label="The group's name" onInput={(e) => setName((e.target as HTMLInputElement).value)} />
          <button class="btn small" disabled={!name.trim() || name.trim() === groupName(meta, id)}>Rename</button>
        </form>
        <span class="eyebrow">{members.length + 1} people</span>
        <div class="stack" style={{ gap: "4px" }}>
          {members.map((w) => (
            <PersonRow key={w.id} who={w}>
              {removing === w.id ? (
                <button class="btn small" id={`remove-${w.id}`} onClick={() => { removeFromGroup(id, w.id); setRemoving(null); }}>Remove {w.name}?</button>
              ) : (
                <button class="btn ghost small" onClick={() => setRemoving(w.id)}>Remove</button>
              )}
            </PersonRow>
          ))}
          <div class="person-row"><span class="ui small">…and you</span></div>
        </div>
        {others.length > 0 &&
          (adding ? (
            <div class="stack" style={{ gap: "4px" }}>
              <span class="eyebrow">Add someone</span>
              {others.map((w) => (
                <PersonRow key={w.id} who={w} id={`add-${w.id}`} onClick={() => addToGroup(id, [w.id])}>
                  <span class="small"><Icon.plus /> Add</span>
                </PersonRow>
              ))}
            </div>
          ) : (
            <button class="btn ghost" id="group-add" onClick={() => setAdding(true)}><Icon.plus /> Add people</button>
          ))}
        <button class="btn ghost" onClick={() => setMuted(id, !muted)}>{muted ? "Unmute" : "Mute (no notices, no count)"}</button>
        {id !== GROUP.id &&
          (leaving ? (
            <div class="well row">
              <span class="ui small" style={{ flex: 1 }}>Leave «{groupName(meta, id)}»? It leaves your chats.</span>
              <button class="btn small" id="group-leave-yes" onClick={() => { leaveGroup(id); onClose(); go({ page: "messenger" }); }}>Leave</button>
              <button class="btn ghost small" onClick={() => setLeaving(false)}>Stay</button>
            </div>
          ) : (
            <button class="linkish" style={{ alignSelf: "flex-start" }} id="group-leave" onClick={() => setLeaving(true)}>Leave the group…</button>
          ))}
      </div>
    </Modal>
  );
}
