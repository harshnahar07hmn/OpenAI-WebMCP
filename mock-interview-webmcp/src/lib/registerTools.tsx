"use client";

// Registers all WebMCP tools with the browser. Called once on page mount.
// Each tool is idempotent (safe to call twice). The `execute` handlers
// use the Zustand store to mutate the UI and the answer-bridge to
// block on human input where the design calls for it.

import { useEffect } from "react";
import { useInterview } from "@/lib/store";
import { apiGenerateQuestion, apiEvaluateAnswer, apiSummarize } from "@/lib/api";
import { awaitAnswer, cancelPending } from "@/lib/answerBridge";
import { difficultyFor } from "@/lib/questionBank";
import type { CandidateProfile, Difficulty, QuestionType } from "@/lib/types";

const TYPE_ROTATION_ARR: QuestionType[] = [
  "behavioral",
  "technical",
  "situational",
  "technical",
  "system_design",
  "culture_fit",
];

interface ToolStatus {
  registered: boolean;
  supported: boolean;
  count: number;
  error?: string;
}

const statusListeners = new Set<(s: ToolStatus) => void>();
let latestStatus: ToolStatus = { registered: false, supported: false, count: 0 };
function setStatus(s: ToolStatus) {
  latestStatus = s;
  statusListeners.forEach((l) => l(s));
}
export function subscribeToolStatus(l: (s: ToolStatus) => void) {
  statusListeners.add(l);
  l(latestStatus);
  return () => {
    statusListeners.delete(l);
  };
}
export function getToolStatus() {
  return latestStatus;
}

// Registry of tool defs so the dev inspector can list & manually invoke them
// even when the browser doesn't support WebMCP.
export interface LocalToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  execute: (input: any) => Promise<any>;
  readOnly: boolean;
}

let LOCAL_TOOLS: LocalToolDef[] = [];
export function getLocalTools(): LocalToolDef[] {
  return LOCAL_TOOLS;
}

function buildTools(): LocalToolDef[] {
  const store = useInterview.getState;

  return [
    // ─────────────────────────────────────────────────────────────────────
    // Profile
    // ─────────────────────────────────────────────────────────────────────
    {
      name: "set_candidate_profile",
      title: "Set candidate profile",
      description:
        "Set or update the candidate's field, target position, years of experience, and skills. Call this FIRST before starting an interview.",
      inputSchema: {
        type: "object",
        properties: {
          field: { type: "string", description: "Broad field, e.g. 'Software Engineering'." },
          position: { type: "string", description: "Specific role, e.g. 'Senior Backend Engineer'." },
          experienceYears: { type: "number", minimum: 0, maximum: 50 },
          skills: {
            type: "array",
            items: { type: "string" },
            description: "Concrete technologies/skills, e.g. ['Python','AWS','PostgreSQL'].",
          },
          focusAreas: {
            type: "array",
            items: { type: "string" },
            description: "Optional weak spots the candidate wants to drill.",
          },
        },
        required: ["field", "position", "experienceYears", "skills"],
        additionalProperties: false,
      },
      readOnly: false,
      execute: async (input) => {
        const profile: CandidateProfile = {
          field: String(input.field),
          position: String(input.position),
          experienceYears: Number(input.experienceYears),
          skills: Array.isArray(input.skills) ? input.skills.map(String) : [],
          focusAreas: Array.isArray(input.focusAreas) ? input.focusAreas.map(String) : undefined,
        };
        store().setProfile(profile);
        return {
          status: "profile_set",
          profile,
          inferred_difficulty: difficultyFor(profile.experienceYears),
          next_action_hint:
            "Profile saved. Call `start_interview` to begin. The candidate is watching the page.",
        };
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // Interview lifecycle
    // ─────────────────────────────────────────────────────────────────────
    {
      name: "start_interview",
      title: "Start the mock interview",
      description:
        "Begin the mock interview. Optionally set total questions (default 6) and difficulty override. After calling this, IMMEDIATELY call `conduct_interview` to run the whole session autonomously — that single call handles the entire ask/wait/evaluate loop until the interview ends.",
      inputSchema: {
        type: "object",
        properties: {
          totalQuestions: { type: "number", minimum: 3, maximum: 20 },
          difficulty: { type: "string", enum: ["junior", "mid", "senior"] },
        },
        additionalProperties: false,
      },
      readOnly: false,
      execute: async (input) => {
        const s = store();
        if (!s.profile) {
          return {
            error: "no_profile",
            message:
              "Candidate profile not set. Call `set_candidate_profile` first with field, position, experienceYears, skills.",
          };
        }
        const partial: { totalQuestions?: number; difficulty?: Difficulty } = {};
        if (typeof input?.totalQuestions === "number") partial.totalQuestions = input.totalQuestions;
        if (input?.difficulty) partial.difficulty = input.difficulty as Difficulty;
        s.startInterview(partial);
        const updated = store();
        return {
          status: "started",
          totalQuestions: updated.config.totalQuestions,
          difficulty: updated.config.difficulty,
          next_action_hint:
            "IMPORTANT: Call `conduct_interview` now. That single tool runs the entire ask → wait → evaluate loop for all questions and returns only when the candidate is done. Do NOT call ask_next_question / wait_for_answer / evaluate_answer manually.",
        };
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // The self-driving loop — the AI just calls this once.
    // ─────────────────────────────────────────────────────────────────────
    {
      name: "conduct_interview",
      title: "Run the entire interview loop autonomously",
      description:
        "Runs the full interview from the current question count to the end. For each remaining question: fetches it, displays it on the page, WAITS for the candidate to type and submit their answer, evaluates the answer, and moves on. Returns only when all questions are done, and includes the final report. This is the ONE tool you should call after `start_interview`.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      readOnly: false,
      execute: async () => {
        const s0 = store();
        if (!s0.profile) return { error: "no_profile", message: "Set profile first." };
        if (s0.phase !== "in_progress") return { error: "not_started", message: "Call `start_interview` first." };

        const perQuestionResults: Array<{
          index: number;
          question: string;
          type: QuestionType;
          answer: string;
          score: number;
          strengths: string[];
          gaps: string[];
        }> = [];

        // Loop until we've asked all planned questions
        // (state can change between iterations; re-read each time)
        // Safety cap: never exceed configured totalQuestions
        while (true) {
          const s = store();
          const answeredSoFar = s.history.filter((h) => h.evaluation).length;
          if (answeredSoFar >= s.config.totalQuestions) break;

          // 1. Ask next
          const index = s.history.length + 1;
          if (index > s.config.totalQuestions) break;
          const askedTexts = s.history.map((h) => h.question.text);
          const question = await apiGenerateQuestion({
            profile: s.profile!,
            index,
            difficulty: s.config.difficulty,
            askedTexts,
            ...(TYPE_ROTATION_ARR[(index - 1) % TYPE_ROTATION_ARR.length]
              ? { desiredType: TYPE_ROTATION_ARR[(index - 1) % TYPE_ROTATION_ARR.length] as QuestionType }
              : {}),
          });
          store().setCurrentQuestion(question);

          // 2. Wait for candidate to type + submit
          let answer: string;
          try {
            answer = await awaitAnswer(question.id, 15 * 60 * 1000);
          } catch (err) {
            return {
              status: "aborted",
              reason: String(err instanceof Error ? err.message : err),
              partial_results: perQuestionResults,
              next_action_hint:
                "The candidate skipped or timed out. You may call `end_interview` to generate a report from what we have, or `reset_session` to start over.",
            };
          }
          store().recordAnswer(answer);

          // 3. Evaluate
          const evaluation = await apiEvaluateAnswer({
            question,
            answer,
            profile: store().profile!,
          });
          store().recordEvaluation(evaluation);

          perQuestionResults.push({
            index,
            question: question.text,
            type: question.type,
            answer,
            score: evaluation.score,
            strengths: evaluation.strengths,
            gaps: evaluation.gaps,
          });
        }

        // 4. Auto-summarize
        const s = store();
        const summary = await apiSummarize({ profile: s.profile!, history: s.history });
        store().endInterview(summary);

        return {
          status: "complete",
          per_question: perQuestionResults,
          final_summary: summary,
          next_action_hint:
            "Interview complete. Share the summary with the candidate in a warm, encouraging tone. If they want another round, call `reset_session`.",
        };
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // Ask + wait loop
    // ─────────────────────────────────────────────────────────────────────
    {
      name: "ask_next_question",
      title: "Fetch the next interview question",
      description:
        "Generate and display the next question. Returns the question text you should ask the candidate. Also updates the on-screen question panel.",
      inputSchema: {
        type: "object",
        properties: {
          desiredType: {
            type: "string",
            enum: ["behavioral", "technical", "system_design", "situational", "culture_fit"],
            description: "Optional override for what kind of question to ask next.",
          },
        },
        additionalProperties: false,
      },
      readOnly: false,
      execute: async (input) => {
        const s = store();
        if (!s.profile) return { error: "no_profile", message: "Set profile first." };
        if (s.phase !== "in_progress") return { error: "not_started", message: "Call `start_interview` first." };

        const askedTexts = s.history.map((h) => h.question.text);
        const index = s.history.length + 1;

        if (index > s.config.totalQuestions) {
          return {
            error: "interview_complete",
            message: "All planned questions asked. Call `end_interview` for the summary.",
          };
        }

        const question = await apiGenerateQuestion({
          profile: s.profile,
          index,
          difficulty: s.config.difficulty,
          askedTexts,
          ...(input?.desiredType ? { desiredType: input.desiredType as QuestionType } : {}),
        });

        store().setCurrentQuestion(question);
        return {
          question: question.text,
          type: question.type,
          index,
          totalQuestions: s.config.totalQuestions,
          hint_for_candidate: question.hint,
          next_action_hint:
            "Ask the candidate this question verbatim. Then call `wait_for_answer` — that call BLOCKS until the candidate types their answer on the page and clicks Submit.",
        };
      },
    },

    {
      name: "wait_for_answer",
      title: "Block until the candidate submits an answer",
      description:
        "Waits for the candidate to type their answer in the on-page textarea and click Submit. Returns the answer text. Call this AFTER `ask_next_question`.",
      inputSchema: {
        type: "object",
        properties: {
          timeoutSeconds: { type: "number", minimum: 5, maximum: 900, description: "Default 600 (10 min)." },
        },
        additionalProperties: false,
      },
      readOnly: true,
      execute: async (input) => {
        const s = store();
        if (!s.currentQuestion) {
          return { error: "no_question", message: "No question is active. Call `ask_next_question` first." };
        }
        try {
          const timeoutMs = (Number(input?.timeoutSeconds) || 600) * 1000;
          const answer = await awaitAnswer(s.currentQuestion.id, timeoutMs);
          store().recordAnswer(answer);
          return {
            answer,
            next_action_hint:
              "Call `evaluate_answer` to get the scored evaluation, then `ask_next_question` for the next one (or `end_interview` if this was the last).",
          };
        } catch (err) {
          return { error: "wait_failed", message: String(err instanceof Error ? err.message : err) };
        }
      },
    },

    {
      name: "evaluate_answer",
      title: "Score the most recent answer",
      description:
        "Evaluate the last submitted answer. Returns strengths, gaps, a suggestion, and a 0-10 score. The evaluation also appears in the on-page transcript.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      readOnly: false,
      execute: async () => {
        const s = store();
        if (!s.profile) return { error: "no_profile" };
        const last = s.history[s.history.length - 1];
        if (!last || !last.answer) {
          return { error: "no_answer", message: "No answered question to evaluate. Call `wait_for_answer` first." };
        }
        const evaluation = await apiEvaluateAnswer({
          question: last.question,
          answer: last.answer,
          profile: s.profile,
        });
        store().recordEvaluation(evaluation);

        const remaining = s.config.totalQuestions - s.history.length;
        return {
          evaluation,
          remaining_questions: remaining,
          next_action_hint:
            remaining > 0
              ? "Share the strengths and one gap with the candidate briefly, then call `ask_next_question`."
              : "That was the last question. Share the evaluation, then call `end_interview` to generate the final report.",
        };
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // Convenience / read-only
    // ─────────────────────────────────────────────────────────────────────
    {
      name: "get_transcript",
      title: "Get the full interview transcript",
      description: "Returns the full list of asked questions, given answers, and evaluations so far.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      readOnly: true,
      execute: async () => {
        const s = store();
        return {
          phase: s.phase,
          profile: s.profile,
          totalQuestions: s.config.totalQuestions,
          transcript: s.history,
        };
      },
    },

    {
      name: "skip_question",
      title: "Skip the current question",
      description: "Cancel the pending wait_for_answer and move on. Useful if the candidate is stuck.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      readOnly: false,
      execute: async () => {
        cancelPending("Skipped by interviewer.");
        return { status: "skipped", next_action_hint: "Call `ask_next_question` for a new question." };
      },
    },

    {
      name: "end_interview",
      title: "End the interview and generate a summary report",
      description:
        "Ends the session and produces a final report: overall score, strengths, development areas, hire recommendation, and next steps.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      readOnly: false,
      execute: async () => {
        cancelPending("Interview ended.");
        const s = store();
        if (!s.profile) return { error: "no_profile" };
        const summary = await apiSummarize({ profile: s.profile, history: s.history });
        store().endInterview(summary);
        return {
          summary,
          next_action_hint:
            "Share the summary with the candidate. Call `reset_session` if they want to try again.",
        };
      },
    },

    {
      name: "reset_session",
      title: "Reset the session",
      description: "Clear all state. Returns to the profile screen so a new interview can start.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      readOnly: false,
      execute: async () => {
        cancelPending("Session reset.");
        store().reset();
        return { status: "reset", next_action_hint: "Call `set_candidate_profile` to begin again." };
      },
    },
  ];
}

async function registerAll() {
  LOCAL_TOOLS = buildTools();

  const mc = typeof document !== "undefined" ? document.modelContext : undefined;
  if (!mc || typeof mc.registerTool !== "function") {
    setStatus({
      registered: false,
      supported: false,
      count: LOCAL_TOOLS.length,
      error: "WebMCP not supported in this browser. Use the dev inspector below.",
    });
    return;
  }

  try {
    await Promise.all(
      LOCAL_TOOLS.map((t) =>
        mc.registerTool({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: { readOnlyHint: t.readOnly },
          execute: async (input, _opts) => {
            const result = await t.execute(input);
            return typeof result === "string" ? result : JSON.stringify(result);
          },
        }),
      ),
    );
    setStatus({ registered: true, supported: true, count: LOCAL_TOOLS.length });
    console.info(`[webmcp] Registered ${LOCAL_TOOLS.length} tools.`);
  } catch (err) {
    setStatus({
      registered: false,
      supported: true,
      count: LOCAL_TOOLS.length,
      error: String(err instanceof Error ? err.message : err),
    });
  }
}

/** React hook — mount once at the app root. */
export function useRegisterWebMCP() {
  useEffect(() => {
    registerAll();
  }, []);
}
