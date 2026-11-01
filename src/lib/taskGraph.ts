/** Dependency graph helpers: cycle detection, ordering and reachability. */

import type { Task } from "../schemas/event";

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
export function dependentsMap(tasks: readonly Pick<Task, "id" | "dependsOn">[]): Graph {
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
