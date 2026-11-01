import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { BUCKET_DAYS, LIMITS } from "./constants";
import { makeId, type IdGen } from "./id";
import { priorityForCategory, priorityRank } from "./priorities";
import { err, ok, type Result } from "./result";
import type { AITask } from "../schemas/ai";
import type { Priority, Task } from "../schemas/event";

/** Dates are ISO `yyyy-MM-dd` strings, interpreted as local calendar days. */
export function shiftDate(iso: string, days: number): string {
  return format(addDays(parseISO(iso), days), "yyyy-MM-dd");
}

/** Calendar days from `fromIso` to `toIso`; negative when `toIso` is earlier. */
export function daysBetween(fromIso: string, toIso: string): number {
  return differenceInCalendarDays(parseISO(toIso), parseISO(fromIso));
}

/** Today as a local `yyyy-MM-dd` date. */
export function todayIso(now: Date = new Date()): string {
  return format(now, "yyyy-MM-dd");
}

/** True when `iso` is strictly after `today`. */
export function isFutureDate(iso: string, today: string): boolean {
  return daysBetween(today, iso) > 0;
}

type Graph = Map<string, string[]>;

function graphOf(tasks: readonly Pick<Task, "id" | "dependsOn">[]): Graph {
  const ids = new Set(tasks.map((t) => t.id));
  return new Map(tasks.map((t) => [t.id, t.dependsOn.filter((d) => ids.has(d))]));
}

const VISITING = 1;
const VISITED = 2;

/** Returns one cycle as a list of ids (first id repeated at the end), or null if acyclic. */
export function detectCycle(tasks: readonly Pick<Task, "id" | "dependsOn">[]): string[] | null {
  const graph = graphOf(tasks);
  const state = new Map<string, typeof VISITING | typeof VISITED>();
  const stack: string[] = [];

  const visit = (id: string): string[] | null => {
    state.set(id, VISITING);
    stack.push(id);
    for (const dep of graph.get(id) ?? []) {
      const s = state.get(dep);
      if (s === VISITING) return [...stack.slice(stack.indexOf(dep)), dep];
      if (s === undefined) {
        const found = visit(dep);
        if (found) return found;
      }
    }
    stack.pop();
    state.set(id, VISITED);
    return null;
  };

  for (const id of graph.keys()) {
    if (!state.has(id)) {
      const found = visit(id);
      if (found) return found;
    }
  }
  return null;
}

/** Thrown by `topoSort` when tasks depend on each other in a loop. */
export class CycleError extends Error {
  constructor(public readonly cycle: string[]) {
    super(`Circular dependency: ${cycle.join(" → ")}`);
    this.name = "CycleError";
  }
}

/**
 * Orders tasks so every dependency comes before its dependents.
 * Ties are broken by due date, then input order. Throws CycleError on a cycle.
 */
export function topoSort(tasks: readonly Task[]): Task[] {
  const cycle = detectCycle(tasks);
  if (cycle) throw new CycleError(cycle);
  const graph = graphOf(tasks);
  const index = new Map(tasks.map((t, i) => [t.id, i]));
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const indegree = new Map(tasks.map((t) => [t.id, graph.get(t.id)?.length ?? 0]));
  const dependents = dependentsMap(tasks);

  const cmp = (a: string, b: string) => {
    const ta = byId.get(a);
    const tb = byId.get(b);
    const byDate = (ta?.dueDate ?? "").localeCompare(tb?.dueDate ?? "");
    return byDate || (index.get(a) ?? 0) - (index.get(b) ?? 0);
  };
  const ready = tasks.filter((t) => indegree.get(t.id) === 0).map((t) => t.id);
  const out: Task[] = [];
  for (let id = next(ready, cmp); id !== undefined; id = next(ready, cmp)) {
    const task = byId.get(id);
    if (task) out.push(task);
    for (const child of dependents.get(id) ?? []) {
      const n = (indegree.get(child) ?? 0) - 1;
      indegree.set(child, n);
      if (n === 0) ready.push(child);
    }
  }
  return out;
}

/** Sorts the ready list and takes its first id (undefined when empty). */
function next(ready: string[], cmp: (a: string, b: string) => number): string | undefined {
  ready.sort(cmp);
  return ready.shift();
}

/** id -> ids of tasks that directly depend on it. */
function dependentsMap(tasks: readonly Pick<Task, "id" | "dependsOn">[]): Graph {
  const map: Graph = new Map(tasks.map((t) => [t.id, []]));
  for (const t of tasks) {
    for (const d of t.dependsOn) map.get(d)?.push(t.id);
  }
  return map;
}

/** All tasks that depend on `id`, directly or transitively (excluding `id`). */
export function transitiveDependents(tasks: readonly Task[], id: string): string[] {
  const deps = dependentsMap(tasks);
  const seen = new Set<string>();
  const queue = [...(deps.get(id) ?? [])];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    if (next === id || seen.has(next)) continue;
    seen.add(next);
    queue.push(...(deps.get(next) ?? []));
  }
  return [...seen];
}

type ToDatesResult = { tasks: Task[]; notes: string[] };

/** Removes the closing edge of each cycle in place; returns one note per removed edge. */
function breakCycles(tasks: Task[]): string[] {
  const notes: string[] = [];
  let cycle = detectCycle(tasks);
  while (cycle) {
    const [from, to] = cycle.slice(-CYCLE_EDGE);
    const task = tasks.find((x) => x.id === from);
    if (!task) break;
    task.dependsOn = task.dependsOn.filter((d) => d !== to);
    const toTitle = tasks.find((x) => x.id === to)?.title ?? "another task";
    notes.push(`Removed a circular link: "${task.title}" no longer waits for "${toTitle}".`);
    cycle = detectCycle(tasks);
  }
  return notes;
}

/** The last two ids of a detected cycle form the edge that closes it. */
const CYCLE_EDGE = 2;

/**
 * Converts AI tasks (offsets in days before the event, key-based deps) into dated tasks.
 * Unknown dependency keys are dropped; edges that would create a cycle are dropped
 * and reported in `notes`.
 */
export function toDates(
  aiTasks: readonly AITask[],
  eventDate: string,
  idGen: IdGen = makeId,
): ToDatesResult {
  const idForKey = new Map<string, string>();
  for (const t of aiTasks) {
    if (!idForKey.has(t.key)) idForKey.set(t.key, idGen("task"));
  }
  const tasks: Task[] = [];
  const seenKeys = new Set<string>();
  for (const t of aiTasks) {
    const id = idForKey.get(t.key);
    if (id === undefined || seenKeys.has(t.key)) continue;
    seenKeys.add(t.key);
    tasks.push({
      id,
      title: t.title,
      category: t.category,
      dueDate: shiftDate(eventDate, -t.dueOffsetDays),
      status: "todo",
      dependsOn: [
        ...new Set(
          t.dependsOn
            .filter((k) => k !== t.key)
            .map((k) => idForKey.get(k))
            .filter((x): x is string => x !== undefined),
        ),
      ],
      custom: false,
      delayDays: 0,
    });
  }

  return { tasks, notes: breakCycles(tasks) };
}

/** True while any of the task's dependencies is not done. */
export function isBlocked(task: Task, tasks: readonly Task[]): boolean {
  return blockers(task, tasks).length > 0;
}

/** Dependencies of `task` that are not done yet. */
export function blockers(task: Task, tasks: readonly Task[]): Task[] {
  return tasks.filter((t) => task.dependsOn.includes(t.id) && t.status !== "done");
}

/** An open task due after the event date. */
export function isAtRisk(task: Task, eventDate: string): boolean {
  return task.status !== "done" && task.dueDate > eventDate;
}

/** An open task whose due date has passed. */
export function isOverdue(task: Task, today: string): boolean {
  return task.status !== "done" && task.dueDate < today;
}

type ShiftResult = { tasks: Task[]; affectedIds: string[]; atRiskIds: string[] };

/**
 * Delays a task by `days` and moves every transitive dependent by the same amount,
 * which keeps their relative order. Tasks pushed past the event date are reported.
 */
export function shiftWithDependents(
  tasks: readonly Task[],
  taskId: string,
  days: number,
  eventDate: string,
): Result<ShiftResult, "not_found" | "invalid_days"> {
  if (!tasks.some((t) => t.id === taskId)) return err("not_found");
  if (!Number.isInteger(days) || days < 1) return err("invalid_days");
  const affected = new Set([taskId, ...transitiveDependents(tasks, taskId)]);
  const next = tasks.map((t) =>
    affected.has(t.id)
      ? {
          ...t,
          dueDate: shiftDate(t.dueDate, days),
          delayDays: t.id === taskId ? t.delayDays + days : t.delayDays,
        }
      : t,
  );
  return ok({
    tasks: next,
    affectedIds: [...affected],
    atRiskIds: next.filter((t) => affected.has(t.id) && isAtRisk(t, eventDate)).map((t) => t.id),
  });
}

/** Moves every task that is not done by `days` (used when the event date moves). */
export function shiftAll(tasks: readonly Task[], days: number): Task[] {
  if (days === 0) return [...tasks];
  return tasks.map((t) =>
    t.status === "done" ? t : { ...t, dueDate: shiftDate(t.dueDate, days) },
  );
}

/** Tasks grouped for the timeline view. */
export type Buckets = {
  overdue: Task[];
  thisWeek: Task[];
  nextTwoWeeks: Task[];
  later: Task[];
  done: Task[];
};

/** Groups tasks by urgency relative to `today`; each group is sorted by due date. */
export function bucket(tasks: readonly Task[], today: string): Buckets {
  const out: Buckets = { overdue: [], thisWeek: [], nextTwoWeeks: [], later: [], done: [] };
  for (const t of tasks) {
    if (t.status === "done") out.done.push(t);
    else {
      const d = daysBetween(today, t.dueDate);
      if (d < 0) out.overdue.push(t);
      else if (d < BUCKET_DAYS.THIS_WEEK) out.thisWeek.push(t);
      else if (d < BUCKET_DAYS.NEXT_TWO_WEEKS) out.nextTwoWeeks.push(t);
      else out.later.push(t);
    }
  }
  for (const list of Object.values(out)) {
    list.sort((a: Task, b: Task) => a.dueDate.localeCompare(b.dueDate));
  }
  return out;
}

/**
 * The next three things to do: open, unblocked tasks ordered by overdue first,
 * then due date, then how many tasks they unblock, then category priority.
 */
export function todayTop3(
  tasks: readonly Task[],
  today: string,
  priorities: readonly Priority[],
): Task[] {
  const deps = dependentsMap(tasks);
  return tasks
    .filter((t) => t.status !== "done" && !isBlocked(t, tasks))
    .map((t, index) => ({
      t,
      index,
      overdue: isOverdue(t, today) ? 0 : 1,
      unblocks: deps.get(t.id)?.length ?? 0,
      rank: priorityRank(priorityForCategory(t.category), priorities),
    }))
    .sort(
      (a, b) =>
        a.overdue - b.overdue ||
        a.t.dueDate.localeCompare(b.t.dueDate) ||
        b.unblocks - a.unblocks ||
        a.rank - b.rank ||
        a.index - b.index,
    )
    .slice(0, LIMITS.TODAY_TASKS)
    .map((x) => x.t);
}

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
