// Latin with colored endings. Every inflected word shows its stem in ink and
// its ending in the color of its case (verbs: teal); plurals are underlined.
import { Fragment } from "preact";
import { Analysis, annotate, caseOf, numOf } from "../latin/analyze";
import { LToken } from "../latin/generate";
import { describe } from "../latin/check";
import { capitalize, stripMarks } from "../latin/text";
import { derived, getProgress } from "./store";

const show = (s: string) => (getProgress().settings.macrons ? s : stripMarks(s));

function colorClass(a?: Analysis): string {
  if (!a) return "";
  if (a.entry.kind === "verb") return "c-verb";
  const c = caseOf(a);
  return c ? `c-${c}` : "";
}

function tooltip(a?: Analysis): string | undefined {
  if (!a || a.entry.kind === "fixed") return a ? a.entry.en : undefined;
  return `${a.entry.en}: ${describe(a)}`;
}

export function Word({ text, analysis, blank, plain }: { text: string; analysis?: Analysis; blank?: boolean; plain?: boolean }) {
  const a = analysis;
  if (!a || a.entry.kind === "fixed") return <span class="w" title={tooltip(a)}>{show(text)}</span>;
  const cls = colorClass(a);
  const plural = numOf(a) === "pl" && a.entry.kind !== "verb" ? " pl" : "";
  const { stem, ending } = a.form;
  // keep the learner's capitalization (first word of a sentence)
  const cap = text[0] !== stem[0] && text[0]?.toLowerCase() === stem[0];
  const s = cap ? capitalize(stem) : stem;
  if (blank) {
    return (
      <span class="w" title="fill in the ending">
        {show(s)}
        <span class="blank">?</span>
      </span>
    );
  }
  if (!ending) {
    return (
      <span class={`w zero ${plain ? "" : cls}`} title={tooltip(a)}>
        {show(text)}
      </span>
    );
  }
  return (
    <span class={`w${plural}`} title={tooltip(a)}>
      {show(s)}
      <span class={`end ${cls}`}>{show(ending)}</span>
    </span>
  );
}

/** A generated sentence, word by word. */
export function LatinTokens({ tokens, blank, plain, period = true, cap = true, cls = "" }: { tokens: LToken[]; blank?: number; plain?: boolean; period?: boolean; cap?: boolean; cls?: string }) {
  return (
    <span class={`latin ${plain ? "plain" : ""} ${cls}`} lang="la">
      {tokens.map((t, i) => (
        <Fragment key={i}>
          {i > 0 && " "}
          <Word text={i === 0 && cap ? capitalize(t.text) : t.text} analysis={t.analysis} blank={i === blank} plain={plain} />
        </Fragment>
      ))}
      {period && "."}
    </span>
  );
}

/** Any Latin text (lesson sentences, Claude's answers). Unknown words are shown plain. */
export function LatinText({ text, plain, cls = "" }: { text: string; plain?: boolean; cls?: string }) {
  const tokens = annotate(text, derived().lexicon);
  return (
    <span class={`latin ${plain ? "plain" : ""} ${cls}`} lang="la">
      {tokens.map((t, i) =>
        t.isWord ? <Word key={i} text={t.text} analysis={t.analysis} plain={plain} /> : <Fragment key={i}>{t.text}</Fragment>,
      )}
    </span>
  );
}
