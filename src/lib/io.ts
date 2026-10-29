import { StoreFile, type Event } from "../schemas/event";
import { err, ok, type Result } from "./result";
import { detectCycle } from "./timeline";

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export function exportEvents(events: readonly Event[]): string {
  const file: StoreFile = { version: 1, events: [...events] };
  return JSON.stringify(file, null, 2);
}

/**
 * Parses an exported file. Never throws: malformed, oversized or inconsistent
 * input returns an error message and the caller's state is left untouched.
 */
export function importEvents(text: string): Result<Event[], string> {
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
    const where = issue?.path.join(".") || "file";
    return err(`That file is not a Hostwise export (${where}: ${issue?.message ?? "invalid"}).`);
  }
  for (const event of parsed.data.events) {
    const ids = new Set(event.tasks.map((t) => t.id));
    if (event.tasks.some((t) => t.dependsOn.some((d) => !ids.has(d)))) {
      return err(`"${event.profile.title}" has a task that depends on a missing task.`);
    }
    if (detectCycle(event.tasks)) {
      return err(`"${event.profile.title}" has circular task dependencies.`);
    }
  }
  return ok(parsed.data.events);
}
