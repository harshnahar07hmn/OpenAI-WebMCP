import type { Question, QuestionType, Difficulty, CandidateProfile } from "./types";

// Compact but genuinely useful offline question bank. Each entry is a template
// with slot placeholders that pull from the candidate's profile so questions
// feel targeted even without an LLM.

interface Template {
  type: QuestionType;
  difficulty: Difficulty[];
  fields?: string[];        // if omitted, applies to all fields
  text: string;             // uses {field}, {position}, {years}, {skill}
  hint?: string;
  rubric: string[];
}

const TEMPLATES: Template[] = [
  // ─── Behavioral (universal) ────────────────────────────────────────────────
  {
    type: "behavioral",
    difficulty: ["junior", "mid", "senior"],
    text: "Tell me about a time you disagreed with a teammate on an important decision. How did you handle it?",
    rubric: [
      "Uses STAR structure (Situation, Task, Action, Result)",
      "Shows empathy and active listening",
      "Focuses on outcome and lessons learned, not blame",
    ],
  },
  {
    type: "behavioral",
    difficulty: ["mid", "senior"],
    text: "Describe a project that failed or missed its goal. What did you learn?",
    rubric: [
      "Takes ownership without deflecting",
      "Identifies root cause, not just symptoms",
      "Concrete change adopted afterwards",
    ],
  },
  {
    type: "behavioral",
    difficulty: ["senior"],
    text: "Walk me through a time you had to influence a decision without formal authority.",
    rubric: [
      "Stakeholder mapping",
      "Data or narrative used to persuade",
      "Explicit outcome",
    ],
  },

  // ─── Situational ───────────────────────────────────────────────────────────
  {
    type: "situational",
    difficulty: ["junior", "mid", "senior"],
    text: "You're two weeks from a launch deadline and QA finds a critical bug. The fix would push the date by a week. What do you do?",
    rubric: [
      "Assesses blast radius before deciding",
      "Loops in stakeholders early",
      "Presents options with tradeoffs, not a single answer",
    ],
  },
  {
    type: "situational",
    difficulty: ["mid", "senior"],
    text: "A senior stakeholder asks you to skip a step you believe is important. How do you respond?",
    rubric: [
      "Respectful but firm",
      "Explains the risk in stakeholder's language",
      "Offers a compromise path",
    ],
  },

  // ─── Culture fit ───────────────────────────────────────────────────────────
  {
    type: "culture_fit",
    difficulty: ["junior", "mid", "senior"],
    text: "What kind of team environment brings out your best work?",
    rubric: [
      "Self-awareness",
      "Specific examples, not vague ideals",
      "Aligns intent with realistic team dynamics",
    ],
  },
  {
    type: "culture_fit",
    difficulty: ["junior", "mid", "senior"],
    text: "Why this specific role — {position} — and not any of the other similar openings you could apply for?",
    rubric: [
      "Shows specific research on role/company",
      "Ties role to personal growth arc",
      "Avoids generic phrasing",
    ],
  },

  // ─── Software Engineering — Technical ──────────────────────────────────────
  {
    type: "technical",
    difficulty: ["junior"],
    fields: ["software engineering", "backend", "frontend", "fullstack", "web development"],
    text: "Explain the difference between a HashMap and a TreeMap. When would you choose one over the other?",
    rubric: [
      "Big-O for insert/lookup",
      "Ordering guarantees",
      "Concrete use case for each",
    ],
  },
  {
    type: "technical",
    difficulty: ["mid", "senior"],
    fields: ["software engineering", "backend", "fullstack"],
    text: "Your API endpoint is p99 latency 2s. Walk me through how you'd debug it.",
    rubric: [
      "Distinguishes p99 vs mean",
      "Names concrete tools (APM, tracing, flame graphs)",
      "Considers DB, network, GC, cold start, downstream",
    ],
  },
  {
    type: "technical",
    difficulty: ["mid", "senior"],
    fields: ["software engineering", "backend", "fullstack"],
    text: "You have {skill} in production. What's one non-obvious pitfall you've hit, and how did you mitigate it?",
    hint: "Use one of your listed skills.",
    rubric: [
      "Specific technical detail",
      "Root-cause understanding",
      "Concrete mitigation, not just 'we monitored it'",
    ],
  },
  {
    type: "technical",
    difficulty: ["senior"],
    fields: ["software engineering", "backend"],
    text: "Design a rate limiter for a public API serving 100k RPS. Discuss algorithm, storage, and multi-region concerns.",
    rubric: [
      "Names a real algorithm (token bucket, sliding window)",
      "Reasons about consistency vs latency",
      "Addresses failure modes (Redis down, split-brain)",
    ],
  },

  // ─── Frontend specific ─────────────────────────────────────────────────────
  {
    type: "technical",
    difficulty: ["junior", "mid"],
    fields: ["frontend", "web development", "fullstack"],
    text: "Explain what causes a browser reflow vs a repaint, and give one performance trick that reduces reflows.",
    rubric: [
      "Correct definitions",
      "Concrete example (batching DOM writes, `transform` vs `top`)",
      "Awareness of measurement (Performance panel)",
    ],
  },

  // ─── System Design ─────────────────────────────────────────────────────────
  {
    type: "system_design",
    difficulty: ["mid", "senior"],
    fields: ["software engineering", "backend", "fullstack"],
    text: "Design a URL shortener that handles 10k writes/sec and 1M reads/sec.",
    rubric: [
      "Storage schema + short-code generation strategy",
      "Read/write scaling: cache, CDN, replication",
      "Handles collisions and expiry",
    ],
  },

  // ─── Product Management ────────────────────────────────────────────────────
  {
    type: "technical",
    difficulty: ["junior", "mid", "senior"],
    fields: ["product", "product management", "pm"],
    text: "You're PM for {position}. Pick a metric you'd own in your first 90 days and defend the choice.",
    rubric: [
      "One north-star metric, not a dashboard",
      "Ties to business goal",
      "Names counter-metric to prevent gaming",
    ],
  },
  {
    type: "system_design",
    difficulty: ["mid", "senior"],
    fields: ["product", "product management"],
    text: "Design the onboarding flow for a new B2B SaaS product. Walk me through the first 5 minutes.",
    rubric: [
      "Reduces time-to-value",
      "Segments by user role",
      "Names a leading indicator to measure success",
    ],
  },

  // ─── Data / ML ─────────────────────────────────────────────────────────────
  {
    type: "technical",
    difficulty: ["mid", "senior"],
    fields: ["data science", "machine learning", "ml", "data engineering", "ai"],
    text: "Your model's AUC dropped 8 points in production last week. What's your investigation plan?",
    rubric: [
      "Distinguishes data drift vs concept drift",
      "Names diagnostic steps (feature stats, label distribution)",
      "Rollback vs retrain tradeoff",
    ],
  },
  {
    type: "technical",
    difficulty: ["junior", "mid"],
    fields: ["data science", "machine learning", "ml"],
    text: "Explain overfitting to a non-technical stakeholder in under 60 seconds.",
    rubric: [
      "Uses analogy, not jargon",
      "Explains why it matters (business impact)",
      "Names a concrete symptom",
    ],
  },

  // ─── Design / UX ───────────────────────────────────────────────────────────
  {
    type: "technical",
    difficulty: ["junior", "mid", "senior"],
    fields: ["design", "ux", "product design"],
    text: "Walk me through a recent design decision where you traded aesthetics for usability.",
    rubric: [
      "Specific, not hypothetical",
      "Names the constraint that forced the tradeoff",
      "Measured or observed outcome",
    ],
  },

  // ─── Sales / Business ──────────────────────────────────────────────────────
  {
    type: "technical",
    difficulty: ["junior", "mid", "senior"],
    fields: ["sales", "business development", "account executive"],
    text: "A prospect says 'we already have a solution for that.' How do you keep the conversation alive?",
    rubric: [
      "Curious, not defensive",
      "Uncovers gaps in current solution",
      "Doesn't pitch prematurely",
    ],
  },
];

// ---------------------------------------------------------------------------
// Selector
// ---------------------------------------------------------------------------

function fieldMatches(templateFields: string[] | undefined, userField: string): boolean {
  if (!templateFields) return true; // universal
  const f = userField.toLowerCase();
  return templateFields.some((tf) => f.includes(tf));
}

function fillSlots(text: string, profile: CandidateProfile): string {
  return text
    .replace(/\{field\}/g, profile.field)
    .replace(/\{position\}/g, profile.position)
    .replace(/\{years\}/g, String(profile.experienceYears))
    .replace(/\{skill\}/g, profile.skills[0] ?? "your primary tech stack");
}

export function difficultyFor(years: number): Difficulty {
  if (years < 2) return "junior";
  if (years < 6) return "mid";
  return "senior";
}

export interface PickOptions {
  profile: CandidateProfile;
  difficulty: Difficulty;
  desiredType?: QuestionType;
  excludeTexts?: string[]; // to avoid repeats within a session
}

/**
 * Deterministically pick the next question for the given profile.
 * Returns null if the bank is exhausted for these constraints.
 */
export function pickFromBank(opts: PickOptions, index: number): Question | null {
  const { profile, difficulty, desiredType, excludeTexts = [] } = opts;

  const candidates = TEMPLATES.filter(
    (t) =>
      t.difficulty.includes(difficulty) &&
      fieldMatches(t.fields, profile.field) &&
      (!desiredType || t.type === desiredType) &&
      !excludeTexts.includes(fillSlots(t.text, profile)),
  );

  if (candidates.length === 0) return null;

  // Deterministic-enough: hash by index so re-renders don't shuffle
  const chosen = candidates[index % candidates.length];
  const text = fillSlots(chosen.text, profile);

  return {
    id: `q-${Date.now()}-${index}`,
    index,
    type: chosen.type,
    text,
    hint: chosen.hint,
    rubricPoints: chosen.rubric,
  };
}
