import { clip, optionalText } from "../../src/lib/text";

describe("clip", () => {
  it("trims and cuts to the limit", () => {
    expect(clip("  hello world  ", 5)).toBe("hello");
    expect(clip("short", 80)).toBe("short");
  });

  it("returns an empty string for blank input or a zero limit", () => {
    expect(clip("   ", 10)).toBe("");
    expect(clip("text", 0)).toBe("");
  });
});

describe("optionalText", () => {
  it("includes the key only when the text is not blank", () => {
    expect(optionalText("notes", "  call back ", 80)).toEqual({ notes: "call back" });
    expect(optionalText("notes", "   ", 80)).toEqual({});
    expect(optionalText("notes", "", 80)).toEqual({});
  });

  it("clips long values", () => {
    expect(optionalText("contact", "abcdef", 3)).toEqual({ contact: "abc" });
  });
});
