// Adding a word to the learner's own dictionary: from the Words page, under an
// answer of Ask Claude, or from a word tapped in the messenger. The learner
// types a word (Latin in any form, or English, Russian, Ukrainian); a word the
// site already has is shown as it is (a Discover card is added as the card);
// anything else Claude fills in, the grammar engine builds its forms, and the
// learner sees the whole card before adding it.
import { useEffect, useRef, useState } from "preact/hooks";
import { CHAT_WORDS, FIXED_NAMES } from "../chat/words";
import { Card, CARD_BY_ID, DECK_CARDS } from "../content/deck";
import { LESSONS } from "../content/lessons";
import { nounUsable, verbUsable } from "../latin/generate";
import { dictionaryForm, headword } from "../latin/morph";
import { Entry } from "../latin/types";
import { fromClaude, fromLine, lookupPrompt, OwnWord } from "../trainer/own";
import { Icon, Modal, toast } from "./components";
import { LatinText } from "./latin";
import { coachOpts } from "./models";
import { sampleErrorText, sampler } from "./platform";
import { derived, update, useProgress } from "./store";
import { Forms, WordModal } from "./pages/words";

type Via = "words" | "ask" | "messenger";
let state: { open: boolean; input: string; via: Via } = { open: false, input: "", via: "words" };
const listeners = new Set<() => void>();

/** Opens the window for adding a word, looking the word up at once when one is given. */
export function openAddWord(input = "", via: Via = "words") {
  state = { open: true, input, via };
  listeners.forEach((l) => l());
}

function close() {
  state = { ...state, open: false };
  listeners.forEach((l) => l());
}

/** Mounted once: shows the window when it is open. */
export function AddWordHost() {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((x) => x + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return state.open ? <AddWord key={`${state.via}:${state.input}`} start={state.input} /> : null;
}

/** Is this word (any form) in the learner's dictionary already: a lesson word, an added card, their own, or a chat word or name? */
export function knownWord(text: string): Entry | null {
  const d = derived();
  const mine = new Set([...d.words, ...CHAT_WORDS, ...FIXED_NAMES].map((w) => w.id));
  return d.lexicon.analyze(text.trim()).find((a) => mine.has(a.entry.id))?.entry ?? null;
}

/** A Discover card the word belongs to, not added yet. */
function cardOf(text: string): Card | null {
  const p = derived();
  const mine = new Set(p.words.map((w) => w.id));
  const hit = p.lexicon.analyze(text.trim()).find((a) => CARD_BY_ID.has(a.entry.id) && !mine.has(a.entry.id));
  return hit ? CARD_BY_ID.get(hit.entry.id)! : null;
}

/** Every word id the site uses, so an own word gets one of its own. */
function takenIds(): Set<string> {
  return new Set([...LESSONS.flatMap((l) => l.words), ...DECK_CARDS.map((c) => c.entry), ...CHAT_WORDS, ...FIXED_NAMES, ...derived().own].map((e) => e.id));
}

/** Whether practice can use the word now: some ending of it is learned. */
function usableNow(e: Entry): boolean {
  const k = derived().seenKnowledge;
  if (e.kind === "noun") return nounUsable(k, e, "nom", "sg") || nounUsable(k, e, "acc", "sg");
  if (e.kind === "verb") return verbUsable(k, e, "3sg");
  return e.kind === "adj";
}

type Found =
  | { kind: "new"; word: OwnWord; entry: Entry }
  | { kind: "known"; entry: Entry }
  | { kind: "card"; card: Card };

function AddWord({ start }: { start: string }) {
  useProgress();
  const [text, setText] = useState(start);
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Entry | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (start.trim()) void look(start);
    else input.current?.focus();
    return () => ctl.current?.abort();
  }, []);

  async function look(q: string) {
    const word = q.trim();
    if (!word || busy) return;
    setError(null);
    setFound(null);
    // a dictionary line with its meaning, typed by hand: no need to ask
    if (/[=—–]/.test(word)) {
      const res = fromLine(word, takenIds());
      if ("error" in res) setError(res.error);
      else setFound({ kind: "new", ...res });
      return;
    }
    const known = knownWord(word);
    if (known) return setFound({ kind: "known", entry: known });
    const card = cardOf(word);
    if (card) return setFound({ kind: "card", card });
    const sample = await sampler();
    if (!sample) {
      setError("Looking a word up works when this page is open on claude.ai. You can also type it with its meaning: gladius, gladiī, m. = sword");
      return;
    }
    setBusy(true);
    ctl.current = new AbortController();
    try {
      const raw = await sample.json(lookupPrompt(word, derived().words.map((w) => headword(w))), { ...coachOpts(), cache: false, signal: ctl.current.signal });
      const res = fromClaude(raw, takenIds());
      if ("error" in res) setError(res.error);
      else {
        // Claude may name a word the learner has already ("farmer" is agricola)
        const head = headword(res.entry);
        const again = knownWord(head);
        const asCard = again ? null : cardOf(head);
        setFound(again ? { kind: "known", entry: again } : asCard ? { kind: "card", card: asCard } : { kind: "new", ...res });
      }
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "cancelled") setError(sampleErrorText(code) || "Claude could not be asked. Try again.");
    } finally {
      setBusy(false);
      ctl.current = null;
    }
  }

  const add = () => {
    if (!found || found.kind === "known") return;
    if (found.kind === "card") {
      const id = found.card.id;
      update((p) => {
        if (!p.revealed.includes(id)) p.revealed.push(id);
        if (!p.added.includes(id)) p.added.push(id);
      });
      toast(`«${headword(found.card.entry)}» is in your words now.`);
    } else {
      const w = found.word;
      update((p) => void p.own.push(w));
      toast(`«${headword(found.entry)}» is in your words now.`);
    }
    close();
  };

  if (open) return <WordModal e={open} onClose={() => setOpen(null)} />;
  const entry = found?.kind === "card" ? found.card.entry : found?.entry;
  return (
    <Modal onClose={close} label="Add a word" screen="Add a word to my dictionary">
      <div class="stack add-word">
        <div class="spread">
          <h2>Add a word</h2>
          <button class="btn ghost small" onClick={close} aria-label="Close"><Icon.close /></button>
        </div>
        <form
          class="row add-word-ask"
          onSubmit={(e) => {
            e.preventDefault();
            void look(text);
          }}
        >
          <input
            ref={input}
            id="add-word-input"
            class="input"
            value={text}
            placeholder="A Latin word, or an English, Russian, Ukrainian one"
            autocomplete="off"
            autocapitalize="off"
            spellcheck={false}
            onInput={(e) => setText((e.target as HTMLInputElement).value)}
          />
          <button type="submit" class="btn" disabled={!text.trim() || busy}>{busy ? "Looking…" : "Look it up"}</button>
        </form>
        {busy && <p class="muted small" role="status">Claude is filling in the card; the grammar engine then checks every form…</p>}
        {error && <p class="small well">{error}</p>}
        {found?.kind === "known" && (
          <div class="well stack" style={{ gap: "6px" }}>
            <p>
              <LatinText text={dictionaryForm(found.entry)} /> ({found.entry.en}) is in your words already.
            </p>
            <div><button class="btn small" onClick={() => setOpen(found.entry)}>Open it</button></div>
          </div>
        )}
        {entry && found?.kind !== "known" && (
          <>
            <WordPreview e={entry} card={found?.kind === "card" ? found.card : undefined} byHand={found?.kind === "new" && !found.word.practice && found.word.kind !== "fixed"} />
            <div class="row">
              <button id="add-word-confirm" class="btn gold" onClick={add}>
                <Icon.plus /> Add to my words
              </button>
              <button class="btn ghost" onClick={() => { setFound(null); setText(""); input.current?.focus(); }}>Another word</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/** The card the learner sees before adding: the word, its forms, where it comes from, its family, examples. */
function WordPreview({ e, card, byHand }: { e: Entry; card?: Card; byHand?: boolean }) {
  const st = e.story;
  const family = (r?: { en?: string[]; ru?: string[]; uk?: string[] }) => [...(r?.en ?? []), ...(r?.ru ?? []), ...(r?.uk ?? [])].join(", ");
  const from = family(st?.from ?? card?.from);
  const kin = family(st?.kin ?? card?.kin);
  return (
    <div class="word-preview stack">
      <div>
        <span class="latin latin-lg"><LatinText text={dictionaryForm(e).replace(/, (m|f|n)\.$/, "")} /></span>
        <div>
          {e.kind === "noun" ? `${e.gender === "m" ? "masculine" : e.gender === "f" ? "feminine" : "neuter"} noun · ` : e.kind === "verb" ? "verb · " : e.kind === "adj" ? "adjective · " : ""}
          {e.en}
          {e.alt?.length ? <span class="muted">, {e.alt.join(", ")}</span> : null}
        </div>
      </div>
      {e.note && <p class="small well">{e.note}</p>}
      <Forms e={e} />
      {!usableNow(e) && e.kind !== "fixed" && <p class="small muted">Its endings come in a later lesson: until then you meet it in your words, word reviews, Ask Claude and the messenger.</p>}
      {byHand && <p class="small muted">Typed in by hand: for reading and word reviews (made-up sentences need to know what it goes with).</p>}
      {st?.origin && <p class="labelled"><span class="label">Origin</span> {st.origin}</p>}
      {st?.history && <p class="labelled"><span class="label">History</span> {st.history}</p>}
      {card?.hook && <p class="labelled"><span class="label">Remember</span> {card.hook}</p>}
      {(from || kin) && (
        <p class="labelled">
          <span class="label">Family</span> {from}
          {kin && <span class="muted">{from ? " · " : ""}same ancient root: {kin}</span>}
        </p>
      )}
      {!!st?.examples?.length && (
        <div class="stack" style={{ gap: "2px" }}>
          {st.examples.map((x) => (
            <div key={x.la} class="ex-line">
              <LatinText text={x.la} />
              <span class="muted">{x.en}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
