import type { Priority } from "../schemas/event";

export const PRIORITY_LABELS: Record<Priority, string> = {
  food: "Food",
  venue: "Venue",
  decor: "Décor",
  entertainment: "Entertainment",
  photography: "Photography",
  guest_comfort: "Guest comfort",
  attire: "Attire",
  favours: "Favours",
};

const CATEGORY_KEYWORDS: [Priority, RegExp][] = [
  ["food", /food|cater|cake|menu|drink|beverage|dessert|meal|dinner|lunch|snack/i],
  ["venue", /venue|hall|space|location|rent/i],
  ["decor", /d[ée]cor|flower|floral|lighting|balloon|theme/i],
  ["entertainment", /entertain|music|dj|band|game|activit|perform/i],
  ["photography", /photo|video|camera/i],
  ["guest_comfort", /comfort|seating|access|transport|chair|ramp|shuttle/i],
  ["attire", /attire|outfit|dress|cloth|costume/i],
  ["favours", /favou?r|gift|return/i],
];

/** Best-effort mapping from a free-text category ("Catering") to a priority tag. */
export function priorityForCategory(category: string): Priority | undefined {
  return CATEGORY_KEYWORDS.find(([, re]) => re.test(category))?.[0];
}

/**
 * Importance rank of a tag against the host's ranked priorities:
 * 0 = top priority, higher = less important; untagged/unranked = priorities.length.
 */
export function priorityRank(tag: Priority | undefined, priorities: readonly Priority[]): number {
  const i = tag ? priorities.indexOf(tag) : -1;
  return i === -1 ? priorities.length : i;
}
