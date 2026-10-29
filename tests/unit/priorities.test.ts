import { priorityForCategory, priorityRank } from "../../src/lib/priorities";

describe("priorities", () => {
  it("maps common category names to priorities", () => {
    expect(priorityForCategory("Catering")).toBe("food");
    expect(priorityForCategory("Décor")).toBe("decor");
    expect(priorityForCategory("DJ & music")).toBe("entertainment");
    expect(priorityForCategory("Return gifts")).toBe("favours");
    expect(priorityForCategory("Contingency")).toBeUndefined();
  });

  it("ranks the top priority 0 and unranked tags last", () => {
    const p = ["food", "venue"] as const;
    expect(priorityRank("food", p)).toBe(0);
    expect(priorityRank("venue", p)).toBe(1);
    expect(priorityRank("decor", p)).toBe(2);
    expect(priorityRank(undefined, p)).toBe(2);
  });
});
