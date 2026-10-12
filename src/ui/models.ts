// Which Claude model answers, as the learner chose in Settings: one choice for
// the coach (Ask Claude, the checks, Answer in Latin) and one for the people in
// the messenger. A tier is a model family; effort is how hard it thinks.
import type { Effort, ModelChoice, ModelTier } from "../trainer/progress";
import { getProgress } from "./store";

export const TIERS: { tier: ModelTier; label: string; note: string }[] = [
  { tier: "quick", label: "Haiku", note: "fastest" },
  { tier: "default", label: "Sonnet", note: "balanced" },
  { tier: "complex", label: "Opus", note: "most capable" },
];

export const EFFORTS: { effort: Effort; label: string }[] = [
  { effort: "low", label: "Low" },
  { effort: "medium", label: "Medium" },
  { effort: "high", label: "High" },
];

/** The options a sample call takes for a choice. */
export const modelOpts = (m: ModelChoice) => ({ modelTier: m.tier, effort: m.effort });

/** The coach's model: explanations, checks, questions. */
export const coachOpts = () => modelOpts(getProgress().settings.coach);

/** The model the people in the messenger write with. */
export const chatOpts = () => modelOpts(getProgress().settings.chat);

/** "Opus" for a tier that answered. */
export const tierName = (tier?: string) => TIERS.find((t) => t.tier === tier)?.label ?? tier ?? "";
