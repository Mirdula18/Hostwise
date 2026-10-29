// @vitest-environment node
import { callGemini, DEFAULT_MODEL } from "../../functions/api/_lib/gemini";
import { RateLimiter } from "../../functions/api/_lib/rateLimit";
import { createHandler, isAllowedOrigin, MAX_BODY_BYTES } from "../../functions/api/gemini";

const KEY = "test-secret-key-that-must-never-leak-9876";
const env = { GEMINI_API_KEY: KEY, GEMINI_MODEL: "gemini-test-flash" };
const URL_ = "https://hostwise.pages.dev/api/gemini";
const ORIGIN = "https://hostwise.pages.dev";

const vendorInput = {
  category: "Catering",
  profile: { occasion: "anniversary", guestCount: 60, dietary: "vegetarian" },
};

function req(body: unknown, init: { origin?: string | null; ip?: string; method?: string } = {}) {
  const headers = new Headers({ "content-type": "application/json" });
  if (init.origin !== null) headers.set("origin", init.origin ?? ORIGIN);
  headers.set("cf-connecting-ip", init.ip ?? "1.2.3.4");
  const method = init.method ?? "POST";
  return new Request(URL_, {
    method,
    headers,
    ...(method === "POST" ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
  });
}

function geminiReply(payload: unknown, status = 200) {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
    { status },
  );
}

function setup(fetchImpl = vi.fn(async () => geminiReply({ questions: ["Q1?"] }))) {
  const handler = createHandler({ fetchImpl, limiter: new RateLimiter(20, 300_000) });
  return { handler, fetchImpl };
}

async function bodyOf(res: Response) {
  return (await res.json()) as { data?: unknown; error?: { code: string; message: string } };
}

describe("/api/gemini", () => {
  it("returns { data } on success and sends the key only in a header", async () => {
    const { handler, fetchImpl } = setup();
    const res = await handler({
      request: req({ task: "vendor_questions", input: vendorInput }),
      env,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await bodyOf(res)).toEqual({ data: { questions: ["Q1?"] } });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("models/gemini-test-flash:generateContent");
    expect(url).not.toContain(KEY);
    expect(new Headers(init.headers).get("x-goog-api-key")).toBe(KEY);
  });

  it("rejects an unknown task with 400", async () => {
    const { handler, fetchImpl } = setup();
    const res = await handler({
      request: req({ task: "free_prompt", input: { prompt: "hi" } }),
      env,
    });
    expect(res.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON and invalid task input with 400", async () => {
    const { handler } = setup();
    expect((await handler({ request: req("{nope"), env })).status).toBe(400);
    const bad = { task: "vendor_questions", input: { category: "", profile: {} } };
    expect((await handler({ request: req(bad), env })).status).toBe(400);
    const extra = { task: "vendor_questions", input: { ...vendorInput, prompt: "x" } };
    expect((await handler({ request: req(extra), env })).status).toBe(400);
  });

  it("rejects a body over 16 KB with 413", async () => {
    const { handler } = setup();
    const big = JSON.stringify({
      task: "parse_change",
      input: { text: "x".repeat(MAX_BODY_BYTES) },
    });
    expect((await handler({ request: req(big), env })).status).toBe(413);
    const lying = req(big);
    lying.headers.delete("content-length");
    expect((await handler({ request: lying, env })).status).toBe(413);
  });

  it("returns 429 on the 21st request in the window", async () => {
    const { handler } = setup();
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) {
      const res = await handler({
        request: req({ task: "vendor_questions", input: vendorInput }),
        env,
      });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses[20]).toBe(429);
    const other = await handler({
      request: req({ task: "vendor_questions", input: vendorInput }, { ip: "9.9.9.9" }),
      env,
    });
    expect(other.status).toBe(200);
  });

  it("rejects a bad or missing origin with 403", async () => {
    const { handler } = setup();
    const evil = req(
      { task: "vendor_questions", input: vendorInput },
      { origin: "https://evil.example" },
    );
    expect((await handler({ request: evil, env })).status).toBe(403);
    const none = req({ task: "vendor_questions", input: vendorInput }, { origin: null });
    expect((await handler({ request: none, env })).status).toBe(403);
  });

  it("rejects non-POST methods with 405", async () => {
    const { handler } = setup();
    const res = await handler({ request: req(null, { method: "GET" }), env });
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
  });

  it("maps an upstream 500 to 502 without echoing the upstream body", async () => {
    const { handler } = setup(
      vi.fn(async () => new Response(`internal secret details ${KEY}`, { status: 500 })),
    );
    const res = await handler({
      request: req({ task: "vendor_questions", input: vendorInput }),
      env,
    });
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).not.toContain("secret details");
    expect(text).not.toContain(KEY);
  });

  it("returns 503 when the key is not configured", async () => {
    const { handler } = setup();
    const res = await handler({
      request: req({ task: "vendor_questions", input: vendorInput }),
      env: { GEMINI_API_KEY: "" },
    });
    expect(res.status).toBe(503);
  });

  it("never includes the API key in any response body", async () => {
    const replies = [
      geminiReply({ questions: ["ok"] }),
      new Response("nope", { status: 500 }),
      new Response("{}", { status: 200 }),
    ];
    for (const reply of replies) {
      const { handler } = setup(vi.fn(async () => reply));
      const res = await handler({
        request: req({ task: "vendor_questions", input: vendorInput }),
        env,
      });
      expect(await res.text()).not.toContain(KEY);
    }
  });
});

describe("isAllowedOrigin", () => {
  it("allows same-origin, the Pages project, previews and localhost only", () => {
    expect(isAllowedOrigin("https://custom.example", "https://custom.example/api/gemini")).toBe(
      true,
    );
    expect(isAllowedOrigin("https://hostwise.pages.dev", URL_)).toBe(true);
    expect(isAllowedOrigin("https://abc123.hostwise.pages.dev", URL_)).toBe(true);
    expect(isAllowedOrigin("http://localhost:5173", URL_)).toBe(true);
    expect(isAllowedOrigin("https://hostwise.pages.dev.evil.com", URL_)).toBe(false);
    expect(isAllowedOrigin("https://nothostwise.pages.dev", URL_)).toBe(false);
    expect(isAllowedOrigin(null, URL_)).toBe(false);
  });
});

describe("callGemini", () => {
  it("uses the default model when none is set and rejects unsafe model names", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request) => geminiReply({ ok: true }));
    await callGemini({ GEMINI_API_KEY: "k" }, "plan", {}, fetchImpl);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(`models/${DEFAULT_MODEL}:`);
    const bad = await callGemini(
      { GEMINI_API_KEY: "k", GEMINI_MODEL: "x/../y?key=1" },
      "plan",
      {},
      fetchImpl,
    );
    expect(bad).toEqual({ ok: false, failure: { status: 503, code: "not_configured" } });
  });

  it("reports empty or non-JSON model output as bad_output", async () => {
    const empty = await callGemini(
      env,
      "plan",
      {},
      vi.fn(async () => new Response("{}")),
    );
    expect(empty).toEqual({ ok: false, failure: { status: 502, code: "bad_output" } });
    const text = new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: "not json" }] } }] }),
    );
    const notJson = await callGemini(
      env,
      "plan",
      {},
      vi.fn(async () => text),
    );
    expect(notJson).toEqual({ ok: false, failure: { status: 502, code: "bad_output" } });
  });

  it("maps network failures to upstream_error", async () => {
    const r = await callGemini(
      env,
      "plan",
      {},
      vi.fn(async () => Promise.reject(new TypeError("down"))),
    );
    expect(r).toEqual({ ok: false, failure: { status: 502, code: "upstream_error" } });
  });

  it("aborts after the timeout and returns 504", async () => {
    const hang = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const r = await callGemini(env, "plan", {}, hang, 10);
    expect(r).toEqual({ ok: false, failure: { status: 504, code: "timeout" } });
  });
});

describe("RateLimiter", () => {
  it("refills tokens over time", () => {
    const limiter = new RateLimiter(2, 1000);
    expect(limiter.take("ip", 0)).toBe(true);
    expect(limiter.take("ip", 0)).toBe(true);
    expect(limiter.take("ip", 0)).toBe(false);
    expect(limiter.take("ip", 600)).toBe(true);
  });

  it("caps memory by evicting stale and then oldest keys", () => {
    const limiter = new RateLimiter(1, 1000, 2);
    limiter.take("a", 0);
    limiter.take("b", 0);
    limiter.take("c", 5000);
    expect(limiter.size).toBe(1);
    limiter.take("d", 5000);
    limiter.take("e", 5000);
    expect(limiter.size).toBe(2);
  });
});
