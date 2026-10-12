// Nūntiī: the messenger. Five friends in and around Rome, their group chat, and
// strangers met at random write to the learner in Latin, only with the words
// and rules the learner knows. Tap a message for its English, a word for its
// meaning; Check asks the coach about the learner's own Latin.
import { Fragment } from "preact";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { GROUP, PEOPLE } from "../../content/people";
import { PORTRAIT_BY_ID } from "../../content/portraits";
import { localTime, moodText, statusAt } from "../../chat/life";
import { arrived, membersOf, Msg, Thread, unreadCount, Who, whoOf } from "../../chat/model";
import { allowedWords, CHAT_WORD_LIST } from "../../chat/words";
import { roman } from "../../latin/text";
import { Icon, Modal } from "../components";
import { LatinText } from "../latin";
import { go } from "../nav";
import { useScreen } from "../screen";
import {
  allThreads,
  answer,
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

// ---------------------------------------------------------------- pieces

/** A round portrait (mirrored for a stranger who shares one). */
export function Avatar({ who, size = 44 }: { who: Pick<Who, "portrait" | "name"> & { flip?: boolean }; size?: number }) {
  const p = PORTRAIT_BY_ID.get(who.portrait);
  return (
    <span class="avatar" style={{ width: `${size}px`, height: `${size}px` }}>
      {p ? <img src={p.src} alt={who.name} style={who.flip ? { transform: "scaleX(-1)" } : undefined} /> : <span class="avatar-letter">{who.name[0]}</span>}
    </span>
  );
}

/** The group's picture: four of its faces. */
function GroupAvatar({ size = 44 }: { size?: number }) {
  return (
    <span class="avatar group-avatar" style={{ width: `${size}px`, height: `${size}px` }} aria-label={GROUP.name}>
      {PEOPLE.slice(0, 4).map((p) => (
        <img key={p.id} src={PORTRAIT_BY_ID.get(p.portrait)?.src} alt="" />
      ))}
    </span>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** "21:40", "Yesterday", "Monday", "12 Oct" for the chat list. */
function when(t: number, now: number): string {
  const d = new Date(t);
  const today = new Date(now);
  const days = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (days === 0) return clock(t);
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-GB", { weekday: "long" });
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function dayLabel(t: number, now: number): string {
  const w = when(t, now);
  return /:/.test(w) ? "Today" : w;
}

const nameOf = (id: string) => (id === "me" ? "You" : whoOf(id, getMeta())?.name ?? id);

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
  if (!me) return <Setup />;
  return (
    <div class={`msgr${known ? " in-chat" : ""}`}>
      <ChatList active={known ? thread! : null} now={now} />
      {known ? <ChatView key={thread} id={thread!} now={now} /> : <EmptyChat />}
    </div>
  );
}

/** What Ask Claude sees of an open chat: the last messages, with their English. */
function screenText(t: Thread, now: number): string {
  const last = arrived(t, now).slice(-10);
  return `A chat in the Latin messenger. Last messages:\n${last.map((m) => `${nameOf(m.from)}: ${m.la}${m.en ? ` (${m.en})` : ""}`).join("\n") || "(none yet)"}`;
}

function EmptyChat() {
  return (
    <section class="chat chat-empty panel">
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
    <section class="panel frame msgr-setup stack">
      <span class="eyebrow">Nūntiī · Messages</span>
      <h1>Your friends in Rome</h1>
      <div class="setup-faces">
        {PEOPLE.map((x) => (
          <Avatar key={x.id} who={x} size={56} />
        ))}
      </div>
      <p>
        Five people in and around Rome will text you in Latin, now and then on their own, at their own hours, and in their own moods. They write
        only with the words and rules you have learned, so you understand everything; as you learn more, they can say more. Tap a message for its
        English, a word for its meaning.
      </p>
      <label class="stack" style={{ gap: "6px" }}>
        <span class="ui"><b>What should they call you?</b></span>
        <input id="me-name" class="input" value={name} maxLength={24} placeholder="Your name" onInput={(e) => setName((e.target as HTMLInputElement).value)} />
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

function ChatList({ active, now }: { active: string | null; now: number }) {
  const meta = getMeta();
  const [finding, setFinding] = useState<{ ctl: AbortController } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rows = allThreads()
    .map((t) => ({ t, last: lastOf(t, now) }))
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
    <aside class="chat-list panel" aria-label="Chats">
      <div class="chat-list-head">
        <h1 class="msgr-title">Nūntiī</h1>
        <button id="find-someone" class="btn gold small" onClick={() => void find()} disabled={!!finding} title="Meet someone new from anywhere in the Roman world">
          <Icon.sparkle /> Someone new
        </button>
      </div>
      {finding && <Finding onStop={() => finding.ctl.abort()} />}
      {error && <p class="small well">{error}</p>}
      <div class="chat-rows" role="list">
        {rows.map(({ t, last }) => {
          const who = t.kind === "group" ? null : whoOf(t.id, meta);
          const unread = unreadCount(t, now);
          const typing = typingIn(t, now);
          return (
            <button key={t.id} role="listitem" class={`chat-row${active === t.id ? " active" : ""}${unread ? " unread" : ""}`} onClick={() => go({ page: "messenger", thread: t.id })} id={`chat-${t.id}`}>
              {who ? <Avatar who={who} /> : <GroupAvatar />}
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
                        {(t.kind === "group" || last.from === "me") && <span class="muted">{nameOf(last.from)}: </span>}
                        <span lang="la">{last.la}</span>
                      </>
                    ) : (
                      <span class="muted">{who ? `${who.job}, ${who.city}` : PEOPLE.map((x) => x.name).join(", ")}</span>
                    )}
                  </span>
                  {unread > 0 && <span class="unread-badge" aria-label={`${unread} unread`}>{roman(unread)}</span>}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
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
      <span class="avatar" style={{ width: "40px", height: "40px" }}>
        <img src={faces[(i * 7) % faces.length]} alt="" />
      </span>
      <span class="ui small" style={{ flex: 1 }}>Looking for someone somewhere in the Roman world…</span>
      <button class="btn ghost small" onClick={onStop}>Stop</button>
    </div>
  );
}

// ------------------------------------------------------------------ chat

function ChatView({ id, now }: { id: string; now: number }) {
  const meta = getMeta();
  const t = getThread(id);
  const members = membersOf(id, meta);
  const group = t.kind === "group";
  const who = group ? null : members[0];
  const [profile, setProfile] = useState<Who | null>(null);
  const [openEn, setOpenEn] = useState<string[]>([]);
  const [gloss, setGloss] = useState<{ msg: string; word: string; text: string } | null>(null);
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

  // stay at the newest message unless the learner scrolled up to read
  useLayoutEffect(() => {
    const el = list.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [count, typingWho, id]);
  const onScroll = () => {
    const el = list.current;
    if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const status = who ? statusAt(who.day, who.tz, now) : null;
  const sub = who ? presence(who, t, now, status!) : typingWho ? `${nameOf(typingWho)} is typing…` : members.map((w) => w.name).join(", ");
  const error = errorOf(id);

  const onBubble = (m: Msg, e: MouseEvent) => {
    const w = (e.target as HTMLElement).closest<HTMLElement>(".w");
    if (w?.title) {
      setGloss(gloss?.msg === m.id && gloss.word === w.textContent ? null : { msg: m.id, word: w.textContent ?? "", text: w.title });
      return;
    }
    setOpenEn(openEn.includes(m.id) ? openEn.filter((x) => x !== m.id) : [...openEn, m.id]);
  };

  let lastDay = "";
  const lastMine = shown.filter((m) => m.from === "me").at(-1)?.id;
  return (
    <section class="chat panel" aria-label={`Chat with ${who?.name ?? GROUP.name}`}>
      <header class="chat-head">
        <button class="btn ghost small chat-back" onClick={() => go({ page: "messenger" })} aria-label="Back to the chats">←</button>
        <button class="chat-head-who" onClick={() => who && setProfile(who)} disabled={!who} id="chat-profile">
          {who ? <Avatar who={who} size={40} /> : <GroupAvatar size={40} />}
          <span class="stack" style={{ gap: 0, minWidth: 0 }}>
            <span class="chat-head-name" lang="la">{who?.name ?? GROUP.name}</span>
            <span class={`chat-head-sub${typingWho ? " typing-text" : ""}`}>{who && typingWho ? "typing…" : sub}</span>
          </span>
        </button>
        {group && (
          <div class="group-faces">
            {members.map((w) => (
              <button key={w.id} class="linkish" onClick={() => setProfile(w)} title={w.name} aria-label={`${w.name}'s profile`}>
                <Avatar who={w} size={28} />
              </button>
            ))}
          </div>
        )}
      </header>

      <div class="chat-msgs" ref={list} onScroll={onScroll} data-ask="Messages">
        {who && shown.length === 0 && <Intro who={who} />}
        {shown.map((m, i) => {
          const day = dayLabel(m.at, now);
          const newDay = day !== lastDay;
          lastDay = day;
          const mine = m.from === "me";
          const sender = !mine && group ? whoOf(m.from, meta) : null;
          const prev = shown[i - 1];
          const firstOfRun = !prev || prev.from !== m.from || newDay;
          return (
            <Fragment key={m.id}>
              {newDay && <div class="chat-day"><span>{day}</span></div>}
              {m.id === firstUnread.current && <div class="chat-new"><span>New</span></div>}
              <div class={`bubble-row${mine ? " mine" : ""}${firstOfRun ? " first" : ""}`}>
                {sender && (firstOfRun ? <button class="linkish bubble-face" onClick={() => setProfile(sender)}><Avatar who={sender} size={30} /></button> : <span class="bubble-face" />)}
                <div class={`bubble${mine ? " mine" : ""}`} onClick={(e) => onBubble(m, e as unknown as MouseEvent)}>
                  {sender && firstOfRun && <span class="bubble-name" lang="la">{sender.name}</span>}
                  <span class="bubble-text">
                    <LatinText text={m.la} lex={lex} />
                  </span>
                  {gloss?.msg === m.id && (
                    <span class="bubble-gloss small ui" role="note">
                      <strong lang="la">{gloss.word}</strong> = {gloss.text}
                    </span>
                  )}
                  {openEn.includes(m.id) && m.en && <span class="bubble-en">{m.en}</span>}
                  {m.newWords && openEn.includes(m.id) && <span class="bubble-en small">New to you: {m.newWords.join(", ")}</span>}
                  <span class="bubble-meta">
                    {clock(m.at)}
                    {mine && t.kind !== "group" && <Ticks m={m} now={now} />}
                  </span>
                </div>
              </div>
              {mine && (m.check || m.id === lastMine || openEn.includes(m.id)) && <Checked m={m} id={id} />}
            </Fragment>
          );
        })}
        {typingWho && (
          <div class="bubble-row">
            {group && <span class="bubble-face"><Avatar who={whoOf(typingWho, meta)!} size={30} /></span>}
            <div class="bubble typing" aria-label={`${nameOf(typingWho)} is typing`}>
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

      <Composer id={id} />
      {profile && <Profile who={profile} t={getThread(profile.id)} now={now} onClose={() => setProfile(null)} />}
    </section>
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

/** A stranger's first page: who they are, before anyone has written. */
function Intro({ who }: { who: Who }) {
  return (
    <div class="chat-intro stack">
      <Avatar who={who} size={88} />
      <p class="ui">
        <b lang="la">{who.name}</b>, {who.age} · {who.job} · {who.city}
      </p>
      {who.stranger && <p class="small muted">{who.about}</p>}
      <p class="small muted">Say «Salvē!»</p>
    </div>
  );
}

/** The coach's check of a sent message, under it (asked for by tapping Check). */
function Checked({ m, id }: { m: Msg; id: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (m.check) return <CheckNote c={m.check} />;
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

function CheckNote({ c, onUse }: { c: NonNullable<Msg["check"]>; onUse?: (s: string) => void }) {
  const lex = chatWords().lex;
  return (
    <div class={`check-note ${c.verdict}`} role="note">
      <span class="check-verdict">{c.verdict === "good" ? "✓ Good Latin" : c.verdict === "almost" ? "Almost" : "Not quite"}</span>
      {c.better && (
        <span class="check-better">
          <LatinText text={c.better} lex={lex} />
          {onUse && <button class="linkish small" onClick={() => onUse(c.better!)}>Use this</button>}
        </span>
      )}
      {c.note && <span class="check-text small">{c.note.replace(/«|»/g, "")}</span>}
    </div>
  );
}

// -------------------------------------------------------------- composer

const DRAFT_KEY = (id: string) => `tabula-latina-draft-${id}`;

function Composer({ id }: { id: string }) {
  const [text, setText] = useState(() => storage.get(DRAFT_KEY(id)) ?? "");
  const [result, setResult] = useState<NonNullable<Msg["check"]> | null>(null);
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [words, setWords] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const change = (v: string) => {
    setText(v);
    storage.set(DRAFT_KEY(id), v);
    setResult(null);
  };
  const doSend = () => {
    if (!text.trim()) return;
    send(id, text);
    change("");
    box.current?.focus();
  };
  const doCheck = async () => {
    if (!text.trim()) return;
    setChecking(true);
    setErr(null);
    const res = await check(id, text.trim());
    setChecking(false);
    if (res && "error" in res) setErr(res.error);
    else if (res) setResult(res);
  };
  return (
    <div class="composer">
      {result && <CheckNote c={result} onUse={(s) => change(s)} />}
      {err && <p class="small bad">{err}</p>}
      <div class="composer-row">
        <button class="btn ghost small" onClick={() => setWords(true)} title="Your words" aria-label="Your words">
          <Icon.book />
        </button>
        <textarea
          ref={box}
          id="composer"
          class="composer-box"
          rows={1}
          lang="la"
          placeholder="Write in Latin…"
          value={text}
          onInput={(e) => change((e.target as HTMLTextAreaElement).value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              doSend();
            }
          }}
        />
        <button id="composer-check" class="btn ghost small" onClick={() => void doCheck()} disabled={!text.trim() || checking} title="Ask the coach whether it is right">
          {checking ? "…" : <><Icon.check /> Check</>}
        </button>
        <button id="composer-send" class="btn gold small" onClick={doSend} disabled={!text.trim()} aria-label="Send">
          <Icon.arrow />
        </button>
      </div>
      {words && <WordsSheet onPick={(w) => change(`${text.trimEnd()}${text.trim() ? " " : ""}${w}`)} onClose={() => setWords(false)} />}
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
          <span class="eyebrow">{who.stranger ? "Met by chance" : "Amīcus"}</span>
          <button class="btn ghost small" onClick={onClose} aria-label="Close"><Icon.close /></button>
        </div>
        <div class="profile-top">
          <Avatar who={who} size={132} />
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
  if (!shown) return null;
  const who = whoOf(shown.m.from, getMeta());
  return (
    <button class="arrival ansata" onClick={() => { go({ page: "messenger", thread: shown.t.id }); setShown(null); }} role="status">
      {who && <Avatar who={who} size={34} />}
      <span class="stack" style={{ gap: 0, minWidth: 0 }}>
        <b class="ui small" lang="la">{who?.name ?? nameOf(shown.m.from)}{shown.t.kind === "group" ? ` · ${GROUP.name}` : ""}</b>
        <span class="arrival-text" lang="la">{shown.m.la}</span>
      </span>
    </button>
  );
}
