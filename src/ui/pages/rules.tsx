// All the rules learned so far, the color legend, and the ending tables.
import { LESSONS } from "../../content/lessons";
import { LESSON_WORDS } from "../../content/words";
import { conjugate, declineNoun } from "../../latin/morph";
import { nounSkill } from "../../latin/skills";
import { roman } from "../../latin/text";
import { Knowledge } from "../../latin/generate";
import { Case, CASE_NAMES, CASE_ROLE, CASE_SLAVIC, full, NounEntry, NounKey, PN, VerbEntry, VerbKey } from "../../latin/types";
import { CaseChip } from "../components";
import { LatinTokens } from "../latin";
import { derived, useProgress } from "../store";
import { RuleView } from "./lessons";

const word = (id: string) => Object.values(LESSON_WORDS).flat().find((w) => w.id === id)!;

type NounRow = [Case, "sg" | "pl"];
const NOUN_ROWS: NounRow[] = [["nom", "sg"], ["acc", "sg"], ["gen", "sg"], ["abl", "sg"], ["nom", "pl"]];
// declensions and conjugations numbered the way Latin grammars do: I, II, III, IV
const NOUN_COLS: [string, string][] = [["puella", "I · -a"], ["amicus", "II · -us"], ["liber", "II · -er"], ["vinum", "II · -um (neuter)"]];

/** Noun endings, one column per pattern. Forms the learner has not met yet show as "?". */
export function NounTable({ rows = NOUN_ROWS, cols = NOUN_COLS.map(([id]) => id), k = derived().knowledge }: { rows?: NounRow[]; cols?: string[]; k?: Knowledge }) {
  const entries = NOUN_COLS.filter(([id]) => cols.includes(id)).map(([id, label]) => [word(id) as NounEntry, label] as const);
  return (
    <div class="table-wrap">
      <table class="paradigm">
        <thead>
          <tr>
            <th></th>
            {entries.map(([e, label]) => <th key={e.id} title={`${label.split(" · ")[0]} declension`}>{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(([c, n]) => (
            <tr key={c + n}>
              <th>
                <CaseChip c={c} label={`${CASE_NAMES[c]}${n === "pl" ? " plural" : ""}`} />
              </th>
              {entries.map(([e]) => {
                const key = `${c}.${n}` as NounKey;
                const form = declineNoun(e)[key];
                if (!form || !k.skills.has(nounSkill(e.decl, c, n))) return <td key={e.id} class="lock" title="Comes in a later lesson">?</td>;
                return (
                  <td key={e.id}>
                    <LatinTokens tokens={[{ text: full(form), role: "subj", analysis: { entry: e, key, gender: e.gender, form } }]} period={false} cap={false} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type VerbRow = PN | "inf";
const VERB_ROWS: [VerbRow, string][] = [["1sg", "ego"], ["2sg", "tū"], ["3sg", "he / she / it"], ["3pl", "they"], ["inf", "to …"]];
const VERB_COLS: [string, string][] = [["laboro", "I"], ["doceo", "II"], ["scribo", "III"], ["dormio", "IV"], ["sum", "to be"], ["possum", "can"]];

/** Present-tense verb endings, one column per pattern. */
export function VerbTable({ rows = VERB_ROWS.map(([r]) => r), cols = VERB_COLS.map(([id]) => id), k = derived().knowledge }: { rows?: VerbRow[]; cols?: string[]; k?: Knowledge }) {
  const entries = VERB_COLS.filter(([id]) => cols.includes(id)).map(([id, label]) => [word(id) as VerbEntry, label] as const);
  return (
    <div class="table-wrap">
      <table class="paradigm">
        <thead>
          <tr>
            <th></th>
            {entries.map(([v, label]) => <th key={v.id} title={/^[IV]+$/.test(label) ? `conjugation ${label}` : undefined}>{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {VERB_ROWS.filter(([pn]) => rows.includes(pn)).map(([pn, label]) => (
            <tr key={pn}>
              <th>{label}</th>
              {entries.map(([v]) => {
                const key = (pn === "inf" ? "inf" : `pres.${pn}`) as VerbKey;
                const form = conjugate(v)[key];
                const known = pn === "inf" ? k.skills.has("v.inf") : v.irregular ? k.skills.has(`v.${v.irregular}`) && pn.endsWith("sg") : k.skills.has(`v.${pn}`);
                if (!form || !known) return <td key={v.id} class="lock" title="Comes in a later lesson">?</td>;
                return (
                  <td key={v.id}>
                    <LatinTokens tokens={[{ text: full(form), role: "verb", analysis: { entry: v, key, form } }]} period={false} cap={false} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Rules() {
  const p = useProgress();
  const cases: Case[] = ["nom", "acc", "gen", "abl"];
  return (
    <div class="stack-lg">

      <section class="panel frame stack">
        <h2>Why endings matter</h2>
        <div class="prose stack">
          <p>
            English shows who does what by word order: <em>dog bites man</em> is not <em>man bites dog</em>. Latin shows it with endings, the
            way English does with <em>he → him</em>. Imagine English adding ‑um to the object: <em>dog bites manum</em>, <em>manum dog bites</em>,
            <em> bites manum dog</em> all mean the same thing.
          </p>
          <p class="small muted">
            From the channel's short video <a href="https://www.youtube.com/watch?v=TFf15Tt3ThI" target="_blank" rel="noopener">Understanding Latin Grammar</a>.
          </p>
        </div>
      </section>

      <section class="stack">
        <h2>The colors</h2>
        <div class="panel stack">
          {cases.map((c) => (
            <div key={c} class="spread" style={{ alignItems: "baseline" }}>
              <div class="row" style={{ gap: "10px" }}>
                <CaseChip c={c} />
                <span>{CASE_ROLE[c]}</span>
              </div>
              <span class="small muted ui">RU {CASE_SLAVIC[c].ru} · UA {CASE_SLAVIC[c].uk}</span>
            </div>
          ))}
          <div class="row" style={{ gap: "10px" }}>
            <CaseChip c="verb" />
            <span>verb endings: who is doing it (-ō, -s, -t, -nt)</span>
          </div>
          <p class="small muted">An underline marks a plural: <LatinTokens tokens={[{ text: "puellae", role: "subj", analysis: { entry: word("puella"), key: "nom.pl", gender: "f", form: { stem: "puell", ending: "ae" } } }]} period={false} cap={false} />. Hover over a word to see its form.</p>
        </div>
      </section>

      <section class="stack">
        <h2>Noun endings</h2>
        <p class="muted small">The review table from Lesson IV. A ? is a form you will meet in a later lesson.</p>
        <div class="panel"><NounTable /></div>
      </section>

      <section class="stack">
        <h2>Verb endings</h2>
        <p class="muted small">Present tense. The ending says who acts; the vowel before it depends on the verb's pattern.</p>
        <div class="panel"><VerbTable /></div>
      </section>

      {LESSONS.filter((l) => p.lessonsDone.includes(l.n)).map((l) => (
        <section key={l.n} class="stack">
          <h2>
            <span class="numeral" style={{ marginRight: "10px" }}>{roman(l.n)}</span>
            {l.title}
          </h2>
          {l.rules.map((r) => <RuleView key={r.id} r={r} />)}
        </section>
      ))}
    </div>
  );
}
