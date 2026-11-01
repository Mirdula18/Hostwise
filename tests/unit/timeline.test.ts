import { counterIds } from "../../src/lib/id";
import { addTask, deleteTask, updateTask } from "../../src/lib/taskEdit";
import {
  blockers,
  bucket,
  isAtRisk,
  isBlocked,
  isOverdue,
  shiftAll,
  shiftWithDependents,
  toDates,
  todayTop3,
} from "../../src/lib/timeline";
import { CycleError, detectCycle, topoSort, transitiveDependents } from "../../src/lib/taskGraph";
import { daysBetween, isFutureDate, shiftDate, todayIso } from "../../src/lib/dates";
import { task } from "./fixtures";

const TODAY = "2026-11-01";

describe("dates", () => {
  it("shifts ISO dates and counts calendar days", () => {
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-11-01", "2026-11-15")).toBe(14);
    expect(isFutureDate("2026-11-02", TODAY)).toBe(true);
    expect(isFutureDate(TODAY, TODAY)).toBe(false);
    expect(todayIso(new Date(2026, 10, 1, 23, 30))).toBe(TODAY);
  });
});

describe("toDates", () => {
  it("maps offset 0 to the event date and 14 to two weeks before", () => {
    const { tasks, notes } = toDates(
      [
        { key: "t1", title: "Book", category: "Venue", dueOffsetDays: 14, dependsOn: [] },
        { key: "t2", title: "Party", category: "Day", dueOffsetDays: 0, dependsOn: ["t1"] },
      ],
      "2026-12-20",
      counterIds(),
    );
    expect(tasks.map((t) => t.dueDate)).toEqual(["2026-12-06", "2026-12-20"]);
    expect(tasks[1]?.dependsOn).toEqual(["task_1"]);
    expect(tasks.every((t) => t.status === "todo" && !t.custom)).toBe(true);
    expect(notes).toEqual([]);
  });

  it("drops unknown, self and duplicate dependency keys and duplicate tasks", () => {
    const { tasks } = toDates(
      [
        { key: "t1", title: "A", category: "x", dueOffsetDays: 3, dependsOn: ["t9", "t1"] },
        { key: "t2", title: "B", category: "x", dueOffsetDays: 1, dependsOn: ["t1", "t1"] },
        { key: "t2", title: "B again", category: "x", dueOffsetDays: 1, dependsOn: [] },
      ],
      "2026-12-20",
      counterIds(),
    );
    expect(tasks).toHaveLength(2);
    expect(tasks[0]?.dependsOn).toEqual([]);
    expect(tasks[1]?.dependsOn).toEqual(["task_1"]);
  });

  it("breaks cycles by dropping an edge and explains it in notes", () => {
    const { tasks, notes } = toDates(
      [
        { key: "a", title: "A", category: "x", dueOffsetDays: 3, dependsOn: ["b"] },
        { key: "b", title: "B", category: "x", dueOffsetDays: 2, dependsOn: ["a"] },
      ],
      "2026-12-20",
    );
    expect(detectCycle(tasks)).toBeNull();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatch(/circular/i);
  });
});

describe("detectCycle and topoSort", () => {
  it("finds a→b→a", () => {
    const cycle = detectCycle([
      task({ id: "a", dependsOn: ["b"] }),
      task({ id: "b", dependsOn: ["a"] }),
    ]);
    expect(cycle).not.toBeNull();
    expect(cycle?.[0]).toBe(cycle?.[cycle.length - 1]);
  });

  it("returns null for an acyclic graph", () => {
    expect(detectCycle([task({ id: "a" }), task({ id: "b", dependsOn: ["a"] })])).toBeNull();
    expect(detectCycle([])).toBeNull();
  });

  it("keeps every dependency before its dependent", () => {
    const tasks = [
      task({ id: "c", dependsOn: ["b"], dueDate: "2026-11-01" }),
      task({ id: "b", dependsOn: ["a"], dueDate: "2026-11-05" }),
      task({ id: "a", dueDate: "2026-12-01" }),
      task({ id: "x", dueDate: "2026-10-01" }),
    ];
    const order = topoSort(tasks).map((t) => t.id);
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("c"));
    expect(order[0]).toBe("x");
  });

  it("throws a CycleError with the cycle on a circular graph", () => {
    const tasks = [task({ id: "a", dependsOn: ["b"] }), task({ id: "b", dependsOn: ["a"] })];
    expect(() => topoSort(tasks)).toThrow(CycleError);
  });
});

describe("shiftWithDependents", () => {
  const tasks = [
    task({ id: "a", dueDate: "2026-11-10" }),
    task({ id: "b", dueDate: "2026-11-20", dependsOn: ["a"] }),
    task({ id: "c", dueDate: "2026-12-18", dependsOn: ["b"] }),
    task({ id: "d", dueDate: "2026-11-15" }),
  ];

  it("moves a task and its transitive dependents but not unrelated tasks", () => {
    const r = shiftWithDependents(tasks, "a", 5, "2026-12-20");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const by = Object.fromEntries(r.value.tasks.map((t) => [t.id, t.dueDate]));
    expect(by).toEqual({ a: "2026-11-15", b: "2026-11-25", c: "2026-12-23", d: "2026-11-15" });
    expect(r.value.affectedIds.sort()).toEqual(["a", "b", "c"]);
    expect(r.value.tasks[0]?.delayDays).toBe(5);
    expect(r.value.tasks[1]?.delayDays).toBe(0);
  });

  it("flags tasks pushed past the event date as at risk", () => {
    const r = shiftWithDependents(tasks, "a", 5, "2026-12-20");
    expect(r.ok && r.value.atRiskIds).toEqual(["c"]);
  });

  it("preserves dependency order after a shift", () => {
    const r = shiftWithDependents(tasks, "b", 30, "2026-12-20");
    if (!r.ok) throw new Error("expected ok");
    const b = r.value.tasks.find((t) => t.id === "b");
    const c = r.value.tasks.find((t) => t.id === "c");
    expect((b?.dueDate ?? "") < (c?.dueDate ?? "")).toBe(true);
  });

  it("rejects unknown tasks and non-positive days", () => {
    expect(shiftWithDependents(tasks, "zz", 1, "2026-12-20")).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(shiftWithDependents(tasks, "a", 0, "2026-12-20")).toEqual({
      ok: false,
      error: "invalid_days",
    });
  });

  it("transitiveDependents ignores cycles back to the start", () => {
    const loop = [task({ id: "a", dependsOn: ["b"] }), task({ id: "b", dependsOn: ["a"] })];
    expect(transitiveDependents(loop, "a")).toEqual(["b"]);
  });
});

describe("status helpers", () => {
  const a = task({ id: "a", status: "doing" });
  const b = task({ id: "b", dependsOn: ["a"] });

  it("isBlocked is true while any dependency is not done", () => {
    expect(isBlocked(b, [a, b])).toBe(true);
    expect(blockers(b, [a, b]).map((t) => t.id)).toEqual(["a"]);
    expect(isBlocked(b, [{ ...a, status: "done" }, b])).toBe(false);
  });

  it("isAtRisk and isOverdue ignore done tasks", () => {
    const late = task({ id: "x", dueDate: "2026-12-25" });
    expect(isAtRisk(late, "2026-12-20")).toBe(true);
    expect(isAtRisk({ ...late, status: "done" }, "2026-12-20")).toBe(false);
    const old = task({ id: "y", dueDate: "2026-10-01" });
    expect(isOverdue(old, TODAY)).toBe(true);
    expect(isOverdue({ ...old, status: "done" }, TODAY)).toBe(false);
  });

  it("shiftAll moves open tasks only, and 0 days is a no-op", () => {
    const tasks = [task({ id: "a" }), task({ id: "b", status: "done" })];
    expect(shiftAll(tasks, 2).map((t) => t.dueDate)).toEqual(["2026-12-03", "2026-12-01"]);
    expect(shiftAll(tasks, 0)).toEqual(tasks);
  });
});

describe("bucket", () => {
  it("groups overdue, this week, next two weeks, later and done", () => {
    const b = bucket(
      [
        task({ id: "late", dueDate: "2026-10-30" }),
        task({ id: "today", dueDate: "2026-11-01" }),
        task({ id: "d6", dueDate: "2026-11-07" }),
        task({ id: "d7", dueDate: "2026-11-08" }),
        task({ id: "d20", dueDate: "2026-11-21" }),
        task({ id: "d21", dueDate: "2026-11-22" }),
        task({ id: "fin", dueDate: "2026-10-01", status: "done" }),
      ],
      TODAY,
    );
    const ids = (list: { id: string }[]) => list.map((t) => t.id);
    expect(ids(b.overdue)).toEqual(["late"]);
    expect(ids(b.thisWeek)).toEqual(["today", "d6"]);
    expect(ids(b.nextTwoWeeks)).toEqual(["d7", "d20"]);
    expect(ids(b.later)).toEqual(["d21"]);
    expect(ids(b.done)).toEqual(["fin"]);
  });

  it("returns empty groups for no tasks", () => {
    expect(bucket([], TODAY)).toEqual({
      overdue: [],
      thisWeek: [],
      nextTwoWeeks: [],
      later: [],
      done: [],
    });
  });
});

describe("todayTop3", () => {
  it("orders overdue first, then due date, then tasks unblocked", () => {
    const tasks = [
      task({ id: "soon", dueDate: "2026-11-05" }),
      task({ id: "late", dueDate: "2026-10-28" }),
      task({ id: "hub", dueDate: "2026-11-05" }),
      task({ id: "dep1", dueDate: "2026-11-30", dependsOn: ["hub"] }),
      task({ id: "dep2", dueDate: "2026-11-30", dependsOn: ["hub"] }),
      task({ id: "far", dueDate: "2026-12-30" }),
    ];
    expect(todayTop3(tasks, TODAY, ["food"]).map((t) => t.id)).toEqual(["late", "hub", "soon"]);
  });

  it("breaks remaining ties by category priority", () => {
    const tasks = [
      task({ id: "decor", category: "Decor", dueDate: "2026-11-05" }),
      task({ id: "food", category: "Catering", dueDate: "2026-11-05" }),
    ];
    expect(todayTop3(tasks, TODAY, ["food"]).map((t) => t.id)).toEqual(["food", "decor"]);
  });

  it("keeps the original order when every other key ties, and returns at most 3", () => {
    const tasks = ["w", "x", "y", "z"].map((id) =>
      task({ id, category: "Decor", dueDate: "2026-11-05" }),
    );
    expect(todayTop3(tasks, TODAY, ["food"]).map((t) => t.id)).toEqual(["w", "x", "y"]);
  });

  it("skips done and blocked tasks and returns fewer than 3 when fewer remain", () => {
    const tasks = [
      task({ id: "a", status: "done" }),
      task({ id: "b", dependsOn: ["c"] }),
      task({ id: "c" }),
    ];
    expect(todayTop3(tasks, TODAY, []).map((t) => t.id)).toEqual(["c"]);
    expect(todayTop3([], TODAY, [])).toEqual([]);
  });
});

describe("task editing", () => {
  const tasks = [task({ id: "a" }), task({ id: "b", dependsOn: ["a"] })];

  it("adds a custom task", () => {
    const r = addTask(
      tasks,
      { title: "New", category: "x", dueDate: "2026-11-11", dependsOn: ["b"] },
      counterIds(),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value[2]).toMatchObject({ id: "task_1", custom: true, status: "todo" });
  });

  it("rejects unknown dependencies", () => {
    const r = addTask(tasks, {
      title: "New",
      category: "x",
      dueDate: "2026-11-11",
      dependsOn: ["zz"],
    });
    expect(r).toEqual({ ok: false, error: { kind: "unknown_dependency", id: "zz" } });
  });

  it("rejects an edit that creates a circular dependency with a clear message", () => {
    const r = updateTask(tasks, "a", { dependsOn: ["b"] });
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === "cycle")
      expect(r.error.message).toMatch(/Circular dependency: Task/);
    else throw new Error("expected cycle error");
  });

  it("updates a task and reports unknown ids", () => {
    const r = updateTask(tasks, "a", { status: "done", title: "Renamed" });
    expect(r.ok && r.value[0]).toMatchObject({ status: "done", title: "Renamed" });
    expect(updateTask(tasks, "zz", {})).toEqual({ ok: false, error: { kind: "not_found" } });
  });

  it("deletes a task and the links pointing to it", () => {
    expect(deleteTask(tasks, "a")).toEqual([{ ...tasks[1], dependsOn: [] }]);
  });
});
