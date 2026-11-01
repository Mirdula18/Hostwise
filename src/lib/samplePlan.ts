/** The sample event's plan, written as the AI would return it (percentages, day offsets). */

import type { AIPlan } from "../schemas/ai";

/** The persona from the PRD: Maya's parents' 35th anniversary dinner. */
export const SAMPLE_PLAN: AIPlan = {
  budget: [
    {
      category: "Catering",
      percent: 38,
      perGuest: true,
      priorityTag: "food",
      rationale:
        "Food is your top priority, so it gets the largest share, with vegetarian dishes as standard.",
    },
    {
      category: "Venue",
      percent: 20,
      perGuest: false,
      priorityTag: "venue",
      rationale:
        "A step-free, ground-floor hall close to parking suits guests who use wheelchairs.",
    },
    {
      category: "Guest comfort",
      percent: 12,
      perGuest: true,
      priorityTag: "guest_comfort",
      rationale: "Cushioned seating, a quiet corner and accessible restrooms for older guests.",
    },
    {
      category: "Décor",
      percent: 8,
      perGuest: false,
      priorityTag: "decor",
      rationale: "You asked for simple décor: fresh flowers on tables and a photo wall.",
    },
    {
      category: "Photography",
      percent: 9,
      perGuest: false,
      priorityTag: "photography",
      rationale: "Three hours of coverage to capture family portraits across generations.",
    },
    {
      category: "Entertainment",
      percent: 6,
      perGuest: false,
      priorityTag: "entertainment",
      rationale: "Live acoustic music at a volume that still allows conversation.",
    },
    {
      category: "Favours",
      percent: 4,
      perGuest: true,
      priorityTag: "favours",
      rationale: "Small sweet boxes, one per family.",
    },
    {
      category: "Contingency",
      percent: 3,
      perGuest: false,
      rationale: "A small buffer for last-minute surprises.",
    },
  ],
  tasks: [
    {
      key: "t1",
      title: "Confirm date with parents and close family",
      category: "Planning",
      dueOffsetDays: 48,
      dependsOn: [],
    },
    {
      key: "t2",
      title: "Draft the guest list",
      category: "Guests",
      dueOffsetDays: 45,
      dependsOn: ["t1"],
    },
    {
      key: "t3",
      title: "Shortlist step-free venues and visit two",
      category: "Venue",
      dueOffsetDays: 42,
      dependsOn: ["t1"],
    },
    { key: "t4", title: "Book the venue", category: "Venue", dueOffsetDays: 38, dependsOn: ["t3"] },
    {
      key: "t5",
      title: "Send invitations with RSVP and dietary question",
      category: "Guests",
      dueOffsetDays: 35,
      dependsOn: ["t2", "t4"],
    },
    {
      key: "t6",
      title: "Get catering quotes with vegetarian menus",
      category: "Catering",
      dueOffsetDays: 34,
      dependsOn: ["t4"],
    },
    {
      key: "t7",
      title: "Book the caterer",
      category: "Catering",
      dueOffsetDays: 28,
      dependsOn: ["t6"],
    },
    {
      key: "t8",
      title: "Book photographer",
      category: "Photography",
      dueOffsetDays: 30,
      dependsOn: ["t4"],
    },
    {
      key: "t9",
      title: "Arrange accessible seating and ramp access",
      category: "Guest comfort",
      dueOffsetDays: 21,
      dependsOn: ["t4"],
    },
    {
      key: "t10",
      title: "Book acoustic musicians",
      category: "Entertainment",
      dueOffsetDays: 24,
      dependsOn: ["t4"],
    },
    {
      key: "t11",
      title: "Order flowers and photo-wall prints",
      category: "Décor",
      dueOffsetDays: 14,
      dependsOn: ["t4"],
    },
    {
      key: "t12",
      title: "Chase RSVPs and confirm final headcount",
      category: "Guests",
      dueOffsetDays: 10,
      dependsOn: ["t5"],
    },
    {
      key: "t13",
      title: "Give final headcount and menu to caterer",
      category: "Catering",
      dueOffsetDays: 7,
      dependsOn: ["t7", "t12"],
    },
    {
      key: "t14",
      title: "Order favour sweet boxes",
      category: "Favours",
      dueOffsetDays: 7,
      dependsOn: ["t12"],
    },
    {
      key: "t15",
      title: "Plan seating chart with elders near exits and restrooms",
      category: "Guest comfort",
      dueOffsetDays: 4,
      dependsOn: ["t9", "t12"],
    },
    {
      key: "t16",
      title: "Share run-of-show with vendors and helpers",
      category: "Planning",
      dueOffsetDays: 2,
      dependsOn: ["t13", "t15"],
    },
    {
      key: "t17",
      title: "Event day: arrive early for setup",
      category: "Planning",
      dueOffsetDays: 0,
      dependsOn: ["t16"],
    },
  ],
  theme:
    "A warm 'Thirty-Five Years of Us' dinner in ivory and deep red, with photos from each decade along the entrance. Tables are set for easy conversation, and the evening ends with family toasts.",
  assumptions: [
    "Prices vary by city; every amount here is an estimate until you add a vendor quote.",
    "About a third of guests are vegetarian, so the menu is mostly vegetarian.",
    "Two wheelchair users need step-free entry, wide aisles and an accessible restroom.",
    "Dinner runs about four hours, including setup.",
  ],
};
