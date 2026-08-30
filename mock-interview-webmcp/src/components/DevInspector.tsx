"use client";

import { useEffect, useState } from "react";
import {
  getLocalTools,
  getToolStatus,
  subscribeToolStatus,
  type LocalToolDef,
} from "@/lib/registerTools";

/**
 * DevInspector — lets you invoke any WebMCP tool manually without needing
 * ChatGPT's built-in browser. Ships in production too; harmless, hides when
 * you close it. This is what makes the app testable in Chrome.
 */
export function DevInspector() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(getToolStatus());
  const [selected, setSelected] = useState<string>("");
  const [input, setInput] = useState<string>("{}");
  const [output, setOutput] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeToolStatus(setStatus), []);

  const tools = getLocalTools();
  const tool = tools.find((t) => t.name === selected);

  async function invoke() {
    if (!tool) return;
    setBusy(true);
    setOutput("");
    try {
      const parsed = input.trim() ? JSON.parse(input) : {};
      const result = await tool.execute(parsed);
      setOutput(JSON.stringify(result, null, 2));
    } catch (err) {
      setOutput(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 bg-panel/90 border border-white/10 hover:border-accent rounded-full px-3 py-2 text-xs shadow-xl"
        title="Open the WebMCP dev inspector"
      >
        🛠 WebMCP tools ({tools.length}){" "}
        <span className={status.registered ? "text-good" : status.supported ? "text-warn" : "text-bad"}>
          ●
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-[420px] max-h-[80vh] card p-4 space-y-3 shadow-2xl z-50 flex flex-col">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">WebMCP dev inspector</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {status.registered
              ? `${status.count} tools registered with the browser.`
              : status.supported
                ? `Browser supports WebMCP but registration failed.`
                : `Browser does not expose document.modelContext — using local invocation.`}
          </p>
          {status.error && (
            <p className="text-xs text-warn mt-1">{status.error}</p>
          )}
        </div>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white text-lg">
          ×
        </button>
      </header>

      <select
        className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-sm"
        value={selected}
        onChange={(e) => {
          setSelected(e.target.value);
          const t = tools.find((x: LocalToolDef) => x.name === e.target.value);
          setInput(defaultInput(t));
          setOutput("");
        }}
      >
        <option value="">— pick a tool —</option>
        {tools.map((t) => (
          <option key={t.name} value={t.name}>{t.name}</option>
        ))}
      </select>

      {tool && (
        <>
          <p className="text-xs text-gray-400">{tool.description}</p>
          <textarea
            className="bg-black/40 border border-white/10 rounded-lg p-2 text-xs font-mono min-h-[80px]"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            onClick={invoke}
            disabled={busy}
            className="bg-accent text-black font-semibold rounded-lg px-3 py-1 text-sm disabled:opacity-50"
          >
            {busy ? "Running…" : "Invoke"}
          </button>
          {output && (
            <pre className="bg-black/60 border border-white/10 rounded-lg p-2 text-xs whitespace-pre-wrap max-h-[240px] overflow-auto">
{output}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

function defaultInput(tool?: LocalToolDef): string {
  if (!tool) return "{}";
  const schema = tool.inputSchema as { properties?: Record<string, { type?: string }> } | undefined;
  const props = schema?.properties ?? {};
  const example: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    switch (v.type) {
      case "number":
        example[k] = 3;
        break;
      case "array":
        example[k] = [];
        break;
      case "boolean":
        example[k] = false;
        break;
      case "object":
        example[k] = {};
        break;
      default:
        example[k] = "";
    }
  }
  // Seed profile example
  if (tool.name === "set_candidate_profile") {
    return JSON.stringify(
      {
        field: "Software Engineering",
        position: "Backend Engineer",
        experienceYears: 3,
        skills: ["Python", "PostgreSQL", "AWS"],
      },
      null,
      2,
    );
  }
  return JSON.stringify(example, null, 2);
}
