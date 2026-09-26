import { Search, X } from "lucide-react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import { Kbd } from "./Kbd";

export interface SearchInputProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  shortcut?: string;
  onEscape?: () => void;
  onArrowDown?: () => void;
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
  className,
}: SearchInputProps) {
  const input = useRef<HTMLInputElement>(null);

  return (
    // biome-ignore lint/a11y/useSemanticElements: jsdom gives the <search> element no role, so the landmark is declared.
    <div
      role="search"
      className={cn(
        "flex h-(--size-control-sm) items-center gap-1.5 rounded-sm border border-line-3 bg-surface-input pr-1 pl-2 transition-[border-color,box-shadow] duration-(--duration-fast) ease-standard not-focus-within:hover:border-ink-3 focus-within:field-focus",
        className,
      )}
    >
      <Icon icon={Search} size="sm" tone="muted" />
      <input
        ref={input}
        type="search"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onEscape?.();
          if (event.key === "ArrowDown") onArrowDown?.();
        }}
        className="min-w-0 flex-1 border-0 bg-transparent text-(length:--text-meta) leading-(--leading-meta) text-ink-1 placeholder:text-ink-4 outline-none"
      />
      {value === "" ? (
        <Kbd size="sm">{shortcut}</Kbd>
      ) : (
        <IconButton
          label="Clear search"
          icon={X}
          size="xs"
          onClick={() => {
            onValueChange("");
            input.current?.focus();
          }}
        />
      )}
    </div>
  );
}
