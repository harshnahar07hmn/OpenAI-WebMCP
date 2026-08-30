import { NextResponse } from "next/server";
import type { AnswerEvaluation, CandidateProfile, Question } from "@/lib/types";
import { evaluateOffline } from "@/lib/evaluator";
import { jsonCompletion } from "@/lib/llm";

export const runtime = "nodejs";

interface Body {
  question: Question;
  answer: string;
  profile: CandidateProfile;
}

export async function POST(req: Request) {
  const { question, answer, profile } = (await req.json()) as Body;

  const llmEval = await jsonCompletion<AnswerEvaluation>(
    `You are an expert interviewer providing calibrated, honest feedback.
Return strict JSON with keys:
- score: integer 0-10
- strengths: string[] (at most 3)
- gaps: string[] (at most 3)
- suggested: string (one actionable sentence)
- followUp: string (optional, one probing follow-up)
Be honest, direct, and specific. Avoid empty praise.`,
    JSON.stringify({
      candidate: {
        field: profile.field,
        position: profile.position,
        experienceYears: profile.experienceYears,
      },
      question: {
        type: question.type,
        text: question.text,
        rubric: question.rubricPoints ?? [],
      },
      candidateAnswer: answer,
    }),
  );

  const evaluation: AnswerEvaluation = llmEval ?? evaluateOffline(question, answer);

  return NextResponse.json({ evaluation, source: llmEval ? "llm" : "offline" });
}
