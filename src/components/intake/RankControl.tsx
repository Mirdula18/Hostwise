import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "../ui/Badge";

type Props = {
  legend: string;
  value: string[];
  labels: Record<string, string>;
  onChange: (next: string[]) => void;
  topN?: number;
};

type PendingFocus = { item: string; dir: "up" | "down" } | null;

/**
 * Keyboard-first ranking: each item has Move up / Move down buttons. Focus follows
 * the moved item and the new position is announced politely.
 */
export function RankControl({ legend, value, labels, onChange, topN = 3 }: Props) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [announcement, setAnnouncement] = useState("");
  const [pending, setPending] = useState<PendingFocus>(null);

  useEffect(() => {
    if (!pending) return;
    const same = refs.current[`${pending.item}-${pending.dir}`];
    const other = refs.current[`${pending.item}-${pending.dir === "up" ? "down" : "up"}`];
    (same && !same.disabled ? same : other)?.focus();
    setPending(null);
  }, [pending, value]);

  const move = (index: number, dir: "up" | "down") => {
    const target = dir === "up" ? index - 1 : index + 1;
    const item = value[index];
    if (item === undefined || target < 0 || target >= value.length) return;
    const next = [...value];
    next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
    setAnnouncement(`${labels[item] ?? item} moved to position ${target + 1}`);
    setPending({ item, dir });
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{legend}</legend>
      <ol className="space-y-2">
        {value.map((item, i) => {
          const label = labels[item] ?? item;
          return (
            <li
              key={item}
              className={`flex items-center gap-2 rounded-lg border p-2 ${
                i < topN ? "border-brand bg-brand/5" : "border-line bg-surface"
              }`}
            >
              <span className="w-6 text-right font-bold" aria-hidden="true">
                {i + 1}.
              </span>
              <span className="flex-1 font-medium">
                <span className="sr-only">Position {i + 1}: </span>
                {label}
              </span>
              {i < topN ? <Badge tone="brand">Top {topN}</Badge> : null}
              <button
                ref={(el) => {
                  refs.current[`${item}-up`] = el;
                }}
                type="button"
                aria-label={`Move ${label} up`}
                disabled={i === 0}
                onClick={() => move(i, "up")}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line disabled:opacity-40"
              >
                <ArrowUp aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                ref={(el) => {
                  refs.current[`${item}-down`] = el;
                }}
                type="button"
                aria-label={`Move ${label} down`}
                disabled={i === value.length - 1}
                onClick={() => move(i, "down")}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line disabled:opacity-40"
              >
                <ArrowDown aria-hidden="true" className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ol>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </fieldset>
  );
}
