import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-brand text-brand-ink hover:bg-brand/90",
  secondary: "border-line bg-surface text-ink hover:bg-bg",
  ghost: "border-transparent text-brand hover:bg-brand/10",
  danger: "border-transparent bg-danger text-white hover:bg-danger/90",
};

/**
 * Shared classes so links can look like buttons; 44px minimum tap target. Every variant
 * has a border (transparent when not needed) so buttons stay outlined in forced-colors mode.
 */
export function buttonClass(variant: ButtonVariant = "primary", extra = ""): string {
  return `inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${extra}`;
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant };

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", className = "", type = "button", ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClass(variant, className)} {...rest} />;
});
