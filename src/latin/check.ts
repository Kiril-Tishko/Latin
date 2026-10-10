// Checks typed answers. Latin: any word order, long marks optional, and every
// mistake is explained by which form was written and which one was needed.
// English: compared against the pattern of acceptable phrasings.
import { Analysis, caseOf, Lexicon, numOf } from "./analyze";
import { English, Knowledge, LToken, Role } from "./generate";
import { normalizeEnglish } from "./english";
import { declineAdj } from "./morph";
import { editDistance, latinKey, stripMarks, words } from "./text";
import { CASE_NAMES, full, PN, PN_NAMES } from "./types";

export type Verdict = "correct" | "almost" | "wrong";

export interface Slot {
  /** Accepted spellings, as latinKey. */
  accept: string[];
  /** Canonical spelling, with long marks. */
  show: string;
  role: Role;
  optional: boolean;
  analysis?: Analysis;
  skill?: string;
  /** Added beyond the model sentence (an optional ego / tū). */
  added?: boolean;
}

export type TokenStatus = "ok" | "typo" | "form" | "word" | "extra";

export interface CheckedToken {
  text: string;
  status: TokenStatus;
  slot?: Slot;
  /** What the learner's word actually is, when we can tell. */
  analysis?: Analysis;
}

export interface Issue {
  kind: "form" | "missing" | "extra" | "word" | "order" | "typo" | "tip";
  /** Plain-text explanation. Latin inside «» (with #hints) is colored by the UI. */
  message: string;
  skill?: string;
}

export interface CheckResult {
  verdict: Verdict;
  tokens: CheckedToken[];
  issues: Issue[];
  /** The expected answer, with long marks. */
  expected: string;
}

const ROLE_TEXT: Partial<Record<Role, string>> = {
  subj: "the subject (who does it)",
  "subj-adj": "describing the subject",
  obj: "the object (what the action is done to)",
  "obj-adj": "describing the object",
  pred: "after est (same case as the subject)",
  "pred-adj": "after est (agreeing with the subject)",
  pp: "the place after the preposition",
  "pp-adj": "describing the place",
  "subj-poss": "the owner (whose)",
  "obj-poss": "the owner (whose)",
  "pp-poss": "the owner (whose)",
  "pred-poss": "the owner (whose)",
  verb: "the verb",
  inf: "the infinitive (to …)",
};

/** «form#key» so the UI colors exactly the intended reading. */
export function hinted(text: string, a?: Analysis): string {
  if (!a || !a.key || a.entry.kind === "verb" || a.entry.kind === "fixed") return `«${text}»`;
  return `«${text}#${a.key}»`;
}

export function describe(a: Analysis): string {
  const e = a.entry;
  if (e.kind === "noun" || e.kind === "adj") {
    const [c, n] = a.key.split(".");
    return `${CASE_NAMES[c as keyof typeof CASE_NAMES]}${n === "pl" ? " plural" : ""}`;
  }
  if (e.kind === "verb") {
    if (a.key === "inf") return "infinitive (to …)";
    if (a.key.startsWith("imp")) return "a command";
    const pn = a.key.split(".")[1] as PN;
    return `the form for ${PN_NAMES[pn]}`;
  }
  return "";
}

/** Expected words for a generated sentence. */
export function slotsFor(tokens: LToken[], k: Knowledge): Slot[] {
  const slots: Slot[] = tokens.map((t) => ({
    accept: [latinKey(t.text)],
    show: t.text,
    role: t.role,
    optional: t.role === "pron",
    analysis: t.analysis,
    skill: t.skill,
  }));
  const verb = tokens.find((t) => t.role === "verb");
  const pn = verb?.analysis?.key.split(".")[1];
  const subjectShown = tokens.some((t) => t.role === "pron" || t.role === "subj");
  if (!subjectShown && (pn === "1sg" || pn === "2sg")) {
    const pron = k.fixed.get(pn === "1sg" ? "ego" : "tu");
    if (pron) slots.push({ accept: [latinKey(pron.lemma)], show: pron.lemma, role: "pron", optional: true, added: true });
  }
  // "I am timid": English doesn't say whether the speaker is a man or a woman.
  for (const s of slots) {
    if (s.role === "pred-adj" && !subjectShown && s.analysis?.entry.kind === "adj") {
      const other = declineAdj(s.analysis.entry, s.analysis.gender === "f" ? "m" : "f")[s.analysis.key as "nom.sg"];
      s.accept.push(latinKey(full(other)));
    }
  }
  return slots;
}

export function checkLatin(answer: string, slots: Slot[], lex: Lexicon): CheckResult {
  const typed = words(answer);
  const keys = typed.map(latinKey);
  const used = slots.map(() => false);
  const tokens: CheckedToken[] = typed.map((text) => ({ text, status: "extra" as TokenStatus }));
  const issues: Issue[] = [];
  const expected = slots.filter((s) => !s.added).map((s) => s.show);

  // 1. exact matches (order free)
  keys.forEach((key, i) => {
    const j = slots.findIndex((s, j) => !used[j] && s.accept.includes(key));
    if (j >= 0) {
      used[j] = true;
      tokens[i].status = "ok";
      tokens[i].slot = slots[j];
    }
  });

  // 2. right word, wrong form
  tokens.forEach((t, i) => {
    if (t.status !== "extra") return;
    const readings = lex.analyze(typed[i]);
    const j = slots.findIndex((s, j) => !used[j] && s.analysis && readings.some((r) => r.entry.id === s.analysis!.entry.id));
    if (j < 0) return;
    const slot = slots[j];
    const mine = readings.find((r) => r.entry.id === slot.analysis!.entry.id)!;
    used[j] = true;
    t.status = "form";
    t.slot = slot;
    t.analysis = mine;
    issues.push({ kind: "form", message: formMessage(typed[i], mine, slot), skill: slot.skill });
  });

  // 3. near misses: spelling slip in the stem, or a wrong ending
  tokens.forEach((t, i) => {
    if (t.status !== "extra") return;
    let best = -1;
    let bestDist = Infinity;
    slots.forEach((s, j) => {
      if (used[j] || s.optional) return;
      const d = editDistance(keys[i], s.accept[0]);
      if (d < bestDist) {
        bestDist = d;
        best = j;
      }
    });
    if (best < 0) return;
    const slot = slots[best];
    const target = slot.accept[0];
    const limit = target.length > 6 ? 2 : 1;
    if (bestDist > limit) return;
    used[best] = true;
    t.slot = slot;
    // compare the ending plus the letter before it: doc-e-t vs doc-i-t is a conjugation slip, puel-lam vs pue-lam a spelling slip
    const endingLen = latinKey(slot.analysis?.form.ending ?? "").length;
    const region = endingLen + 1;
    const inEnding = endingLen > 0 && keys[i].slice(-region) !== target.slice(-region);
    if (inEnding) {
      t.status = "form";
      issues.push({
        kind: "form",
        message: `${hinted(typed[i])} has the wrong ending. ${ROLE_TEXT[slot.role] ? `This is ${ROLE_TEXT[slot.role]}, so it` : "It"} should be ${hinted(slot.show, slot.analysis)}${slot.analysis ? ` (${describe(slot.analysis)})` : ""}.`,
        skill: slot.skill,
      });
    } else {
      t.status = "typo";
      issues.push({ kind: "typo", message: `Small spelling slip: ${hinted(typed[i])} → ${hinted(slot.show, slot.analysis)}.` });
    }
  });

  // 4. what is left: wrong words and extra words
  const missing = slots.filter((s, j) => !used[j] && !s.optional);
  tokens.forEach((t, i) => {
    if (t.status !== "extra") return;
    if (missing.length) {
      const slot = missing.shift()!;
      used[slots.indexOf(slot)] = true;
      t.status = "word";
      t.slot = slot;
      issues.push({ kind: "word", message: `${hinted(typed[i])} is not the word needed here: expected ${hinted(slot.show, slot.analysis)}.`, skill: slot.skill });
    } else {
      issues.push({ kind: "extra", message: `${hinted(typed[i])} is not needed here.` });
    }
  });
  for (const slot of missing) {
    issues.push({ kind: "missing", message: `Missing ${ROLE_TEXT[slot.role] ?? "a word"}: ${hinted(slot.show, slot.analysis)}.`, skill: slot.skill });
  }

  // 5. word order rules that do matter
  tokens.forEach((t, i) => {
    if (t.status === "extra" || !t.slot) return;
    const next = tokens[i + 1]?.slot?.role;
    if (t.slot.role === "prep" && next && !["pp", "pp-adj", "pp-poss"].includes(next)) {
      issues.push({ kind: "order", message: `Put ${hinted(t.slot.show)} right before its noun: ${hinted(t.slot.show)} + the place.` });
    }
    if (t.slot.role === "neg" && next && next !== "verb" && next !== "inf") {
      issues.push({ kind: "order", message: `${hinted("nōn")} goes right before the verb it negates.`, skill: "s.non" });
    }
  });

  // 6. a gentle tip on long marks that tell forms apart
  tokens.forEach((t) => {
    if (t.status !== "ok" || !t.slot?.analysis) return;
    const end = t.slot.analysis.form.ending;
    if (/[āō]$/.test(end) && caseOf(t.slot.analysis) === "abl" && stripMarks(t.text) === t.text) {
      issues.push({ kind: "tip", message: `Accepted. In writing, the ablative has a long ${end.slice(-1)}: ${hinted(t.slot.show, t.slot.analysis)}.` });
    }
  });

  const serious = issues.some((x) => x.kind === "form" || x.kind === "missing" || x.kind === "extra" || x.kind === "word");
  const minor = issues.some((x) => x.kind === "typo" || x.kind === "order");
  return {
    verdict: serious ? "wrong" : minor ? "almost" : "correct",
    tokens,
    issues,
    expected: expected.join(" "),
  };
}

function formMessage(typed: string, mine: Analysis, slot: Slot): string {
  const want = slot.analysis!;
  const role = ROLE_TEXT[slot.role];
  if (want.entry.kind === "verb") {
    return `${hinted(typed)} is ${describe(mine)}. Here you need ${describe(want)}: ${hinted(slot.show)}.`;
  }
  const sameCase = caseOf(mine) === caseOf(want);
  const numberNote = sameCase && numOf(mine) !== numOf(want) ? ` It should be ${numOf(want) === "pl" ? "plural" : "singular"}.` : "";
  return `${hinted(typed, mine)} is the ${describe(mine)}.${role ? ` Here the word is ${role}, so it needs the ${describe(want)}:` : " Needed:"} ${hinted(slot.show, want)}.${numberNote}`;
}

// --------------------------------------------------------------- English

export function checkEnglish(answer: string, en: English, swapped?: English): { verdict: Verdict; issues: Issue[] } {
  const norm = normalizeEnglish(answer.replace(/\((?:m|f|male|female)\)/gi, " "));
  if (en.pattern.test(norm)) return { verdict: "correct", issues: [] };
  if (swapped?.pattern.test(norm)) {
    return {
      verdict: "wrong",
      issues: [
        {
          kind: "form",
          message: "You swapped who does what. Look at the endings: the -a / -us word is the subject, the -am / -um word is the object.",
          skill: "s.svo",
        },
      ],
    };
  }
  const target = normalizeEnglish(en.text.replace(/ \((m|f)\)/g, ""));
  const issues: Issue[] = [];
  const hasNot = /\bnot\b|\bcannot\b/.test(norm);
  const needsNot = /\bnot\b|\bcannot\b/.test(target);
  if (needsNot && !hasNot) issues.push({ kind: "missing", message: "The Latin has «nōn» (not).", skill: "s.non" });
  if (!needsNot && hasNot) issues.push({ kind: "extra", message: "There is no «nōn» in this sentence, so no 'not'." });
  if (!issues.length && target.length > 10 && editDistance(norm, target) <= 2) {
    return { verdict: "almost", issues: [{ kind: "typo", message: `Small spelling slip. Expected: ${en.text}` }] };
  }
  return { verdict: "wrong", issues };
}
