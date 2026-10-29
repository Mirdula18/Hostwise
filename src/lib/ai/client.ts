import type { ZodType } from "zod";
import type { AITaskName } from "../../schemas/ai";
import { cacheKey, LRUCache } from "./cache";

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

export class AIError extends Error {
  constructor(public readonly code: AIErrorCode) {
    super(FRIENDLY[code]);
    this.name = "AIError";
  }
}

const CLIENT_TIMEOUT_MS = 20_000;
const ENDPOINT = "/api/gemini";

const sharedCache = new LRUCache<unknown>(50);

type CallOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
  cache?: LRUCache<unknown> | null;
};

type Envelope = { data?: unknown; error?: { code?: string } };

function codeForStatus(status: number): AIErrorCode {
  if (status === 429) return "rate_limited";
  if (status === 504) return "timeout";
  if (status === 400 || status === 413 || status === 403) return "bad_request";
  return "unavailable";
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
    let body: Envelope;
    try {
      body = (await res.json()) as Envelope;
    } catch {
      throw new AIError(res.ok ? "invalid_response" : codeForStatus(res.status));
    }
    if (!res.ok || body.error) {
      throw new AIError(
        body.error?.code === "bad_output" ? "invalid_response" : codeForStatus(res.status),
      );
    }
    return body.data;
  } catch (e) {
    if (e instanceof AIError) throw e;
    if (timedOut) throw new AIError("timeout");
    if (signal?.aborted) throw new AIError("aborted");
    throw new AIError("network");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

function describeIssues(issues: readonly { path: PropertyKey[]; message: string }[]): string {
  return issues
    .slice(0, 5)
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
  const hit = cache?.get(key);
  if (hit !== undefined) return hit as T;

  const first = schema.safeParse(await post(task, input, options));
  if (first.success) {
    cache?.set(key, first.data);
    return first.data;
  }
  const hint = `Your previous answer did not match the schema (${describeIssues(first.error.issues)}). Fix it and answer again.`;
  const second = schema.safeParse(await post(task, { ...input, _fixHint: hint }, options));
  if (second.success) {
    cache?.set(key, second.data);
    return second.data;
  }
  throw new AIError("invalid_response");
}

export function clearAICache(): void {
  sharedCache.clear();
}
