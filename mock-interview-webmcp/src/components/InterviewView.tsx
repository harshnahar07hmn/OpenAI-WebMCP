"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useInterview } from "@/lib/store";
import { subscribe, getSnapshot, getServerSnapshot, submitAnswer } from "@/lib/answerBridge";

export function InterviewView() {
  const phase = useInterview((s) => s.phase);
  const currentQuestion = useInterview((s) => s.currentQuestion);
  const history = useInterview((s) => s.history);
  const totalQuestions = useInterview((s) => s.config.totalQuestions);

  const pending = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [draft, setDraft] = useState("");

  // Reset draft each time a new question arrives
  useEffect(() => {
    setDraft("");
  }, [currentQuestion?.id]);

  if (phase !== "in_progress") return null;

  const activeExchange = history[history.length - 1];
  const showEval = activeExchange?.evaluation && activeExchange.answer;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (!pending) {
      // No wait active — nothing to do. Should never happen in real usage
      // since the AI's tool loop always leaves a wait_for_answer pending.
      return;
    }
    submitAnswer(trimmed);
    setDraft("");
  }

  return (
    <section className="card p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="chip bg-accent/20 text-accent">
            Question {history.length} / {totalQuestions}
          </span>
          {currentQuestion && (
            <span className="chip bg-white/10 text-gray-300">{currentQuestion.type.replace(/_/g, " ")}</span>
          )}
          {pending && (
            <span className="chip bg-warn/20 text-warn pulse-ring">Waiting for your answer…</span>
          )}
        </div>
      </header>

      {currentQuestion ? (
        <div className="space-y-3">
          <p className="text-xl leading-relaxed">{currentQuestion.text}</p>
          {currentQuestion.hint && (
            <p className="text-sm text-gray-400 italic">Hint: {currentQuestion.hint}</p>
          )}
        </div>
      ) : (
        <p className="text-gray-400 italic">
          Waiting for the interviewer (ChatGPT) to ask the next question. In the ChatGPT chat, say
          <span className="text-accent"> &quot;ask the next question&quot;</span>.
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              onSubmit(e as unknown as React.FormEvent);
            }
          }}
          placeholder={
            pending
              ? "The interviewer is waiting for your answer — type here, then press Submit."
              : "Waiting for the interviewer to ask the next question…"
          }
          disabled={!pending}
          className="w-full min-h-[140px] bg-black/40 border border-white/10 rounded-lg p-3 outline-none focus:border-accent disabled:opacity-40 disabled:cursor-not-allowed"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={!pending || !draft.trim()}
            className="bg-accent hover:bg-accent/80 disabled:bg-white/10 disabled:text-gray-500 text-black font-semibold rounded-lg px-4 py-2 transition"
          >
            Submit answer
          </button>
          <span className="text-xs text-gray-500">Ctrl/Cmd + Enter also works</span>
        </div>
      </form>

      {showEval && (
        <div className="border-t border-white/10 pt-4 space-y-2">
          <h3 className="text-sm uppercase tracking-wider text-gray-400">Feedback</h3>
          <div className="flex items-center gap-3">
            <span
              className={
                "chip " +
                (activeExchange.evaluation!.score >= 8
                  ? "bg-good/20 text-good"
                  : activeExchange.evaluation!.score >= 5
                    ? "bg-warn/20 text-warn"
                    : "bg-bad/20 text-bad")
              }
            >
              Score {activeExchange.evaluation!.score}/10
            </span>
          </div>
          {activeExchange.evaluation!.strengths.length > 0 && (
            <div>
              <p className="text-xs uppercase text-good">Strengths</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                {activeExchange.evaluation!.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {activeExchange.evaluation!.gaps.length > 0 && (
            <div>
              <p className="text-xs uppercase text-warn">Gaps</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                {activeExchange.evaluation!.gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm italic text-gray-300">
            {activeExchange.evaluation!.suggested}
          </p>
        </div>
      )}
    </section>
  );
}
