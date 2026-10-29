# Data Model — Hostwise

All types are inferred from Zod schemas in `src/schemas/`. Money values are integers in **minor units**.

## Core enums
```ts
export const Priority = z.enum([
  "food", "venue", "decor", "entertainment",
  "photography", "guest_comfort", "attire", "favours",
]);
export const Source = z.enum(["estimate", "user", "quote"]);
export const TaskStatus = z.enum(["todo", "doing", "done"]);
export const VendorStatus = z.enum(["considering", "contacted", "quoted", "booked", "declined"]);
export const Occasion = z.enum([
  "birthday", "kids_birthday", "anniversary", "graduation",
  "engagement", "community", "farewell", "other",
]);
```

## EventProfile (from intake)
```ts
export const EventProfile = z.object({
  occasion: Occasion,
  title: z.string().min(1).max(80),
  date: z.string().date(),                          // ISO yyyy-mm-dd, must be in the future
  guestCount: z.number().int().min(1).max(1000),
  totalBudget: z.number().int().positive(),         // minor units
  currency: z.string().length(3),                   // "INR", "USD"
  priorities: z.array(Priority).min(1).max(3),      // ranked, index 0 = most important
  ageMix: z.array(z.enum(["kids", "teens", "adults", "seniors"])).optional(),
  accessibility: z.string().max(300).optional(),
  dietary: z.string().max(300).optional(),
  culturalContext: z.string().max(300).optional(),
  setting: z.enum(["indoor", "outdoor", "either"]).optional(),
  city: z.string().max(80).optional(),
});
```

## BudgetLine
```ts
export const BudgetLine = z.object({
  id: z.string(),
  category: z.string().min(1).max(40),   // "Catering", "Venue", ...
  priorityTag: Priority.optional(),       // links a line to a user priority
  allocated: z.number().int().min(0),
  committed: z.number().int().min(0),     // accepted quotes
  spent: z.number().int().min(0),
  perGuest: z.boolean(),                  // scales with guest count
  locked: z.boolean(),
  source: Source,
  rationale: z.string().max(300).optional(),
});
```

## Task
```ts
export const Task = z.object({
  id: z.string(),
  title: z.string().min(1).max(120),
  category: z.string().max(40),
  dueDate: z.string().date(),
  status: TaskStatus,
  dependsOn: z.array(z.string()),          // task ids
  vendorId: z.string().optional(),
  custom: z.boolean(),                     // user-added
  delayDays: z.number().int().min(0).default(0),
});
// Derived (not stored): blocked, atRisk (dueDate > event.date), overdue.
```

## Vendor and Quote
```ts
export const Quote = z.object({
  id: z.string(),
  amount: z.number().int().positive(),
  includes: z.string().max(500),
  validUntil: z.string().date().optional(),
  deposit: z.number().int().min(0).optional(),
  cancellation: z.string().max(300).optional(),
  accepted: z.boolean(),
});
export const Vendor = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  category: z.string().max(40),            // matches a BudgetLine.category
  contact: z.string().max(200).optional(),
  status: VendorStatus,
  notes: z.string().max(1000).optional(),
  quotes: z.array(Quote),
  questions: z.array(z.string()).optional(),
});
```

## ChangeRequest (parsed by AI, then validated)
```ts
export const ChangeRequest = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("budget"), newTotal: z.number().int().positive() }),
  z.object({ kind: z.literal("guests"), newCount: z.number().int().min(1).max(1000) }),
  z.object({ kind: z.literal("date"), newDate: z.string().date() }),
  z.object({ kind: z.literal("delay"), taskId: z.string(), days: z.number().int().min(1).max(120) }),
  z.object({ kind: z.literal("unclear"), clarifyingQuestion: z.string() }),
]);
```

## Impact and options (computed in code)
```ts
type Impact = {
  before: { total: number; allocatedSum: number };
  after: { total: number; requiredSum: number };   // requiredSum includes per-guest scaling
  gap: number;                                      // negative = shortfall
  affectedCategories: string[];
  affectedTaskIds: string[];
};
type Adjustment = { category: string; delta: number };   // minor units
type TradeOffOption = {
  id: string;
  label: string;                // "Protect food, trim décor and favours"
  adjustments: Adjustment[];
  guestCountChange?: number;
  budgetChange?: number;
  respectsTopPriority: boolean;
};
```

## Event (root)
```ts
export const Event = z.object({
  id: z.string(),
  profile: EventProfile,
  budget: z.array(BudgetLine),
  tasks: z.array(Task),
  vendors: z.array(Vendor),
  theme: z.string().max(600).optional(),
  assumptions: z.array(z.string().max(200)),
  changeLog: z.array(z.object({ at: z.string(), summary: z.string() })),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const StoreFile = z.object({ version: z.literal(1), events: z.array(Event) }); // export/import
```

## Invariants (enforced by lib functions, tested)
1. `sum(budget.allocated) === profile.totalBudget` after any plan or rebalance operation, unless the user chose "change total".
2. Allocations are never negative.
3. The task graph is acyclic.
4. Every `dependsOn` id exists.
5. A `quote` source appears only on lines that have an accepted quote.
