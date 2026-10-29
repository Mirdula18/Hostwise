import { useEffect, useRef, type ReactNode } from "react";

let firstRender = true;

type Props = { title: string; children?: ReactNode; className?: string };

/**
 * The page's single h1. Sets document.title and, after the first page load,
 * moves focus here so screen-reader users hear the new page.
 */
export function PageHeading({ title, children, className = "" }: Props) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${title} · Hostwise`;
  }, [title]);
  useEffect(() => {
    if (firstRender) firstRender = false;
    else ref.current?.focus();
  }, []);
  return (
    <h1 ref={ref} tabIndex={-1} className={`text-2xl font-bold sm:text-3xl ${className}`}>
      {children ?? title}
    </h1>
  );
}
