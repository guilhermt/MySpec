import type { ComponentProps } from "react";
import { Textarea as UITextarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { type ControlStateProps, useControlState } from "./Field";
import { FIELD } from "./Input";

export interface TextareaProps
  extends Omit<ComponentProps<typeof UITextarea>, "className" | "disabled">,
    ControlStateProps {
  mono?: boolean;
  className?: string;
}

/** Textarea is the multi-line text field, wired to the Field around it. */
export function Textarea({
  mono,
  disabled,
  disabledReason,
  loading,
  loadingLabel,
  className,
  ...props
}: TextareaProps) {
  const { attributes, wrap } = useControlState({ disabled, disabledReason, loading, loadingLabel });
  return wrap(
    <UITextarea
      {...attributes}
      {...props}
      className={cn(
        FIELD,
        "min-h-(--size-composer-min) py-2 resize-y text-(length:--text-body) leading-(--leading-body) md:text-(length:--text-body)",
        mono && "font-mono",
        loading && "text-ink-3 cursor-progress",
        className,
      )}
    />,
  );
}
