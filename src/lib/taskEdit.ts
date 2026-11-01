/** Adding, editing and deleting tasks; every edit keeps the dependency graph valid. */

import { makeId, type IdGen } from "./id";
import { err, ok, type Result } from "./result";
import { detectCycle } from "./taskGraph";
import type { Task } from "../schemas/event";

/** Fields the host can set when adding or editing a task. */
export type TaskInput = Pick<Task, "title" | "category" | "dueDate" | "dependsOn"> &
  Partial<Pick<Task, "status" | "vendorId">>;

/** Why a task edit was refused. */
export type TaskEditError =
  | { kind: "not_found" }
  | { kind: "unknown_dependency"; id: string }
  | { kind: "cycle"; message: string };

function validateGraph(tasks: Task[]): Result<Task[], TaskEditError> {
  const ids = new Set(tasks.map((t) => t.id));
  for (const t of tasks) {
    const missing = t.dependsOn.find((d) => !ids.has(d));
    if (missing) return err({ kind: "unknown_dependency", id: missing });
  }
  const cycle = detectCycle(tasks);
  if (cycle) {
    const titles = cycle.map((id) => tasks.find((t) => t.id === id)?.title ?? id);
    return err({ kind: "cycle", message: `Circular dependency: ${titles.join(" → ")}` });
  }
  return ok(tasks);
}

/** Adds a custom task; refused if it names an unknown dependency or creates a cycle. */
export function addTask(
  tasks: readonly Task[],
  input: TaskInput,
  idGen: IdGen = makeId,
): Result<Task[], TaskEditError> {
  const task: Task = {
    id: idGen("task"),
    status: "todo",
    custom: true,
    delayDays: 0,
    ...input,
  };
  return validateGraph([...tasks, task]);
}

/** Edits a task; refused if the task is unknown or the change creates a cycle. */
export function updateTask(
  tasks: readonly Task[],
  id: string,
  patch: Partial<TaskInput>,
): Result<Task[], TaskEditError> {
  if (!tasks.some((t) => t.id === id)) return err({ kind: "not_found" });
  return validateGraph(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
}

/** Removes a task and any dependency links pointing at it. */
export function deleteTask(tasks: readonly Task[], id: string): Task[] {
  return tasks
    .filter((t) => t.id !== id)
    .map((t) =>
      t.dependsOn.includes(id) ? { ...t, dependsOn: t.dependsOn.filter((d) => d !== id) } : t,
    );
}
