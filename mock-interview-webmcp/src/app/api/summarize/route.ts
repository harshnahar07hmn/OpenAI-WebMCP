import { NextResponse } from "next/server";
import type { CandidateProfile, InterviewSummary, QAExchange } from "@/lib/types";
import { jsonCompletion } from "@/lib/llm";

export const runtime = "nodejs";

interface Body {
  profile: CandidateProfile;
  history: QAExchange[];
}

function offlineSummary(history: QAExchange[]): InterviewSummary {
  const answered = history.filter((h) => h.evaluation);
  const avg =
    answered.length === 0
      ? 0
      : Math.round(
          (answered.reduce((s, h) => s + (h.evaluation!.score || 0), 0) / answered.length) * 10,
        ) / 10;

  const strengths = new Set<string>();
  const gaps = new Set<string>();
  answered.forEach((h) => {
    h.evaluation!.strengths.forEach((s) => strengths.add(s));
    h.evaluation!.gaps.forEach((g) => gaps.add(g));
  });

  const rec: InterviewSummary["hireRecommendation"] =
    avg >= 8 ? "strong_yes" : avg >= 6.5 ? "yes" : avg >= 5 ? "maybe" : "no";

  return {
    overallScore: avg,
    strengths: Array.from(strengths).slice(0, 5),
    developmentAreas: Array.from(gaps).slice(0, 5),
    hireRecommendation: rec,
    nextSteps: [
      "Practice one behavioral and one technical question per day this week.",
      "Record yourself answering and self-review for hedge words and rambling.",
      "Draft a 60-second story for every bullet point on your resume.",
    ],
    generatedAt: Date.now(),
  };
}

export async function POST(req: Request) {
  const { profile, history } = (await req.json()) as Body;

  const llmSummary = await jsonCompletion<InterviewSummary>(
    `You are a senior interview coach. Produce a final report as strict JSON with keys:
- overallScore: number 0-10 (one decimal ok)
- strengths: string[] (top 3-5, specific)
- developmentAreas: string[] (top 3-5, specific and actionable)
- hireRecommendation: one of "strong_yes" | "yes" | "maybe" | "no"
- nextSteps: string[] (3-5 concrete next-week practice actions)
- generatedAt: current UNIX ms timestamp
Base the report only on the transcript provided. Be honest and calibrated.`,
    JSON.stringify({ candidate: profile, transcript: history }),
  );

  const summary = llmSummary ?? offlineSummary(history);
  return NextResponse.json({ summary, source: llmSummary ? "llm" : "offline" });
}
