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
  return value ? ({ [key]: value } as Record<K, string>) : {};
}
