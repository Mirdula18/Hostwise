import { z } from "zod";
import { Adjustment, Priority } from "./event";
import { LIMITS, TEXT } from "../lib/constants";

/** Response schemas for each Gemini task. AI output is untrusted until it passes these. */

export const InputType = z.enum(["text", "number", "date", "select", "multiselect", "rank"]);
export type InputType = z.infer<typeof InputType>;

export const NextQuestion = z
  .object({
    done: z.boolean(),
    field: z.string().max(TEXT.LABEL).optional(),
    question: z.string().max(TEXT.NOTE).optional(),
    inputType: InputType.optional(),
    options: z.array(z.string().max(TEXT.NAME)).max(LIMITS.LIST_MAX).optional(),
    helper: z.string().max(TEXT.NOTE).optional(),
  })
  .refine((q) => q.done || (q.field && q.question && q.inputType), {
    message: "A question needs field, question and inputType unless done is true",
  });
export type NextQuestion = z.infer<typeof NextQuestion>;

export const AIBudgetItem = z.object({
  category: z.string().min(1).max(TEXT.LABEL),
  percent: z.number().int().min(0).max(100),
  perGuest: z.boolean(),
  priorityTag: Priority.optional().catch(undefined),
  rationale: z.string().max(TEXT.NOTE).optional(),
});
export type AIBudgetItem = z.infer<typeof AIBudgetItem>;

export const AITask = z.object({
  key: z.string().min(1).max(TEXT.KEY),
  title: z.string().min(1).max(TEXT.TITLE),
  category: z.string().max(TEXT.LABEL),
  dueOffsetDays: z.number().int().min(0).max(LIMITS.DUE_OFFSET_MAX_DAYS),
  dependsOn: z.array(z.string()).max(LIMITS.DEPENDS_ON_MAX),
});
export type AITask = z.infer<typeof AITask>;

export const AIPlan = z.object({
  budget: z.array(AIBudgetItem).min(LIMITS.PLAN_BUDGET_MIN).max(LIMITS.LIST_MAX),
  tasks: z.array(AITask).min(1).max(LIMITS.PLAN_TASKS_MAX),
  theme: z.string().max(TEXT.THEME),
  assumptions: z.array(z.string().max(TEXT.SHORT_NOTE)).max(LIMITS.LIST_MAX),
});
export type AIPlan = z.infer<typeof AIPlan>;

export const RankResult = z.object({
  ranking: z
    .array(
      z.object({
        optionId: z.string(),
        why: z.string().max(TEXT.REASON),
        whatTheyGiveUp: z.string().max(TEXT.NOTE),
      }),
    )
    .min(1),
  custom: z
    .object({
      label: z.string().max(TEXT.OPTION_LABEL),
      adjustments: z.array(Adjustment).max(LIMITS.LIST_MAX),
      why: z.string().max(TEXT.REASON),
    })
    .optional(),
});
export type RankResult = z.infer<typeof RankResult>;

export const VendorQuestions = z.object({
  questions: z.array(z.string().min(1).max(TEXT.NOTE)).min(1).max(LIMITS.LIST_MAX),
});
export type VendorQuestions = z.infer<typeof VendorQuestions>;

export const AITaskName = z.enum([
  "intake_next",
  "plan",
  "parse_change",
  "rank_options",
  "vendor_questions",
]);
export type AITaskName = z.infer<typeof AITaskName>;
