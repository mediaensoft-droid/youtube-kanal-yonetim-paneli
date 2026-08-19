import { SelectHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={clsx(
          "w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink",
          "transition-colors duration-150 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
