"use client";

import { useRegisterWebMCP } from "@/lib/registerTools";
import { useInterview } from "@/lib/store";
import { ProfileForm } from "@/components/ProfileForm";
import { InterviewView } from "@/components/InterviewView";
import { SummaryView } from "@/components/SummaryView";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { DevInspector } from "@/components/DevInspector";

export default function Home() {
  useRegisterWebMCP();
  const phase = useInterview((s) => s.phase);
  const profile = useInterview((s) => s.profile);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="chip bg-accent/20 text-accent">WebMCP</span>
          <h1 className="text-2xl md:text-3xl font-bold">Mock Interview Coach</h1>
        </div>
        <p className="text-gray-400 max-w-3xl">
          Open this page inside the ChatGPT desktop app browser. Then say{" "}
          <span className="text-white">&quot;start a mock interview&quot;</span> — the agent will use the
          tools this page exposes to interview you. Answer each question in the box below and press
          Submit; the agent picks up your answer and gives feedback.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">
          {phase === "profile" && <ProfileForm />}
          {phase === "in_progress" && <InterviewView />}
          {phase === "review" && <SummaryView />}

          {phase === "profile" && profile && (
            <section className="card p-6">
              <h2 className="text-lg font-semibold mb-2">Profile saved ✓</h2>
              <p className="text-sm text-gray-400">
                Now open ChatGPT&apos;s built-in browser (or use the dev inspector) and say
                <em className="text-accent"> &quot;start the interview&quot;</em>. The agent will call the{" "}
                <code className="bg-white/10 rounded px-1">start_interview</code> tool.
              </p>
              <pre className="mt-3 text-xs bg-black/60 rounded p-2 border border-white/5 overflow-auto">
{JSON.stringify(profile, null, 2)}
              </pre>
            </section>
          )}
        </div>

        <TranscriptPanel />
      </div>

      <footer className="text-center text-xs text-gray-600 pt-8">
        Built for the OpenAI WebMCP Challenge · {new Date().getFullYear()}
      </footer>

      <DevInspector />
    </main>
  );
}
