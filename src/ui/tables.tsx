// The endings at a glance: noun and verb tables of the lessons' words, with a ?
// for every form of a rule the learner has not learned yet.
import { LESSON_WORDS } from "../content/words";
import { conjugate, declineNoun } from "../latin/morph";
import { nounSkill } from "../latin/skills";
import { Knowledge } from "../latin/generate";
import { Case, CASE_NAMES, full, NounEntry, NounKey, PN, VerbEntry, VerbKey } from "../latin/types";
import { CaseChip } from "./components";
import { LatinTokens } from "./latin";
import { derived } from "./store";

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
                // esse and posse wait for sum and possum, like their other forms
                const own = !v.irregular || k.skills.has(`v.${v.irregular}`);
                const known = pn === "inf" ? k.skills.has("v.inf") && own : v.irregular ? own && pn.endsWith("sg") : k.skills.has(`v.${pn}`);
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
