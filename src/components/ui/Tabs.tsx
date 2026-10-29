import { useRef, type KeyboardEvent, type ReactNode } from "react";

export type TabItem<K extends string> = { key: K; label: string };

type Props<K extends string> = {
  label: string;
  tabs: readonly TabItem<K>[];
  selected: K;
  onSelect: (key: K) => void;
  idPrefix: string;
};

const tabId = (prefix: string, key: string) => `${prefix}-tab-${key}`;
const panelId = (prefix: string, key: string) => `${prefix}-panel-${key}`;

/** WAI-ARIA tabs with automatic activation: arrows, Home and End move between tabs. */
export function Tabs<K extends string>({ label, tabs, selected, onSelect, idPrefix }: Props<K>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : e.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    const tab = tabs[next];
    if (!tab) return;
    onSelect(tab.key);
    refs.current[tab.key]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-1 overflow-x-auto border-b border-line print:hidden"
    >
      {tabs.map((tab, i) => {
        const active = tab.key === selected;
        return (
          <button
            key={tab.key}
            ref={(el) => {
              refs.current[tab.key] = el;
            }}
            type="button"
            role="tab"
            id={tabId(idPrefix, tab.key)}
            aria-selected={active}
            aria-controls={panelId(idPrefix, tab.key)}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(tab.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`min-h-11 whitespace-nowrap border-b-4 px-4 text-sm font-semibold ${
              active ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

type PanelProps = { idPrefix: string; tabKey: string; children: ReactNode };

export function TabPanel({ idPrefix, tabKey, children }: PanelProps) {
  return (
    <div
      role="tabpanel"
      id={panelId(idPrefix, tabKey)}
      aria-labelledby={tabId(idPrefix, tabKey)}
      tabIndex={0}
      className="pt-4"
    >
      {children}
    </div>
  );
}
