"use client";

import { useInterview } from "@/lib/store";

const RECO_LABEL: Record<string, string> = {
  strong_yes: "Strong Hire",
  yes: "Hire",
  maybe: "Lean No",
  no: "No Hire",
};

const RECO_COLOR: Record<string, string> = {
  strong_yes: "bg-good/20 text-good",
  yes: "bg-good/10 text-good",
  maybe: "bg-warn/20 text-warn",
  no: "bg-bad/20 text-bad",
};

export function SummaryView() {
  const phase = useInterview((s) => s.phase);
  const summary = useInterview((s) => s.summary);
  const reset = useInterview((s) => s.reset);

  if (phase !== "review" || !summary) return null;

  return (
    <section className="card p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Interview report</h2>
        <button
          onClick={reset}
          className="text-sm bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1 transition"
        >
          Start over
        </button>
      </header>

      <div className="flex items-center gap-3">
        <span className="chip bg-accent/20 text-accent text-base">
          Overall: {summary.overallScore.toFixed(1)}/10
        </span>
        <span className={`chip ${RECO_COLOR[summary.hireRecommendation] ?? "bg-white/10"} text-sm`}>
          {RECO_LABEL[summary.hireRecommendation] ?? summary.hireRecommendation}
        </span>
      </div>

      {summary.strengths.length > 0 && (
        <div>
          <p className="text-xs uppercase text-good">Strengths</p>
          <ul className="list-disc list-inside text-sm space-y-1">
            {summary.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {summary.developmentAreas.length > 0 && (
        <div>
          <p className="text-xs uppercase text-warn">Development areas</p>
          <ul className="list-disc list-inside text-sm space-y-1">
            {summary.developmentAreas.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {summary.nextSteps.length > 0 && (
        <div>
          <p className="text-xs uppercase text-accent">Next steps</p>
          <ul className="list-disc list-inside text-sm space-y-1">
            {summary.nextSteps.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
