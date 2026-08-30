import type { Difficulty } from "./types";

// ---------------------------------------------------------------------------
// The static question bank/templates have been removed entirely.
// Questions are now generated live by the calling AI (ChatGPT via WebMCP)
// based on the candidate's actual profile — see the `ask_question` tool in
// registerTools.tsx. This file just keeps the one small piece of shared
// logic that isn't about picking a canned question: mapping years of
// experience to a difficulty tier.
// ---------------------------------------------------------------------------

export function difficultyFor(years: number): Difficulty {
  if (years < 2) return "junior";
  if (years < 6) return "mid";
  return "senior";
}
