import { GoogleGenAI } from '@google/genai';

const MODEL = 'gemini-2.0-flash-lite';

function toErr(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Call Gemini with a plain text prompt and get the text response.
 * Returns empty string on any error.
 */
export async function geminiText(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return '';

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return (response.text ?? '').trim();
  } catch (e) {
    console.error('[Gemini] geminiText failed', toErr(e));
    return '';
  }
}

/**
 * Same as geminiText but strips Markdown code fences and parses JSON.
 * Returns null on parse failure.
 */
export async function geminiJSON<T = unknown>(prompt: string): Promise<T | null> {
  const raw = await geminiText(prompt);
  if (!raw) return null;
  // Strip ```json ... ``` or ``` ... ```
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to extract JSON object from response
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]) as T; } catch { /* ignore */ }
    }
    console.error('[Gemini] JSON parse failed, raw:', raw.slice(0, 200));
    return null;
  }
}
