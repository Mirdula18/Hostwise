import { z } from "zod";
import { AIError, callAI, clearAICache } from "../../src/lib/ai/client";
import { cacheKey, hashKey, LRUCache, stableStringify } from "../../src/lib/ai/cache";
import { debounce } from "../../src/lib/ai/debounce";

const Schema = z.object({ questions: z.array(z.string()).min(1) });

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("callAI", () => {
  beforeEach(() => clearAICache());

  it("returns parsed data on success", async () => {
    const fetchImpl = vi.fn(async () => reply({ data: { questions: ["a"] } }));
    await expect(
      callAI("vendor_questions", { category: "x" }, Schema, { fetchImpl }),
    ).resolves.toEqual({
      questions: ["a"],
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/gemini");
    expect(JSON.parse(String(init.body))).toEqual({
      task: "vendor_questions",
      input: { category: "x" },
    });
  });

  it("retries an invalid response with a fix hint and returns the valid retry", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(reply({ data: { questions: [] } }))
      .mockResolvedValueOnce(reply({ data: { questions: ["fixed"] } }));
    await expect(
      callAI("vendor_questions", { category: "x" }, Schema, { fetchImpl }),
    ).resolves.toEqual({
      questions: ["fixed"],
    });
    const second = JSON.parse(String((fetchImpl.mock.calls[1] as [string, RequestInit])[1].body));
    expect(second.input._fixHint).toMatch(/questions/);
  });

  it("throws AIError after two invalid responses", async () => {
    const fetchImpl = vi.fn(async () => reply({ data: { wrong: true } }));
    const p = callAI("vendor_questions", { category: "x" }, Schema, { fetchImpl });
    await expect(p).rejects.toBeInstanceOf(AIError);
    await expect(p).rejects.toMatchObject({ code: "invalid_response" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws AIError('timeout') when the request takes too long", async () => {
    const fetchImpl = vi.fn(
      (_u: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("x", "AbortError")),
          ),
        ),
    );
    await expect(
      callAI("plan", { a: 1 }, Schema, { fetchImpl, timeoutMs: 10 }),
    ).rejects.toMatchObject({ code: "timeout" });
  });

  it("maps server errors and network failures to typed codes", async () => {
    const cases: [Response | Error, string][] = [
      [reply({ error: { code: "rate_limited" } }, 429), "rate_limited"],
      [reply({ error: { code: "timeout" } }, 504), "timeout"],
      [reply({ error: { code: "bad_request" } }, 400), "bad_request"],
      [reply({ error: { code: "bad_output" } }, 502), "invalid_response"],
      [reply({ error: { code: "upstream_error" } }, 502), "unavailable"],
      [new Response("<html>", { status: 500 }), "unavailable"],
      [new Response("<html>", { status: 200 }), "invalid_response"],
      [new TypeError("Failed to fetch"), "network"],
    ];
    for (const [result, code] of cases) {
      const fetchImpl = vi.fn(async () => {
        if (result instanceof Error) throw result;
        return result;
      });
      await expect(
        callAI("plan", { n: code }, Schema, { fetchImpl, cache: null }),
      ).rejects.toMatchObject({ code });
    }
  });

  it("reports a caller abort as aborted", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(
      (_u: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("x", "AbortError")),
          ),
        ),
    );
    const p = callAI("plan", { a: 2 }, Schema, { fetchImpl, signal: controller.signal });
    controller.abort();
    await expect(p).rejects.toMatchObject({ code: "aborted" });
  });

  it("serves identical input from the cache without a second request", async () => {
    const fetchImpl = vi.fn(async () => reply({ data: { questions: ["a"] } }));
    await callAI("vendor_questions", { b: 1, a: 2 }, Schema, { fetchImpl });
    await callAI("vendor_questions", { a: 2, b: 1 }, Schema, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await callAI("plan", { a: 2, b: 1 }, Schema, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("cache", () => {
  it("evicts the least recently used entry", () => {
    const cache = new LRUCache<number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    cache.set("c", 3);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
    expect(cache.size).toBe(2);
    cache.set("a", 9);
    expect(cache.get("a")).toBe(9);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("builds stable keys regardless of key order and ignores undefined", () => {
    expect(stableStringify({ b: [1, { d: 1, c: 2 }], a: undefined, z: null })).toBe(
      '{"b":[1,{"c":2,"d":1}],"z":null}',
    );
    expect(stableStringify(undefined)).toBe("null");
    expect(cacheKey("t", { a: 1, b: 2 })).toBe(cacheKey("t", { b: 2, a: 1 }));
    expect(hashKey("abc")).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("debounce", () => {
  it("runs only the last call after the delay and can be cancelled", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 500);
    d(1);
    d(2);
    vi.advanceTimersByTime(499);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledWith(2);
    d(3);
    d.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
    d.cancel();
    vi.useRealTimers();
  });
});
