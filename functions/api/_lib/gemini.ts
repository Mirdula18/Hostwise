import { buildGeminiRequest } from "./prompts";
import type { TaskName } from "./schemas";

export type GeminiEnv = { GEMINI_API_KEY?: string; GEMINI_MODEL?: string };

/** Used only when GEMINI_MODEL is not set; override it in the Pages dashboard. */
export const DEFAULT_MODEL = "gemini-2.5-flash";
const TIMEOUT_MS = 20_000;

type GeminiFailure = {
  status: 502 | 503 | 504;
  code: "upstream_error" | "bad_output" | "timeout" | "not_configured";
};

type GeminiResult = { ok: true; data: unknown } | { ok: false; failure: GeminiFailure };

type GenerateContentResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

/**
 * Calls generateContent with the key in a header (never in the URL). Upstream bodies
 * are never returned to the caller, only a generic failure code.
 */
export async function callGemini(
  env: GeminiEnv,
  task: TaskName,
  input: unknown,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = TIMEOUT_MS,
): Promise<GeminiResult> {
  const key = env.GEMINI_API_KEY?.trim();
  if (!key) return { ok: false, failure: { status: 503, code: "not_configured" } };
  const model = env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  if (!/^[\w.-]+$/.test(model)) {
    return { ok: false, failure: { status: 503, code: "not_configured" } };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(buildGeminiRequest(task, input)),
        signal: controller.signal,
      },
    );
    if (!res.ok) return { ok: false, failure: { status: 502, code: "upstream_error" } };
    const body = (await res.json()) as GenerateContentResponse;
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!text) return { ok: false, failure: { status: 502, code: "bad_output" } };
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch (e) {
    if (controller.signal.aborted) {
      return { ok: false, failure: { status: 504, code: "timeout" } };
    }
    return {
      ok: false,
      failure: { status: 502, code: e instanceof SyntaxError ? "bad_output" : "upstream_error" },
    };
  } finally {
    clearTimeout(timer);
  }
}
