// The Sibyl's leaves on the page (chat/sibyl.ts): the wind that now and then
// blows a leaf across the screen (`SibylWind`, on every page), the leaf caught
// and read (`LeafReveal`), the Liber Sibyllīnus where the caught leaves are
// kept, pinned under the Ācta in Nūntiī (`SibylRow`, `SibylBook`), and the
// small leaf on the message where a prophecy came true (`LeafMark`).
import { Fragment } from "preact";
import { useEffect, useLayoutEffect, useState } from "preact/hooks";
import { PEOPLE } from "../content/people";
import { romanDate, romeDay } from "../chat/calendar";
import { actaKey } from "../chat/acta";
import { showEmoji, withoutEmoji } from "../chat/emoji";
import { Msg } from "../chat/model";
import { Leaf, LeafState, SIBYL_ID } from "../chat/sibyl";
import { Icon, toast } from "./components";
import { LatinText } from "./latin";
import { go } from "./nav";
import { storage } from "./platform";
import { useScreen } from "./screen";
import { Speak } from "./speak";
import { Avatar, Sprig } from "./pages/messenger";
import { bookNews, catchLeaf, chatWords, fateOf, focusLeaf, leafStates, leafToday, leaves, prepareLeaf, readBook, showMessage, takeLeafFocus } from "./messenger";

const LOCAL_KEY = "tabula-latina-sibyl-v1";
const SECOND = 1000;
const MIN = 60 * SECOND;

/** A leaf with writing on it, golden-brown. */
export function LeafIcon({ cls = "" }: { cls?: string }) {
  return (
    <svg class={`leaf-svg ${cls}`} viewBox="0 0 40 96" aria-hidden="true">
      {/* (no gradient: an id shared by every leaf breaks where the first one is hidden) */}
      <path d="M20 2 C36 22 38 62 20 88 C2 62 4 22 20 2 Z" fill="#d9a548" />
      <path d="M20 2 C36 22 38 62 20 88 Z" fill="#9c6a26" opacity="0.45" />
      <path d="M20 2 C36 22 38 62 20 88 C2 62 4 22 20 2 Z" fill="none" stroke="#6b4519" stroke-width="1.4" />
      <path d="M20 6 L20 94" stroke="#6b4519" stroke-width="1.2" fill="none" stroke-linecap="round" />
      <path d="M20 26 L29 18 M20 40 L31 31 M20 54 L31 46 M20 68 L28 61 M20 33 L10 25 M20 47 L9 39 M20 61 L10 54" stroke="#7d5420" stroke-width="0.7" fill="none" opacity="0.7" />
      {/* her writing, in a hand no one reads */}
      <path d="M12 30 q2 -3 4 0 t4 0 M23 36 q2 -2 3 1 M11 44 l3 -2 l2 3 l3 -3 M23 50 q3 -3 5 0 M12 58 q2 2 4 -1 M23 64 l2 -3 l2 3" stroke="#3b2410" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.75" />
    </svg>
  );
}

// ------------------------------------------------------------- the wind

interface DayLog {
  key: string;
  /** Times a leaf flew past today, and tries at writing one. */
  passes: number;
  tries: number;
}

function dayLog(now: number): DayLog {
  const key = actaKey(now);
  try {
    const d = JSON.parse(storage.get(LOCAL_KEY) ?? "null") as DayLog | null;
    if (d?.key === key) return d;
  } catch {
    /* nothing kept */
  }
  return { key, passes: 0, tries: 0 };
}
const keepLog = (d: DayLog) => storage.set(LOCAL_KEY, JSON.stringify(d));

/** The learner is busy: typing (the box focused, the phone's keyboard up) or in a dialog. */
function busy(): boolean {
  const a = document.activeElement as HTMLElement | null;
  return (
    document.hidden ||
    document.documentElement.classList.contains("kb-open") ||
    !!document.querySelector(".modal, .scrim, .sibyl-veil") ||
    !!(a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.isContentEditable))
  );
}

/** The leaf written for today's wind (kept across a re-render). */
let ready: Leaf | null = null;
let writing = false;

/**
 * The wind: on a leaf's day (chat/sibyl.ts, leafDay), after a while on the
 * page (a minute the first time, then a few), a leaf blows across the screen,
 * once and maybe once more; it waits while the learner types. Claude writes
 * the leaf just before it flies; without Claude no leaf comes.
 */
export function SibylWind() {
  const [flight, setFlight] = useState<{ leaf: Leaf; n: number } | null>(null);
  const [caught, setCaught] = useState<{ leaf: Leaf; msg: Msg; x: number; y: number } | null>(null);
  useEffect(() => {
    let active = 0;
    // the first leaf ever comes soon; later ones after a few minutes on the page
    let due = (leaves().length ? 90 + Math.random() * 270 : 45) * SECOND;
    let flying = false;
    const tick = async () => {
      if (document.hidden) return;
      active += 5 * SECOND;
      if (flying || active < due) return;
      const now = Date.now();
      const log = dayLog(now);
      if (log.passes >= 2 || log.tries >= 2 || !leafToday(now)) return;
      if (!ready) {
        if (writing) return;
        writing = true;
        const res = await prepareLeaf();
        writing = false;
        if ("error" in res) {
          keepLog({ ...log, tries: log.tries + 1 });
          due = active + 3 * MIN;
          return;
        }
        ready = res;
      }
      if (busy()) return;
      flying = true;
      keepLog({ ...dayLog(Date.now()), passes: log.passes + 1 });
      setFlight({ leaf: ready, n: log.passes + 1 });
      // missed: it may come by once more, a few minutes later
      setTimeout(() => {
        flying = false;
        due = active + (4 + Math.random() * 5) * MIN;
      }, 20 * SECOND);
    };
    const timer = setInterval(() => void tick(), 5 * SECOND);
    return () => clearInterval(timer);
  }, []);

  const onCatch = (x: number, y: number) => {
    if (!flight) return;
    const msg = catchLeaf(flight.leaf);
    ready = null;
    setCaught({ leaf: flight.leaf, msg, x, y });
    setFlight(null);
  };
  return (
    <>
      {flight && <LeafFlight key={flight.n} onCatch={onCatch} onGone={() => setFlight(null)} />}
      {caught && <LeafReveal {...caught} onClose={() => {
        setCaught(null);
        toast("Kept in the Liber Sibyllīnus, in Nūntiī.");
      }} />}
    </>
  );
}

/** A leaf blowing across the screen, from one side to the other, falling and turning. */
function LeafFlight({ onCatch, onGone }: { onCatch: (x: number, y: number) => void; onGone: () => void }) {
  // a wavering way down, from one side towards the other
  const [path] = useState(() => {
    const fromLeft = Math.random() < 0.5;
    const x0 = fromLeft ? 4 + Math.random() * 30 : 66 + Math.random() * 30;
    const x4 = fromLeft ? 60 + Math.random() * 34 : 6 + Math.random() * 34;
    const at = (k: number, sway: number) => `${x0 + (x4 - x0) * k + sway}vw`;
    const sway = 6 + Math.random() * 8;
    return { "--x0": `${x0}vw`, "--x1": at(0.3, sway), "--x2": at(0.5, -sway), "--x3": at(0.75, sway), "--x4": `${x4}vw`, "--spin": fromLeft ? "1" : "-1" };
  });
  return (
    <button
      class="sibyl-leaf"
      style={path}
      aria-label="A leaf is blowing past: catch it"
      title="A leaf with writing on it"
      onAnimationEnd={(e) => e.target === e.currentTarget && onGone()}
      onClick={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        onCatch(r.left + r.width / 2, r.top + r.height / 2);
      }}
    >
      <span class="sibyl-leaf-turn">
        <LeafIcon />
      </span>
    </button>
  );
}

/** The leaf caught: it opens where it was caught, and her lines come one by one. */
function LeafReveal({ leaf, msg, x, y, onClose }: { leaf: Leaf; msg: Msg; x: number; y: number; onClose: () => void }) {
  const [shown, setShown] = useState(0);
  const [open, setOpen] = useState<number[]>([]);
  const lex = chatWords().lex;
  useScreen("dialog", "A leaf of the Sibyl, just caught", () => `A leaf of the Sibyl of Cumae, written in the learner's Latin, caught as the wind blew it across the screen:\n${leaf.lines.map((l) => `${l.la} = ${l.en}`).join("\n")}`);
  useEffect(() => {
    const timers = leaf.lines.map((_, i) => setTimeout(() => setShown(i + 1), 700 + i * 900));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  const from = { "--fx": `${x - window.innerWidth / 2}px`, "--fy": `${y - window.innerHeight / 2}px` };
  const toggle = (i: number) => setOpen(open.includes(i) ? open.filter((x) => x !== i) : [...open, i]);
  return (
    <div class="sibyl-veil" role="dialog" aria-modal="true" aria-label="A leaf of the Sibyl" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sibyl-card" style={from}>
        <div class="sibyl-card-head">
          <LeafIcon cls="sibyl-card-leaf" />
          <span class="stack" style={{ gap: 0 }}>
            <span class="sibyl-kicker" lang="la">Folium Sibyllae</span>
            <span class="sibyl-date" lang="la" title={dateEn(msg.at)}>{romanDate(romeDay(msg.at))}</span>
          </span>
          <span class="sibyl-card-tools">
            {shown >= leaf.lines.length && <Speak text={withoutEmoji(leaf.lines.map((l) => l.la).join(". "))} id="sibyl-leaf" label="Hear it" />}
          </span>
        </div>
        <div class="sibyl-lines">
          {leaf.lines.map((l, i) => (
            <Fragment key={i}>
              <p class={`sibyl-line${i < shown ? " on" : ""}`} onClick={() => toggle(i)} title="Tap for the English">
                <LatinText text={showEmoji(l.la)} lex={lex} />
              </p>
              {i < shown && open.includes(i) && l.en && <p class="sibyl-en">{l.en}</p>}
            </Fragment>
          ))}
        </div>
        <p class={`sibyl-note small${shown >= leaf.lines.length ? " on" : ""}`}>
          The Sibyl of Cumae wrote what the god told her on leaves and let the wind scatter them. This one blew to you. Tap a line for its English.
        </p>
        <p class={`sibyl-motto${shown >= leaf.lines.length ? " on" : ""}`}>
          <span lang="la">Sibylla numquam fallit.</span>
          <span class="muted">The Sibyl is never wrong.</span>
        </p>
        <button class="btn gold sibyl-keep" onClick={onClose}>
          <span lang="la">Servā</span> · keep it
        </button>
      </div>
    </div>
  );
}

const dateEn = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "long" });

// ------------------------------------------------------------- the book

const nameOf = (id: string) => PEOPLE.find((p) => p.id === id)?.name ?? id;

/** The book's face: a leaf on a dark green seal. */
function BookAvatar({ size }: { size: number }) {
  return (
    <span class="avatar sibyl-avatar" style={{ "--av-size": `${size}px` }} aria-label="Liber Sibyllīnus">
      <LeafIcon />
    </span>
  );
}

/** The book in the chat list, under the Ācta, once a leaf is caught: the newest leaf, or what came true. */
export function SibylRow({ active, now }: { active: boolean; now: number }) {
  const all = leaves();
  if (!all.length) return null;
  const news = bookNews(now);
  const last = all.at(-1)!;
  return (
    <button role="listitem" id="chat-sibylla" class={`chat-row sibyl-row${active ? " active" : ""}${news ? " unread" : ""}`} onClick={() => go({ page: "messenger", thread: SIBYL_ID })}>
      <BookAvatar size={64} />
      <span class="chat-row-main">
        <span class="chat-row-top">
          <span class="chat-row-name" lang="la">Liber Sibyllīnus</span>
        </span>
        <span class="chat-row-bottom">
          <span class="chat-row-preview">
            {news ? <b lang="la">Implētum est!</b> : <span lang="la">{showEmoji(last.la.split("\n")[0])}</span>}
          </span>
          {news && <span class="unread-badge" aria-label="something came true">I</span>}
        </span>
      </span>
      <span class="chat-row-go" aria-hidden="true"><Icon.chevron /></span>
    </button>
  );
}

/** Does the book match a search: its name, or a line of a leaf? */
export const bookMatches = (q: string, plain: (s: string) => string) => leaves().length > 0 && (plain("Liber Sibyllinus").includes(q) || leaves().some((m) => plain(`${m.la} ${m.en ?? ""}`).includes(q)));

/** What Ask Claude sees of the book: the leaves, and which came true (not what is still to come). */
export function bookText(now: number): string {
  const { states } = leafStates(now);
  const all = leaves();
  if (!all.length) return "The Liber Sibyllīnus, where the Sibyl's leaves the learner catches are kept: none yet.";
  return `The Liber Sibyllīnus: leaves of the Sibyl of Cumae, in the learner's Latin, that the wind blew across their screen; each foretells something that comes true in a friend's life (what, the learner learns only when it happens).\n${all
    .map((m) => {
      const st = states.get(m.id);
      const done = st?.state === "told" ? ` — came true: ${nameOf(st.msg.from)} wrote «${st.msg.la}»` : st?.state === "known" ? ` — came true${st.en ? `: ${nameOf(st.who)}: ${st.en}` : ""}` : " — still to come";
      return `${romanDate(romeDay(m.at))}: ${m.la.replace(/\n/g, " / ")} (${(m.en ?? "").replace(/\n/g, " / ")})${done}`;
    })
    .join("\n")}`;
}

/**
 * The Liber Sibyllīnus: every leaf caught, oldest first, a tap on a line for its
 * English; under each, whether it has come true, and where (a tap on the
 * message brings it into view in its chat). First, the story of the books.
 */
export function SibylBook({ now }: { now: number }) {
  const all = leaves();
  const { states } = leafStates(now);
  const lex = chatWords().lex;
  const [open, setOpen] = useState<string[]>([]);
  const [allEn, setAllEn] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  // seen: every leaf, and what came true while the book is open
  const news = bookNews(now);
  useEffect(() => {
    readBook();
    if (news) document.getElementById(`leaf-${all.at(-1)?.id}`)?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [all.length, news]);
  // the leaf asked for (from a message's mark), else the newest; again once the fonts and the story are laid out
  useLayoutEffect(() => {
    const f = takeLeafFocus();
    const show = () => document.getElementById(`leaf-${f ?? all.at(-1)?.id}`)?.scrollIntoView({ block: f ? "center" : "end" });
    show();
    const later = setTimeout(show, 250);
    if (f) {
      setFlash(f);
      setTimeout(() => setFlash(null), 1800);
    }
    return () => clearTimeout(later);
  }, []);
  const toggle = (key: string) => setOpen(open.includes(key) ? open.filter((x) => x !== key) : [...open, key]);
  return (
    <section class="chat msgr-panel acta sibyl-book" aria-label="Liber Sibyllīnus">
      <header class="chat-head">
        <button class="btn ghost small chat-back" onClick={() => go({ page: "messenger" })} aria-label="Back to the chats">←</button>
        <span class="chat-head-who">
          <BookAvatar size={72} />
          <span class="stack" style={{ gap: 0, minWidth: 0 }}>
            <span class="chat-head-name" lang="la">Liber Sibyllīnus</span>
            <span class="chat-head-sub">The Sibyl's leaves you caught</span>
          </span>
        </span>
        <div class="chat-tools">
          <button class="round-btn" id="sibyl-english" aria-label={allEn ? "Hide the English" : "Show the English of all"} aria-pressed={allEn} onClick={() => setAllEn(!allEn)}>
            <Icon.eye />
          </button>
        </div>
        <Sprig cls="head-sprig" flip />
      </header>
      <div class="chat-msgs acta-msgs" data-ask="The book">
        <div class="chat-flow">
          <Lore open={all.length <= 1} />
          {!all.length && <p class="acta-empty muted">No leaf yet. Now and then the wind blows one across the page: catch it.</p>}
          {all.map((m) => {
            const lines = m.la.split("\n");
            const en = (m.en ?? "").split("\n");
            return (
              <article key={m.id} id={`leaf-${m.id}`} class={`acta-post sibyl-page${flash === m.id ? " hit" : ""}`}>
                <span class="acta-top">
                  <span class="acta-kind" lang="la" title={dateEn(m.at)}>
                    <LeafIcon cls="kind-leaf" /> {romanDate(romeDay(m.at))}
                  </span>
                  <Speak text={withoutEmoji(lines.join(". "))} id={`leaf-${m.id}`} label="Hear it" />
                </span>
                {lines.map((la, j) => {
                  const key = `${m.id}:${j}`;
                  return (
                    <Fragment key={key}>
                      <p class="acta-line sibyl-line on" onClick={() => toggle(key)}>
                        <LatinText text={showEmoji(la)} lex={lex} />
                      </p>
                      {en[j] && (allEn || open.includes(key)) && <p class="acta-en">{en[j]}</p>}
                    </Fragment>
                  );
                })}
                <LeafFate id={m.id} st={states.get(m.id)} />
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** Under a leaf: still to come, coming, or come true (with the message that told of it). */
function LeafFate({ id, st }: { id: string; st: LeafState | undefined }) {
  if (!st || st.state === "waits")
    return (
      <p class="sibyl-state waits">
        <span lang="la">Fātum manet…</span> <span class="muted">What it foretells is still to come.</span>
      </p>
    );
  if (st.state === "coming")
    return (
      <p class="sibyl-state coming">
        <span lang="la">Fātum venit…</span> <span class="muted">It is coming true about now.</span>
      </p>
    );
  if (st.state === "known")
    return (
      <p class="sibyl-state done">
        <b lang="la">Implētum est.</b> <span class="muted">{st.en ? <>It came true: the neighbours say {nameOf(st.who)} — {st.en.replace(/^./, (c) => c.toLowerCase())}</> : "It came true."}</span>
      </p>
    );
  const who = PEOPLE.find((p) => p.id === st.msg.from);
  const f = fateOf(id);
  return (
    <div class="sibyl-state done">
      <p>
        <b lang="la">Implētum est.</b> <span class="muted">It came true{f ? ` on ${dateEn(st.msg.at)}` : ""}:</span>
      </p>
      <button
        class="sibyl-told"
        onClick={() => {
          showMessage(st.chat, st.msg.id);
          go({ page: "messenger", thread: st.chat });
        }}
        title="See it in the chat"
      >
        {who && <Avatar who={who} size={40} />}
        <span class="sibyl-told-text">
          <b lang="la">{who?.name ?? nameOf(st.msg.from)}</b> <span lang="la">{showEmoji(st.msg.la)}</span>
        </span>
        <Icon.chevron />
      </button>
    </div>
  );
}

/** The story of the Sibylline Books, and where their words live on. */
function Lore({ open }: { open: boolean }) {
  return (
    <details class="acta-post sibyl-lore" open={open}>
      <summary>
        <span lang="la">Unde liber?</span> <span class="muted">Where this book comes from</span>
      </summary>
      <p>
        An old woman once came to Tarquin, king of Rome, with nine books of prophecies, and asked a huge price. He laughed. She burned three, and asked the same price for six. He laughed again. She burned three more, and asked the same price for the last three. Shaken, the king paid it. They were the Sibyl's books.
      </p>
      <p>
        Rome kept them in a stone chest under the temple of Jupiter on the Capitol, and only fifteen priests (the <i lang="la">quindecimvirī</i>) could open them, when the city was in danger. They burned with the temple in 83 BC; Augustus put a new collection under Apollo's statue on the Palatine, and there they are in your friends' Rome, AD 100. Around AD 405 the general Stilicho had them burned for good.
      </p>
      <p>
        The Sibyl of Cumae wrote on leaves (Virgil, <i>Aeneid</i> III): when the wind came in at the door, the leaves flew apart and no one could put the prophecy together again.
      </p>
      <p class="labelled"><b>Hidden links:</b></p>
      <ul class="sibyl-links">
        <li><i lang="la">folium</i> (a leaf, plural <i lang="la">folia</i>) lives on in <i>foliage</i>, <i>folio</i>, <i>portfolio</i> (Italian <i>portafoglio</i>, "carry-leaves"), <i>foil</i> and <i>trefoil</i>, and, through German, in Russian and Ukrainian <i>фольга</i> and <i>фолиант / фоліант</i>.</li>
        <li><i>Sibylline</i> in English means mysterious, prophetic.</li>
        <li>The <i lang="la">Dies irae</i>, the medieval hymn of the Last Day, calls her as a witness beside King David: <i lang="la">teste David cum Sibylla</i>.</li>
        <li>Michelangelo painted five sibyls on the Sistine Chapel's ceiling; the Cumaean one is the old giantess with the book.</li>
        <li>Where her name comes from, the ancients already argued: "god's counsel" in Greek, said Varro, probably a guess.</li>
      </ul>
    </details>
  );
}

/** On a message where a leaf came true: a small leaf, which opens the book at it. */
export function LeafMark({ leaf }: { leaf: string }) {
  return (
    <button
      class="leaf-mark"
      title="The Sibyl foretold this"
      aria-label="The Sibyl foretold this: open her book"
      onClick={(e) => {
        e.stopPropagation();
        focusLeaf(leaf);
        go({ page: "messenger", thread: SIBYL_ID });
      }}
    >
      <LeafIcon />
    </button>
  );
}
