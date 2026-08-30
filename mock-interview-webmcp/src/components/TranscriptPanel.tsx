"use client";

import { useInterview } from "@/lib/store";

export function TranscriptPanel() {
  const history = useInterview((s) => s.history);
  const phase = useInterview((s) => s.phase);

  if (history.length === 0) return null;

  return (
    <aside className="card p-4 space-y-3 max-h-[80vh] overflow-auto">
      <header className="flex items-center justify-between">
        <h3 className="text-sm uppercase tracking-wider text-gray-400">Transcript</h3>
        <span className="chip bg-white/10 text-gray-300 text-xs">{phase}</span>
      </header>
      <ol className="space-y-3">
        {history.map((h, i) => (
          <li key={h.question.id} className="border-l-2 border-white/10 pl-3 space-y-1">
            <p className="text-xs uppercase text-gray-500">
              Q{i + 1} · {h.question.type.replace(/_/g, " ")}
            </p>
            <p className="text-sm text-gray-200">{h.question.text}</p>
            {h.answer && (
              <p className="text-sm text-accent/90 whitespace-pre-wrap">
                <span className="text-xs uppercase text-gray-500">Answer: </span>
                {h.answer}
              </p>
            )}
            {h.evaluation && (
              <p className="text-xs text-gray-400">
                Score {h.evaluation.score}/10 · {h.evaluation.suggested}
              </p>
            )}
          </li>
        ))}
      </ol>
    </aside>
  );
}
