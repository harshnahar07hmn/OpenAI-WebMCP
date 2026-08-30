import { NextResponse } from "next/server";
import type { CandidateProfile, Difficulty, Question, QuestionType } from "@/lib/types";
import { pickFromBank } from "@/lib/questionBank";
import { jsonCompletion } from "@/lib/llm";

export const runtime = "nodejs";

interface Body {
  profile: CandidateProfile;
  index: number;
  difficulty: Difficulty;
  askedTexts: string[];
  desiredType?: QuestionType;
}

const TYPE_ROTATION: QuestionType[] = [
  "behavioral",
  "technical",
  "situational",
  "technical",
  "system_design",
  "culture_fit",
];

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const { profile, index, difficulty, askedTexts } = body;
  const desiredType = body.desiredType ?? TYPE_ROTATION[(index - 1) % TYPE_ROTATION.length];

  // Try LLM first
  const llmQ = await jsonCompletion<{
    type: QuestionType;
    text: string;
    rubricPoints: string[];
    hint?: string;
  }>(
    `You are an expert technical hiring manager. Ask ONE interview question tailored to the candidate.
Return strict JSON with keys: type, text, rubricPoints (array of 3 strings), hint (optional short prompt for the candidate).
Do not repeat any question in the "alreadyAsked" list.`,
    JSON.stringify({
      role: profile.position,
      field: profile.field,
      experienceYears: profile.experienceYears,
      skills: profile.skills,
      difficulty,
      questionNumber: index,
      desiredType,
      alreadyAsked: askedTexts,
    }),
  );

  let question: Question;
  if (llmQ && llmQ.text && llmQ.type) {
    question = {
      id: `q-${Date.now()}-${index}`,
      index,
      type: llmQ.type,
      text: llmQ.text,
      hint: llmQ.hint,
      rubricPoints: llmQ.rubricPoints,
    };
  } else {
    // Offline fallback
    const fromBank = pickFromBank(
      { profile, difficulty, desiredType, excludeTexts: askedTexts },
      index,
    ) ??
      pickFromBank({ profile, difficulty, excludeTexts: askedTexts }, index) ??
      pickFromBank({ profile, difficulty }, index)!;
    question = fromBank;
  }

  return NextResponse.json({ question, source: llmQ ? "llm" : "bank" });
}
