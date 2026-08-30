"use client";

// Registers all WebMCP tools with the browser. Called once on page mount.
// Each tool is idempotent (safe to call twice). The `execute` handlers
// use the Zustand store to mutate the UI and the answer-bridge to
// block on human input where the design calls for it.

import { useEffect } from "react";
import { useInterview } from "@/lib/store";
import { apiEvaluateAnswer, apiSummarize } from "@/lib/api";
import { awaitAnswer, cancelPending } from "@/lib/answerBridge";
import { difficultyFor } from "@/lib/questionBank";
import type { CandidateProfile, Difficulty, QuestionType } from "@/lib/types";

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

interface PlannedQuestion {
  text: string;
  type: QuestionType;
  rubricPoints?: string[];
  hint?: string;
}

// Holds the AI-authored question set between `start_interview` (which
// receives them) and `run_interview` (which asks them one by one). Module
// scoped rather than in the Zustand store since it's transient plan state,
// not something the UI needs to render.
let plannedQuestions: PlannedQuestion[] = [];

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
      title: "Start the mock interview with all your generated questions",
      description:
        "Begin the mock interview. YOU (the AI) must write ALL the interview questions yourself, right now, in this single call — there is no built-in question bank. Pass them as the `questions` array, each genuinely tailored to the candidate's profile (use their exact field/position/skills/experience — vary the type across behavioral, technical, situational, system_design, culture_fit). After this call, IMMEDIATELY call `run_interview` (no arguments) — that ONE call runs the entire ask/wait/evaluate loop for every question and blocks until the candidate finishes, returning the full transcript and final report at the end. Do not try to ask questions one at a time yourself.",
      inputSchema: {
        type: "object",
        properties: {
          difficulty: { type: "string", enum: ["junior", "mid", "senior"] },
          questions: {
            type: "array",
            minItems: 3,
            maxItems: 20,
            description:
              "ALL the questions for this interview, in order, written by you and tailored to the candidate's profile. Vary the `type` across the list.",
            items: {
              type: "object",
              properties: {
                text: { type: "string", description: "The exact question text." },
                type: {
                  type: "string",
                  enum: ["behavioral", "technical", "system_design", "situational", "culture_fit"],
                },
                rubricPoints: {
                  type: "array",
                  items: { type: "string" },
                  description: "2-4 bullet points describing what a strong answer covers.",
                },
                hint: { type: "string", description: "Optional short on-screen hint for the candidate." },
              },
              required: ["text", "type"],
              additionalProperties: false,
            },
          },
        },
        required: ["questions"],
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

        const rawQuestions = Array.isArray(input?.questions) ? input.questions : [];
        const questions: PlannedQuestion[] = rawQuestions
          .map((q: any) => ({
            text: String(q?.text ?? "").trim(),
            type: (q?.type as QuestionType) ?? "behavioral",
            rubricPoints: Array.isArray(q?.rubricPoints) ? q.rubricPoints.map(String) : undefined,
            hint: q?.hint ? String(q.hint) : undefined,
          }))
          .filter((q: PlannedQuestion) => q.text.length > 0);

        if (questions.length < 3) {
          return {
            error: "not_enough_questions",
            message: "Provide at least 3 tailored questions in the `questions` array, written by you for this candidate.",
          };
        }

        const partial: { totalQuestions?: number; difficulty?: Difficulty } = {
          totalQuestions: questions.length,
        };
        if (input?.difficulty) partial.difficulty = input.difficulty as Difficulty;
        s.startInterview(partial);
        plannedQuestions = questions;

        const updated = store();
        return {
          status: "started",
          totalQuestions: updated.config.totalQuestions,
          difficulty: updated.config.difficulty,
          next_action_hint:
            "IMPORTANT: call `run_interview` now, with no arguments. It runs the whole interview autonomously — displaying each of your questions, waiting for the candidate's answer, evaluating it, and moving to the next — and returns once with the full transcript and final report. You do not need to call anything else per question.",
        };
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // Runs the whole interview autonomously from the questions YOU supplied
    // to start_interview. One call, blocks until done.
    // ─────────────────────────────────────────────────────────────────────
    {
      name: "run_interview",
      title: "Run the entire interview using the questions you already wrote",
      description:
        "Runs the full interview using the exact questions you passed to `start_interview`. For each one: displays it, WAITS for the candidate to type and submit their answer, evaluates it, and moves to the next — automatically, without any further tool calls from you. Returns once, at the very end, with every question/answer/evaluation and the final summary report. Call this immediately after `start_interview`.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      readOnly: false,
      execute: async () => {
        const s0 = store();
        if (!s0.profile) return { error: "no_profile", message: "Set profile first." };
        if (s0.phase !== "in_progress") return { error: "not_started", message: "Call `start_interview` first." };
        if (plannedQuestions.length === 0) {
          return {
            error: "no_questions",
            message: "No questions were provided. Call `start_interview` again with a `questions` array.",
          };
        }

        const perQuestionResults: Array<{
          index: number;
          question: string;
          type: QuestionType;
          answer: string;
          score: number;
          strengths: string[];
          gaps: string[];
        }> = [];

        for (let i = 0; i < plannedQuestions.length; i++) {
          const planned = plannedQuestions[i];
          const index = i + 1;
          const question = {
            id: `q-${Date.now()}-${index}`,
            index,
            type: planned.type,
            text: planned.text,
            hint: planned.hint,
            rubricPoints: planned.rubricPoints,
          };
          store().setCurrentQuestion(question);

          let answer: string;
          try {
            answer = await awaitAnswer(question.id, 15 * 60 * 1000);
          } catch (err) {
            return {
              status: "aborted",
              reason: String(err instanceof Error ? err.message : err),
              partial_results: perQuestionResults,
              next_action_hint:
                "The candidate skipped or timed out. You may call `end_interview` (force: true) to generate a report from what we have, or `reset_session` to start over.",
            };
          }
          store().recordAnswer(answer);

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

        const s = store();
        const summary = await apiSummarize({ profile: s.profile!, history: s.history });
        store().endInterview(summary);
        plannedQuestions = [];

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
      name: "end_interview",
      title: "End the interview and generate a summary report",
      description:
        "Ends the session and produces a final report: overall score, strengths, development areas, hire recommendation, and next steps. Only call this after `remaining_questions` reached 0 from `ask_question`, OR the candidate has explicitly asked to stop early. If questions are still remaining and the candidate hasn't asked to stop, this call will be REJECTED — call `ask_question` again instead.",
      inputSchema: {
        type: "object",
        properties: {
          force: {
            type: "boolean",
            description:
              "Set true ONLY if the candidate explicitly asked to end early / skip remaining questions. Otherwise omit — ending with unanswered questions remaining is rejected by default.",
          },
        },
        additionalProperties: false,
      },
      readOnly: false,
      execute: async (input) => {
        const s = store();
        if (!s.profile) return { error: "no_profile" };

        const answered = s.history.filter((h) => h.evaluation).length;
        const remaining = s.config.totalQuestions - answered;
        const force = input?.force === true;

        if (remaining > 0 && !force) {
          return {
            error: "questions_remaining",
            questions_answered: answered,
            total_questions: s.config.totalQuestions,
            remaining_questions: remaining,
            message: `The interview isn't finished — ${remaining} of ${s.config.totalQuestions} questions haven't been asked yet.`,
            next_action_hint:
              `Do NOT end the interview yet. Generate question ${answered + 1} of ${s.config.totalQuestions} yourself, tailored to the candidate's profile, and call \`ask_question\` with it. Only call \`end_interview\` again (with force: true) if the candidate explicitly asks to stop early.`,
          };
        }

        cancelPending("Interview ended.");
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
        plannedQuestions = [];
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
