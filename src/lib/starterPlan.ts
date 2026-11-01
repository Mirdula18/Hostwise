import { daysBetween } from "./dates";
import type { AIPlan, AIBudgetItem } from "../schemas/ai";
import type { EventProfile } from "../schemas/event";

const BASE: AIBudgetItem[] = [
  { category: "Catering", percent: 34, perGuest: true, priorityTag: "food" },
  { category: "Venue", percent: 18, perGuest: false, priorityTag: "venue" },
  { category: "Décor", percent: 9, perGuest: false, priorityTag: "decor" },
  { category: "Entertainment", percent: 8, perGuest: false, priorityTag: "entertainment" },
  { category: "Photography", percent: 8, perGuest: false, priorityTag: "photography" },
  { category: "Guest comfort", percent: 7, perGuest: true, priorityTag: "guest_comfort" },
  { category: "Favours", percent: 5, perGuest: true, priorityTag: "favours" },
  { category: "Contingency", percent: 11, perGuest: false },
];

/** Extra percent for the host's 1st, 2nd and 3rd priority. */
const BOOST_FIRST = 8;
const BOOST_SECOND = 5;
const BOOST_THIRD = 3;
const BOOST = [BOOST_FIRST, BOOST_SECOND, BOOST_THIRD];

/** The full timeline spans eight weeks; shorter lead times compress every deadline. */
const FULL_PLAN_DAYS = 56;

type StarterTask = { title: string; category: string; daysBefore: number; dependsOn: string[] };

const TASKS: StarterTask[] = [
  {
    title: "Confirm the date with key guests",
    category: "Planning",
    daysBefore: 56,
    dependsOn: [],
  },
  { title: "Draft the guest list", category: "Guests", daysBefore: 52, dependsOn: ["t1"] },
  { title: "Shortlist and visit venues", category: "Venue", daysBefore: 49, dependsOn: ["t1"] },
  { title: "Book the venue", category: "Venue", daysBefore: 42, dependsOn: ["t3"] },
  {
    title: "Send invitations with RSVP and dietary questions",
    category: "Guests",
    daysBefore: 35,
    dependsOn: ["t2", "t4"],
  },
  { title: "Get catering quotes", category: "Catering", daysBefore: 35, dependsOn: ["t4"] },
  { title: "Book the caterer", category: "Catering", daysBefore: 28, dependsOn: ["t6"] },
  {
    title: "Book entertainment or music",
    category: "Entertainment",
    daysBefore: 28,
    dependsOn: ["t4"],
  },
  { title: "Plan décor and order supplies", category: "Décor", daysBefore: 21, dependsOn: ["t4"] },
  { title: "Confirm final headcount", category: "Guests", daysBefore: 10, dependsOn: ["t5"] },
  {
    title: "Give final numbers and menu to the caterer",
    category: "Catering",
    daysBefore: 7,
    dependsOn: ["t7", "t10"],
  },
  {
    title: "Share the run-of-show with helpers and vendors",
    category: "Planning",
    daysBefore: 2,
    dependsOn: ["t11"],
  },
  {
    title: "Event day: arrive early to set up",
    category: "Planning",
    daysBefore: 0,
    dependsOn: ["t12"],
  },
];

/** Added only when the host mentioned accessibility or dietary needs. */
const ACCESS_TASK = {
  key: "t14",
  title: "Check step-free access and accessible restrooms",
  category: "Guest comfort",
  daysBefore: 21,
  dependsOn: ["t4"],
};
const DIETARY_TASK = {
  key: "t15",
  title: "Confirm dietary options with the caterer",
  category: "Catering",
  daysBefore: 14,
  dependsOn: ["t7"],
};

function starterBudget(profile: EventProfile): AIPlan["budget"] {
  return BASE.map((item) => {
    const rank = item.priorityTag ? profile.priorities.indexOf(item.priorityTag) : -1;
    const boost = rank >= 0 ? (BOOST[rank] ?? 0) : 0;
    return {
      ...item,
      percent: item.percent + boost,
      rationale:
        rank >= 0
          ? `Raised because you ranked this priority #${rank + 1}.`
          : "Typical share for this kind of event.",
    };
  });
}

function starterTasks(profile: EventProfile, today: string): AIPlan["tasks"] {
  const daysLeft = Math.max(0, daysBetween(today, profile.date) - 1);
  const scale = Math.min(1, daysLeft / FULL_PLAN_DAYS);
  const toAI = ({ daysBefore, ...t }: StarterTask & { key: string }) => ({
    ...t,
    dueOffsetDays: Math.round(daysBefore * scale),
  });
  const extra = [
    ...(profile.accessibility ? [ACCESS_TASK] : []),
    ...(profile.dietary ? [DIETARY_TASK] : []),
  ];
  return [...TASKS.map((t, i) => ({ ...t, key: `t${i + 1}` })), ...extra].map(toAI);
}

/**
 * A reasonable plan built without AI, used when the assistant is unavailable.
 * Splits lean towards the host's ranked priorities; deadlines are compressed to fit
 * the time left before the event.
 */
export function starterPlan(profile: EventProfile, today: string): AIPlan {
  return {
    budget: starterBudget(profile),
    tasks: starterTasks(profile, today),
    theme: "",
    assumptions: [
      "This starter plan was made without the AI assistant. Adjust it to fit your event.",
      "Percentages are typical splits, not prices. Add vendor quotes to replace estimates.",
    ],
  };
}
