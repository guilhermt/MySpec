import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Check } from "lucide-react";
import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  loading?: boolean;
  className?: string;
}

/** Checkbox is a whole row that checks, with the box drawn at its start. */
export function Checkbox({
  checked,
  onCheckedChange,
  children,
  disabled,
  disabledReason,
  loading,
  className,
}: CheckboxProps) {
  const reasonId = useId();
  const withReason = disabled === true && disabledReason !== undefined;
  const inert = disabled === true || loading === true;

  const row = (
    <BaseCheckbox.Root
      render={<div />}
      checked={checked}
      onCheckedChange={(next) => {
        if (!inert) onCheckedChange(next);
      }}
      {...(inert ? { readOnly: true } : {})}
      {...(disabled ? { "aria-disabled": true } : {})}
      {...(loading ? { "aria-busy": true } : {})}
      {...(withReason ? { "aria-describedby": reasonId } : {})}
      className={cn(
        "group/checkbox flex min-h-(--size-control-sm) items-center gap-2 rounded-sm px-2 text-(length:--text-meta) leading-(--leading-meta) text-ink-1 focus-visible:focus-ring cursor-default",
        disabled && "text-ink-4",
        loading && "cursor-progress",
        className,
      )}
    >
      {loading ? (
        <Spinner tone="current" />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "grid size-(--icon) shrink-0 place-items-center rounded-xs border border-line-3 bg-surface-input transition-colors duration-(--duration-fast) ease-standard group-data-checked/checkbox:border-brand group-data-checked/checkbox:bg-brand",
            disabled
              ? "border-dashed bg-transparent"
              : "group-hover/checkbox:border-ink-3 group-active/checkbox:bg-brand-tint-press",
          )}
        >
          <BaseCheckbox.Indicator>
            <Check className="size-(--icon-xs) text-brand-on" />
          </BaseCheckbox.Indicator>
        </span>
      )}
      {children}
    </BaseCheckbox.Root>
  );

  if (!withReason) return row;
  return (
    <span className="inline-flex items-center gap-2">
      {row}
      <span id={reasonId} className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
        {disabledReason}
      </span>
    </span>
  );
}
