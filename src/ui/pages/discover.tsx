// Discover: mystery cards. Every card has its own fixed spot in the deck grid;
// an opened card turns face up where it lies and stays there, so nothing on the
// page moves. The open card itself shows in a dialog: the word and its
// relatives on the left, the memory hook and examples on the right.
import { useEffect, useMemo, useState } from "preact/hooks";
import { Card, CARD_BY_ID, DECK_CARDS } from "../../content/deck";
import { seeded } from "../../latin/generate";
import { dictionaryForm } from "../../latin/morph";
import { roman } from "../../latin/text";
import { cardExamples, cardUnlocked } from "../../trainer/discover";
import { lessonWords } from "../../trainer/knowledge";
import { openAsk } from "../ask";
import { CardBack, Icon, Modal, toast } from "../components";
import { LatinText, LatinTokens } from "../latin";
import { derived, getProgress, update, useProgress } from "../store";
import { Speak } from "../speak";

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

const plainDict = (c: Card) => dictionaryForm(c.entry).replace(/, (m|f|n)\.$/, "");

/** The open face of a card: word, relatives, memory hook, examples, add button. */
export function CardView({ card, n, onDone, onNext, onClose }: { card: Card; n?: number; onDone?: () => void; onNext?: () => void; onClose?: () => void }) {
  const p = useProgress();
  const added = p.added.includes(card.id);
  const examples = useMemo(() => cardExamples(card, derived().knowledge, seeded(card.id.length * 7919 + p.added.length), 2), [card.id, p.added.length]);
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
            <Speak text={plainDict(card)} id={`card-${card.id}`} />
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
                toast(`${e.en} added: it will appear in your exercises.`);
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
                { label: `Word: ${dictionaryForm(e)}`, detail: `The learner is looking at the Discover card for ${dictionaryForm(e)} (${e.en}). Hook shown: ${card.hook}` },
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

const headword = (c: Card) => (c.entry.kind === "verb" ? c.entry.pp[0] : (c.entry as { lemma: string }).lemma);
const KIND_SHORT = { noun: "noun", verb: "verb", adj: "adjective", fixed: "word" } as const;

// a card picked elsewhere (the home page) opens as soon as Discover shows
let openOnArrival: string | null = null;
export function openCardOnArrival(id: string) {
  openOnArrival = id;
}

type TileState = "new" | "seen" | "added";

function Tile({ card, n, state, next, turned, onOpen }: { card: Card; n: number; state: TileState; next: boolean; turned: boolean; onOpen: () => void }) {
  if (state === "new") {
    return (
      <button class={`deck-tile${next ? " next" : ""}`} onClick={onOpen} aria-label={`Card ${roman(n)}: not opened yet`}>
        <CardBack n={n} />
      </button>
    );
  }
  return (
    <button class={`deck-tile face ${state}${turned ? " turned" : ""}`} onClick={onOpen} aria-label={`Card ${roman(n)}: ${headword(card)}, ${card.entry.en}`}>
      <span class="kind">{KIND_SHORT[card.entry.kind]}</span>
      <span class="head latin">{headword(card)}</span>
      <span class="gloss">{card.entry.en}</span>
      <span class="mark">{state === "added" ? <><Icon.check /> in dictionary</> : "viewed"}</span>
    </button>
  );
}

export function Discover() {
  const p = useProgress();
  const d = derived();
  const [open, setOpen] = useState<string | null>(() => {
    const id = openOnArrival;
    openOnArrival = null;
    return id;
  });
  // cards turned over during this visit flip in place; the rest are drawn as they are
  const [turned, setTurned] = useState<Set<string>>(() => new Set(open ? [open] : []));
  const lessonIds = useMemo(() => new Set(lessonWords(p.lessonsDone).map((w) => w.id)), [p.lessonsDone.join()]);
  const cards = DECK_CARDS.filter((c) => !lessonIds.has(c.id) && (cardUnlocked(c, d.knowledge) || p.revealed.includes(c.id) || p.added.includes(c.id)));
  const state = (id: string): TileState => (p.added.includes(id) ? "added" : p.revealed.includes(id) || id === open ? "seen" : "new");
  const fresh = cards.filter((c) => state(c.id) === "new");
  const seenCount = cards.length - fresh.length;
  const addedCount = cards.filter((c) => state(c.id) === "added").length;
  const later = DECK_CARDS.filter((c) => !lessonIds.has(c.id)).length - cards.length;

  const current = open ? CARD_BY_ID.get(open) : undefined;
  const index = current ? cards.findIndex((c) => c.id === current.id) : -1;
  // the next unopened card after this one, going round the deck
  const after = index >= 0 ? [...cards.slice(index + 1), ...cards.slice(0, index)] : cards;
  const next = after.find((c) => state(c.id) === "new");

  const show = (id: string) => {
    setOpen(id);
    if (state(id) === "new") setTurned((t) => new Set(t).add(id));
  };

  return (
    <div class="stack">
      <div class="spread deck-head">
        <p class="ui">
          <strong>{seenCount}</strong> of {cards.length} cards opened · <strong>{addedCount}</strong> in your dictionary
        </p>
        <button class="btn gold" disabled={!fresh.length} onClick={() => fresh[0] && show(fresh[0].id)}>
          <Icon.card /> {fresh.length ? "Open a new card" : "All cards opened"}
        </button>
      </div>

      <div class="deck-grid">
        {cards.map((c, i) => (
          <Tile key={c.id} card={c} n={i + 1} state={state(c.id)} next={c.id === fresh[0]?.id} turned={turned.has(c.id)} onOpen={() => show(c.id)} />
        ))}
      </div>

      {later > 0 && <p class="small muted">{later} more card{later === 1 ? "" : "s"} open with later lessons.</p>}

      {current && (
        <Modal wide className="card-modal" label={`Card ${roman(index + 1)}`} onClose={() => setOpen(null)}>
          <div class="card-turn" key={current.id}>
            <CardView card={current} n={index + 1} onNext={next ? () => show(next.id) : undefined} onClose={() => setOpen(null)} />
          </div>
        </Modal>
      )}
    </div>
  );
}
