import { Radio as BaseRadio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import { createContext, type ReactNode, useContext, useId } from "react";
import { cn } from "@/lib/utils";

export interface RadioGroupProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  orientation?: "vertical" | "horizontal";
  invalid?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export interface RadioProps {
  value: string;
  children: ReactNode;
}

/** RingState tells each radio of the group how to draw its ring. */
const RingState = createContext({ invalid: false, disabled: false });

/** RadioGroup is a labelled group of radio rows; one Tab stop, and the arrows move the choice. */
export function RadioGroup({
  label,
  value,
  onValueChange,
  children,
  orientation = "vertical",
  invalid = false,
  disabled = false,
  disabledReason,
}: RadioGroupProps) {
  const reasonId = useId();
  const withReason = disabled && disabledReason !== undefined;

  const group = (
    <BaseRadioGroup
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        if (!disabled) onValueChange(next as string);
      }}
      {...(disabled ? { readOnly: true, "aria-disabled": true } : {})}
      {...(invalid ? { "aria-invalid": true } : {})}
      {...(withReason ? { "aria-describedby": reasonId } : {})}
      className={cn(
        orientation === "vertical"
          ? "flex flex-col gap-(--space-1)"
          : "flex flex-row gap-(--space-4)",
        disabled && "text-ink-4",
      )}
    >
      <RingState value={{ invalid, disabled }}>{children}</RingState>
    </BaseRadioGroup>
  );

  if (!withReason) return group;
  return (
    <span className="inline-flex items-center gap-(--space-2)">
      {group}
      <span id={reasonId} className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
        {disabledReason}
      </span>
    </span>
  );
}

/** Radio is one row of a RadioGroup, with the ring drawn at its start. */
export function Radio({ value, children }: RadioProps) {
  const { invalid, disabled } = useContext(RingState);
  return (
    <BaseRadio.Root
      value={value}
      render={<div />}
      nativeButton={false}
      className={cn(
        "group/radio flex min-h-(--size-control-sm) items-center gap-(--space-2) rounded-sm px-(--space-2) text-(length:--text-meta) leading-(--leading-meta) focus-visible:focus-ring",
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

export interface RadioInputProps {
  /** name joins the radio to the others of the same choice; the arrows move among them. */
  name: string;
  value: string;
  checked: boolean;
  onChoose: (value: string) => void;
  /** label is the accessible name, since the radio has no text beside it. */
  label: string;
}

/**
 * RadioInput is a radio alone, a native input grouped with the others by its name, for the radios
 * spread over the rows of a table, where no element holds only them and a RadioGroup would take
 * the other controls of the rows for its own. The arrows move the choice among the radios of the
 * name, and the cell is the target, with the ring at its start like the box of a Checkbox.
 */
export function RadioInput({ name, value, checked, onChoose, label }: RadioInputProps) {
  return (
    <label className="group/radio grid min-h-(--size-control-sm) grid-cols-(--icon) place-items-center rounded-sm px-(--space-2) has-focus-visible:focus-ring">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChoose(value)}
        aria-label={label}
        className="col-start-1 row-start-1 m-0 size-(--icon) appearance-none rounded-full border border-line-3 bg-surface-input outline-none checked:border-brand group-hover/radio:not-checked:border-ink-3"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none col-start-1 row-start-1 size-2 scale-0 rounded-full bg-brand transition-transform duration-(--duration-fast) ease-standard group-has-checked/radio:scale-100"
      />
    </label>
  );
}
