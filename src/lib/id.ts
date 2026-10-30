/** Makes an id with the given prefix, e.g. `task_1a2b3c4d`. */
export type IdGen = (prefix: string) => string;

const ID_CHARS = 8;

/** Collision-resistant id for client-side records. */
export const makeId: IdGen = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, ID_CHARS)}`;

/** Deterministic id generator for tests and fixtures. */
export function counterIds(): IdGen {
  let n = 0;
  return (prefix) => `${prefix}_${++n}`;
}
