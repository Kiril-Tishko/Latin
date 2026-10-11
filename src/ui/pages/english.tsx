// Latin in English: what English took from Latin (words, word parts, grammar
// rules, spelling, abbreviations) and how it came, tied to the learner's words
// and the endings they know. Each section is a part Ask Claude can see.
import { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { Relatives } from "../../content/deck";
import {
  ABBREVIATIONS, ASSIMILATION, ENGLISH_CASES, FROZEN_VERBS, GRAMMAR_RULES, GRAMMAR_TERMS, LATER_PLURALS, LATER_VERBS, PHRASES, PLURALS,
  PLURAL_TRAPS, PREFIXES, SPELLINGS, SUFFIXES, TABLE_PAIRS, THREE_LANGUAGES, TRIPLETS, WAVES, wordInEnglish,
} from "../../content/english";
import { LESSONS } from "../../content/lessons";
import { dictionaryForm } from "../../latin/morph";
import { roman } from "../../latin/text";
import { Entry } from "../../latin/types";
import { CaseChip, Icon } from "../components";
import { LatinText } from "../latin";
import { Inline } from "../markup";
import { go } from "../nav";
import { useScreen } from "../screen";
import { derived, useProgress } from "../store";
import { startSession } from "./train";

const SECTIONS: [string, string][] = [
  ["much", "More than half of English"],
  ["waves", "How Latin came to English"],
  ["yours", "Your words in English"],
  ["verbs", "Latin verbs inside English"],
  ["plurals", "Latin plurals in English"],
  ["rules", "Grammar rules from Latin"],
  ["parts", "Building words with Latin parts"],
  ["spelling", "Letters added for Latin"],
  ["terms", "Grammar words are Latin"],
  ["abbr", "Latin abbreviations"],
  ["phrases", "Latin phrases in English"],
  ["slavic", "Russian and Ukrainian"],
];

function Section({ id, children }: { id: string; children: ComponentChildren }) {
  const n = SECTIONS.findIndex(([s]) => s === id) + 1;
  const title = SECTIONS[n - 1][1];
  return (
    <section class="stack en-section" id={`en-${id}`} data-ask={title}>
      <h2>
        <span class="numeral" style={{ marginRight: "6px" }}>{roman(n)}</span> {title}
      </h2>
      {children}
    </section>
  );
}

/** An English word with its Latin ending in the ending's color (a plural underlined). */
function Ending({ word, ending, cls, pl }: { word: string; ending: string; cls: string; pl?: boolean }) {
  const stem = ending ? word.slice(0, word.length - ending.length) : word;
  return (
    <span class="latin" lang="en">
      <span class={`w${pl ? " pl" : ""}`}>
        {stem}
        {ending && <span class={`end ${cls}`}>{ending}</span>}
      </span>
    </span>
  );
}

/** A word with one silent letter marked. */
function Silent({ word, letter }: { word: string; letter: string }) {
  const i = word.indexOf(letter);
  return (
    <strong>
      {word.slice(0, i)}
      <span class="silent">{letter}</span>
      {word.slice(i + letter.length)}
    </strong>
  );
}

const plainDict = (e: Entry) => dictionaryForm(e).replace(/, (m|f|n)\.$/, "");

const LANGS: [keyof Relatives, string][] = [
  ["en", "EN"],
  ["ru", "RU"],
  ["uk", "UA"],
];

/** One of the learner's words: what it gave English (and Russian, Ukrainian), its cousins, its traps. */
function WordCard({ e }: { e: Entry }) {
  const rel = wordInEnglish(e.id);
  if (!rel) return null;
  const kin = LANGS.filter(([k]) => rel.kin?.[k]?.length);
  return (
    <div class="panel tight stack en-card" style={{ gap: "4px" }}>
      <div class="spread" style={{ alignItems: "baseline" }}>
        <LatinText text={plainDict(e)} />
        <span class="small muted">{e.en}</span>
      </div>
      {rel.from.en?.length ? (
        <div class="rel-line en-from">
          <span class="rel-lang">EN</span> {rel.from.en.join(", ")}
        </div>
      ) : (
        <div class="small muted">No common English word comes from it.</div>
      )}
      {LANGS.slice(1)
        .filter(([k]) => rel.from[k]?.length)
        .map(([k, label]) => (
          <div key={k} class="rel-line small">
            <span class="rel-lang">{label}</span> {rel.from[k]!.join(", ")}
          </div>
        ))}
      {kin.length > 0 && (
        <div class="small">
          <span class="muted">Same ancient root, not borrowed: </span>
          {kin.map(([k, label]) => `${label} ${rel.kin![k]!.join(", ")}`).join(" · ")}
        </div>
      )}
      {rel.trap && (
        <div class="small">
          <strong>Not related: </strong>
          {rel.trap}
        </div>
      )}
      {rel.note && <div class="small muted">{rel.note}</div>}
    </div>
  );
}

function YourWords() {
  const p = useProgress();
  const d = derived();
  // the current step's words first; every other lesson is a tap away
  const [filter, setFilter] = useState<number | "deck" | "all">(() => (p.lessonsDone.includes(p.focusLesson) ? p.focusLesson : "all"));
  const shown = d.words.filter((w) => {
    if (filter === "deck" ? !("deck" in w.source) : filter !== "all" && !("lesson" in w.source && w.source.lesson === filter)) return false;
    const rel = wordInEnglish(w.id);
    return !!rel && (!!rel.from.en?.length || !!rel.kin?.en?.length || !!rel.note);
  });
  return (
    <>
      <p class="prose">
        Every Latin word you know, with the English words that grew from it. Russian and Ukrainian words borrowed from it are added where they exist, and so are
        cousins: words from the same ancient root that were never borrowed.
      </p>
      <div class="spread">
        <div class="seg" role="group" aria-label="Which words">
          <button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All</button>
          {LESSONS.filter((l) => p.lessonsDone.includes(l.n)).map((l) => (
            <button key={l.n} aria-pressed={filter === l.n} onClick={() => setFilter(l.n)}>{roman(l.n)}</button>
          ))}
          <button aria-pressed={filter === "deck"} onClick={() => setFilter("deck")}>Discovered ({d.added.length})</button>
        </div>
        <button class="btn ghost small" onClick={practise}>
          <Icon.stylus /> Find the Latin
        </button>
      </div>
      <div class="grid-2">
        {shown.map((w) => (
          <WordCard key={w.id} e={w} />
        ))}
      </div>
      {!shown.length && <p class="muted small">Nothing here yet: open some cards in Inventiō and add them to your dictionary.</p>}
    </>
  );
}

function practise() {
  if (startSession({ kind: "english" })) go({ page: "train" });
}

export function English() {
  useProgress();
  const known = derived().knowledge.skills;
  useScreen("page", "Latin in English", () =>
    "The page 'Latin in English' (an extra next to the lessons): how much of English comes from Latin, how Latin came in waves, the learner's own Latin words with the English (and Russian, Ukrainian) words from them, Latin verb forms and plurals inside English, grammar rules English took from Latin, Latin word parts, letters added to English spelling, grammar terms, abbreviations, everyday Latin phrases, and Russian / Ukrainian parallels.",
  );
  const youKnow = (skill?: string) => !!skill && known.has(skill);
  return (
    <div class="stack-lg english">
      <div class="stack" style={{ gap: "10px" }} data-ask="Latin in English: introduction">
        <button class="linkish" style={{ alignSelf: "flex-start" }} onClick={() => go({ page: "lessons" })}>← All lessons</button>
        <span class="eyebrow">Vestīgia Latīna · Latin footprints</span>
        <h1>Latin in English</h1>
        <p class="muted prose dropcap">
          English is a Germanic language, a sister of German and Dutch, yet most of its dictionary is Latin. The words came in waves over two thousand years, and
          with them came word parts, plurals, spellings and even rules of grammar. Here is what English took, and what you can already recognise with the Latin
          you know.
        </p>
        <div class="row">
          <button class="btn" onClick={practise}>
            <Icon.play /> Practise: find the Latin in English words
          </button>
        </div>
        <nav class="en-toc" aria-label="On this page">
          {SECTIONS.map(([id, title], i) => (
            <button key={id} class="chip en-toc-item" onClick={() => document.getElementById(`en-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              {roman(i + 1)} · {title}
            </button>
          ))}
        </nav>
      </div>

      <Section id="much">
        <div class="prose stack">
          <p>
            Count the words in a big English dictionary and about <strong>six in ten</strong> come from Latin: half of them straight from Latin, half through
            French, Latin's daughter. Old English and other Germanic languages give about a quarter, Greek about one word in twenty.
          </p>
          <p class="small muted">
            From a count of 80,000 words of the Shorter Oxford Dictionary (Finkenstaedt and Wolff, 1973): Latin 28%, French 28%, Germanic 25%, Greek 5%; the rest
            from other languages, from names, or unknown.
          </p>
          <p>
            Yet the words you use most are Old English: <em>the, and, is, I, you, eat, drink, sleep, water</em>. Latin gave English its longer, more learned
            words. <em>The teacher teaches</em> is all Old English; in <em>the student studies</em> both words come from <Inline text="«studeō»" />.
          </p>
        </div>
        <h3>Three words for one thing</h3>
        <p class="small muted">The Old English word is plain, the French one a little finer, the Latin one learned and formal.</p>
        <div class="table-wrap">
          <table class="paradigm">
            <thead>
              <tr>
                <th>Old English</th>
                <th>French</th>
                <th>Latin</th>
              </tr>
            </thead>
            <tbody>
              {TRIPLETS.map((t) => (
                <tr key={t[0]}>
                  {t.map((w) => <td key={w}>{w}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>On the farm, on the table</h3>
        <p class="small">
          After 1066 English peasants kept the animals and Norman lords ate them: the animal kept its English name, and its meat got a French one, from Latin.
        </p>
        <div class="table-wrap">
          <table class="paradigm">
            <thead>
              <tr>
                <th>On the farm</th>
                <th>On the table</th>
                <th>Latin</th>
              </tr>
            </thead>
            <tbody>
              {TABLE_PAIRS.map((t) => (
                <tr key={t.animal}>
                  <td>{t.animal}</td>
                  <td>{t.meat}</td>
                  <td><Inline text={t.latin} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="waves">
        <ol class="en-waves">
          {WAVES.map((w) => (
            <li key={w.title} class="panel stack" style={{ gap: "6px" }}>
              <span class="eyebrow">{w.when}</span>
              <h3>{w.title}</h3>
              <p><Inline text={w.text} /></p>
              <ul class="en-pairs">
                {w.words.map(([en, la, gloss]) => (
                  <li key={en}>
                    <strong>{en}</strong> <span class="muted">←</span> <LatinText text={la} />
                    {gloss && (
                      <span class="small muted">
                        , <Inline text={gloss} />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="yours">
        <YourWords />
      </Section>

      <Section id="verbs">
        <p class="prose">
          You know the endings that say who acts: <Inline text="«labōrō», «labōrās», «labōrat», «labōrant»" />. English has whole Latin verb forms frozen
          inside it, endings and all.
        </p>
        {FROZEN_VERBS.map((g) => (
          <div key={g.ending} class="stack" style={{ gap: "8px" }}>
            <h3>
              <span class="chip case c-verb" style={{ marginRight: "4px" }}>{g.ending}</span> {g.who}{" "}
              <span class="small muted ui" style={{ marginLeft: "4px" }}>{youKnow(g.skill) ? "· you know this ending" : "· an ending for later"}</span>
            </h3>
            <div class="grid-3">
              {g.items.map((v) => (
                <div key={v.en} class="panel tight stack" style={{ gap: "4px" }}>
                  <span class="latin-lg"><Ending word={v.en} ending={v.ending} cls="c-verb" /></span>
                  <span>
                    <Inline text={v.la} />: <em>{v.meaning}</em>
                  </span>
                  {v.note && <span class="small muted"><Inline text={v.note} /></span>}
                </div>
              ))}
            </div>
          </div>
        ))}
        <h3>Forms for later</h3>
        <ul class="en-list">
          {LATER_VERBS.map((v) => (
            <li key={v.en}>
              <strong>{v.en}</strong>: {v.la}, <em>{v.meaning}</em>. {v.note && <Inline text={v.note} />}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="plurals">
        <p class="prose">English kept some Latin plurals, and you already know the first two.</p>
        {PLURALS.map((g) => (
          <div key={g.sg} class="stack" style={{ gap: "8px" }}>
            <h3>
              -{g.sg} → -{g.pl}{" "}
              <span class="small muted ui" style={{ marginLeft: "4px" }}>
                {g.known && youKnow(g.skill) ? (
                  <>
                    · you know it: <Inline text={g.known} />
                  </>
                ) : g.known ? (
                  <>
                    · like <Inline text={g.known} />
                  </>
                ) : (
                  "· the neuter plural, for later"
                )}
              </span>
            </h3>
            <ul class="en-pairs">
              {g.pairs.map(([sg, pl]) => (
                <li key={sg}>
                  <Ending word={sg} ending={g.sg} cls="c-nom" /> <span class="muted">→</span> <Ending word={pl} ending={g.pl} cls="c-nom" pl />
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p class="small">
          <span class="muted">Later declensions: </span>
          {LATER_PLURALS.map(([sg, pl]) => `${sg} → ${pl}`).join(", ")}.
        </p>
        <h3>Watch out</h3>
        <ul class="en-list">
          {PLURAL_TRAPS.map((t) => (
            <li key={t}><Inline text={t} /></li>
          ))}
        </ul>
      </Section>

      <Section id="rules">
        <p class="prose">
          From the 1600s on, English grammarians admired Latin and wrote rules to make English behave more like it. Some stuck, most are now ignored. One case
          is the other way round: English cases are not borrowed at all, but cousins of the Latin ones.
        </p>
        {GRAMMAR_RULES.map((r) => (
          <article key={r.id} class="panel stack">
            <h3>{r.title}</h3>
            <dl class="rule-block">
              <dt>Latin</dt>
              <dd><Inline text={r.latin} /></dd>
              <dt>English</dt>
              <dd><Inline text={r.english} /></dd>
              <dt>Today</dt>
              <dd><Inline text={r.today} /></dd>
              {r.slavic && (
                <>
                  <dt>RU · UA</dt>
                  <dd><Inline text={r.slavic} /></dd>
                </>
              )}
            </dl>
            {r.id === "who-whom" && <EnglishCases />}
          </article>
        ))}
      </Section>

      <Section id="parts">
        <p class="prose">
          English builds new words with Latin parts all the time (<em>postwar, supermarket, rewrite</em>). Most prefixes are Latin prepositions, two of them
          yours: <Inline text="«ad»" /> and <Inline text="«in»" />.
        </p>
        <div class="table-wrap">
          <table class="paradigm">
            <thead>
              <tr>
                <th>Prefix</th>
                <th>Means</th>
                <th>In English</th>
              </tr>
            </thead>
            <tbody>
              {PREFIXES.map((x) => (
                <tr key={x.prefix}>
                  <td><strong>{x.prefix}</strong></td>
                  <td>{x.meaning}</td>
                  <td>{x.examples}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>The sound rule English kept</h3>
        <p class="small">
          In Latin a prefix changes its last sound to suit the next one, which is why English says <em>impossible</em> and <em>illegal</em> but <em>inactive</em>.
        </p>
        <ul class="en-pairs">
          {ASSIMILATION.map((x) => (
            <li key={x.word}>
              <Inline text={x.parts} /> <span class="muted">→</span> <strong>{x.word}</strong>{" "}
              <span class="small muted">({x.rule})</span>
            </li>
          ))}
        </ul>
        <h3>Endings that build words</h3>
        <div class="table-wrap">
          <table class="paradigm">
            <thead>
              <tr>
                <th>Ending</th>
                <th>Means</th>
                <th>From your words</th>
              </tr>
            </thead>
            <tbody>
              {SUFFIXES.map((x) => (
                <tr key={x.suffix}>
                  <td><strong>{x.suffix}</strong></td>
                  <td>{x.meaning}</td>
                  <td><Inline text={x.examples} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="spelling">
        <p class="prose">
          Around 1500 scholars respelled English words to show their Latin parents, adding letters that nobody pronounces. Twice they picked the wrong parent.
        </p>
        <ul class="en-list">
          {SPELLINGS.map((x) => (
            <li key={x.word}>
              <Silent word={x.word} letter={x.letter} /> <span class="muted">was</span> {x.before}
              {x.wrong ? <span class="muted">; the {x.letter} came from </span> : <span class="muted">; Latin </span>}
              <Inline text={x.latin} />
            </li>
          ))}
        </ul>
      </Section>

      <Section id="terms">
        <p class="prose">The words you learn grammar with are Latin too, and say what they mean.</p>
        <div class="table-wrap">
          <table class="paradigm">
            <thead>
              <tr>
                <th>Term</th>
                <th>Latin</th>
                <th>Literally</th>
              </tr>
            </thead>
            <tbody>
              {GRAMMAR_TERMS.map((x) => (
                <tr key={x.term}>
                  <td><strong>{x.term}</strong></td>
                  <td><span class="latin">{x.latin}</span></td>
                  <td><Inline text={x.meaning} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="abbr">
        <div class="table-wrap">
          <table class="paradigm">
            <thead>
              <tr>
                <th>Short</th>
                <th>Latin</th>
                <th>Means</th>
              </tr>
            </thead>
            <tbody>
              {ABBREVIATIONS.map((x) => (
                <tr key={x.abbr}>
                  <td><strong>{x.abbr}</strong></td>
                  <td><span class="latin"><Inline text={x.latin} /></span></td>
                  <td><Inline text={x.meaning} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="phrases">
        <p class="prose">Latin English uses every day, many of them with grammar you already know.</p>
        <div class="grid-3">
          {PHRASES.map((x) => (
            <div key={x.la} class="panel tight stack" style={{ gap: "2px" }}>
              <LatinText text={x.la} cls="latin-lg" />
              <span>{x.en}</span>
              {x.note && <span class="small muted"><Inline text={x.note} /></span>}
            </div>
          ))}
        </div>
      </Section>

      <Section id="slavic">
        <div class="prose stack">
          <p>
            Russian and Ukrainian took the same Latin words later, mostly from the 1600s on, through Polish, German and French, and through schools that taught in
            Latin, such as the Kyiv-Mohyla Academy. That is why so many learned words are shared by all three languages. Church words are the exception: the
            Slavs took them from Greek, where English took them from Latin.
          </p>
        </div>
        <div class="table-wrap">
          <table class="paradigm">
            <thead>
              <tr>
                <th>Latin</th>
                <th>English</th>
                <th>Russian</th>
                <th>Ukrainian</th>
              </tr>
            </thead>
            <tbody>
              {THREE_LANGUAGES.map((x) => (
                <tr key={x.word + x.en}>
                  <td><Inline text={x.la} /></td>
                  <td>{x.en}</td>
                  <td>{x.ru}</td>
                  <td>{x.uk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div class="row">
          <button class="btn" onClick={practise}>
            <Icon.play /> Practise: find the Latin in English words
          </button>
        </div>
      </Section>
    </div>
  );
}

/** English pronouns that still change for case, in the case colors. */
function EnglishCases() {
  return (
    <div class="stack" style={{ gap: "8px" }}>
      <div class="table-wrap">
        <table class="paradigm">
          <thead>
            <tr>
              <th><CaseChip c="nom" label="subject" /></th>
              <th><CaseChip c="acc" label="object" /></th>
              <th><CaseChip c="gen" label="whose" /></th>
            </tr>
          </thead>
          <tbody>
            {ENGLISH_CASES.map(([n, a, g]) => (
              <tr key={n}>
                <td><span class="end c-nom">{n}</span></td>
                <td><span class="end c-acc">{a}</span></td>
                <td><span class="end c-gen">{g}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <span class="end c-nom">He</span> sees <span class="end c-acc">him</span>: the form shows who does what, as in <Inline text="«Magistra discipulam docet»" />.
        The girl<span class="end c-gen">'s</span> letter: <Inline text="«epistula puellae#gen.sg»" />.
      </p>
    </div>
  );
}
