// My dictionary: every word from the lessons plus the cards added from
// Discover, with strength, forms and spaced review.
import { useMemo, useState } from "preact/hooks";
import { CHAT_WORD_LIST } from "../../chat/words";
import { CARD_BY_ID } from "../../content/deck";
import { LESSONS } from "../../content/lessons";
import { STORY_ONLY } from "../../content/words";
import { conjugate, declineAdj, declineNoun, dictionaryForm, headword as latinHeadword } from "../../latin/morph";
import { nounSkill, adjDecl } from "../../latin/skills";
import { latinKey, roman } from "../../latin/text";
import { Case, CASE_NAMES, Entry, full, Gender, NounKey, PN, VerbKey } from "../../latin/types";
import { seeded } from "../../latin/generate";
import { wordExamples } from "../../trainer/discover";
import { dueWords, strength } from "../../trainer/srs";
import { openAsk } from "../ask";
import { Icon, Modal, Mosaic } from "../components";
import { LatinText, LatinTokens } from "../latin";
import { go } from "../nav";
import { derived, update, useProgress } from "../store";
import { openAddWord } from "../addword";
import { startSession } from "./train";
import { Speak } from "../speak";
import { Sayings } from "../saying";
import { wordInEnglish } from "../../content/english";
import { useScreen } from "../screen";

const CASE_ORDER: Case[] = ["nom", "acc", "gen", "abl", "dat", "voc"];
const PN_ROWS: [PN, string][] = [
  ["1sg", "ego (I)"],
  ["2sg", "tū (you)"],
  ["3sg", "he / she / it"],
  ["1pl", "we"],
  ["2pl", "you (pl.)"],
  ["3pl", "they"],
];

export function Forms({ e }: { e: Entry }) {
  const k = derived().knowledge;
  if (e.kind === "noun" || e.kind === "adj") {
    const genders: Gender[] = e.kind === "adj" ? ["m", "f", "n"] : [e.gender];
    const rows = CASE_ORDER.filter((c) => c !== "dat" && c !== "voc");
    return (
      <div class="table-wrap">
        <table class="paradigm">
          <thead>
            <tr>
              <th>case</th>
              {genders.map((g) => (
                <th key={g} colSpan={2}>{e.kind === "adj" ? (g === "m" ? "masculine" : g === "f" ? "feminine" : "neuter") : "singular · plural"}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c}>
                <th>{CASE_NAMES[c]}</th>
                {genders.flatMap((g) =>
                  (["sg", "pl"] as const).map((n) => {
                    const key = `${c}.${n}` as NounKey;
                    const decl = e.kind === "noun" ? e.decl : adjDecl(g);
                    const form = e.kind === "noun" ? declineNoun(e)[key] : declineAdj(e, g)[key];
                    const knownSkill = k.skills.has(nounSkill(decl, c, n));
                    if (!form) return <td key={g + n} class="lock">–</td>;
                    if (!knownSkill) return <td key={g + n} class="lock" title="You'll learn this form in a later lesson">?</td>;
                    return (
                      <td key={g + n}>
                        <LatinTokens tokens={[{ text: full(form), role: "subj", analysis: { entry: e, key, gender: g, form } }]} period={false} cap={false} />
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (e.kind === "verb") {
    const forms = conjugate(e);
    const known = (pn: PN) => k.skills.has(`v.${pn}`) && (!e.irregular || pn.endsWith("sg"));
    return (
      <div class="table-wrap">
        <table class="paradigm">
          <thead>
            <tr><th>who</th><th>present</th></tr>
          </thead>
          <tbody>
            {PN_ROWS.map(([pn, label]) => {
              const key = `pres.${pn}` as VerbKey;
              const form = forms[key];
              return (
                <tr key={pn}>
                  <th>{label}</th>
                  {form && known(pn) ? (
                    <td><LatinTokens tokens={[{ text: full(form), role: "verb", analysis: { entry: e, key, form } }]} period={false} cap={false} /></td>
                  ) : (
                    <td class="lock" title="You'll learn this form in a later lesson">?</td>
                  )}
                </tr>
              );
            })}
            <tr>
              <th>infinitive</th>
              {forms.inf ? <td><LatinTokens tokens={[{ text: full(forms.inf), role: "inf", analysis: { entry: e, key: "inf", form: forms.inf } }]} period={false} cap={false} /></td> : <td class="lock">–</td>}
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}

/** A stable number for a word, to seed its examples. */
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 2147483647, 7);

export function WordModal({ e, onClose }: { e: Entry; onClose: () => void }) {
  const card = CARD_BY_ID.get(e.id);
  // two short, sensible sentences with words and grammar the learner knows; "Other examples" draws new ones
  const [round, setRound] = useState(0);
  const examples = useMemo(() => wordExamples(e, derived().knowledge, seeded(hash(e.id) + round * 7919), 2), [e.id, round]);
  return (
    <Modal onClose={onClose} label={e.en} screen={`Word: ${dictionaryForm(e)} (${e.en})`}>
      <div class="stack">
        <div class="spread">
          <div class="stack" style={{ gap: "2px" }}>
            <span>
              <span class="latin latin-lg">{dictionaryForm(e).replace(/, (m|f|n)\.$/, "")}</span>
              <Speak text={latinHeadword(e)} id={`word-${e.id}`} />
            </span>
            <span>
              {e.kind === "noun" ? `${e.gender === "m" ? "masculine" : e.gender === "f" ? "feminine" : "neuter"} noun · ` : ""}
              {e.en}
              {e.alt?.length ? <span class="muted">, {e.alt.join(", ")}</span> : null}
            </span>
          </div>
          <button class="btn ghost small" onClick={onClose} aria-label="Close"><Icon.close /></button>
        </div>
        {e.note && <p class="small well">{e.note}</p>}
        <Forms e={e} />
        {examples.length > 0 && (
          <div class="stack" style={{ gap: "2px" }}>
            <div class="spread">
              <span class="eyebrow" style={{ color: "var(--ink-2)" }}>Examples</span>
              <button class="linkish" onClick={() => setRound(round + 1)}>Other examples</button>
            </div>
            {examples.map((x, i) => (
              <div key={x.latin} class="ex-line">
                <span>
                  <LatinTokens tokens={x.tokens} />
                  <Speak text={x.latin} id={`word-${e.id}-ex-${i}`} />
                </span>
                <span class="muted">{x.english}</span>
              </div>
            ))}
          </div>
        )}
        {!examples.length && !!e.story?.examples?.length && (
          <div class="stack" style={{ gap: "2px" }}>
            <span class="eyebrow" style={{ color: "var(--ink-2)" }}>Examples</span>
            {e.story.examples.map((x) => (
              <div key={x.la} class="ex-line">
                <LatinText text={x.la} />
                <span class="muted">{x.en}</span>
              </div>
            ))}
          </div>
        )}
        <Sayings wordId={e.id} max={2} />
        {card && <p class="small"><span class="eyebrow" style={{ marginRight: "8px" }}>Remember</span>{card.hook}</p>}
        {e.story && <OwnStory e={e} />}
        <InEnglish e={e} onMore={() => { onClose(); go({ page: "english" }); }} />
        <div class="row">
          <button class="btn ghost small" onClick={() => openAsk({ label: `Word: ${dictionaryForm(e)}`, detail: `The learner opened the dictionary entry ${dictionaryForm(e)} (${e.en}).` }, "How is this word used? Give me two short examples with words I know.")}>
            <Icon.quill /> Ask Claude about it
          </button>
          {"own" in e.source && (
            <button
              class="btn ghost small"
              onClick={() => {
                if (!confirm(`Remove «${latinHeadword(e)}» from your words?`)) return;
                update((p) => void (p.own = p.own.filter((w) => w.id !== e.id)));
                onClose();
              }}
            >
              Remove from my words
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** A word the learner added: where it comes from and its story, as Claude told it. */
function OwnStory({ e }: { e: Entry }) {
  const st = e.story!;
  const family = (r?: { en?: string[]; ru?: string[]; uk?: string[] }) => [...(r?.en ?? []), ...(r?.ru ?? []), ...(r?.uk ?? [])].join(", ");
  const from = family(st.from);
  const kin = family(st.kin);
  return (
    <div class="small stack" style={{ gap: "4px" }}>
      {st.origin && <p class="labelled"><span class="label">Origin</span> {st.origin}</p>}
      {st.history && <p class="labelled"><span class="label">History</span> {st.history}</p>}
      {(from || kin) && (
        <p class="labelled">
          <span class="label">Family</span> {from}
          {kin && <span class="muted">{from ? " · " : ""}same ancient root: {kin}</span>}
        </p>
      )}
      <p class="muted">You added this word; Claude wrote its card.</p>
    </div>
  );
}

/** The English words a word gave, its cousins and its traps, with a way to the whole story. */
function InEnglish({ e, onMore }: { e: Entry; onMore: () => void }) {
  const rel = wordInEnglish(e.id);
  if (!rel || !(rel.from.en?.length || rel.kin?.en?.length)) return null;
  return (
    <div class="small stack" style={{ gap: "2px" }}>
      <div>
        <span class="eyebrow" style={{ marginRight: "8px" }}>In English</span>
        {rel.from.en?.join(", ")}
        {rel.kin?.en?.length ? <span class="muted">{rel.from.en?.length ? " · " : ""}same ancient root: {rel.kin.en.join(", ")}</span> : null}
      </div>
      {rel.trap && <div class="muted">Not related: {rel.trap}</div>}
      <div>
        <button class="linkish" onClick={onMore}>Latin in English</button>
      </div>
    </div>
  );
}

/** The one word shown on a tile: nominative, first person, or masculine form. */
export function headword(e: Entry): string {
  return e.kind === "verb" ? e.pp[0] : e.lemma;
}

function matches(e: Entry, q: string, formHits: Set<string>): boolean {
  if (!q) return true;
  const key = latinKey(q);
  const glosses = [e.en, ...(e.alt ?? [])].map((g) => g.toLowerCase());
  return (
    latinKey(headword(e)).includes(key) ||
    glosses.some((g) => g.includes(q.toLowerCase())) ||
    formHits.has(e.id)
  );
}

export function Words() {
  const p = useProgress();
  const d = derived();
  const [filter, setFilter] = useState<number | "deck" | "own" | "all" | "chat">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Entry | null>(null);
  const vocab = d.words.filter((w) => w.kind !== "fixed" && !STORY_ONLY.has(w.id));
  const due = dueWords(p, vocab.map((w) => w.id)).length;
  const q = query.trim();
  // typing any form finds its word: puellam -> puella, labōrant -> labōrō
  const formHits = new Set(q ? d.lexicon.analyze(q).map((a) => a.entry.id) : []);
  const shown = vocab.filter(
    (w) =>
      (filter === "all" || (filter === "deck" ? "deck" in w.source : filter === "own" ? "own" in w.source : filter !== "chat" && "lesson" in w.source && w.source.lesson === filter)) &&
      matches(w, q, formHits),
  );
  useScreen("page", "Words", () => {
    const which = filter === "all" ? "all words" : filter === "deck" ? "the words added from Discover" : filter === "own" ? "the words the learner added themselves" : filter === "chat" ? "the chat words of the messenger" : `the words of Lesson ${filter}`;
    const list = shown.slice(0, 40).map((w) => `${headword(w)} (${w.en})`).join(", ");
    return `The learner's dictionary: ${vocab.length} words, ${due} due for review. Showing ${which}${q ? `, searching "${q}"` : ""}: ${shown.length} word${shown.length === 1 ? "" : "s"}${shown.length ? `: ${list}${shown.length > 40 ? ", …" : ""}` : ""}.`;
  });
  return (
    <div class="stack">
      <div class="row word-search-row">
        <input
          id="word-search"
          class="search"
          type="search"
          value={query}
          placeholder="Quaere… search Latin (any form) or English"
          autocomplete="off"
          autocapitalize="off"
          spellcheck={false}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        <button id="add-word" class="btn gold" onClick={() => openAddWord(q && !shown.length ? q : "", "words")} title="Add any Latin word to your dictionary: Claude fills in its card">
          <Icon.plus /> Add a word
        </button>
      </div>
      <div class="spread">
        <div class="seg" role="group" aria-label="Filter words">
          <button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All</button>
          {LESSONS.filter((l) => p.lessonsDone.includes(l.n)).map((l) => (
            <button key={l.n} aria-pressed={filter === l.n} onClick={() => setFilter(l.n)}>{roman(l.n)}</button>
          ))}
          <button aria-pressed={filter === "deck"} onClick={() => setFilter("deck")}>Discovered ({d.added.length})</button>
          <button aria-pressed={filter === "own"} onClick={() => setFilter("own")} title="Words you added yourself">Yours ({d.own.length})</button>
          <button aria-pressed={filter === "chat"} onClick={() => setFilter("chat")} title="Words for chatting in Nūntiī">Chat ({CHAT_WORD_LIST.length})</button>
        </div>
        <button class="btn" disabled={!due} onClick={() => startSession({ kind: "words" }) && go({ page: "train" })}>
          {due > 0 ? `Review ${due} word${due === 1 ? "" : "s"}` : "Nothing to review"}
        </button>
      </div>
      {filter === "chat" && (
        <>
          <p class="small muted">Words for chatting with your friends in Nūntiī. The lessons have not taught them yet, so the messenger shows their meanings.</p>
          <div class="word-grid">
            {CHAT_WORD_LIST.filter((w) => matches(w, q, formHits)).map((w) => (
              <div key={w.id} class="panel word-tile">
                <span class="head latin" lang="la">{headword(w)}</span>
                <span class="gloss">{w.en}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <div class="word-grid">
        {filter !== "chat" && shown.map((w) => (
          <button key={w.id} class="panel word-tile" onClick={() => setOpen(w)}>
            <span class="head latin" lang="la">{headword(w)}</span>
            <span class="gloss">{w.en}</span>
            <Mosaic value={strength(p.words[w.id])} tiles={6} thin />
          </button>
        ))}
      </div>
      {!shown.length && filter !== "chat" && (
        <p class="muted">
          {q ? <>Nothing found for "{q}". <button class="linkish" onClick={() => openAddWord(q, "words")}>Add «{q}» to your words</button></> : filter === "own" ? "No words of your own yet: add one with Add a word." : "No words here yet. Open some cards in Discover."}
        </p>
      )}
      {open && <WordModal e={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
