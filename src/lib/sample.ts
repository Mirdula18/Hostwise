import type { AIPlan } from "../schemas/ai";
import type { Event, EventProfile } from "../schemas/event";
import { makeId, type IdGen } from "./id";
import { planToEvent } from "./plan";
import { shiftDate } from "./timeline";

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

export function sampleProfile(today: string): EventProfile {
  return {
    occasion: "anniversary",
    title: "Mum & Dad's 35th Anniversary",
    date: shiftDate(today, 49),
    guestCount: 60,
    totalBudget: 30_000_000,
    currency: "INR",
    priorities: ["food", "guest_comfort", "venue"],
    ageMix: ["kids", "adults", "seniors"],
    accessibility: "Two guests use wheelchairs; several elders prefer seating near restrooms.",
    dietary: "Many vegetarian guests; one nut allergy.",
    culturalContext: "Indian family; elders are blessed at the start of the dinner.",
    setting: "indoor",
    city: "Pune",
  };
}

/** A complete, realistic event so judges can explore without intake or AI calls. */
export function createSampleEvent(
  today: string,
  now: string = new Date().toISOString(),
  idGen: IdGen = makeId,
): Event {
  const event = planToEvent(sampleProfile(today), SAMPLE_PLAN, now, idGen);
  const caterTask = event.tasks.find((t) => t.title.startsWith("Book the caterer"));
  const vendors: Event["vendors"] = [
    {
      id: idGen("vendor"),
      name: "Annapurna Caterers",
      category: "Catering",
      contact: "Phone: add yours",
      status: "quoted",
      notes: "Pure-vegetarian kitchen; asked about Jain options.",
      quotes: [
        {
          id: idGen("quote"),
          amount: 10_800_000,
          includes: "Dinner buffet for 60, two starters, dessert, service staff",
          deposit: 2_000_000,
          cancellation: "Deposit refundable until 14 days before",
          accepted: false,
        },
      ],
    },
    {
      id: idGen("vendor"),
      name: "Spice Route Kitchen",
      category: "Catering",
      status: "quoted",
      quotes: [
        {
          id: idGen("quote"),
          amount: 12_600_000,
          includes: "Plated dinner for 60, live chaat counter, staff",
          deposit: 3_000_000,
          accepted: false,
        },
      ],
    },
  ];
  return {
    ...event,
    vendors,
    tasks: event.tasks.map((t) =>
      t.id === caterTask?.id ? { ...t, vendorId: vendors[0]?.id } : t,
    ),
  };
}
