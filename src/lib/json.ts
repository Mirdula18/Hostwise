/**
 * Parses JSON text as `unknown`, so every caller has to validate the value (usually with
 * Zod) before using it. Throws a `SyntaxError` on invalid JSON, like `JSON.parse`.
 */
export function parseJson(text: string): unknown {
  const value: unknown = JSON.parse(text);
  return value;
}

/** Like `parseJson`, but returns `undefined` for invalid JSON instead of throwing. */
export function tryParseJson(text: string): unknown {
  try {
    return parseJson(text);
  } catch {
    return undefined;
  }
}
