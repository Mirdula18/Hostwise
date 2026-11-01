import { z, type ZodType } from "zod";
import { HTTP, SECOND_MS } from "../constants";
import { cacheKey, LRUCache } from "./cache";
import type { AITaskName } from "../../schemas/ai";

type AIErrorCode =
  | "timeout"
  | "network"
  | "rate_limited"
  | "invalid_response"
  | "bad_request"
  | "unavailable"
  | "aborted";

const FRIENDLY: Record<AIErrorCode, string> = {
  timeout: "The assistant took too long to answer.",
  network: "Could not reach the assistant. Check your connection.",
  rate_limited: "Too many requests in a short time. Please wait a minute.",
  invalid_response: "The assistant's answer didn't make sense, so it was not used.",
  bad_request: "That request could not be sent to the assistant.",
  unavailable: "The assistant is unavailable right now.",
  aborted: "The request was cancelled.",
};

/** A failed AI call; `message` is always a friendly sentence safe to show the user. */
export class AIError extends Error {
  constructor(public readonly code: AIErrorCode) {
    super(FRIENDLY[code]);
    this.name = "AIError";
  }
}

const CLIENT_TIMEOUT_S = 20;
const CLIENT_TIMEOUT_MS = CLIENT_TIMEOUT_S * SECOND_MS;
const CACHE_SIZE = 50;
/** Validation issues quoted back to the model in the retry hint. */
const HINT_ISSUES = 5;
const BAD_REQUEST_STATUSES: ReadonlySet<number> = new Set([
  HTTP.BAD_REQUEST,
  HTTP.FORBIDDEN,
  HTTP.TOO_LARGE,
]);
const ENDPOINT = "/api/gemini";

const sharedCache = new LRUCache<unknown>(CACHE_SIZE);

type CallOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
  cache?: LRUCache<unknown> | null;
};

/** The proxy's reply: `{ data }` on success, `{ error: { code } }` on failure. */
const Envelope = z.object({
  data: z.unknown().optional(),
  error: z.object({ code: z.string().optional() }).optional(),
});

/** Maps a non-OK proxy response to the client's error code. */
function codeForStatus(status: number): AIErrorCode {
  if (status === HTTP.RATE_LIMITED) return "rate_limited";
  if (status === HTTP.GATEWAY_TIMEOUT) return "timeout";
  if (BAD_REQUEST_STATUSES.has(status)) return "bad_request";
  return "unavailable";
}

/** Turns a proxy response into its data, or throws the matching AIError. */
async function readEnvelope(res: Response): Promise<unknown> {
  const json: unknown = await res.json().catch(() => undefined);
  const parsed = Envelope.safeParse(json);
  if (!parsed.success) {
    throw new AIError(res.ok ? "invalid_response" : codeForStatus(res.status));
  }
  const body = parsed.data;
  if (!res.ok || body.error) {
    throw new AIError(
      body.error?.code === "bad_output" ? "invalid_response" : codeForStatus(res.status),
    );
  }
  return body.data;
}

/** Classifies a thrown error once the request has failed. */
function toAIError(e: unknown, timedOut: boolean, signal?: AbortSignal): AIError {
  if (e instanceof AIError) return e;
  if (timedOut) return new AIError("timeout");
  if (signal?.aborted) return new AIError("aborted");
  return new AIError("network");
}

async function post(
  task: AITaskName,
  input: unknown,
  { fetchImpl = (...a) => fetch(...a), timeoutMs = CLIENT_TIMEOUT_MS, signal }: CallOptions,
): Promise<unknown> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task, input }),
      signal: controller.signal,
    });
    return await readEnvelope(res);
  } catch (e) {
    throw toAIError(e, timedOut, signal);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

function describeIssues(issues: readonly { path: PropertyKey[]; message: string }[]): string {
  return issues
    .slice(0, HINT_ISSUES)
    .map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

/**
 * Calls a server-side AI task and validates the answer with `schema`. An invalid
 * answer is retried once with the validation errors as a fix hint; a second invalid
 * answer throws AIError("invalid_response"). Valid answers are cached by input.
 */
export async function callAI<T>(
  task: AITaskName,
  input: Record<string, unknown>,
  schema: ZodType<T>,
  options: CallOptions = {},
): Promise<T> {
  const cache = options.cache === undefined ? sharedCache : options.cache;
  const key = cacheKey(task, input);
  const hit = cache === null ? undefined : schema.safeParse(cache.get(key));
  if (hit?.success) return hit.data;

  let parsed = schema.safeParse(await post(task, input, options));
  if (!parsed.success) {
    const hint = `Your previous answer did not match the schema (${describeIssues(parsed.error.issues)}). Fix it and answer again.`;
    parsed = schema.safeParse(await post(task, { ...input, _fixHint: hint }, options));
  }
  if (!parsed.success) throw new AIError("invalid_response");
  cache?.set(key, parsed.data);
  return parsed.data;
}

/** Empties the shared prompt cache (used by tests and after imports). */
export function clearAICache(): void {
  sharedCache.clear();
}
