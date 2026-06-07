/**
 * Minimal LLM client (OpenAI-compatible Chat Completions).
 *
 * Configurable via env so it works with OpenAI, OpenRouter, Together, a local
 * server, etc. If no key is set, `hasLLM()` is false and callers fall back to
 * deterministic heuristics so the app still runs end-to-end in demo mode.
 */

const BASE_URL = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";
const MODEL = process.env.LLM_MODEL ?? "gpt-5.4-mini-2026-03-17";

export function hasLLM(): boolean {
  return Boolean(process.env.LLM_API_KEY?.trim());
}

interface ChatOptions {
  system: string;
  user: string;
  temperature?: number;
}

/** Calls the chat model and returns the raw text content. */
export async function chatText({ system, user, temperature = 0.4 }: ChatOptions): Promise<string> {
  const key = process.env.LLM_API_KEY;
  if (!key) throw new Error("LLM_API_KEY is not configured");

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned an empty response");
  return content;
}

/** Calls the chat model expecting a JSON object and parses it. */
export async function chatJSON<T>(options: ChatOptions): Promise<T> {
  const text = await chatText(options);
  try {
    return JSON.parse(text) as T;
  } catch {
    // Some models wrap JSON in prose or code fences — extract the first object.
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("Failed to parse LLM JSON response");
  }
}
