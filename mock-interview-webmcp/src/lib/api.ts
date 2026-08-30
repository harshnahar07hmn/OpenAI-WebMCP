// Client-side helpers that call the Next.js API routes.
// Keep the AI-vs-fallback branching on the server so the client
// never needs to know about the OPENAI_API_KEY.

import type { CandidateProfile, Question, AnswerEvaluation, QAExchange, InterviewSummary } from "./types";

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiEvaluateAnswer(input: {
  question: Question;
  answer: string;
  profile: CandidateProfile;
}): Promise<AnswerEvaluation> {
  const { evaluation } = await post<{ evaluation: AnswerEvaluation }>("/api/evaluate-answer", input);
  return evaluation;
}

export async function apiSummarize(input: {
  profile: CandidateProfile;
  history: QAExchange[];
}): Promise<InterviewSummary> {
  const { summary } = await post<{ summary: InterviewSummary }>("/api/summarize", input);
  return summary;
}
