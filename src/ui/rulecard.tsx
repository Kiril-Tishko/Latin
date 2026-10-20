// The rule behind an exercise, for its Rule button: the part (or two) of the
// lessons' rules that teach what the exercise practises, in the same simple
// words as on the page where it was learned.
import { Part, PARTS } from "../content/parts";
import { SKILL_BY_ID } from "../latin/skills";
import { joinEndings } from "./components";
import { LatinText } from "./latin";
import { Inline } from "./markup";

/** The parts that teach any of these rules: the part being practised first, then the newest. */
export function partsFor(skills: string[], first?: string): Part[] {
  const own = PARTS.filter((x) => x.skills.some((s) => skills.includes(s)));
  return own.sort((a, b) => (a.id === first ? -1 : b.id === first ? 1 : PARTS.indexOf(b) - PARTS.indexOf(a)));
}

export function RuleBox({ skills, part }: { skills: string[]; part?: string }) {
  const parts = partsFor(skills, part).slice(0, 2);
  if (!parts.length) {
    const hints = skills.map((s) => SKILL_BY_ID.get(s)?.hint).filter(Boolean) as string[];
    return <div class="well ex-hints" data-ask="The rule, opened in the exercise">{hints.map((h, i) => <p key={i}><Inline text={h} /></p>)}</div>;
  }
  return (
    <div class="well stack ex-hints rule-box" style={{ gap: "10px" }} data-ask="The rule, opened in the exercise">
      {parts.map((x) => {
        const ex = x.examples[0];
        return (
          <div key={x.id} class="rule-mini">
            <h3>Rule {x.id} · {joinEndings(x.title)}</h3>
            {x.explain.map((line, i) => (
              <p key={i}><Inline text={line} /></p>
            ))}
            {ex && (
              <p class="rule-ex">
                <LatinText text={ex.la} /> <span class="muted">{ex.en}</span>
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
