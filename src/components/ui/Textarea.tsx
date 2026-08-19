import { TextareaHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={clsx(
          "w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-ink-faint",
          "transition-colors duration-150 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand",
          className
        )}
        {...props}
      />
    );
  }
);
