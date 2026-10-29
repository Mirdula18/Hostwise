import { allocate, format, fromMinor, parseMoney, sum, toMinor } from "../../src/lib/money";

describe("money", () => {
  it("allocate(10000, [1,1,1]) gives [3334,3333,3333]", () => {
    const parts = allocate(10000, [1, 1, 1]);
    expect(parts).toEqual([3334, 3333, 3333]);
    expect(sum(parts)).toBe(10000);
  });

  it("allocate splits evenly when every weight is zero", () => {
    expect(allocate(9, [0, 0, 0])).toEqual([3, 3, 3]);
  });

  it("allocate returns [] for no weights and zeros for a zero total", () => {
    expect(allocate(500, [])).toEqual([]);
    expect(allocate(0, [3, 2])).toEqual([0, 0]);
  });

  it("allocate treats negative and non-finite weights as zero", () => {
    expect(allocate(100, [-5, 1, Number.NaN])).toEqual([0, 100, 0]);
  });

  it("allocate gives remainder ties to the larger weight", () => {
    expect(allocate(1, [1, 2])).toEqual([0, 1]);
    expect(sum(allocate(7, [33, 33, 34]))).toBe(7);
  });

  it("allocate rejects negative or fractional totals", () => {
    expect(() => allocate(-1, [1])).toThrow(RangeError);
    expect(() => allocate(1.5, [1])).toThrow(RangeError);
  });

  it("toMinor and fromMinor convert between major and minor units", () => {
    expect(toMinor(12.34)).toBe(1234);
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(fromMinor(1234)).toBe(12.34);
    expect(() => toMinor(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it("format renders INR with the rupee symbol and Indian grouping", () => {
    expect(format(123456, "INR")).toContain("₹");
    expect(format(123456, "INR")).toContain("1,234.56");
    expect(format(30_000_000, "INR")).toBe("₹3,00,000");
  });

  it("format drops decimals for whole amounts and handles other currencies", () => {
    expect(format(5000, "USD")).toBe("$50");
    expect(format(0, "USD")).toBe("$0");
    expect(format(1999, "JPY")).toMatch(/19\.99/);
  });
});

describe("parseMoney", () => {
  it("parses typed amounts into minor units", () => {
    expect(parseMoney("1,250.50")).toBe(125050);
    expect(parseMoney(" 0 ")).toBe(0);
    expect(parseMoney("12.")).toBe(1200);
  });
  it("rejects negatives, junk, too many decimals and huge values", () => {
    for (const bad of ["-5", "abc", "1.234", "", "1e5", "99999999999"]) {
      expect(parseMoney(bad)).toBeNull();
    }
  });
});
