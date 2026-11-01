import { z } from "zod";
import { buildGeminiRequest } from "./prompts";
import { HTTP, SECOND_MS } from "../../../src/lib/constants";
import { parseJson } from "../../../src/lib/json";
import { err, ok, type Result } from "../../../src/lib/result";
import type { TaskName } from "./schemas";

/** Pages Function bindings: the secret key and the optional model override. */
export type GeminiEnv = { GEMINI_API_KEY?: string; GEMINI_MODEL?: string };

/** Used only when GEMINI_MODEL is not set; override it in the Pages dashboard. */
export const DEFAULT_MODEL = "gemini-2.5-flash";
const TIMEOUT_S = 20;
const TIMEOUT_MS = TIMEOUT_S * SECOND_MS;

type GeminiFailure = {
  status: (typeof HTTP)["BAD_GATEWAY" | "UNAVAILABLE" | "GATEWAY_TIMEOUT"];
  code: "upstream_error" | "bad_output" | "timeout" | "not_configured";
};

type GeminiResult = Result<unknown, GeminiFailure>;

/** The slice of Gemini's generateContent response the proxy reads. */
const GenerateContentResponse = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({ parts: z.array(z.object({ text: z.string().optional() })).optional() })
          .optional(),
      }),
    )
    .optional(),
});

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_NAME = /^[\w.-]+$/;

const NOT_CONFIGURED = err<GeminiFailure>({ status: HTTP.UNAVAILABLE, code: "not_configured" });
const BAD_OUTPUT = err<GeminiFailure>({ status: HTTP.BAD_GATEWAY, code: "bad_output" });
const UPSTREAM_ERROR = err<GeminiFailure>({ status: HTTP.BAD_GATEWAY, code: "upstream_error" });
const TIMED_OUT = err<GeminiFailure>({ status: HTTP.GATEWAY_TIMEOUT, code: "timeout" });

/** The key and model from the environment, or null when either is missing or unsafe. */
function resolveConfig(env: GeminiEnv): { key: string; model: string } | null {
  const key = env.GEMINI_API_KEY?.trim();
  const model = env.GEMINI_MODEL?.trim() ?? "";
  const chosen = model === "" ? DEFAULT_MODEL : model;
  return key && MODEL_NAME.test(chosen) ? { key, model: chosen } : null;
}

/** Joins the first candidate's text parts and parses them as JSON. */
async function readOutput(res: Response): Promise<GeminiResult> {
  if (!res.ok) return UPSTREAM_ERROR;
  const body = GenerateContentResponse.safeParse(await res.json());
  if (!body.success) return BAD_OUTPUT;
  const text = body.data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) return BAD_OUTPUT;
  return ok(parseJson(text));
}

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
  const config = resolveConfig(env);
  if (!config) return NOT_CONFIGURED;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${API_BASE}/${config.model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": config.key },
      body: JSON.stringify(buildGeminiRequest(task, input, config.model)),
      signal: controller.signal,
    });
    return await readOutput(res);
  } catch (e) {
    if (controller.signal.aborted) return TIMED_OUT;
    return e instanceof SyntaxError ? BAD_OUTPUT : UPSTREAM_ERROR;
  } finally {
    clearTimeout(timer);
  }
}
