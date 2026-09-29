import { Search } from "lucide-react";
import { type KeyboardEvent, type Ref, useRef } from "react";
import { cn } from "@/lib/utils";
import { type ControlStateProps, useControlState } from "./Field";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { ICONS } from "./icons";
import { Kbd } from "./Kbd";

export interface SearchInputProps extends ControlStateProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  shortcut?: string;
  /** onEscape is told the event, so it can keep the key from reaching the place around the box. */
  onEscape?: (event: KeyboardEvent<HTMLInputElement>) => void;
  onArrowDown?: () => void;
  /** landmark is false when the bar around the field already is the search landmark. */
  landmark?: boolean;
  /** inputRef is the text field, the target of the key that focuses the search. */
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
}

/** SearchInput is the search box: the field, its key while empty, and a clear button with text. */
export function SearchInput({
  label,
  value,
  onValueChange,
  placeholder,
  shortcut = "/",
  onEscape,
  onArrowDown,
  landmark = true,
  inputRef,
  disabled,
  disabledReason,
  loading,
  loadingLabel,
  className,
}: SearchInputProps) {
  const input = useRef<HTMLInputElement | null>(null);
  // jsdom gives the <search> element no role, so the landmark is declared as an attribute.
  const landmarkRole = landmark ? { role: "search" } : {};
  const { attributes, wrap } = useControlState({ disabled, disabledReason, loading, loadingLabel });

  return wrap(
    <div
      {...landmarkRole}
      {...(disabled ? { "data-disabled": "" } : {})}
      className={cn(
        "flex h-(--size-control-sm) items-center gap-1.5 rounded-sm border border-line-3 bg-surface-input pr-1 pl-2 transition-[border-color,box-shadow] duration-(--duration-fast) ease-standard not-data-disabled:not-focus-within:hover:border-ink-3 focus-within:field-focus data-disabled:dashed-disabled data-disabled:focus-within:field-focus",
        className,
      )}
    >
      <Icon icon={Search} size="sm" tone="muted" />
      {/* biome-ignore lint/a11y/useSemanticElements: type="search" makes WebKit draw its own cancel next to the clear button, so the text field declares the role. */}
      <input
        ref={(element) => {
          input.current = element;
          if (typeof inputRef === "function") inputRef(element);
          else if (inputRef) inputRef.current = element;
        }}
        {...attributes}
        type="text"
        role="searchbox"
        enterKeyHint="search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onEscape?.(event);
          if (event.key === "ArrowDown") onArrowDown?.();
        }}
        className="min-w-0 flex-1 border-0 bg-transparent read-only:cursor-not-allowed text-(length:--text-meta) leading-(--leading-meta) text-ink-1 aria-disabled:text-ink-4 placeholder:text-ink-4 outline-none"
      />
      {value === "" ? (
        <Kbd size="sm">{shortcut}</Kbd>
      ) : (
        <IconButton
          label="Clear search"
          icon={ICONS.close}
          size="xs"
          {...(disabled ? { disabled } : {})}
          onClick={() => {
            onValueChange("");
            input.current?.focus();
          }}
        />
      )}
    </div>,
  );
}
