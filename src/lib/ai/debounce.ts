type Debounced<A extends unknown[]> = ((...args: A) => void) & { cancel: () => void };

/** Delays calls until `ms` have passed without another call; only the last call runs. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms = 500): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: A) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, ms);
  };
  debounced.cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  return debounced;
}
