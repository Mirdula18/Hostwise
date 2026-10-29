import { exportEvents, importEvents, MAX_IMPORT_BYTES } from "../../src/lib/io";
import { createSampleEvent } from "../../src/lib/sample";
import { event, task } from "./fixtures";

describe("export and import", () => {
  it("round-trips identical data", () => {
    const events = [event(), createSampleEvent("2026-11-01", "2026-11-01T00:00:00.000Z")];
    const r = importEvents(exportEvents(events));
    expect(r).toEqual({ ok: true, value: events });
  });

  it("returns an error for malformed JSON", () => {
    expect(importEvents("{not json")).toEqual({ ok: false, error: "That file is not valid JSON." });
  });

  it("returns an error for JSON that is not a Hostwise export", () => {
    const r = importEvents(JSON.stringify({ version: 2, events: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/not a Hostwise export \(version/);
    expect(importEvents("null").ok).toBe(false);
  });

  it("rejects files over 2 MB", () => {
    expect(importEvents(" ".repeat(MAX_IMPORT_BYTES + 1))).toEqual({
      ok: false,
      error: "That file is larger than 2 MB.",
    });
  });

  it("rejects missing dependencies and circular tasks", () => {
    const missing = event({ tasks: [task({ id: "a", dependsOn: ["zz"] })] });
    expect(importEvents(exportEvents([missing])).ok).toBe(false);
    const loop = event({
      tasks: [task({ id: "a", dependsOn: ["b"] }), task({ id: "b", dependsOn: ["a"] })],
    });
    const r = importEvents(exportEvents([loop]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/circular/);
  });
});
