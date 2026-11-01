/** The trimmed text, or undefined when it is missing or blank. */
export function nonEmpty(text: string | undefined): string | undefined {
  const trimmed = text?.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** Trims `text` and cuts it to at most `max` characters. */
export function clip(text: string, max: number): string {
  return text.trim().slice(0, max);
}

/**
 * `{ [key]: clipped }` for a non-blank optional field, or `{}` so the key is left out
 * entirely (Zod `.optional()` fields must be absent, not empty).
 */
export function optionalText<K extends string>(
  key: K,
  text: string,
  max: number,
): Partial<Record<K, string>> {
  const value = clip(text, max);
  const out: Partial<Record<K, string>> = {};
  if (value) out[key] = value;
  return out;
}
