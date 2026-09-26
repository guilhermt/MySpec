import type { ComponentProps } from "react";
import { Input as UIInput } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type ControlStateProps, useControlState } from "./Field";

export interface InputProps
  extends Omit<ComponentProps<typeof UIInput>, "className" | "disabled">,
    ControlStateProps {
  mono?: boolean;
  className?: string;
}

/**
 * FIELD holds the look the input and the textarea share, over the classes of the ui primitives.
 * Each state of the primitive is neutralized in the variant it is written in, dark: included: the
 * plain and dark: backgrounds are replaced, and the field-focus and field-error box-shadows are
 * important, because every ring class of the primitive rewrites the whole box-shadow after them.
 * In error with the focus, the error border and the rail stay and the halo is added outside.
 * Disabled rides on aria-disabled, since the field stays focusable, and keeps the focus it takes.
 */
export const FIELD =
  "rounded-sm border border-line-3 bg-surface-input dark:bg-surface-input px-2.5 text-ink-1 placeholder:text-ink-4 transition-[border-color,box-shadow] duration-(--duration-fast) ease-standard hover:border-ink-3 focus-visible:field-focus! aria-invalid:border-state-error dark:aria-invalid:border-state-error aria-invalid:field-error! aria-invalid:focus-visible:field-error-focus! aria-disabled:dashed-disabled! aria-disabled:focus-visible:field-focus!";

/** Input is the one-line text field, wired to the Field around it. */
export function Input({
  mono,
  disabled,
  disabledReason,
  loading,
  loadingLabel,
  className,
  ...props
}: InputProps) {
  const { attributes, wrap } = useControlState({ disabled, disabledReason, loading, loadingLabel });
  return wrap(
    <UIInput
      {...attributes}
      {...props}
      className={cn(
        FIELD,
        "h-(--size-control) text-(length:--text-ui) leading-(--leading-ui) md:text-(length:--text-ui)",
        mono && "font-mono",
        loading && "text-ink-3 cursor-progress",
        className,
      )}
    />,
  );
}
