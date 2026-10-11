// Rules at hand while practising: a one-screen refresher before a step's
// session (the endings to know and each rule in two lines), and the rule
// behind an exercise on request.
import { useEffect, useLayoutEffect, useRef } from "preact/hooks";
import { LESSON_BY_N, LESSONS, Rule } from "../content/lessons";
import { Knowledge } from "../latin/generate";
import { SKILL_BY_ID } from "../latin/skills";
import { roman } from "../latin/text";
import { Case } from "../latin/types";
import { Icon } from "./components";
import { fitToWindow } from "./fit";
import { LatinText } from "./latin";
import { Inline } from "./markup";
import { NounTable, VerbTable } from "./pages/rules";
import { useScreen } from "./screen";

/** The lesson that teaches a skill. */
export function lessonOfSkill(id: string): number | undefined {
  return LESSONS.find((l) => l.skills.includes(id))?.n;
}

/** Rules that teach any of these skills: the given lesson's first, then in lesson order. */
export function rulesFor(skills: string[], lesson?: number): Rule[] {
  const ordered = [...LESSONS].sort((a, b) => (a.n === lesson ? -1 : b.n === lesson ? 1 : a.n - b.n));
  const out: Rule[] = [];
  for (const l of ordered) for (const r of l.rules) if (r.skills.some((s) => skills.includes(s)) && !out.includes(r)) out.push(r);
  return out;
}

const NOUN_ORDER = ["nom.sg", "acc.sg", "gen.sg", "abl.sg", "nom.pl"];

/** The endings a lesson teaches, as small tables (nothing for a lesson without new endings). */
function StepTables({ lesson, k }: { lesson: number; k: Knowledge }) {
  const skills = LESSON_BY_N.get(lesson)?.skills ?? [];
  const regular = (["1sg", "2sg", "3sg", "3pl", "inf"] as const).filter((pn) => skills.includes(`v.${pn}`));
  // a new plural ending is easiest to see next to the singular
  if (regular.includes("3pl") && !regular.includes("3sg")) regular.unshift("3sg");
  const irregular = ["sum", "possum"].filter((v) => skills.includes(`v.${v}`));
  const nounKeys = new Set(skills.filter((s) => /^n\d/.test(s)).map((s) => s.split(".").slice(1).join(".")));
  nounKeys.delete("nom.sg");
  const rows = NOUN_ORDER.filter((key) => key === "nom.sg" || nounKeys.has(key)).map((key) => key.split(".") as [Case, "sg" | "pl"]);
  const cols = [
    k.skills.has("n1.nom.sg") && "puella",
    k.skills.has("n2.nom.sg") && "amicus",
    k.skills.has("n2.nom.sg") && lesson === 3 && "liber",
    k.skills.has("n2n.nom.sg") && "vinum",
  ].filter(Boolean) as string[];
  const tables = [
    regular.length > 0 && <VerbTable key="v" rows={[...regular]} cols={["laboro", "doceo", "scribo", "dormio"]} k={k} />,
    irregular.length > 0 && <VerbTable key="i" rows={["1sg", "2sg", "3sg"]} cols={irregular} k={k} />,
    nounKeys.size > 0 && <NounTable key="n" rows={rows} cols={cols} k={k} />,
  ].filter(Boolean);
  if (!tables.length) return null;
  return <div class="step-tables">{tables}</div>;
}

/** The two main rules of a lesson (the ones it practises first); the rest are on the lesson page. */
const mainRules = (lesson: number) => (LESSON_BY_N.get(lesson)?.rules ?? []).filter((r) => r.skills.length > 0).slice(0, 2);

/** Before a step's exercises: the endings and each rule of the lesson, on one screen. */
export function RuleIntro({ lesson, k, onStart }: { lesson: number; k: Knowledge; onStart: () => void }) {
  const l = LESSON_BY_N.get(lesson);
  const start = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => start.current?.focus(), []);
  useLayoutEffect(() => fitToWindow(panel.current, false), [lesson]);
  useScreen("page", `Rules before Step ${roman(lesson)}`, () =>
    `Before the exercises of step ${lesson} ("${l?.title ?? ""}"): a one-screen refresher with the endings to know and the lesson's main rules. The learner presses Start exercises when ready.`,
  );
  if (!l) return null;
  return (
    <div class="trainer">
      <section class="panel frame rule-intro" ref={panel} data-ask={`Rule refresher, Lesson ${roman(lesson)}`}>
        <div class="spread rule-intro-head">
          <div class="stack" style={{ gap: "4px" }}>
            <span class="eyebrow">Step {roman(lesson)} · first, the rules</span>
            <h2>{l.title}</h2>
          </div>
          <button class="btn big" ref={start} onClick={onStart}>
            Start exercises <Icon.arrow />
          </button>
        </div>
        <StepTables lesson={lesson} k={k} />
        <div class="rule-minis">
          {mainRules(lesson).map((r) => (
            <RuleMini key={r.id} r={r} />
          ))}
        </div>
        <p class="small muted">The other rules of this lesson are on its page, and the Rule button in each exercise shows the one you need.</p>
      </section>
    </div>
  );
}

function RuleMini({ r }: { r: Rule }) {
  const ex = r.examples[0];
  return (
    <div class="rule-mini">
      <h3>{r.title}</h3>
      <p>
        <Inline text={r.how} />
      </p>
      {ex && (
        <p class="rule-ex">
          <LatinText text={ex.la} /> <span class="muted">{ex.en}</span>
        </p>
      )}
    </div>
  );
}

/** The rule behind an exercise, for the Rule button: the one or two rules that teach its skills. */
export function RuleBox({ skills, lesson }: { skills: string[]; lesson?: number }) {
  const rules = rulesFor(skills, lesson).slice(0, 2);
  if (!rules.length) {
    const hints = skills.map((s) => SKILL_BY_ID.get(s)?.hint).filter(Boolean) as string[];
    return <div class="well ex-hints" data-ask="The rule, opened in the exercise">{hints.map((h, i) => <p key={i}><Inline text={h} /></p>)}</div>;
  }
  return (
    <div class="well stack ex-hints rule-box" style={{ gap: "10px" }} data-ask="The rule, opened in the exercise">
      {rules.map((r) => (
        <RuleMini key={r.id} r={r} />
      ))}
    </div>
  );
}
