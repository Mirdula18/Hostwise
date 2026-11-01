import { parseJson } from "../src/lib/json";

/** Returns `value`, or fails the test with a clear message when it is missing. */
export function must<T>(value: T | null | undefined, what = "value"): T {
  if (value === null || value === undefined) throw new Error(`Expected ${what} to exist`);
  return value;
}

/** The JSON body a fake fetch received, as `unknown` for the test to check. */
export function sentBody(init: RequestInit | undefined): unknown {
  return typeof init?.body === "string" ? parseJson(init.body) : undefined;
}

/** The URL a fake fetch was called with, whatever form it was passed in. */
export function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}
