import type { AIPlan, AIBudgetItem } from "../schemas/ai";
import type { EventProfile } from "../schemas/event";
import { daysBetween } from "./timeline";

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

const BOOST = [8, 5, 3];

const TASKS: [string, string, number, string[]][] = [
  ["Confirm the date with key guests", "Planning", 56, []],
  ["Draft the guest list", "Guests", 52, ["t1"]],
  ["Shortlist and visit venues", "Venue", 49, ["t1"]],
  ["Book the venue", "Venue", 42, ["t3"]],
  ["Send invitations with RSVP and dietary questions", "Guests", 35, ["t2", "t4"]],
  ["Get catering quotes", "Catering", 35, ["t4"]],
  ["Book the caterer", "Catering", 28, ["t6"]],
  ["Book entertainment or music", "Entertainment", 28, ["t4"]],
  ["Plan décor and order supplies", "Décor", 21, ["t4"]],
  ["Confirm final headcount", "Guests", 10, ["t5"]],
  ["Give final numbers and menu to the caterer", "Catering", 7, ["t7", "t10"]],
  ["Share the run-of-show with helpers and vendors", "Planning", 2, ["t11"]],
  ["Event day: arrive early to set up", "Planning", 0, ["t12"]],
];

/**
 * A reasonable plan built without AI, used when the assistant is unavailable.
 * Splits lean towards the host's ranked priorities; deadlines are compressed to fit
 * the time left before the event.
 */
export function starterPlan(profile: EventProfile, today: string): AIPlan {
  const budget = BASE.map((item) => {
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
  const daysLeft = Math.max(0, daysBetween(today, profile.date) - 1);
  const scale = Math.min(1, daysLeft / 56);
  const tasks = TASKS.map(([title, category, offset, dependsOn], i) => ({
    key: `t${i + 1}`,
    title,
    category,
    dueOffsetDays: Math.round(offset * scale),
    dependsOn,
  }));
  const extra = [
    ...(profile.accessibility
      ? [
          {
            key: "t14",
            title: "Check step-free access and accessible restrooms",
            category: "Guest comfort",
            dueOffsetDays: Math.round(21 * scale),
            dependsOn: ["t4"],
          },
        ]
      : []),
    ...(profile.dietary
      ? [
          {
            key: "t15",
            title: "Confirm dietary options with the caterer",
            category: "Catering",
            dueOffsetDays: Math.round(14 * scale),
            dependsOn: ["t7"],
          },
        ]
      : []),
  ];
  return {
    budget,
    tasks: [...tasks, ...extra],
    theme: "",
    assumptions: [
      "This starter plan was made without the AI assistant. Adjust it to fit your event.",
      "Percentages are typical splits, not prices. Add vendor quotes to replace estimates.",
    ],
  };
}
