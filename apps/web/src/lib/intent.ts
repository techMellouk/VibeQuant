/**
 * Follow-up intent classifier.
 *
 * After a strategy exists, a user's next message is either a REFINEMENT of the
 * current strategy (adjust budget / risk / sizing / outcome side, same belief)
 * or a NEW THESIS (a different belief that needs fresh market discovery).
 *
 * Without this, every follow-up is treated as a refinement and the engine keeps
 * reusing the prior thesis + markets, so a brand-new belief can never produce a
 * new strategy.
 */

import { hasLLM, chatJSON } from "./llm";

export type FollowUpIntent = "refine" | "new_thesis";

export interface FollowUpClassification {
  intent: FollowUpIntent;
  /** Cleaned thesis to discover on when intent is `new_thesis`. */
  thesis: string;
}

const NEW_THESIS_TRIGGERS = [
  "nevermind",
  "never mind",
  "actually",
  "instead",
  "forget",
  "scratch that",
  "different thesis",
  "new thesis",
  "what about",
  "change the topic",
  "change my mind",
];

const REFINE_TRIGGERS = [
  "budget",
  "usdc",
  "risk",
  "aggressive",
  "conservative",
  "less",
  "more",
  "smaller",
  "bigger",
  "increase",
  "decrease",
  "reduce",
  "lower",
  "raise",
  "only",
  "cap",
  "limit",
  "stake",
  "size",
  "sizing",
  "position",
  "hedge",
  "spread",
  "diversify",
  "confidence",
  "double",
  "half",
  "fewer",
  "reallocate",
];

const BELIEF_PATTERN =
  /\b(i think|i believe|i bet|i feel|will win|will lose|will happen|gonna|going to|is going to|expect|predict)\b/i;

/** Strip conversational lead-ins so discovery sees the core belief. */
function cleanThesis(message: string): string {
  return message
    .replace(/^(ok(ay)?|well|hmm|so|um|uh)[,\s]+/i, "")
    .replace(/^(nevermind|never mind|actually|instead|forget it|forget that|scratch that)[,.\s]+/i, "")
    .trim() || message.trim();
}

function heuristicClassify(message: string): FollowUpClassification {
  const lower = message.toLowerCase();
  const wordCount = message.trim().split(/\s+/).length;

  if (NEW_THESIS_TRIGGERS.some((t) => lower.includes(t))) {
    return { intent: "new_thesis", thesis: cleanThesis(message) };
  }
  if (BELIEF_PATTERN.test(message)) {
    return { intent: "new_thesis", thesis: cleanThesis(message) };
  }
  if (REFINE_TRIGGERS.some((t) => new RegExp(`\\b${t}\\b`).test(lower))) {
    return { intent: "refine", thesis: "" };
  }
  // Short, instruction-like messages lean refine; longer statements lean new belief.
  return wordCount <= 6
    ? { intent: "refine", thesis: "" }
    : { intent: "new_thesis", thesis: cleanThesis(message) };
}

export async function classifyFollowUp(
  message: string,
  priorThesis: string,
): Promise<FollowUpClassification> {
  const fallback = heuristicClassify(message);
  if (!hasLLM()) return fallback;

  try {
    const result = await chatJSON<{ intent?: string; thesis?: string }>({
      system:
        "You classify a user's follow-up message in a prediction-market trading assistant. " +
        "The user already stated a thesis and received a strategy. Decide if the new message is " +
        '"refine" (adjust the SAME strategy: budget, risk, position size, outcome side, number of ' +
        'markets, etc.) or "new_thesis" (a DIFFERENT belief/topic that requires finding different ' +
        "markets). Treat words like nevermind, actually, instead, or a new prediction as new_thesis. " +
        'Respond ONLY with JSON: {"intent":"refine"|"new_thesis","thesis":string}. ' +
        "For new_thesis, set thesis to the cleaned belief statement. For refine, set thesis to \"\".",
      user: JSON.stringify({ priorThesis, message }),
      temperature: 0,
    });

    const intent: FollowUpIntent = result.intent === "new_thesis" ? "new_thesis" : "refine";
    return {
      intent,
      thesis: intent === "new_thesis" ? (result.thesis?.trim() || cleanThesis(message)) : "",
    };
  } catch (error) {
    console.error("[intent] LLM classify failed, using heuristic:", error);
    return fallback;
  }
}
