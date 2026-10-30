import { z } from "zod";
import { LIMITS, TEXT } from "../lib/constants";

export const Priority = z.enum([
  "food",
  "venue",
  "decor",
  "entertainment",
  "photography",
  "guest_comfort",
  "attire",
  "favours",
]);
export type Priority = z.infer<typeof Priority>;

export const Source = z.enum(["estimate", "user", "quote"]);
export type Source = z.infer<typeof Source>;

export const TaskStatus = z.enum(["todo", "doing", "done"]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const VendorStatus = z.enum(["considering", "contacted", "quoted", "booked", "declined"]);
export type VendorStatus = z.infer<typeof VendorStatus>;

export const Occasion = z.enum([
  "birthday",
  "kids_birthday",
  "anniversary",
  "graduation",
  "engagement",
  "community",
  "farewell",
  "other",
]);
export type Occasion = z.infer<typeof Occasion>;

export const AgeGroup = z.enum(["kids", "teens", "adults", "seniors"]);
export type AgeGroup = z.infer<typeof AgeGroup>;

export const Setting = z.enum(["indoor", "outdoor", "either"]);

const IsoDate = z.string().date();

/** Shape of the intake answers; "date must be in the future" is checked by `isFutureDate`. */
export const EventProfile = z.object({
  occasion: Occasion,
  title: z.string().min(1).max(TEXT.NAME),
  date: IsoDate,
  guestCount: z.number().int().min(1).max(LIMITS.GUESTS_MAX),
  totalBudget: z.number().int().positive(),
  currency: z.string().length(LIMITS.CURRENCY_CODE_LENGTH),
  priorities: z.array(Priority).min(1).max(LIMITS.PRIORITIES_MAX),
  ageMix: z.array(AgeGroup).optional(),
  accessibility: z.string().max(TEXT.NOTE).optional(),
  dietary: z.string().max(TEXT.NOTE).optional(),
  culturalContext: z.string().max(TEXT.NOTE).optional(),
  setting: Setting.optional(),
  city: z.string().max(TEXT.NAME).optional(),
});
export type EventProfile = z.infer<typeof EventProfile>;

export const BudgetLine = z.object({
  id: z.string(),
  category: z.string().min(1).max(TEXT.LABEL),
  priorityTag: Priority.optional(),
  allocated: z.number().int().min(0),
  committed: z.number().int().min(0),
  spent: z.number().int().min(0),
  perGuest: z.boolean(),
  locked: z.boolean(),
  source: Source,
  rationale: z.string().max(TEXT.NOTE).optional(),
});
export type BudgetLine = z.infer<typeof BudgetLine>;

export const Task = z.object({
  id: z.string(),
  title: z.string().min(1).max(TEXT.TITLE),
  category: z.string().max(TEXT.LABEL),
  dueDate: IsoDate,
  status: TaskStatus,
  dependsOn: z.array(z.string()),
  vendorId: z.string().optional(),
  custom: z.boolean(),
  delayDays: z.number().int().min(0).default(0),
});
export type Task = z.infer<typeof Task>;

export const Quote = z.object({
  id: z.string(),
  amount: z.number().int().positive(),
  includes: z.string().max(TEXT.CHANGE),
  validUntil: IsoDate.optional(),
  deposit: z.number().int().min(0).optional(),
  cancellation: z.string().max(TEXT.NOTE).optional(),
  accepted: z.boolean(),
});
export type Quote = z.infer<typeof Quote>;

export const Vendor = z.object({
  id: z.string(),
  name: z.string().min(1).max(TEXT.NAME),
  category: z.string().max(TEXT.LABEL),
  contact: z.string().max(TEXT.SHORT_NOTE).optional(),
  status: VendorStatus,
  notes: z.string().max(TEXT.LONG_NOTE).optional(),
  quotes: z.array(Quote),
  questions: z.array(z.string()).optional(),
});
export type Vendor = z.infer<typeof Vendor>;

export const ChangeRequest = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("budget"), newTotal: z.number().int().positive() }),
  z.object({ kind: z.literal("guests"), newCount: z.number().int().min(1).max(LIMITS.GUESTS_MAX) }),
  z.object({ kind: z.literal("date"), newDate: IsoDate }),
  z.object({
    kind: z.literal("delay"),
    taskId: z.string(),
    days: z.number().int().min(1).max(LIMITS.DELAY_DAYS_MAX),
  }),
  z.object({ kind: z.literal("unclear"), clarifyingQuestion: z.string().min(1).max(TEXT.NOTE) }),
]);
export type ChangeRequest = z.infer<typeof ChangeRequest>;
/** A change the engine can act on (everything except "unclear"). */
export type ActionableChange = Exclude<ChangeRequest, { kind: "unclear" }>;

export const Adjustment = z.object({ category: z.string(), delta: z.number().int() });
export type Adjustment = z.infer<typeof Adjustment>;

export const TradeOffOption = z.object({
  id: z.string(),
  label: z.string(),
  adjustments: z.array(Adjustment),
  guestCountChange: z.number().int().optional(),
  budgetChange: z.number().int().optional(),
  respectsTopPriority: z.boolean(),
});
export type TradeOffOption = z.infer<typeof TradeOffOption>;

export const Impact = z.object({
  request: ChangeRequest,
  before: z.object({ total: z.number().int(), allocatedSum: z.number().int() }),
  after: z.object({ total: z.number().int(), requiredSum: z.number().int() }),
  gap: z.number().int(),
  affectedCategories: z.array(z.string()),
  affectedTaskIds: z.array(z.string()),
});
export type Impact = z.infer<typeof Impact>;

const ChangeLogEntry = z.object({ at: z.string(), summary: z.string() });

export const Event = z.object({
  id: z.string(),
  profile: EventProfile,
  budget: z.array(BudgetLine),
  tasks: z.array(Task),
  vendors: z.array(Vendor),
  theme: z.string().max(TEXT.THEME).optional(),
  assumptions: z.array(z.string().max(TEXT.SHORT_NOTE)),
  changeLog: z.array(ChangeLogEntry),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Event = z.infer<typeof Event>;

export const StoreFile = z.object({ version: z.literal(1), events: z.array(Event) });
export type StoreFile = z.infer<typeof StoreFile>;
