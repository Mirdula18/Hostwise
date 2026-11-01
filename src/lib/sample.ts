import { shiftDate } from "./dates";
import { makeId, type IdGen } from "./id";
import { planToEvent } from "./plan";
import { SAMPLE_PLAN } from "./samplePlan";
import type { Event, EventProfile } from "../schemas/event";

/** The sample event is seven weeks away, so every timeline bucket has tasks. */
const SAMPLE_DAYS_AHEAD = 49;

/** The sample host's answers, dated relative to `today`. */
export function sampleProfile(today: string): EventProfile {
  return {
    occasion: "anniversary",
    title: "Mum & Dad's 35th Anniversary",
    date: shiftDate(today, SAMPLE_DAYS_AHEAD),
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

/** Two catering quotes to compare on the Vendors tab. */
function sampleVendors(idGen: IdGen): Event["vendors"] {
  return [
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
}

/** A complete, realistic event so judges can explore without intake or AI calls. */
export function createSampleEvent(
  today: string,
  now: string = new Date().toISOString(),
  idGen: IdGen = makeId,
): Event {
  const event = planToEvent(sampleProfile(today), SAMPLE_PLAN, now, idGen);
  const caterTask = event.tasks.find((t) => t.title.startsWith("Book the caterer"));
  const vendors = sampleVendors(idGen);
  return {
    ...event,
    vendors,
    tasks: event.tasks.map((t) =>
      t.id === caterTask?.id ? { ...t, vendorId: vendors[0]?.id } : t,
    ),
  };
}
