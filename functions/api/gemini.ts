import { callGemini, type GeminiEnv } from "./_lib/gemini";
import { RateLimiter } from "./_lib/rateLimit";
import { RequestEnvelope, TaskInputs } from "./_lib/schemas";

/** Minimal Pages Function context; avoids pulling Workers globals into the app's types. */
type Context = { request: Request; env: GeminiEnv };

export const MAX_BODY_BYTES = 16 * 1024;

const LOCAL_ORIGINS = new Set([
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:8788",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8788",
]);
/** Production and preview deployments of this Pages project. */
const PAGES_ORIGIN = /^https:\/\/([a-z0-9-]+\.)?hostwise\.pages\.dev$/;

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

export type HandlerDeps = { fetchImpl?: typeof fetch; limiter?: RateLimiter; now?: () => number };

export function createHandler({
  fetchImpl = (...args) => fetch(...args),
  limiter = new RateLimiter(),
  now = Date.now,
}: HandlerDeps = {}) {
  return async ({ request, env }: Context): Promise<Response> => {
    if (request.method !== "POST") return fail("method_not_allowed", 405, { allow: "POST" });
    if (!isAllowedOrigin(request.headers.get("origin"), request.url)) {
      return fail("forbidden_origin", 403);
    }
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > MAX_BODY_BYTES) return fail("too_large", 413);

    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    if (!limiter.take(ip, now())) return fail("rate_limited", 429, { "retry-after": "60" });

    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return fail("too_large", 413);

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return fail("bad_request", 400);
    }
    const envelope = RequestEnvelope.safeParse(body);
    if (!envelope.success) return fail("bad_request", 400);
    const input = TaskInputs[envelope.data.task].safeParse(envelope.data.input);
    if (!input.success) return fail("bad_request", 400);

    const result = await callGemini(env, envelope.data.task, input.data, fetchImpl);
    if (!result.ok) return fail(result.failure.code, result.failure.status);
    return json({ data: result.data }, 200);
  };
}

/** One entry for every method so non-POST requests get a 405 instead of the SPA fallback. */
export const onRequest = createHandler();
