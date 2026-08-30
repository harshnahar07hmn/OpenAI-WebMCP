import { create } from "zustand";
import type {
  CandidateProfile,
  InterviewConfig,
  InterviewPhase,
  QAExchange,
  Question,
  InterviewSummary,
  AnswerEvaluation,
  Difficulty,
} from "./types";
import { difficultyFor } from "./questionBank";

interface State {
  phase: InterviewPhase;
  profile: CandidateProfile | null;
  config: InterviewConfig;
  history: QAExchange[];
  currentQuestion: Question | null;
  summary: InterviewSummary | null;

  // Actions
  setProfile: (p: CandidateProfile) => void;
  startInterview: (partial?: Partial<InterviewConfig>) => void;
  setCurrentQuestion: (q: Question) => void;
  recordAnswer: (answer: string) => QAExchange | null;
  recordEvaluation: (evaluation: AnswerEvaluation) => void;
  advance: () => void;
  endInterview: (summary: InterviewSummary) => void;
  reset: () => void;
}

const defaultConfig: InterviewConfig = {
  totalQuestions: 6,
  difficulty: "mid",
  mix: ["behavioral", "technical", "situational", "technical", "system_design", "culture_fit"],
};

export const useInterview = create<State>((set, get) => ({
  phase: "profile",
  profile: null,
  config: defaultConfig,
  history: [],
  currentQuestion: null,
  summary: null,

  setProfile: (p) => {
    const inferred: Difficulty = difficultyFor(p.experienceYears);
    set({
      profile: p,
      config: { ...get().config, difficulty: inferred },
    });
  },

  startInterview: (partial) => {
    if (!get().profile) return;
    set({
      phase: "in_progress",
      config: { ...get().config, ...partial },
      history: [],
      currentQuestion: null,
      summary: null,
    });
  },

  setCurrentQuestion: (q) => {
    const exchange: QAExchange = { question: q, answer: "", askedAt: Date.now() };
    set({
      currentQuestion: q,
      history: [...get().history, exchange],
    });
  },

  recordAnswer: (answer) => {
    const history = get().history;
    if (history.length === 0) return null;
    const last = history[history.length - 1];
    const updated: QAExchange = { ...last, answer, answeredAt: Date.now() };
    const nextHistory = [...history.slice(0, -1), updated];
    set({ history: nextHistory });
    return updated;
  },

  recordEvaluation: (evaluation) => {
    const history = get().history;
    if (history.length === 0) return;
    const last = history[history.length - 1];
    const updated: QAExchange = { ...last, evaluation };
    set({ history: [...history.slice(0, -1), updated] });
  },

  advance: () => {
    // Purely a phase marker — the UI decides what "next" means.
    set({ currentQuestion: null });
  },

  endInterview: (summary) => {
    set({ phase: "review", summary, currentQuestion: null });
  },

  reset: () => {
    set({
      phase: "profile",
      profile: null,
      config: defaultConfig,
      history: [],
      currentQuestion: null,
      summary: null,
    });
  },
}));
