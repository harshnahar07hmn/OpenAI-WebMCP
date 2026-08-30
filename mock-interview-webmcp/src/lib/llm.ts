// Shared LLM helper. Returns null if no key set — callers use fallback.
import OpenAI from "openai";

const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export const LLM_MODEL = model;

/**
 * Ask the model for JSON matching the given shape.
 * Uses response_format: json_object to force valid JSON.
 * Returns null if no key or the call fails.
 */
export async function jsonCompletion<T>(system: string, user: string): Promise<T | null> {
  const openai = getOpenAI();
  if (!openai) return null;

  try {
    const res = await openai.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      temperature: 0.7,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const text = res.choices[0]?.message?.content?.trim();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch (err) {
    console.error("[llm] call failed, falling back:", err);
    return null;
  }
}
