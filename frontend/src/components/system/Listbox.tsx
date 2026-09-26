import { Combobox } from "@base-ui/react/combobox";
import { ChevronDown, Search } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import { ICONS } from "./icons";
import { MENU_ITEM, MenuMessage } from "./Menu";
import { type ListMessage, SELECT_TRIGGER, UNAVAILABLE } from "./Select";
import { Shimmer } from "./Shimmer";

export interface ListboxItem {
  value: string;
  label: string;
  sub?: string;
  unavailable?: boolean;
}

export interface ListboxProps {
  label: string;
  value: string | null;
  items: readonly ListboxItem[];
  onValueChange: (value: string | null) => void;
  searchLabel: string;
  emptyText: string;
  placeholder?: string;
  message?: ListMessage;
  loading?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

/** LIST_OFFSET_PX mirrors --space-1 of tokens.css: the gap between a list and its trigger, as in the menus. */
export const LIST_OFFSET_PX = 4;

/**
 * Listbox is a long choice with a search at the top of its list. While the catalog is read, the
 * saved choice shimmers; a message stands in for the list when it cannot be shown.
 */
export function Listbox({
  label,
  value,
  items,
  onValueChange,
  searchLabel,
  emptyText,
  placeholder = "",
  message,
  loading,
  disabled,
  disabledReason,
}: ListboxProps) {
  const reasonId = useId();
  const withReason = disabled === true && disabledReason !== undefined;
  const chosen = items.find((item) => item.value === value) ?? null;
  const shown =
    chosen === null ? null : `${chosen.unavailable ? `${UNAVAILABLE} ` : ""}${chosen.label}`;

  const trigger = (
    <Combobox.Trigger
      aria-label={`${label}: ${chosen?.label ?? placeholder}`}
      {...(disabled ? { "aria-disabled": true } : {})}
      {...(withReason ? { "aria-describedby": reasonId } : {})}
      {...(loading ? { "aria-busy": true } : {})}
      className={SELECT_TRIGGER}
    >
      <span className="truncate">
        <Combobox.Value>
          {shown === null ? (
            <span className="text-ink-4">{placeholder}</span>
          ) : loading ? (
            <Shimmer>{shown}</Shimmer>
          ) : (
            shown
          )}
        </Combobox.Value>
      </span>
      <Icon icon={ChevronDown} size="sm" tone="muted" />
    </Combobox.Trigger>
  );

  return (
    <Combobox.Root<ListboxItem>
      items={items}
      value={chosen}
      onValueChange={(item) => onValueChange(item?.value ?? null)}
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(item, current) => item.value === current.value}
      {...(disabled ? { open: false } : {})}
    >
      {withReason ? (
        <span className="inline-flex items-center gap-2">
          {trigger}
          <span
            id={reasonId}
            className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3"
          >
            {disabledReason}
          </span>
        </span>
      ) : (
        trigger
      )}
      <Combobox.Portal>
        <Combobox.Positioner
          align="start"
          sideOffset={LIST_OFFSET_PX}
          className="isolate z-(--z-overlay) outline-none"
        >
          <Combobox.Popup className="flex max-h-(--available-height) min-w-(--size-menu-min) flex-col gap-0.5 overflow-y-auto rounded-lg bg-surface-3 p-1 text-(length:--text-ui) leading-(--leading-ui) text-ink-1 shadow-float outline-none">
            {message !== undefined ? (
              <MenuMessage
                tone={message.tone ?? "neutral"}
                {...(message.onRetry !== undefined ? { onRetry: message.onRetry } : {})}
              >
                {message.text}
              </MenuMessage>
            ) : (
              <>
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
                      {...(item.unavailable ? { disabled: true } : {})}
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
                        <Icon icon={ICONS.done} />
                      </Combobox.ItemIndicator>
                      <span>
                        {item.unavailable && `${UNAVAILABLE} `}
                        {item.label}
                        {item.unavailable && " · unavailable"}
                      </span>
                      {item.sub !== undefined && " "}
                      {item.sub !== undefined && (
                        <span className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
                          {item.sub}
                        </span>
                      )}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </>
            )}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
