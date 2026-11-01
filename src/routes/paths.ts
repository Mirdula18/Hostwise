/** Every in-app URL, built in one place so links and routes cannot drift apart. */
export const paths = {
  home: "/",
  intake: "/intake",
  accessibility: "/accessibility",
  event: (id: string) => `/event/${id}`,
  change: (id: string) => `/event/${id}/change`,
} as const;

/** Route patterns for `<Route path>`, matching the builders in `paths`. */
export const routePatterns = {
  home: paths.home,
  intake: paths.intake,
  accessibility: paths.accessibility,
  event: paths.event(":id"),
  change: paths.change(":id"),
} as const;
