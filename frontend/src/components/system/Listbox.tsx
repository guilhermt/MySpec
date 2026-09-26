import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { MENU_ITEM } from "./Menu";
import { SELECT_TRIGGER } from "./Select";

export interface ListboxItem {
  value: string;
  label: string;
  sub?: string;
}

export interface ListboxProps {
  label: string;
  value: string | null;
  items: readonly ListboxItem[];
  onValueChange: (value: string | null) => void;
  searchLabel: string;
  emptyText: string;
  placeholder?: string;
}

/** Listbox is a long choice with a search at the top of its list. */
export function Listbox({
  label,
  value,
  items,
  onValueChange,
  searchLabel,
  emptyText,
  placeholder = "",
}: ListboxProps) {
  const chosen = items.find((item) => item.value === value) ?? null;

  return (
    <Combobox.Root<ListboxItem>
      items={items}
      value={chosen}
      onValueChange={(item) => onValueChange(item?.value ?? null)}
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(item, current) => item.value === current.value}
    >
      <Combobox.Trigger
        aria-label={`${label}: ${chosen?.label ?? placeholder}`}
        className={SELECT_TRIGGER}
      >
        <span className="truncate">
          <Combobox.Value>
            {chosen === null ? <span className="text-ink-4">{placeholder}</span> : chosen.label}
          </Combobox.Value>
        </span>
        <Icon icon={ChevronDown} size="sm" tone="muted" />
      </Combobox.Trigger>
      <Combobox.Portal>
        {/* sideOffset 4 is --space-1, as the menus have it. */}
        <Combobox.Positioner
          align="start"
          sideOffset={4}
          className="isolate z-(--z-overlay) outline-none"
        >
          <Combobox.Popup className="flex max-h-(--available-height) min-w-(--size-menu-min) flex-col gap-0.5 overflow-y-auto rounded-lg bg-surface-3 p-1 text-(length:--text-ui) leading-(--leading-ui) text-ink-1 shadow-float outline-none">
            <div className="flex h-(--size-control-sm) items-center gap-1.5 rounded-sm border border-line-3 bg-surface-input pr-1 pl-2 not-focus-within:hover:border-ink-3 focus-within:field-focus">
              <Icon icon={Search} size="sm" tone="muted" />
              <Combobox.Input
                aria-label={searchLabel}
                className="min-w-0 flex-1 border-0 bg-transparent text-(length:--text-meta) leading-(--leading-meta) text-ink-1 placeholder:text-ink-4 outline-none"
              />
            </div>
            <Combobox.Empty className="px-2 py-1.5 text-(length:--text-meta) leading-(--leading-meta) text-ink-3 empty:hidden">
              {emptyText}
            </Combobox.Empty>
            <Combobox.List className="flex flex-col gap-0.5">
              {(item: ListboxItem) => (
                <Combobox.Item
                  key={item.value}
                  value={item}
                  className={cn(
                    "flex cursor-default items-center outline-none select-none",
                    MENU_ITEM,
                    "data-highlighted:bg-veil-hover",
                  )}
                >
                  <Combobox.ItemIndicator
                    keepMounted
                    className="size-(--icon) text-brand-ink data-unchecked:invisible"
                  >
                    <Check className="size-(--icon)" />
                  </Combobox.ItemIndicator>
                  <span>{item.label}</span>
                  {item.sub !== undefined && " "}
                  {item.sub !== undefined && (
                    <span className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
                      {item.sub}
                    </span>
                  )}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
