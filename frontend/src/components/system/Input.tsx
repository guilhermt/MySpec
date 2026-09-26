import type { ComponentProps } from "react";
import { Input as UIInput } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useFieldControl } from "./Field";

export interface InputProps extends Omit<ComponentProps<typeof UIInput>, "className"> {
  mono?: boolean;
  loading?: boolean;
  className?: string;
}

/**
 * FIELD holds the look the input and the textarea share, over the classes of the ui primitives.
 * Each state of the primitive is neutralized in the variant it is written in, dark: included: the
 * plain and dark: backgrounds are replaced, and the field-focus and field-error box-shadows are
 * important, because every ring class of the primitive rewrites the whole box-shadow after them.
 */
export const FIELD =
  "rounded-sm border border-line-3 bg-surface-input dark:bg-surface-input px-2.5 text-ink-1 placeholder:text-ink-4 transition-[border-color,box-shadow] duration-(--duration-fast) ease-standard hover:border-ink-3 focus-visible:field-focus! aria-invalid:border-state-error dark:aria-invalid:border-state-error aria-invalid:field-error! disabled:opacity-100 disabled:bg-transparent dark:disabled:bg-transparent disabled:dashed-disabled!";

/** Input is the one-line text field, wired to the Field around it. */
export function Input({ mono, loading, className, ...props }: InputProps) {
  const field = useFieldControl();
  return (
    <UIInput
      {...(field !== null
        ? {
            id: field.controlId,
            ...(field.describedBy !== undefined ? { "aria-describedby": field.describedBy } : {}),
            ...(field.invalid ? { "aria-invalid": true } : {}),
          }
        : {})}
      {...(loading ? { "aria-busy": true } : {})}
      {...props}
      className={cn(
        FIELD,
        "h-(--size-control) text-(length:--text-ui) leading-(--leading-ui) md:text-(length:--text-ui)",
        mono && "font-mono",
        loading && "text-ink-3 cursor-progress",
        className,
      )}
    />
  );
}
