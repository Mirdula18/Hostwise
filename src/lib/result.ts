/** Success with a value, or failure with a typed error. Used instead of throwing. */
export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

/** Wraps a success value. */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
/** Wraps a failure. */
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
