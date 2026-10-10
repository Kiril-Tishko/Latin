// My dictionary: every word from the lessons plus the cards added from
// Discover, with strength, forms and spaced review.
import { useState } from "preact/hooks";
import { CARD_BY_ID } from "../../content/deck";
import { LESSONS } from "../../content/lessons";
import { STORY_ONLY } from "../../content/words";
import { conjugate, declineAdj, declineNoun, dictionaryForm } from "../../latin/morph";
import { nounSkill, adjDecl } from "../../latin/skills";
import { roman } from "../../latin/text";
import { Case, CASE_NAMES, Entry, full, Gender, NounKey, PN, VerbKey } from "../../latin/types";
import { dueWords, strength } from "../../trainer/srs";
import { openAsk } from "../ask";
import { Icon, Modal, Mosaic } from "../components";
import { LatinTokens } from "../latin";
import { go } from "../nav";
import { derived, useProgress } from "../store";
import { startSession } from "./train";
import { Speak } from "../speak";

const CASE_ORDER: Case[] = ["nom", "acc", "gen", "abl", "dat", "voc"];
const PN_ROWS: [PN, string][] = [
  ["1sg", "ego (I)"],
  ["2sg", "tū (you)"],
  ["3sg", "he / she / it"],
  ["1pl", "we"],
  ["2pl", "you (pl.)"],
  ["3pl", "they"],
];

function Forms({ e }: { e: Entry }) {
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

function WordModal({ e, onClose }: { e: Entry; onClose: () => void }) {
  const card = CARD_BY_ID.get(e.id);
  return (
    <Modal onClose={onClose} label={e.en}>
      <div class="stack">
        <div class="spread">
          <div class="stack" style={{ gap: "2px" }}>
            <span>
              <span class="latin latin-lg">{dictionaryForm(e).replace(/, (m|f|n)\.$/, "")}</span>
              <Speak text={dictionaryForm(e).replace(/, (m|f|n)\.$/, "")} id={`word-${e.id}`} />
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
        {card && <p class="small"><span class="eyebrow" style={{ marginRight: "8px" }}>Remember</span>{card.hook}</p>}
        <div class="row">
          <button class="btn ghost small" onClick={() => { onClose(); openAsk({ label: `Word: ${dictionaryForm(e)}`, detail: `The learner opened the dictionary entry ${dictionaryForm(e)} (${e.en}).` }, "How is this word used? Give me two short examples with words I know."); }}>
            <Icon.quill /> Ask Claude about it
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function Words() {
  const p = useProgress();
  const d = derived();
  const [filter, setFilter] = useState<number | "deck" | "all">("all");
  const [open, setOpen] = useState<Entry | null>(null);
  const vocab = d.words.filter((w) => w.kind !== "fixed" && !STORY_ONLY.has(w.id));
  const due = dueWords(p, vocab.map((w) => w.id)).length;
  const shown = vocab.filter((w) => filter === "all" || (filter === "deck" ? "deck" in w.source : "lesson" in w.source && w.source.lesson === filter));
  return (
    <div class="stack-lg">
      <div class="stack" style={{ gap: "6px" }}>
        <span class="eyebrow">Verba</span>
        <h1>My dictionary</h1>
        <p class="muted prose">Every word from the lessons you've watched, plus the cards you added. The tiles show how firmly each word sits.</p>
      </div>
      <div class="panel frame spread">
        <div class="stack" style={{ gap: "2px" }}>
          <h3>{due > 0 ? `${due} word${due === 1 ? "" : "s"} ready for review` : "All words reviewed for now"}</h3>
          <span class="small muted ui">{vocab.length} words · reviews are spaced so each word returns just before you'd forget it</span>
        </div>
        <button class="btn" disabled={!due} onClick={() => { startSession({ kind: "words" }); go({ page: "train" }); }}>Review now</button>
      </div>
      <div class="seg" role="group" aria-label="Filter words">
        <button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All</button>
        {LESSONS.filter((l) => p.lessonsDone.includes(l.n)).map((l) => (
          <button key={l.n} aria-pressed={filter === l.n} onClick={() => setFilter(l.n)}>Lesson {roman(l.n)}</button>
        ))}
        <button aria-pressed={filter === "deck"} onClick={() => setFilter("deck")}>Discovered ({d.added.length})</button>
      </div>
      <div class="grid-3">
        {shown.map((w) => (
          <button key={w.id} class="panel tight stack" style={{ gap: "6px", textAlign: "left", cursor: "pointer" }} onClick={() => setOpen(w)}>
            <span class="latin">{dictionaryForm(w).replace(/, (m|f|n)\.$/, "")}</span>
            <span class="small muted">{w.en}</span>
            <Mosaic value={strength(p.words[w.id])} tiles={6} thin />
          </button>
        ))}
        {!shown.length && <p class="muted">No words here yet. Open some cards in Discover.</p>}
      </div>
      {open && <WordModal e={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
