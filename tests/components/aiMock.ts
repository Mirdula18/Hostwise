import { z } from "zod";
import { clearAICache } from "../../src/lib/ai/client";
import { sentBody } from "../must";

/** What the app sends to /api/gemini. */
const Sent = z.object({ task: z.string(), input: z.record(z.string(), z.unknown()) });

type Handler = (input: Record<string, unknown>) => unknown;
type Handlers = Partial<Record<string, Handler | "fail" | "invalid">>;

/**
 * Replaces global fetch with a fake /api/gemini. Each task returns `{ data }` from its
 * handler, a 502 for "fail", or schema-breaking data for "invalid". Never hits the network.
 */
export function mockAI(handlers: Handlers) {
  clearAICache();
  const calls: { task: string; input: Record<string, unknown> }[] = [];
  const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const { task, input } = Sent.parse(sentBody(init));
    calls.push({ task, input });
    const h = handlers[task];
    if (!h || h === "fail") {
      return new Response(JSON.stringify({ error: { code: "upstream_error", message: "x" } }), {
        status: 502,
      });
    }
    if (h === "invalid") return new Response(JSON.stringify({ data: { nonsense: true } }));
    return new Response(JSON.stringify({ data: await Promise.resolve(h(input)) }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}
