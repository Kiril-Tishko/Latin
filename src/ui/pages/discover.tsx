// Discover: mystery cards, opened one at a time. An open card shows everything
// at once: the word and its relatives on the left, the memory hook and
// examples on the right.
import { useEffect, useMemo, useState } from "preact/hooks";
import { Card, CARD_BY_ID } from "../../content/deck";
import { seeded } from "../../latin/generate";
import { dictionaryForm } from "../../latin/morph";
import { cardExamples, nextCard } from "../../trainer/discover";
import { openAsk } from "../ask";
import { Icon, toast } from "../components";
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
export function CardView({ card, onDone, onNext }: { card: Card; onDone?: () => void; onNext?: () => void }) {
  const p = useProgress();
  const added = p.added.includes(card.id);
  const examples = useMemo(() => cardExamples(card, derived().knowledge, seeded(card.id.length * 7919 + p.added.length), 2), [card.id, p.added.length]);
  useEffect(() => {
    if (!getProgress().revealed.includes(card.id)) update((x) => void x.revealed.push(card.id));
  }, [card.id]);
  const e = card.entry;
  const kind = e.kind === "noun" ? (e.gender === "m" ? "noun · masculine" : e.gender === "f" ? "noun · feminine" : "noun · neuter") : e.kind === "verb" ? "verb" : "adjective";
  return (
    <div class="card-grid">
      <div class="stack" style={{ gap: "14px" }}>
        <div class="stack" style={{ gap: "4px" }}>
          <span class="eyebrow">{kind}</span>
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
              Next card <Icon.arrow />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Discover() {
  const p = useProgress();
  const d = derived();
  const known = new Set(d.words.map((w) => w.id));
  const next = nextCard(p.revealed, d.knowledge, known);
  const [open, setOpen] = useState<string | null>(null);
  const current = open ? CARD_BY_ID.get(open) : null;
  const waiting = p.revealed.filter((id) => !p.added.includes(id) && id !== open).map((id) => CARD_BY_ID.get(id)).filter(Boolean) as Card[];
  const addedCards = p.added.map((id) => CARD_BY_ID.get(id)).filter(Boolean) as Card[];
  const another = nextCard([...p.revealed, ...(open ? [open] : [])], d.knowledge, known);

  return (
    <div class="stack-lg">
      <div class={`mystery ${current ? "open" : ""}`}>
        <div class="flip">
          <div class="face front">
            <button class="card-front frame" style={{ width: "100%", color: "inherit", font: "inherit" }} disabled={!next} onClick={() => next && setOpen(next.id)} aria-label="Open the mystery card">
              <div class="stack" style={{ alignItems: "center", gap: "6px" }}>
                <span class="q">?</span>
                <span class="inscription small">{next ? "Open the card" : "No new cards for now"}</span>
              </div>
            </button>
          </div>
          <div class="face back panel frame">
            {current && <CardView card={current} onNext={another ? () => setOpen(null) : undefined} />}
          </div>
        </div>
      </div>

      {waiting.length > 0 && (
        <section class="stack">
          <span class="eyebrow">Opened, not added yet</span>
          <div class="word-grid">
            {waiting.map((c) => (
              <div key={c.id} class="panel word-tile" style={{ cursor: "default" }}>
                <span class="head latin">{c.entry.kind === "verb" ? c.entry.pp[0] : (c.entry as { lemma: string }).lemma}</span>
                <span class="gloss">{c.entry.en}</span>
                <div class="row" style={{ gap: "8px" }}>
                  <button class="btn small gold" onClick={() => { update((x) => void x.added.push(c.id)); toast(`${c.entry.en} added.`); }}>Add</button>
                  <button class="linkish" onClick={() => setOpen(c.id)}>Look again</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {addedCards.length > 0 && (
        <section class="stack">
          <span class="eyebrow">In your dictionary from Discover ({addedCards.length})</span>
          <p>
            {addedCards.map((c, i) => (
              <span key={c.id}>
                {i > 0 && " · "}
                <button class="linkish latin" style={{ color: "var(--ink)", fontFamily: "var(--f-text)", fontSize: "1.05rem" }} onClick={() => setOpen(c.id)}>
                  {c.entry.kind === "verb" ? c.entry.pp[0] : (c.entry as { lemma: string }).lemma}
                </button>
              </span>
            ))}
          </p>
        </section>
      )}
    </div>
  );
}
