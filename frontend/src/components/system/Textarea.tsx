import type { ComponentProps, CSSProperties } from "react";
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

/**
 * Textarea is the multi-line text field, wired to the Field around it. The field sizes to its
 * content, which ignores rows, so rows is its minimum height: that many lines of its own line height
 * (1lh: --leading-body, or the leading its text is given, like --leading-code), with the padding and
 * the border.
 */
export function Textarea({
  mono,
  disabled,
  disabledReason,
  loading,
  loadingLabel,
  className,
  rows,
  style,
  ...props
}: TextareaProps) {
  const { attributes, wrap } = useControlState({ disabled, disabledReason, loading, loadingLabel });
  return wrap(
    <UITextarea
      {...attributes}
      {...props}
      {...(rows !== undefined ? { rows } : {})}
      style={rows !== undefined ? ({ ...style, "--rows": rows } as CSSProperties) : style}
      className={cn(
        FIELD,
        "py-(--space-2) resize-y text-(length:--text-body) leading-(--leading-body) md:text-(length:--text-body)",
        rows === undefined
          ? "min-h-(--size-composer-min)"
          : "min-h-[calc(var(--rows)*1lh+var(--space-2)*2+var(--border)*2)]",
        mono && "font-mono",
        loading && "text-ink-3 cursor-progress",
        className,
      )}
    />,
  );
}
