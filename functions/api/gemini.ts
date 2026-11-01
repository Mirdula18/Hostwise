import { callGemini, type GeminiEnv } from "./_lib/gemini";
import { RateLimiter } from "./_lib/rateLimit";
import { RequestEnvelope, TaskInputs, type TaskName } from "./_lib/schemas";
import { HTTP, KIB } from "../../src/lib/constants";
import { tryParseJson } from "../../src/lib/json";
import { err, ok, type Result } from "../../src/lib/result";

/** Minimal Pages Function context; avoids pulling Workers globals into the app's types. */
type Context = { request: Request; env: GeminiEnv };

const MAX_BODY_KIB = 16;
export const MAX_BODY_BYTES = MAX_BODY_KIB * KIB;
const RETRY_AFTER_SECONDS = "60";

const LOCAL_ORIGINS = new Set([
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:8788",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8788",
]);
/** Production and preview deployments of this Pages project. */
const PAGES_ORIGIN = /^https:\/\/([a-z0-9-]+\.)?hostwise\.pages\.dev$/;

/** True for same-origin, this Pages project (and previews) and local dev servers. */
export function isAllowedOrigin(origin: string | null, requestUrl: string): boolean {
  if (!origin) return false;
  if (origin === new URL(requestUrl).origin) return true;
  return LOCAL_ORIGINS.has(origin) || PAGES_ORIGIN.test(origin);
}

const MESSAGES = {
  method_not_allowed: "Use POST.",
  forbidden_origin: "Requests are only accepted from the Hostwise app.",
  too_large: "Request is too large.",
  rate_limited: "Too many requests. Please wait a few minutes and try again.",
  bad_request: "Request was not understood.",
  not_configured: "The AI service is not configured.",
  upstream_error: "The AI service had a problem. Please try again.",
  bad_output: "The AI returned something unexpected. Please try again.",
  timeout: "The AI took too long to respond. Please try again.",
} as const;

type ErrorCode = keyof typeof MESSAGES;

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });
}

function fail(code: ErrorCode, status: number, extra?: Record<string, string>): Response {
  return json({ error: { code, message: MESSAGES[code] } }, status, extra);
}

type HandlerDeps = { fetchImpl?: typeof fetch; limiter?: RateLimiter; now?: () => number };

/** Cheap checks before the body is read: method, origin, declared size and rate limit. */
function precheck(request: Request, limiter: RateLimiter, at: number): Response | null {
  if (request.method !== "POST") {
    return fail("method_not_allowed", HTTP.METHOD_NOT_ALLOWED, { allow: "POST" });
  }
  if (!isAllowedOrigin(request.headers.get("origin"), request.url)) {
    return fail("forbidden_origin", HTTP.FORBIDDEN);
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return fail("too_large", HTTP.TOO_LARGE);
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (!limiter.take(ip, at)) {
    return fail("rate_limited", HTTP.RATE_LIMITED, { "retry-after": RETRY_AFTER_SECONDS });
  }
  return null;
}

type TaskCall = { task: TaskName; input: unknown };

/** Reads the body and validates it against the envelope and the task's strict schema. */
async function readTaskCall(request: Request): Promise<Result<TaskCall, Response>> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return err(fail("too_large", HTTP.TOO_LARGE));
  }
  const envelope = RequestEnvelope.safeParse(tryParseJson(raw));
  if (!envelope.success) return err(fail("bad_request", HTTP.BAD_REQUEST));
  const input = TaskInputs[envelope.data.task].safeParse(envelope.data.input);
  if (!input.success) return err(fail("bad_request", HTTP.BAD_REQUEST));
  return ok({ task: envelope.data.task, input: input.data });
}

/** Builds the Pages Function; dependencies are injectable for tests. */
export function createHandler({
  fetchImpl = (...args) => fetch(...args),
  limiter = new RateLimiter(),
  now = Date.now,
}: HandlerDeps = {}) {
  return async ({ request, env }: Context): Promise<Response> => {
    const rejected = precheck(request, limiter, now());
    if (rejected) return rejected;
    const call = await readTaskCall(request);
    if (!call.ok) return call.error;
    const result = await callGemini(env, call.value.task, call.value.input, fetchImpl);
    if (!result.ok) return fail(result.error.code, result.error.status);
    return json({ data: result.value }, HTTP.OK);
  };
}

/** One entry for every method so non-POST requests get a 405 instead of the SPA fallback. */
export const onRequest = createHandler();
