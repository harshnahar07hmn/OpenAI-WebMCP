import type { AnswerEvaluation, Question } from "./types";

// ---------------------------------------------------------------------------
// Offline rubric-based evaluator.
// Deterministic fallback when the OpenAI API is unavailable / no key.
// Heuristic — good enough to demo the flow, honest about its limits.
// ---------------------------------------------------------------------------

const STAR_MARKERS = ["situation", "task", "action", "result", "outcome"];
const HEDGES = ["kind of", "sort of", "maybe", "i think", "i guess", "probably"];
const CONCRETE = ["metric", "%", "$", "reduced", "improved", "shipped", "grew", "led"];

export function evaluateOffline(question: Question, answer: string): AnswerEvaluation {
  const trimmed = answer.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const lower = trimmed.toLowerCase();

  // Base score from length — enough words to say something meaningful
  let score = 0;
  if (wordCount === 0) {
    return {
      score: 0,
      strengths: [],
      gaps: ["No answer provided."],
      suggested: "Take a moment and share even a rough draft — the interview values structured thinking over polish.",
    };
  }
  if (wordCount >= 30) score += 3;
  else if (wordCount >= 15) score += 2;
  else score += 1;

  // STAR / structure signal for behavioral questions
  const strengths: string[] = [];
  const gaps: string[] = [];

  const starHits = STAR_MARKERS.filter((m) => lower.includes(m)).length;
  if (question.type === "behavioral" || question.type === "situational") {
    if (starHits >= 2) {
      score += 2;
      strengths.push("Answer shows clear structure (situation → action → result).");
    } else {
      gaps.push("Try using the STAR method: Situation, Task, Action, Result.");
    }
  }

  // Concreteness bonus
  const concreteHits = CONCRETE.filter((c) => lower.includes(c)).length;
  if (concreteHits >= 1) {
    score += 2;
    strengths.push("Includes concrete outcomes or metrics.");
  } else {
    gaps.push("Add a specific metric, number, or outcome to make it memorable.");
  }

  // Hedge penalty
  const hedgeHits = HEDGES.filter((h) => lower.includes(h)).length;
  if (hedgeHits >= 3) {
    score -= 1;
    gaps.push("Reduce hedging language ('kind of', 'maybe') — commit to your point.");
  }

  // Rubric-point overlap: for each rubric point, check keyword overlap
  if (question.rubricPoints && question.rubricPoints.length > 0) {
    const pointsCovered = question.rubricPoints.filter((point) => {
      const pointWords = point.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
      return pointWords.some((pw) => lower.includes(pw));
    }).length;
    const coverage = pointsCovered / question.rubricPoints.length;
    score += Math.round(coverage * 3);
    if (coverage >= 0.6) {
      strengths.push(`Covers ${pointsCovered}/${question.rubricPoints.length} rubric points.`);
    } else if (coverage > 0) {
      gaps.push(`Only ${pointsCovered}/${question.rubricPoints.length} rubric points touched.`);
    } else {
      gaps.push("Answer misses the core rubric — re-read the question and identify what it's really testing.");
    }
  }

  // Clamp
  score = Math.max(0, Math.min(10, score));

  const suggested = gaps[0] ?? "Solid answer. To level up, add one specific example a listener could quote back later.";

  return {
    score,
    strengths,
    gaps,
    suggested,
  };
}
