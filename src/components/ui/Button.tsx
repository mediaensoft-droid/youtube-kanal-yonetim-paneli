import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover disabled:bg-line-strong disabled:text-ink-faint",
  secondary:
    "bg-surface-2 text-ink border border-line hover:bg-surface-hover hover:border-line-strong disabled:text-ink-faint",
  danger:
    "bg-transparent text-red-400 border border-red-900/60 hover:bg-red-950/40 disabled:text-ink-faint disabled:border-line",
  ghost: "bg-transparent text-ink-muted hover:bg-surface-hover hover:text-ink disabled:text-ink-faint",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
});
