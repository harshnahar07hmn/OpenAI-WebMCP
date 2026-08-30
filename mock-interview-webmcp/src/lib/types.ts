export type Difficulty = "junior" | "mid" | "senior";

export type QuestionType =
  | "behavioral"
  | "technical"
  | "system_design"
  | "situational"
  | "culture_fit";

export interface CandidateProfile {
  field: string;              // e.g. "Software Engineering", "Product Management"
  position: string;           // e.g. "Senior Backend Engineer"
  experienceYears: number;    // e.g. 3
  skills: string[];           // e.g. ["Python", "AWS", "PostgreSQL"]
  focusAreas?: string[];      // optional: user's weak spots to drill
}

export interface Question {
  id: string;
  index: number;              // 1-based
  type: QuestionType;
  text: string;
  hint?: string;              // for the candidate; not for the AI
  rubricPoints?: string[];    // what a great answer covers
}

export interface AnswerEvaluation {
  score: number;              // 0..10
  strengths: string[];
  gaps: string[];
  suggested: string;          // one-line improvement suggestion
  followUp?: string;          // optional follow-up question the AI might ask
}

export interface QAExchange {
  question: Question;
  answer: string;
  evaluation?: AnswerEvaluation;
  askedAt: number;
  answeredAt?: number;
}

export type InterviewPhase =
  | "profile"       // gathering candidate info
  | "in_progress"   // asking questions
  | "review"        // finished, showing summary
  | "idle";         // reset / not started

export interface InterviewConfig {
  totalQuestions: number;     // default 6
  difficulty: Difficulty;     // default derived from experienceYears
  mix: QuestionType[];        // ordered list of types to cycle through
}

export interface InterviewSummary {
  overallScore: number;        // 0..10
  strengths: string[];
  developmentAreas: string[];
  hireRecommendation: "strong_yes" | "yes" | "maybe" | "no";
  nextSteps: string[];
  generatedAt: number;
}
