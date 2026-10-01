import { type KeyboardEvent, type ReactNode, useId, useRef } from "react";
import { cn } from "@/lib/utils";

/** OPTION_CLASS is an option of a choice: a button with its key, its title and its note. */
export const OPTION_CLASS =
  "flex w-full items-start gap-(--space-3) rounded-md border border-line-2 bg-surface-2 px-(--space-3) py-(--space-2) text-left transition-[background-color,border-color] duration-(--duration-fast) ease-standard outline-none not-aria-disabled:hover:border-line-3 not-aria-disabled:hover:bg-surface-2-hover focus-visible:focus-ring aria-checked:border-brand-ring aria-checked:bg-brand-tint aria-disabled:cursor-not-allowed";

/** KEY_CLASS is the key drawn at the start of an option, in the brand when the option is chosen. */
export const KEY_CLASS =
  "inline-grid h-(--key-size) min-w-(--key-size) flex-none place-items-center rounded-xs border border-line-2 border-b-(length:--border-2) bg-surface-2 font-mono text-(length:--text-micro) leading-(--leading-micro) text-ink-2 group-aria-checked:border-brand-ring group-aria-checked:text-brand-ink";

export interface OptionView {
  value: string;
  /** key is the digit that picks it: "1". */
  key: string;
  title: string;
  note: string;
  /** badge is drawn after the title: the Suggested tag. */
  badge?: ReactNode;
  disabledReason?: string;
}

export interface OptionGroupProps {
  label: string;
  /** value is the chosen option; null for none, which no option shows checked. */
  value: string | null;
  options: readonly OptionView[];
  onChange: (value: string) => void;
}

/**
 * OptionGroup is a choice among options drawn as the options of a question: one Tab stop, the
 * arrows moving among the enabled options, Space and Enter choosing. The digits stay with whoever
 * uses the group.
 */
export function OptionGroup({ label, value, options, onChange }: OptionGroupProps) {
  const reasonBase = useId();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const enabled = options.filter((option) => option.disabledReason === undefined);
  const stop = enabled.find((option) => option.value === value)?.value ?? enabled[0]?.value ?? null;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (enabled.length === 0) return;
    const at = enabled.findIndex(
      (option) => buttons.current.get(option.value) === document.activeElement,
    );
    const step = event.key === "ArrowDown" ? 1 : -1;
    const next =
      at < 0 ? (step > 0 ? 0 : enabled.length - 1) : (at + step + enabled.length) % enabled.length;
    const target = enabled[next];
    if (target !== undefined) buttons.current.get(target.value)?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex flex-col gap-(--space-1-5)"
      onKeyDown={onKeyDown}
    >
      {options.map((option, index) => {
        const disabled = option.disabledReason !== undefined;
        const reasonId = `${reasonBase}-${index}`;
        return (
          <div key={option.value} className="flex flex-col gap-(--space-1)">
            {/* biome-ignore lint/a11y/useSemanticElements: an input radio can't hold the key, the title and the note of an option */}
            <button
              ref={(node) => {
                if (node === null) buttons.current.delete(option.value);
                else buttons.current.set(option.value, node);
              }}
              type="button"
              role="radio"
              aria-checked={option.value === value}
              aria-disabled={disabled || undefined}
              aria-describedby={disabled ? reasonId : undefined}
              tabIndex={option.value === stop ? 0 : -1}
              className={cn("group", OPTION_CLASS, disabled && "aria-disabled:dashed-disabled")}
              onClick={() => {
                if (!disabled) onChange(option.value);
              }}
            >
              <span className={KEY_CLASS}>{option.key}</span>
              <span className="flex flex-col gap-(--space-0-5) font-medium text-ink-1 group-aria-disabled:text-ink-4">
                <span className="flex items-center gap-(--space-2)">
                  {option.title}
                  {option.badge}
                </span>
                {option.note !== "" && (
                  <small className="text-(length:--text-meta) leading-(--leading-meta) font-normal text-ink-3">
                    {option.note}
                  </small>
                )}
              </span>
            </button>
            {disabled && (
              <span
                id={reasonId}
                className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3"
              >
                {option.disabledReason}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
