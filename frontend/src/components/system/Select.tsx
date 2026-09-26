import { Menu as BaseMenu } from "@base-ui/react/menu";
import { Check, ChevronDown } from "lucide-react";
import { Fragment, useId } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import {
  MENU_ITEM,
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuMessage,
  MenuSeparator,
  MenuTrigger,
} from "./Menu";

export interface SelectOption {
  value: string;
  label: string;
  sub?: string;
  unavailable?: boolean;
}

/** ListMessage stands in for the choices of a Select or a Listbox while they load or when they fail. */
export interface ListMessage {
  text: string;
  tone?: "neutral" | "error";
  onRetry?: () => void;
}

export interface SelectGroup {
  label: string;
  note?: string;
  options: readonly SelectOption[];
}

export interface SelectProps {
  label: string;
  value: string;
  options?: readonly SelectOption[];
  groups?: readonly SelectGroup[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  message?: ListMessage;
  size?: "md" | "sm";
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * SELECT_TRIGGER is the look of a field that opens a list, shared with Listbox. Disabled rides on
 * aria-disabled, whose variant outweighs the plain classes; focused, it keeps the focus border and halo.
 */
export const SELECT_TRIGGER =
  "flex h-(--size-control) w-full items-center justify-between gap-2 rounded-sm border border-line-3 bg-surface-input px-2.5 text-(length:--text-ui) leading-(--leading-ui) text-ink-1 transition-[border-color,box-shadow] duration-(--duration-fast) ease-standard hover:border-ink-3 aria-expanded:border-focus focus-visible:field-focus aria-disabled:dashed-disabled aria-disabled:focus-visible:field-focus";

/** UNAVAILABLE marks a choice that is no longer offered. */
export const UNAVAILABLE = "◇";

/** Select is a field that opens a menu of choices, one of them checked. */
export function Select({
  label,
  value,
  options,
  groups,
  onValueChange,
  placeholder = "",
  message,
  size = "md",
  disabled,
  disabledReason,
}: SelectProps) {
  const reasonId = useId();
  const withReason = disabled === true && disabledReason !== undefined;
  const all = [...(options ?? []), ...(groups ?? []).flatMap((group) => group.options)];
  const chosen = all.find((option) => option.value === value);

  const trigger = (
    <MenuTrigger
      render={<button type="button" />}
      aria-label={`${label}: ${chosen?.label ?? placeholder}`}
      {...(disabled ? { "aria-disabled": true } : {})}
      {...(withReason ? { "aria-describedby": reasonId } : {})}
      className={cn(SELECT_TRIGGER, size === "sm" && "h-(--size-control-sm)")}
    >
      <span className="truncate">
        {chosen?.unavailable && `${UNAVAILABLE} `}
        {chosen?.label ?? <span className="text-ink-4">{placeholder}</span>}
      </span>
      <Icon icon={ChevronDown} size="sm" tone="muted" />
    </MenuTrigger>
  );

  return (
    <Menu {...(disabled ? { open: false } : {})}>
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
      <MenuContent>
        {message !== undefined ? (
          <MenuMessage
            tone={message.tone ?? "neutral"}
            {...(message.onRetry !== undefined ? { onRetry: message.onRetry } : {})}
          >
            {message.text}
          </MenuMessage>
        ) : (
          <BaseMenu.RadioGroup value={value} onValueChange={(next: string) => onValueChange(next)}>
            {options?.map((option) => (
              <SelectItem key={option.value} option={option} />
            ))}
            {groups?.map((group, index) => (
              <Fragment key={group.label}>
                {(index > 0 || (options?.length ?? 0) > 0) && <MenuSeparator />}
                <MenuGroup>
                  <MenuGroupLabel {...(group.note !== undefined ? { note: group.note } : {})}>
                    {group.label}
                  </MenuGroupLabel>
                  {group.options.map((option) => (
                    <SelectItem key={option.value} option={option} />
                  ))}
                </MenuGroup>
              </Fragment>
            ))}
          </BaseMenu.RadioGroup>
        )}
      </MenuContent>
    </Menu>
  );
}

/** SelectItem is a choice with its check at the start, in the brand ink. */
function SelectItem({ option }: { option: SelectOption }) {
  return (
    <BaseMenu.RadioItem
      value={option.value}
      {...(option.unavailable ? { disabled: true } : {})}
      className={cn(
        "relative flex cursor-default items-center outline-hidden select-none",
        MENU_ITEM,
      )}
    >
      <BaseMenu.RadioItemIndicator
        keepMounted
        className="size-(--icon) text-brand-ink data-unchecked:invisible"
      >
        <Check className="size-(--icon)" />
      </BaseMenu.RadioItemIndicator>
      <span>
        {option.unavailable && `${UNAVAILABLE} `}
        {option.label}
        {option.unavailable && " · unavailable"}
      </span>
      {option.sub !== undefined && " "}
      {option.sub !== undefined && (
        <span className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
          {option.sub}
        </span>
      )}
    </BaseMenu.RadioItem>
  );
}
