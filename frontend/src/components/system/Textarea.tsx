import type { ComponentProps } from "react";
import { Textarea as UITextarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useFieldControl } from "./Field";
import { FIELD } from "./Input";

export interface TextareaProps extends Omit<ComponentProps<typeof UITextarea>, "className"> {
  mono?: boolean;
  loading?: boolean;
  className?: string;
}

/** Textarea is the multi-line text field, wired to the Field around it. */
export function Textarea({ mono, loading, className, ...props }: TextareaProps) {
  const field = useFieldControl();
  return (
    <UITextarea
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
        "min-h-(--size-composer-min) py-2 resize-y text-(length:--text-body) leading-(--leading-body) md:text-(length:--text-body)",
        mono && "font-mono",
        loading && "text-ink-3 cursor-progress",
        className,
      )}
    />
  );
}
