// Rēgulae: every rule of the lessons watched, one line each (a tap opens the
// rule's own page), then the ending tables and the colors.
import { LESSONS } from "../../content/lessons";
import { LESSON_WORDS } from "../../content/words";
import { conjugate, declineNoun } from "../../latin/morph";
import { nounSkill } from "../../latin/skills";
import { roman } from "../../latin/text";
import { Knowledge } from "../../latin/generate";
import { Case, CASE_NAMES, full, NounEntry, NounKey, PN, VerbEntry, VerbKey } from "../../latin/types";
import { CaseChip, Icon } from "../components";
import { LatinTokens } from "../latin";
import { derived, useProgress } from "../store";
import { partName, RuleList, rightWords } from "./learn";
import { Part, partsOf } from "../../content/parts";
import { currentPart, partState } from "../../trainer/path";
import { useScreen } from "../screen";
import { go } from "../nav";

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

/** Rēgulae: every rule of the lessons watched, one line each, then the endings at a glance. */
export function Rules() {
  const p = useProgress();
  const k = derived().seenKnowledge;
  const lessons = LESSONS.filter((l) => p.lessonsDone.includes(l.n));
  const current = currentPart(p);
  const stateWords = (x: Part) => (partState(p, x) === "learned" ? "learned" : partState(p, x) === "practising" ? rightWords(p, x) : "new");
  useScreen("page", "Rules", () =>
    [
      "The rules page: every rule of the lessons watched, one line each, grouped by lesson (a tap opens the rule: its simple explanation, its questions, its practice, and the lesson's full text under More detail). Below: the endings at a glance (a ? is a form of a rule not learned yet) and the case colors.",
      ...lessons.map((l) => `Lesson ${l.n} (${l.title}): ${partsOf(l.n).map((x) => `${x.id} ${x.title} (${stateWords(x)})`).join("; ")}`),
    ].join("\n"),
  );
  return (
    <div class="stack-lg rules-page">
      <div class="stack" style={{ gap: "8px" }}>
        <span class="eyebrow">Rēgulae</span>
        <h1>Your rules</h1>
        <p class="muted">Every rule of the lessons you watched, one line each. Tap a rule to read it and practise it.</p>
        {current && (
          <div class="row">
            <button class="btn" onClick={() => go({ page: "learn", id: current.id })}>
              {partState(p, current) === "new" ? "Next to learn" : "Continue"}: {partName(current)} · {current.title} <Icon.arrow />
            </button>
          </div>
        )}
      </div>

      {lessons.map((l) => {
        const parts = partsOf(l.n);
        const learned = parts.filter((x) => partState(p, x) === "learned").length;
        return (
          <section key={l.n} class="stack rules-lesson" data-ask={`Rules of Lesson ${roman(l.n)}`}>
            <div class="spread rules-lesson-head">
              <h2>
                <span class="numeral">{roman(l.n)}</span> {l.title}
              </h2>
              <span class="small ui muted">
                {learned === parts.length ? <span class="story-read"><Icon.check /> all learned</span> : `${learned} of ${parts.length} learned`}
              </span>
            </div>
            <div class="panel rule-list-panel">
              <RuleList lesson={l.n} />
            </div>
          </section>
        );
      })}

      <section class="stack" data-ask="Endings at a glance">
        <h2>Endings at a glance</h2>
        <p class="muted small">A ? is a form of a rule you have not learned yet.</p>
        <div class="panel stack">
          <h3>Nouns</h3>
          <NounTable k={k} />
        </div>
        <div class="panel stack">
          <h3>Verbs</h3>
          <VerbTable k={k} />
        </div>
        <div class="row color-key small ui">
          <span>Colors:</span>
          <CaseChip c="nom" label="subject" />
          <CaseChip c="acc" label="object" />
          <CaseChip c="gen" label="of / 's" />
          <CaseChip c="abl" label="in / at" />
          <CaseChip c="verb" label="who does it" />
          <span>An underline marks a plural.</span>
        </div>
      </section>

      <details class="rule-more" data-ask="Why endings matter">
        <summary>Why endings matter</summary>
        <div class="prose stack" style={{ marginTop: "10px" }}>
          <p>
            English shows who does what by word order: <em>dog bites man</em> is not <em>man bites dog</em>. Latin shows it with endings, the
            way English does with <em>he → him</em>. Imagine English adding ‑um to the object: <em>dog bites manum</em>, <em>manum dog bites</em>,
            <em> bites manum dog</em> all mean the same thing.
          </p>
          <p class="small muted">
            From the channel's short video <a href="https://www.youtube.com/watch?v=TFf15Tt3ThI" target="_blank" rel="noopener">Understanding Latin Grammar</a>.
          </p>
        </div>
      </details>

      <p class="small">
        <button class="linkish" onClick={() => go({ page: "english" })}>The Latin rules inside English →</button>
      </p>
    </div>
  );
}
