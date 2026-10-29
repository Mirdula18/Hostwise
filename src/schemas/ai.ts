import { z } from "zod";
import { Adjustment, Priority } from "./event";

/** Response schemas for each Gemini task. AI output is untrusted until it passes these. */

export const InputType = z.enum(["text", "number", "date", "select", "multiselect", "rank"]);
export type InputType = z.infer<typeof InputType>;

export const NextQuestion = z
  .object({
    done: z.boolean(),
    field: z.string().max(40).optional(),
    question: z.string().max(300).optional(),
    inputType: InputType.optional(),
    options: z.array(z.string().max(80)).max(12).optional(),
    helper: z.string().max(300).optional(),
  })
  .refine((q) => q.done || (q.field && q.question && q.inputType), {
    message: "A question needs field, question and inputType unless done is true",
  });
export type NextQuestion = z.infer<typeof NextQuestion>;

export const AIBudgetItem = z.object({
  category: z.string().min(1).max(40),
  percent: z.number().int().min(0).max(100),
  perGuest: z.boolean(),
  priorityTag: Priority.optional().catch(undefined),
  rationale: z.string().max(300).optional(),
});
export type AIBudgetItem = z.infer<typeof AIBudgetItem>;

export const AITask = z.object({
  key: z.string().min(1).max(20),
  title: z.string().min(1).max(120),
  category: z.string().max(40),
  dueOffsetDays: z.number().int().min(0).max(730),
  dependsOn: z.array(z.string()).max(10),
});
export type AITask = z.infer<typeof AITask>;

export const AIPlan = z.object({
  budget: z.array(AIBudgetItem).min(2).max(12),
  tasks: z.array(AITask).min(1).max(40),
  theme: z.string().max(600),
  assumptions: z.array(z.string().max(200)).max(12),
});
export type AIPlan = z.infer<typeof AIPlan>;

export const RankResult = z.object({
  ranking: z
    .array(
      z.object({
        optionId: z.string(),
        why: z.string().max(400),
        whatTheyGiveUp: z.string().max(300),
      }),
    )
    .min(1),
  custom: z
    .object({
      label: z.string().max(100),
      adjustments: z.array(Adjustment).max(12),
      why: z.string().max(400),
    })
    .optional(),
});
export type RankResult = z.infer<typeof RankResult>;

export const VendorQuestions = z.object({
  questions: z.array(z.string().min(1).max(300)).min(1).max(12),
});
export type VendorQuestions = z.infer<typeof VendorQuestions>;
