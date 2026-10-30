import { makeId, type IdGen } from "./id";
import { allocate, sum } from "./money";
import { priorityForCategory, priorityRank } from "./priorities";
import { err, ok, type Result } from "./result";
import type { AIBudgetItem } from "../schemas/ai";
import type { BudgetLine, Priority } from "../schemas/event";

/** Integer percentages that sum to exactly 100 (empty in, empty out). */
export function normalisePercents(percents: readonly number[]): number[] {
  return allocate(100, percents);
}

/** Turns AI percentage splits into money lines whose allocations sum exactly to `total`. */
export function fromPercents(
  items: readonly AIBudgetItem[],
  total: number,
  idGen: IdGen = makeId,
): BudgetLine[] {
  const percents = normalisePercents(items.map((i) => i.percent));
  const amounts = allocate(total, percents);
  return items.map((item, i) => ({
    id: idGen("line"),
    category: item.category,
    priorityTag: item.priorityTag ?? priorityForCategory(item.category),
    allocated: amounts[i] ?? 0,
    committed: 0,
    spent: 0,
    perGuest: item.perGuest,
    locked: false,
    source: "estimate",
    ...(item.rationale ? { rationale: item.rationale } : {}),
  }));
}

/** Money already promised or paid on a line; trimming below this is not allowed. */
export function usedAmount(line: BudgetLine): number {
  return Math.max(line.committed, line.spent);
}

/** How much can be taken from a line without going below what is already used. */
export function headroom(line: BudgetLine): number {
  return Math.max(0, line.allocated - usedAmount(line));
}

/**
 * Order in which lines give up money: least important first, then the biggest line,
 * then original order.
 */
export function trimOrder(
  lines: readonly BudgetLine[],
  priorities: readonly Priority[],
): BudgetLine[] {
  return lines
    .map((line, index) => ({ line, index, rank: priorityRank(line.priorityTag, priorities) }))
    .sort((a, b) => b.rank - a.rank || b.line.allocated - a.line.allocated || a.index - b.index)
    .map((x) => x.line);
}

/** Weight used when sharing extra money out: the top priority gets the most. */
function priorityWeight(line: BudgetLine, priorities: readonly Priority[]): number {
  return priorities.length + 1 - priorityRank(line.priorityTag, priorities);
}

/**
 * Takes `amount` from `candidates` in the given order, never below their headroom.
 * Returns per-line deltas (negative) or null when there is not enough room.
 */
export function takeInOrder(
  candidates: readonly BudgetLine[],
  amount: number,
): Map<string, number> | null {
  const deltas = new Map<string, number>();
  let remaining = amount;
  for (const line of candidates) {
    if (remaining <= 0) break;
    const take = Math.min(headroom(line), remaining);
    if (take > 0) {
      deltas.set(line.id, -take);
      remaining -= take;
    }
  }
  return remaining > 0 ? null : deltas;
}

/** Shares `amount` across `recipients` by priority weight. */
export function giveByPriority(
  recipients: readonly BudgetLine[],
  amount: number,
  priorities: readonly Priority[],
): Map<string, number> {
  const parts = allocate(
    amount,
    recipients.map((l) => priorityWeight(l, priorities)),
  );
  return new Map(recipients.map((l, i) => [l.id, parts[i] ?? 0]));
}

function applyDeltas(
  lines: readonly BudgetLine[],
  deltas: ReadonlyMap<string, number>,
): BudgetLine[] {
  return lines.map((l) => {
    const d = deltas.get(l.id);
    return d ? { ...l, allocated: l.allocated + d } : l;
  });
}

/** Why an edit to one budget line could not be balanced against the others. */
export type RebalanceError =
  | { kind: "not_found" }
  | { kind: "negative" }
  | { kind: "below_committed"; minimum: number }
  | { kind: "insufficient_unlocked"; shortBy: number }
  | { kind: "no_unlocked" };

/**
 * Sets one line to `newAmount` and keeps the total fixed by moving the difference
 * through the other unlocked lines. Raising takes from the lowest-priority lines first;
 * lowering shares the freed money by priority.
 */
export function rebalance(
  lines: readonly BudgetLine[],
  changedId: string,
  newAmount: number,
  priorities: readonly Priority[],
): Result<BudgetLine[], RebalanceError> {
  const changed = lines.find((l) => l.id === changedId);
  if (!changed) return err({ kind: "not_found" });
  if (!Number.isInteger(newAmount) || newAmount < 0) return err({ kind: "negative" });
  if (newAmount < usedAmount(changed)) {
    return err({ kind: "below_committed", minimum: usedAmount(changed) });
  }

  const delta = newAmount - changed.allocated;
  const others = lines.filter((l) => l.id !== changedId && !l.locked);
  let deltas: Map<string, number>;

  if (delta > 0) {
    const taken = takeInOrder(trimOrder(others, priorities), delta);
    if (!taken) {
      const room = sum(others.map(headroom));
      return err({ kind: "insufficient_unlocked", shortBy: delta - room });
    }
    deltas = taken;
  } else if (delta < 0) {
    if (others.length === 0) return err({ kind: "no_unlocked" });
    deltas = giveByPriority(others, -delta, priorities);
  } else {
    deltas = new Map();
  }

  return ok(
    applyDeltas(lines, deltas).map((l) =>
      l.id === changedId ? { ...l, allocated: newAmount, source: sourceAfterEdit(l) } : l,
    ),
  );
}

/** "Keep others; change total": sets one line and lets the total move. */
export function setLineAmount(
  lines: readonly BudgetLine[],
  id: string,
  newAmount: number,
): Result<{ lines: BudgetLine[]; total: number }, RebalanceError> {
  const line = lines.find((l) => l.id === id);
  if (!line) return err({ kind: "not_found" });
  if (!Number.isInteger(newAmount) || newAmount < 0) return err({ kind: "negative" });
  if (newAmount < usedAmount(line))
    return err({ kind: "below_committed", minimum: usedAmount(line) });
  const next = lines.map((l) =>
    l.id === id ? { ...l, allocated: newAmount, source: sourceAfterEdit(l) } : l,
  );
  return ok({ lines: next, total: sum(next.map((l) => l.allocated)) });
}

function sourceAfterEdit(line: BudgetLine): BudgetLine["source"] {
  return line.source === "quote" ? "quote" : "user";
}

/**
 * Scales per-guest lines by newCount / oldCount. Fixed lines are untouched.
 * The same count returns the input unchanged.
 */
export function scaleForGuests(
  lines: readonly BudgetLine[],
  oldCount: number,
  newCount: number,
): BudgetLine[] {
  if (!Number.isInteger(oldCount) || oldCount < 1 || !Number.isInteger(newCount) || newCount < 1) {
    throw new RangeError("Guest counts must be positive integers");
  }
  if (oldCount === newCount) return [...lines];
  return lines.map((l) =>
    l.perGuest
      ? {
          ...l,
          allocated: Math.round((l.allocated * newCount) / oldCount),
          source: l.source === "quote" ? "quote" : "estimate",
        }
      : l,
  );
}

type LineStatus = {
  used: number;
  remaining: number;
  over: boolean;
  overBy: number;
  /** Share of the allocation used, 0–100+ (rounded). */
  percentUsed: number;
};

/** Used, remaining and over-budget figures for one budget line. */
export function lineStatus(line: BudgetLine): LineStatus {
  const used = usedAmount(line);
  const remaining = line.allocated - used;
  const percentUsed =
    line.allocated === 0 ? (used > 0 ? 100 : 0) : Math.round((used / line.allocated) * 100);
  return { used, remaining, over: remaining < 0, overBy: Math.max(0, -remaining), percentUsed };
}

type BudgetSummary = {
  total: number;
  allocated: number;
  committed: number;
  spent: number;
  remaining: number;
  /** Positive when part of the total is not yet assigned to a category. */
  unallocated: number;
  overBudget: boolean;
  overLineIds: string[];
};

/** Totals across all lines, plus which lines (if any) are over budget. */
export function summary(lines: readonly BudgetLine[], total: number): BudgetSummary {
  const allocated = sum(lines.map((l) => l.allocated));
  const committed = sum(lines.map((l) => l.committed));
  const spent = sum(lines.map((l) => l.spent));
  const used = sum(lines.map(usedAmount));
  const overLineIds = lines.filter((l) => lineStatus(l).over).map((l) => l.id);
  return {
    total,
    allocated,
    committed,
    spent,
    remaining: total - used,
    unallocated: total - allocated,
    overBudget: overLineIds.length > 0 || used > total || allocated > total,
    overLineIds,
  };
}

/** Locks or unlocks a line; locked lines are never touched by rebalancing or trade-offs. */
export function toggleLock(lines: readonly BudgetLine[], id: string): BudgetLine[] {
  return lines.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l));
}

/** Records what has actually been spent on a line; must be a whole, non-negative amount. */
export function setSpent(
  lines: readonly BudgetLine[],
  id: string,
  spent: number,
): Result<BudgetLine[], "negative"> {
  if (!Number.isInteger(spent) || spent < 0) return err("negative");
  return ok(lines.map((l) => (l.id === id ? { ...l, spent } : l)));
}
