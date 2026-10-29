export type IdGen = (prefix: string) => string;

/** Collision-resistant id for client-side records. */
export const makeId: IdGen = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;

/** Deterministic id generator for tests and fixtures. */
export function counterIds(): IdGen {
  let n = 0;
  return (prefix) => `${prefix}_${++n}`;
}
