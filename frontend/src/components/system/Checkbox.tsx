import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { ICONS } from "./icons";
import { Spinner } from "./Spinner";

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
  loading?: boolean;
  /** describedBy is the id of a line outside the row that describes it, like a consequence. */
  describedBy?: string;
  className?: string;
}

export interface CheckboxSignProps {
  checked: boolean;
  disabled?: boolean;
  /** row is a sign inside a Checkbox, which owns the hover, the press and the check. */
  row?: boolean;
  children?: ReactNode;
}

/**
 * CheckboxSign is the box alone, aria-hidden, for a row that already has a role of its own and
 * carries the aria-checked, like a card of the select mode. Its state comes from its own props, and
 * it has no hover: the hover is the row's. Inside a Checkbox, the Base UI indicator draws the check.
 */
export function CheckboxSign({ checked, disabled, row, children }: CheckboxSignProps) {
  return (
    <span
      aria-hidden="true"
      {...(checked ? { "data-checked": "" } : {})}
      {...(disabled ? { "data-disabled": "" } : {})}
      className={cn(
        "grid size-(--icon) shrink-0 place-items-center rounded-xs border border-line-3 bg-surface-input transition-colors duration-(--duration-fast) ease-standard data-checked:border-brand data-checked:bg-brand data-disabled:border-dashed data-disabled:bg-transparent",
        row &&
          !disabled &&
          "group-hover/checkbox:border-ink-3 group-active/checkbox:bg-brand-tint-press",
      )}
    >
      {children ?? (checked && <Icon icon={ICONS.done} size="xs" className="text-brand-on" />)}
    </span>
  );
}

/** Checkbox is a whole row that checks, with the box drawn at its start. */
export function Checkbox({
  checked,
  onCheckedChange,
  children,
  disabled,
  disabledReason,
  loading,
  describedBy,
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
      {...(withReason || describedBy !== undefined
        ? {
            "aria-describedby": [describedBy, withReason ? reasonId : undefined]
              .filter(Boolean)
              .join(" "),
          }
        : {})}
      className={cn(
        "group/checkbox flex min-h-(--size-control-sm) items-center gap-2 rounded-sm px-2 text-(length:--text-meta) leading-(--leading-meta) text-ink-1 focus-visible:focus-ring cursor-default",
        disabled && "text-ink-4",
        loading && "cursor-progress",
        className,
      )}
    >
      {loading ? (
        // The spinner stands in the box's own square, so the text beside it never moves.
        <span aria-hidden="true" className="grid size-(--icon) shrink-0 place-items-center">
          <Spinner tone="current" />
        </span>
      ) : (
        <CheckboxSign checked={checked} {...(disabled ? { disabled } : {})} row>
          <BaseCheckbox.Indicator>
            <Icon icon={ICONS.done} size="xs" className="text-brand-on" />
          </BaseCheckbox.Indicator>
        </CheckboxSign>
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
