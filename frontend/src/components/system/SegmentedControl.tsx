import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import type { LucideIcon } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  detail?: string;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onValueChange: (value: T) => void;
  size?: "xs" | "sm";
  disabled?: boolean;
  disabledReason?: string;
}

/** SegmentedControl picks one of up to three views; one Tab stop, and the arrows move the choice. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onValueChange,
  size = "xs",
  disabled,
  disabledReason,
}: SegmentedControlProps<T>) {
  if (import.meta.env.DEV && options.length > 3) {
    throw new Error(`SegmentedControl "${label}" takes at most 3 options`);
  }
  const reasonId = useId();
  const withReason = disabled === true && disabledReason !== undefined;

  const group = (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        if (!disabled) onValueChange(next as T);
      }}
      {...(disabled ? { readOnly: true, "aria-disabled": true } : {})}
      {...(withReason ? { "aria-describedby": reasonId } : {})}
      className={cn(
        "inline-flex gap-0.5 rounded-sm bg-surface-0 p-0.5",
        disabled && "dashed-disabled border border-dashed border-line-3 bg-transparent",
      )}
    >
      {options.map((option) => (
        <Radio.Root
          key={option.value}
          value={option.value}
          className={cn(
            "inline-flex h-(--size-control-xs) items-center gap-1.5 rounded-xs px-2.5 text-(length:--text-meta) leading-(--leading-meta) text-ink-2 transition-colors duration-(--duration-fast) ease-standard not-data-readonly:not-data-checked:hover:bg-veil-hover not-data-readonly:not-data-checked:hover:text-ink-1 focus-visible:focus-ring data-checked:bg-brand-tint data-checked:text-ink-1 data-checked:font-medium data-checked:shadow-[inset_0_0_0_var(--border)_var(--brand-ring)]",
            size === "sm" && "h-(--size-control-sm)",
          )}
        >
          {option.icon !== undefined && <Icon icon={option.icon} size="sm" />}
          {option.label}
          {option.detail !== undefined && (
            // The space keeps the detail apart from the label in the accessible name.
            <>
              {" "}
              <span className="text-ink-3">{option.detail}</span>
            </>
          )}
        </Radio.Root>
      ))}
    </RadioGroup>
  );

  if (!withReason) return group;
  return (
    <span className="inline-flex items-center gap-2">
      {group}
      <span id={reasonId} className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
        {disabledReason}
      </span>
    </span>
  );
}
