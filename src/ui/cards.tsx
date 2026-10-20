// Mystery cards on the Words page: five cards lie face down at a time, each
// with a new word (its relatives in English, Russian and Ukrainian, a memory
// hook, examples with known words). An opened card turns face up in its place,
// so nothing moves; when all five are open, the next five come. The open card
// shows in a dialog, with "Add to my dictionary".
import { useEffect, useMemo, useState } from "preact/hooks";
import { Card, CARD_BY_ID, DECK_CARDS } from "../content/deck";
import { seeded } from "../latin/generate";
import { dictionaryForm, headword as latinHeadword } from "../latin/morph";
import { roman } from "../latin/text";
import { Progress } from "../trainer/progress";
import { cardExamples, cardUnlocked } from "../trainer/discover";
import { lessonWords } from "../trainer/knowledge";
import { openAsk } from "./ask";
import { CardBack, Icon, Modal, toast } from "./components";
import { LatinText, LatinTokens } from "./latin";
import { derived, getProgress, update, useProgress } from "./store";
import { Speak } from "./speak";
import { Sayings } from "./saying";

const LANG: [keyof Card["from"], string][] = [
  ["en", "EN"],
  ["ru", "RU"],
  ["uk", "UA"],
];

function Relatives({ card }: { card: Card }) {
  const groups: [string, Card["from"]][] = [
    ["Borrowed from Latin", card.from],
    ["Same ancient root", card.kin],
  ];
  return (
    <div class="stack" style={{ gap: "10px" }}>
      {groups
        .filter(([, rel]) => Object.values(rel).some((x) => x?.length))
        .map(([title, rel]) => (
          <div key={title} class="stack" style={{ gap: "2px" }}>
            <span class="eyebrow" style={{ color: "var(--ink-2)" }}>{title}</span>
            {LANG.filter(([k]) => rel[k]?.length).map(([k, label]) => (
              <div key={k} class="rel-line">
                <span class="rel-lang">{label}</span> {rel[k]!.join(", ")}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

export const plainDict = (c: Card) => dictionaryForm(c.entry).replace(/, (m|f|n)\.$/, "");

/** The open face of a card: word, relatives, memory hook, examples, add button. */
export function CardView({ card, n, onDone, onNext, onClose }: { card: Card; n?: number; onDone?: () => void; onNext?: () => void; onClose?: () => void }) {
  const p = useProgress();
  const added = p.added.includes(card.id);
  // made once per card: adding it must not change the examples under the learner's eyes
  const examples = useMemo(() => cardExamples(card, derived().knowledge, seeded(card.id.length * 7919 + p.added.length), 2), [card.id]);
  useEffect(() => {
    if (!getProgress().revealed.includes(card.id)) update((x) => void x.revealed.push(card.id));
  }, [card.id]);
  const e = card.entry;
  const kind = e.kind === "noun" ? (e.gender === "m" ? "noun · masculine" : e.gender === "f" ? "noun · feminine" : "noun · neuter") : e.kind === "verb" ? "verb" : "adjective";
  return (
    <div class="stack" style={{ gap: "6px" }}>
      <div class="spread card-top">
        <span class="eyebrow">{n !== undefined && <span class="card-no">{roman(n)}</span>}{kind}</span>
        {onClose && <button class="btn ghost small" onClick={onClose} aria-label="Close"><Icon.close /></button>}
      </div>
    <div class="card-grid">
      <div class="stack" style={{ gap: "14px" }}>
        <div class="stack" style={{ gap: "4px" }}>
          <div class="card-word">
            <LatinText text={plainDict(card)} />
            <Speak text={latinHeadword(card.entry)} id={`card-${card.id}`} />
          </div>
          <div class="card-meaning">
            {e.en}
            {e.alt?.length ? <span class="muted">, {e.alt.slice(0, 2).join(", ")}</span> : null}
          </div>
        </div>
        <Relatives card={card} />
      </div>
      <div class="stack" style={{ gap: "14px" }}>
        <div class="well stack" style={{ gap: "4px" }}>
          <span class="eyebrow" style={{ color: "var(--ink-2)" }}>Remember it</span>
          <p>{card.hook}</p>
        </div>
        <Sayings wordId={card.id} />
        {examples.length > 0 && (
          <div class="stack" style={{ gap: "4px" }}>
            <span class="eyebrow" style={{ color: "var(--ink-2)" }}>With words you know</span>
            {examples.map((x, i) => (
              <div key={i} class="ex-line">
                <span>
                  <LatinTokens tokens={x.tokens} />
                  <Speak text={x.latin} id={`card-${card.id}-${i}`} />
                </span>
                <span class="muted">{x.english}</span>
              </div>
            ))}
          </div>
        )}
        <div class="row">
          {added ? (
            <span class="chip" style={{ color: "var(--good)", borderColor: "var(--good)" }}>In your dictionary</span>
          ) : (
            <button
              class="btn gold"
              onClick={() => {
                update((x) => void x.added.push(card.id));
                toast(`«${latinHeadword(e)}» is in your words now: it will appear in your exercises.`);
                onDone?.();
              }}
            >
              <Icon.check /> Add to my dictionary
            </button>
          )}
          <button
            class="btn ghost"
            aria-label="Ask Claude about this word"
            onClick={() =>
              openAsk(
                { label: `Word: ${dictionaryForm(e)}`, detail: `The learner opened the mystery card for ${dictionaryForm(e)} (${e.en}). Hook shown: ${card.hook}` },
                "Tell me more about this word and how to remember it.",
              )
            }
          >
            <Icon.quill /> Ask
          </button>
          {onNext && (
            <button class="btn ghost" onClick={onNext} style={{ marginLeft: "auto" }}>
              Next new card <Icon.arrow />
            </button>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}

const cardWord = (c: Card) => (c.entry.kind === "verb" ? c.entry.pp[0] : (c.entry as { lemma: string }).lemma);

/** How many unopened cards lie on the table at once. */
const BATCH = 5;

/** The deck as the learner sees it: the cards open to them (not lesson words), in order, and the five on the table. */
export function deck(p: Progress) {
  const lessonIds = new Set(lessonWords(p.lessonsDone).map((w) => w.id));
  const k = derived().knowledge;
  const mine = DECK_CARDS.filter((c) => !lessonIds.has(c.id));
  const all = mine.filter((c) => cardUnlocked(c, k) || p.revealed.includes(c.id) || p.added.includes(c.id));
  const opened = (c: Card) => p.revealed.includes(c.id) || p.added.includes(c.id);
  // the five on the table: the group of five that holds the first card not opened yet
  const firstNew = all.findIndex((c) => !opened(c));
  const from = firstNew < 0 ? Math.max(0, all.length - BATCH) : Math.floor(firstNew / BATCH) * BATCH;
  const table = all.slice(from, from + BATCH);
  return {
    all,
    table,
    opened: all.filter(opened),
    fresh: all.filter((c) => !opened(c)),
    /** Cards that open with later lessons. */
    later: mine.length - all.length,
    number: (c: Card) => all.indexOf(c) + 1,
  };
}

/** One card on the table: its back until opened, then the word face up in the same place. */
function Slot({ card, n, next, turned, onOpen }: { card: Card; n: number; next: boolean; turned: boolean; onOpen: () => void }) {
  const p = useProgress();
  const added = p.added.includes(card.id);
  if (!added && !p.revealed.includes(card.id)) {
    return (
      <button class={`deck-tile${next ? " next" : ""}`} onClick={onOpen} aria-label={`Card ${roman(n)}: not opened yet`}>
        <CardBack n={n} />
      </button>
    );
  }
  return (
    <button class={`deck-tile face${added ? " added" : ""}${turned ? " turned" : ""}`} onClick={onOpen} aria-label={`Card ${roman(n)}: ${cardWord(card)}, ${card.entry.en}`}>
      <span class="head latin">{cardWord(card)}</span>
      <span class="gloss">{card.entry.en}</span>
      <span class="mark">{added ? <><Icon.check /> added</> : "+ add"}</span>
    </button>
  );
}

/** The five cards on the table, and the open card's dialog. */
export function CardStrip() {
  const p = useProgress();
  const d = deck(p);
  const [open, setOpen] = useState<string | null>(null);
  // cards turned over during this visit flip in place
  const [turned, setTurned] = useState<Set<string>>(() => new Set());
  const isNew = (c: Card) => !p.revealed.includes(c.id) && !p.added.includes(c.id);
  const show = (id: string) => {
    const c = CARD_BY_ID.get(id);
    if (c && isNew(c)) setTurned((t) => new Set(t).add(id));
    setOpen(id);
  };
  const current = open ? CARD_BY_ID.get(open) : undefined;
  const nextNew = d.table.find((c) => isNew(c) && c.id !== open) ?? d.fresh.find((c) => c.id !== open && !d.table.includes(c));
  if (!d.all.length) return null;
  return (
    <section class="panel deck-panel stack" data-ask="Mystery cards" aria-label="Mystery cards">
      <div class="stack" style={{ gap: "0" }}>
        <div class="spread deck-head">
          <strong class="ui">Mystery cards</strong>
          <span class="small ui muted">
            <strong>{d.opened.length}</strong> / {d.all.length} opened
          </span>
        </div>
        <span class="small muted">{d.fresh.length ? "A new word in each: open one, add it if you like it." : "You have opened every card for now."}</span>
      </div>
      <div class="deck-strip">
        {d.table.map((c) => (
          <Slot key={c.id} card={c} n={d.number(c)} next={c.id === d.fresh[0]?.id} turned={turned.has(c.id)} onOpen={() => show(c.id)} />
        ))}
      </div>
      {d.later > 0 && !d.fresh.length && <p class="small muted">{d.later} more card{d.later === 1 ? "" : "s"} open with later lessons.</p>}
      {current && (
        <Modal wide className="card-modal" label={`Card ${roman(d.number(current))}`} screen={`Card ${roman(d.number(current))}: ${plainDict(current)} (${current.entry.en})`} onClose={() => setOpen(null)}>
          <div class="card-turn" key={current.id}>
            <CardView card={current} n={d.number(current)} onNext={nextNew ? () => show(nextNew.id) : undefined} onClose={() => setOpen(null)} />
          </div>
        </Modal>
      )}
    </section>
  );
}

/** A card opened from elsewhere (the Cards filter of the Words page). */
export function CardModal({ card, onClose }: { card: Card; onClose: () => void }) {
  const n = deck(getProgress()).number(card);
  return (
    <Modal wide className="card-modal" label={`Card ${roman(n)}`} screen={`Card ${roman(n)}: ${plainDict(card)} (${card.entry.en})`} onClose={onClose}>
      <div class="card-turn" key={card.id}>
        <CardView card={card} n={n} onClose={onClose} />
      </div>
    </Modal>
  );
}
