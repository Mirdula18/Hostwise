import { z } from "zod";

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
  title: z.string().min(1).max(80),
  date: IsoDate,
  guestCount: z.number().int().min(1).max(1000),
  totalBudget: z.number().int().positive(),
  currency: z.string().length(3),
  priorities: z.array(Priority).min(1).max(3),
  ageMix: z.array(AgeGroup).optional(),
  accessibility: z.string().max(300).optional(),
  dietary: z.string().max(300).optional(),
  culturalContext: z.string().max(300).optional(),
  setting: Setting.optional(),
  city: z.string().max(80).optional(),
});
export type EventProfile = z.infer<typeof EventProfile>;

export const BudgetLine = z.object({
  id: z.string(),
  category: z.string().min(1).max(40),
  priorityTag: Priority.optional(),
  allocated: z.number().int().min(0),
  committed: z.number().int().min(0),
  spent: z.number().int().min(0),
  perGuest: z.boolean(),
  locked: z.boolean(),
  source: Source,
  rationale: z.string().max(300).optional(),
});
export type BudgetLine = z.infer<typeof BudgetLine>;

export const Task = z.object({
  id: z.string(),
  title: z.string().min(1).max(120),
  category: z.string().max(40),
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
  includes: z.string().max(500),
  validUntil: IsoDate.optional(),
  deposit: z.number().int().min(0).optional(),
  cancellation: z.string().max(300).optional(),
  accepted: z.boolean(),
});
export type Quote = z.infer<typeof Quote>;

export const Vendor = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  category: z.string().max(40),
  contact: z.string().max(200).optional(),
  status: VendorStatus,
  notes: z.string().max(1000).optional(),
  quotes: z.array(Quote),
  questions: z.array(z.string()).optional(),
});
export type Vendor = z.infer<typeof Vendor>;

export const ChangeRequest = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("budget"), newTotal: z.number().int().positive() }),
  z.object({ kind: z.literal("guests"), newCount: z.number().int().min(1).max(1000) }),
  z.object({ kind: z.literal("date"), newDate: IsoDate }),
  z.object({
    kind: z.literal("delay"),
    taskId: z.string(),
    days: z.number().int().min(1).max(120),
  }),
  z.object({ kind: z.literal("unclear"), clarifyingQuestion: z.string().min(1).max(300) }),
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
  theme: z.string().max(600).optional(),
  assumptions: z.array(z.string().max(200)),
  changeLog: z.array(ChangeLogEntry),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Event = z.infer<typeof Event>;

export const StoreFile = z.object({ version: z.literal(1), events: z.array(Event) });
export type StoreFile = z.infer<typeof StoreFile>;
