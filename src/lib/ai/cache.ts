/** JSON with object keys sorted, so equal inputs always produce the same string. */
export function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const HEX = 16;
const HASH_HEX_DIGITS = 8;
const DEFAULT_CACHE_SIZE = 50;

/** 32-bit FNV-1a hash, hex encoded. Short cache keys; collisions only cost a cache miss. */
export function hashKey(text: string): string {
  let h = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME);
  }
  return (h >>> 0).toString(HEX).padStart(HASH_HEX_DIGITS, "0");
}

/** Least-recently-used cache backed by Map insertion order. */
export class LRUCache<V> {
  private map = new Map<string, V>();

  constructor(private readonly max = DEFAULT_CACHE_SIZE) {}

  get(key: string): V | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

/** Cache key for a task call: task name, input hash and input length. */
export function cacheKey(task: string, input: unknown): string {
  const text = stableStringify(input);
  return `${task}:${hashKey(text)}:${text.length}`;
}
