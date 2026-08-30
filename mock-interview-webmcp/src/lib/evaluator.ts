import type { AnswerEvaluation, Question } from "./types";

// ---------------------------------------------------------------------------
// Offline rubric-based evaluator.
// Deterministic fallback when the OpenAI API is unavailable / no key.
//
// v2 — rebalanced after live testing showed it was punishing genuinely
// competent, well-structured answers down to 3/10 just for not using
// specific buzzwords ("metric", "%", "STAR"). The old version required
// EXACT literal keyword hits (e.g. rubric word "assesses" had to appear
// verbatim) which almost never survives paraphrasing. This version:
//   - uses prefix-stem matching instead of exact word matching
//   - recognizes a much broader set of "concrete/specific" signals
//     (numbers, named tools/techniques, structural sequencing words)
//   - treats STAR structure as ONE of several valid structure signals,
//     not the only one
//   - gives partial/baseline credit instead of all-or-nothing scoring
// ---------------------------------------------------------------------------

const STAR_MARKERS = ["situation", "task", "action", "result", "outcome"];
const SEQUENCE_MARKERS = [
  "first", "then", "next", "after that", "finally", "because", "so that",
  "as a result", "once", "before", "afterwards", "step 1", "step one",
];
const HEDGES = ["kind of", "sort of", "maybe", "i think", "i guess", "probably"];

// Broad set of "this answer is concrete/specific" signals — numbers,
// results language, AND common technical/process nouns & verbs so a
// well-reasoned technical or situational answer isn't penalized just
// because it doesn't say the word "metric" out loud.
const CONCRETE_PATTERNS = [
  /\d/, // any digit — numbers, percentages, dollar amounts, counts
  /%/, /\$/,
  /\b(reduced|improved|shipped|grew|led|fixed|resolved|deployed|migrated|cut|increased|decreased|saved|prevented)\b/,
  /\b(trace|traces|tracing|log|logs|logging|monitor|monitoring|metric|metrics|dashboard|alert|alerts)\b/,
  /\b(query|queries|index|indexes|indexing|cache|caching|latency|throughput|database|db|api|endpoint)\b/,
  /\b(test|tests|testing|rollback|deploy|deployment|incident|postmortem|root cause)\b/,
  /\b(stakeholder|stakeholders|risk|impact|tradeoff|trade-off|priorit|escalat|document|sign.?off)\b/,
];

function stem(word: string): string {
  // crude prefix stem: strips common suffixes, keeps first 5 chars
  return word.toLowerCase().replace(/(ing|tion|ed|es|s)$/i, "").slice(0, 5);
}

export function evaluateOffline(question: Question, answer: string): AnswerEvaluation {
  const trimmed = answer.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const lower = trimmed.toLowerCase();

  if (wordCount === 0) {
    return {
      score: 0,
      strengths: [],
      gaps: ["No answer provided."],
      suggested:
        "Take a moment and share even a rough draft — the interview values structured thinking over polish.",
    };
  }

  const strengths: string[] = [];
  const gaps: string[] = [];

  // ── Base score from length (more generous baseline) ──────────────────
  let score = 0;
  if (wordCount >= 60) score += 4;
  else if (wordCount >= 25) score += 3;
  else if (wordCount >= 10) score += 2;
  else score += 1;

  // ── Structure signal: STAR words OR sequencing/logical connectors ────
  const starHits = STAR_MARKERS.filter((m) => lower.includes(m)).length;
  const sequenceHits = SEQUENCE_MARKERS.filter((m) => lower.includes(m)).length;
  const sentenceCount = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  const hasStructure = starHits >= 2 || sequenceHits >= 1 || sentenceCount >= 3;

  if (hasStructure) {
    score += 2;
    if (starHits >= 2) {
      strengths.push("Answer shows clear structure (situation → action → result).");
    } else {
      strengths.push("Answer is organized into clear, sequential steps.");
    }
  } else if (question.type === "behavioral" || question.type === "situational") {
    gaps.push("Try using the STAR method: Situation, Task, Action, Result.");
  } else {
    gaps.push("Break your answer into clearer steps (first check X, then do Y, then verify Z).");
  }

  // ── Concreteness: numbers, named techniques, tools, process language ─
  const concreteHits = CONCRETE_PATTERNS.filter((re) => re.test(lower)).length;
  if (concreteHits >= 2) {
    score += 2;
    strengths.push("Concrete, specific, and grounded in real tools/process.");
  } else if (concreteHits === 1) {
    score += 1;
    strengths.push("Includes at least one concrete detail.");
  } else {
    gaps.push("Add a specific tool, number, or outcome to make it more memorable.");
  }

  // ── Hedge penalty — lighter touch, only for heavy hedging ────────────
  const hedgeHits = HEDGES.filter((h) => lower.includes(h)).length;
  if (hedgeHits >= 4) {
    score -= 1;
    gaps.push("Reduce hedging language ('kind of', 'maybe') — commit to your point.");
  }

  // ── Rubric-point overlap via stemmed prefix matching, not exact words ─
  if (question.rubricPoints && question.rubricPoints.length > 0) {
    const answerStems = new Set(words.map(stem));
    const pointsCovered = question.rubricPoints.filter((point) => {
      const pointWords = point
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 4);
      return pointWords.some((pw) => answerStems.has(stem(pw)) || lower.includes(pw));
    }).length;
    const coverage = pointsCovered / question.rubricPoints.length;

    // Baseline credit: a substantive, on-topic answer (decent length +
    // at least some structure/concreteness) gets partial rubric credit
    // even if it doesn't literally echo rubric vocabulary — paraphrasing
    // a good idea shouldn't score like an irrelevant answer.
    const effectiveCoverage =
      coverage === 0 && wordCount >= 15 && (hasStructure || concreteHits >= 1)
        ? 0.34
        : coverage;

    score += Math.round(effectiveCoverage * 3);

    if (effectiveCoverage >= 0.6) {
      strengths.push(
        pointsCovered > 0
          ? `Covers ${pointsCovered}/${question.rubricPoints.length} rubric points.`
          : "Substantively addresses what the question is testing.",
      );
    } else if (effectiveCoverage > 0) {
      gaps.push(
        pointsCovered > 0
          ? `Only ${pointsCovered}/${question.rubricPoints.length} rubric points touched.`
          : "On topic, but go deeper on the specific scenario being tested.",
      );
    } else {
      gaps.push("Answer misses the core rubric — re-read the question and identify what it's really testing.");
    }
  }

  // Clamp
  score = Math.max(0, Math.min(10, score));

  const suggested =
    gaps[0] ?? "Solid answer. To level up, add one specific example a listener could quote back later.";

  return {
    score,
    strengths,
    gaps,
    suggested,
  };
}
