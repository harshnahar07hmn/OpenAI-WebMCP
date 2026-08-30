# Mock Interview Coach — WebMCP

An **agent-native** mock-interview app built for the [OpenAI WebMCP Challenge](https://openai.com/webmcp-challenge/).

Open the page in ChatGPT's built-in browser, tell ChatGPT to "start a mock interview," and the agent runs the interview by calling tools this page exposes. You type your answers into the page; the agent evaluates them, tracks a running score, and produces a final report.

## The WebMCP loop

```
1. User → ChatGPT: "Interview me for a senior backend role"
2. ChatGPT → set_candidate_profile(...)
3. ChatGPT → start_interview()
4. ┌─────── loop ───────────────────────────────┐
   │ ChatGPT → ask_next_question()             │
   │ ChatGPT → wait_for_answer()   ← BLOCKS    │
   │ User    → types answer on page, submits   │
   │ ChatGPT ← receives answer                  │
   │ ChatGPT → evaluate_answer()               │
   │ ChatGPT → (speaks feedback in chat)       │
   └────────────────────────────────────────────┘
5. ChatGPT → end_interview()  → shows report
```

## Tools registered

| Tool | What it does |
| --- | --- |
| `set_candidate_profile` | Set field, position, years of experience, skills |
| `start_interview` | Begin (optional totalQuestions, difficulty override) |
| `ask_next_question` | Fetch + display the next question |
| `wait_for_answer` | **Blocks** until user submits their typed answer |
| `evaluate_answer` | Score the last answer (0–10, strengths, gaps, suggestion) |
| `get_transcript` | Read the whole session so far |
| `skip_question` | Cancel the pending wait and move on |
| `end_interview` | Generate the final report |
| `reset_session` | Clear everything and go back to the profile form |

## Run locally

```bash
cd mock-interview-webmcp
npm install
npm run dev
# open http://localhost:3000
```

The bottom-right **🛠 WebMCP tools** button opens a dev inspector — you can invoke each tool manually without needing ChatGPT's browser. Perfect for development in regular Chrome.

## Configure OpenAI (optional)

Without a key the app uses a curated question bank + rubric-based feedback (so demos always work). With a key, questions and feedback are LLM-generated.

```bash
cp .env.example .env.local
# edit .env.local:
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o-mini   # or anything JSON-mode capable
```

## Deploy to Vercel

```bash
# From this directory:
npx vercel        # follow prompts, link to a new project
# Add OPENAI_API_KEY in Vercel dashboard → Settings → Environment Variables
npx vercel --prod
```

WebMCP requires a **secure context** (HTTPS). Localhost counts; any Vercel URL counts. Origin-isolation is auto-enabled by Next.js's defaults.

## Testing in ChatGPT desktop browser

1. Update the ChatGPT desktop app to the latest version.
2. In ChatGPT, open the built-in browser and navigate to your deployment URL.
3. The address bar should show a **Site tools** indicator (that means WebMCP was detected).
4. In the ChatGPT chat panel next to the browser, say *"Please start a mock interview for a mid-level backend engineer."*

## Testing in Chrome (without ChatGPT)

Enable the flag: `chrome://flags/#enable-webmcp-testing` → Enabled → relaunch. Then install the [Model Context Tool Inspector Extension](https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd). Or just use the bottom-right dev inspector — it invokes the same tool functions directly, bypassing the `document.modelContext` API.

## Architecture

- **Next.js 15** (App Router, RSC + client components)
- **Zustand** for reactive session state
- **Custom `answerBridge`** — a tiny promise-based bridge that lets a WebMCP tool call block until the user clicks Submit on the page
- **`/api/generate-question`, `/api/evaluate-answer`, `/api/summarize`** — server routes that try OpenAI first, fall back to deterministic offline logic

## License

MIT.
