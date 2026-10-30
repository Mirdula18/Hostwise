/**
 * Named limits shared by the Zod schemas (browser and proxy), form inputs and the lib.
 * Changing a value here changes validation everywhere it applies.
 */

/** Maximum lengths for free-text fields, in characters. */
export const TEXT = {
  KEY: 20,
  LABEL: 40,
  ID: 60,
  NAME: 80,
  OPTION_LABEL: 100,
  TITLE: 120,
  SHORT_NOTE: 200,
  NOTE: 300,
  REASON: 400,
  CHANGE: 500,
  THEME: 600,
  LONG_NOTE: 1000,
} as const;

/** Numeric and list-size limits. */
export const LIMITS = {
  GUESTS_MAX: 1000,
  PRIORITIES_MAX: 3,
  CURRENCY_CODE_LENGTH: 3,
  AGE_GROUPS_MAX: 4,
  DELAY_DAYS_MAX: 120,
  /** Largest accepted budget in major units; guards against float overflow. */
  BUDGET_MAX_MAJOR: 1e10,
  LIST_MAX: 12,
  PLAN_BUDGET_MIN: 2,
  PLAN_TASKS_MAX: 40,
  DEPENDS_ON_MAX: 10,
  /** Two years: the furthest a plan task may be due before the event. */
  DUE_OFFSET_MAX_DAYS: 730,
  INTAKE_ASKED_MAX: 20,
  CHANGE_TASKS_MAX: 60,
  RANK_OPTIONS_MAX: 6,
  RANK_CATEGORIES_MAX: 15,
  /** Items shown before a list is summarised as "and N more". */
  SUMMARY_ITEMS: 2,
  TODAY_TASKS: 3,
  VISIBLE_TOASTS: 3,
} as const;

/** HTTP status codes used by the proxy and the AI client. */
export const HTTP = {
  OK: 200,
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  METHOD_NOT_ALLOWED: 405,
  TOO_LARGE: 413,
  RATE_LIMITED: 429,
  BAD_GATEWAY: 502,
  UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

/** Timeline buckets, in days from today. */
export const BUCKET_DAYS = { THIS_WEEK: 7, NEXT_TWO_WEEKS: 21 } as const;

/** A `yyyy-MM-dd` date string (shape only; validity is checked separately). */
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Debounce for inputs that trigger an AI call (CLAUDE.md rule 7). */
export const AI_DEBOUNCE_MS = 500;

export const KIB = 1024;
export const SECOND_MS = 1000;
const SECONDS_PER_MINUTE = 60;
export const MINUTE_MS = SECONDS_PER_MINUTE * SECOND_MS;
