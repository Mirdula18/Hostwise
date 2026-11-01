/** The schedule: dating AI tasks, task status, delays and the timeline views. */

import { BUCKET_DAYS, LIMITS } from "./constants";
import { daysBetween, shiftDate } from "./dates";
import { makeId, type IdGen } from "./id";
import { priorityForCategory, priorityRank } from "./priorities";
import { err, ok, type Result } from "./result";
import { dependentsMap, detectCycle, transitiveDependents } from "./taskGraph";
import type { AITask } from "../schemas/ai";
import type { Priority, Task } from "../schemas/event";

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
