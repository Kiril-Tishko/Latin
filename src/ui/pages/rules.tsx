// All the rules learned so far, the color legend, and the ending tables.
import { LESSONS } from "../../content/lessons";
import { LESSON_WORDS } from "../../content/words";
import { conjugate, declineNoun } from "../../latin/morph";
import { nounSkill } from "../../latin/skills";
import { roman } from "../../latin/text";
import { Case, CASE_NAMES, CASE_ROLE, CASE_SLAVIC, full, NounEntry, NounKey, PN, VerbEntry, VerbKey } from "../../latin/types";
import { CaseChip } from "../components";
import { LatinTokens } from "../latin";
import { derived, useProgress } from "../store";
import { RuleView } from "./lessons";

const word = (id: string) => Object.values(LESSON_WORDS).flat().find((w) => w.id === id)!;

function NounTable() {
  const k = derived().knowledge;
  const cols = ["puella", "amicus", "liber", "vinum"].map((id) => word(id) as NounEntry);
  const rows: [Case, "sg" | "pl"][] = [["nom", "sg"], ["acc", "sg"], ["gen", "sg"], ["abl", "sg"], ["nom", "pl"]];
  return (
    <div class="table-wrap">
      <table class="paradigm">
        <thead>
          <tr>
            <th></th>
            <th>-a (1st)</th>
            <th>-us (2nd)</th>
            <th>-er (2nd)</th>
            <th>-um (2nd, neuter)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([c, n]) => (
            <tr key={c + n}>
              <th>
                <CaseChip c={c} label={`${CASE_NAMES[c]}${n === "pl" ? " plural" : ""}`} />
              </th>
              {cols.map((e) => {
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

function VerbTable() {
  const k = derived().knowledge;
  const cols = ["laboro", "doceo", "scribo", "dormio", "sum", "possum"].map((id) => word(id) as VerbEntry);
  const rows: [PN | "inf", string][] = [["1sg", "ego"], ["2sg", "tū"], ["3sg", "he / she / it"], ["3pl", "they"], ["inf", "to …"]];
  return (
    <div class="table-wrap">
      <table class="paradigm">
        <thead>
          <tr>
            <th></th>
            <th>1st</th>
            <th>2nd</th>
            <th>3rd</th>
            <th>4th</th>
            <th>to be</th>
            <th>can</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([pn, label]) => (
            <tr key={pn}>
              <th>{label}</th>
              {cols.map((v) => {
                const key = (pn === "inf" ? "inf" : `pres.${pn}`) as VerbKey;
                const form = conjugate(v)[key];
                const known = pn === "inf" ? k.skills.has("v.inf") : k.skills.has(`v.${pn}`) && (!v.irregular || pn.endsWith("sg"));
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
      <div class="stack" style={{ gap: "6px" }}>
        <span class="eyebrow">Rēgulae</span>
        <h1>Rules</h1>
        <p class="muted prose">Everything the lessons have taught so far. Endings are colored by case everywhere on this site.</p>
      </div>

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
