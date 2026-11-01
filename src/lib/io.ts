import { KIB } from "./constants";
import { err, ok, type Result } from "./result";
import { nonEmpty } from "./text";
import { detectCycle } from "./timeline";
import { StoreFile, type Event } from "../schemas/event";

const MAX_IMPORT_MIB = 2;
/** Largest import file accepted, in bytes. */
export const MAX_IMPORT_BYTES = MAX_IMPORT_MIB * KIB * KIB;
const JSON_INDENT = 2;

/** Serialises events as a versioned Hostwise export file. */
export function exportEvents(events: readonly Event[]): string {
  const file: StoreFile = { version: 1, events: [...events] };
  return JSON.stringify(file, null, JSON_INDENT);
}

/** A message when an event's task graph is broken (missing dependency or cycle). */
function taskGraphProblem(event: Event): string | null {
  const ids = new Set(event.tasks.map((t) => t.id));
  if (event.tasks.some((t) => t.dependsOn.some((d) => !ids.has(d)))) {
    return `"${event.profile.title}" has a task that depends on a missing task.`;
  }
  if (detectCycle(event.tasks)) return `"${event.profile.title}" has circular task dependencies.`;
  return null;
}

/**
 * Parses an exported file. Never throws: malformed, oversized or inconsistent
 * input returns an error message and the caller's state is left untouched.
 */
export function importEvents(text: string): Result<Event[]> {
  if (new Blob([text]).size > MAX_IMPORT_BYTES) return err("That file is larger than 2 MB.");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return err("That file is not valid JSON.");
  }
  const parsed = StoreFile.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = nonEmpty(issue?.path.join(".")) ?? "file";
    return err(`That file is not a Hostwise export (${where}: ${issue?.message ?? "invalid"}).`);
  }
  for (const event of parsed.data.events) {
    const problem = taskGraphProblem(event);
    if (problem) return err(problem);
  }
  return ok(parsed.data.events);
}
