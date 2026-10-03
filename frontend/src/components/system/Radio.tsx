import { Radio as BaseRadio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import { createContext, type ReactElement, type ReactNode, useContext, useId } from "react";
import { cn } from "@/lib/utils";

export interface RadioGroupProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  /** render is the element the group is drawn as, like a tbody whose rows hold the radios. */
  render?: ReactElement;
  orientation?: "vertical" | "horizontal";
  invalid?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export interface RadioProps {
  value: string;
  /** label names a radio that has no text beside it, like one in a table cell. */
  label?: string;
  children?: ReactNode;
}

/** RingState tells each radio of the group how to draw its ring. */
const RingState = createContext({ invalid: false, disabled: false });

/** RadioGroup is a labelled group of radio rows; one Tab stop, and the arrows move the choice. */
export function RadioGroup({
  label,
  value,
  onValueChange,
  children,
  render,
  orientation = "vertical",
  invalid = false,
  disabled = false,
  disabledReason,
}: RadioGroupProps) {
  const reasonId = useId();
  const withReason = disabled && disabledReason !== undefined;

  const group = (
    <BaseRadioGroup
      {...(render !== undefined ? { render } : {})}
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        if (!disabled) onValueChange(next as string);
      }}
      {...(disabled ? { readOnly: true, "aria-disabled": true } : {})}
      {...(invalid ? { "aria-invalid": true } : {})}
      {...(withReason ? { "aria-describedby": reasonId } : {})}
      className={cn(
        orientation === "vertical" ? "flex flex-col gap-1" : "flex flex-row gap-4",
        disabled && "text-ink-4",
      )}
    >
      <RingState value={{ invalid, disabled }}>{children}</RingState>
    </BaseRadioGroup>
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

/** Radio is one row of a RadioGroup, with the ring drawn at its start. */
export function Radio({ value, label, children }: RadioProps) {
  const { invalid, disabled } = useContext(RingState);
  return (
    <BaseRadio.Root
      value={value}
      render={<div />}
      nativeButton={false}
      {...(label !== undefined ? { "aria-label": label } : {})}
      className={cn(
        "group/radio flex min-h-(--size-control-sm) items-center gap-2 rounded-sm px-2 text-(length:--text-meta) leading-(--leading-meta) focus-visible:focus-ring",
        disabled ? "text-ink-4" : "text-ink-1",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-(--icon) place-items-center rounded-full border border-line-3 bg-surface-input group-data-checked/radio:border-brand",
          !disabled && "group-hover/radio:not-group-data-checked/radio:border-ink-3",
          invalid && "border-state-error bg-state-error-veil",
          disabled && "border-dashed bg-transparent",
        )}
      >
        <span className="size-2 scale-0 rounded-full bg-brand transition-transform duration-(--duration-fast) ease-standard group-data-checked/radio:scale-100" />
      </span>
      {children}
    </BaseRadio.Root>
  );
}
