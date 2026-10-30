// @vitest-environment node
import { callGemini } from "../../functions/api/_lib/gemini";
import { RateLimiter } from "../../functions/api/_lib/rateLimit";
import { createHandler, onRequest } from "../../functions/api/gemini";

/** Edge cases of the proxy that rely on defaults: global fetch, missing headers, odd output. */

const env = { GEMINI_API_KEY: "test-secret-key-that-must-never-leak-9876", GEMINI_MODEL: "m-1" };
const ORIGIN = "https://hostwise.pages.dev";
const body = JSON.stringify({
  task: "vendor_questions",
  input: { category: "Venue", profile: { occasion: "birthday", guestCount: 40 } },
});

const reply = (parts: { text?: string }[]) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts } }] }), { status: 200 });

afterEach(() => vi.unstubAllGlobals());

describe("proxy defaults", () => {
  it("uses the global fetch when none is injected", async () => {
    const fetchSpy = vi.fn(async () => reply([{ text: '{"questions":["Q?"]}' }]));
    vi.stubGlobal("fetch", fetchSpy);
    const res = await onRequest({
      request: new Request(`${ORIGIN}/api/gemini`, {
        method: "POST",
        headers: { origin: ORIGIN },
        body,
      }),
      env,
    });
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("accepts a request with no content-length or client IP header", async () => {
    const fetchImpl = vi.fn(async () => reply([{ text: '{"questions":["Q?"]}' }]));
    const limiter = new RateLimiter(1, 60_000);
    const handler = createHandler({ fetchImpl, limiter });
    const request = () =>
      new Request(`${ORIGIN}/api/gemini`, { method: "POST", headers: { origin: ORIGIN }, body });
    expect((await handler({ request: request(), env })).status).toBe(200);
    // Every request without an IP shares the "unknown" bucket, so the second is limited.
    expect((await handler({ request: request(), env })).status).toBe(429);
  });

  it("treats parts without text as empty and joins the rest", async () => {
    const fetchImpl = vi.fn(async () => reply([{}, { text: '{"a":' }, { text: "1}" }]));
    expect(await callGemini(env, "plan", {}, fetchImpl)).toEqual({ ok: true, value: { a: 1 } });
  });

  it("calls the global fetch from callGemini by default", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply([{ text: "[]" }])),
    );
    expect(await callGemini(env, "plan", {})).toEqual({ ok: true, value: [] });
  });
});
