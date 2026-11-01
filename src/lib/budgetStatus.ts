/** Read-only views of the budget: per-line status and plan totals. */

import { usedAmount } from "./budget";
import { sum } from "./money";
import type { BudgetLine } from "../schemas/event";

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
