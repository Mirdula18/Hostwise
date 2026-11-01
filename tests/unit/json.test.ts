import { parseJson, tryParseJson } from "../../src/lib/json";

describe("parseJson", () => {
  it("parses objects, arrays and primitives", () => {
    expect(parseJson('{"a":[1,2]}')).toEqual({ a: [1, 2] });
    expect(parseJson("0")).toBe(0);
    expect(parseJson("null")).toBeNull();
  });

  it("throws a SyntaxError on invalid JSON", () => {
    expect(() => parseJson("{nope")).toThrow(SyntaxError);
    expect(() => parseJson("")).toThrow(SyntaxError);
  });
});

describe("tryParseJson", () => {
  it("returns the value, or undefined instead of throwing", () => {
    expect(tryParseJson('"ok"')).toBe("ok");
    expect(tryParseJson("not json")).toBeUndefined();
    expect(tryParseJson("")).toBeUndefined();
  });
});
