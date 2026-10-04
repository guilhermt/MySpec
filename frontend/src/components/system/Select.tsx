import { Fragment, useId } from "react";
import { cn } from "@/lib/utils";
import { CutText } from "./CutText";
import { Icon } from "./Icon";
import { ICONS } from "./icons";
import {
  type ItemAction,
  Menu,
  MenuActionItem,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuMessage,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "./Menu";
import { Shimmer } from "./Shimmer";
import { StateGlyph } from "./StateGlyph";

export interface SelectOption {
  value: string;
  label: string;
  sub?: string;
  /** subTone paints the sub as an error: the clone that failed. */
  subTone?: "error";
  /** blocked puts the blocked glyph before the sub. */
  blocked?: boolean;
  unavailable?: boolean;
  /** disabled is an option that can't be chosen, its reason in sub. */
  disabled?: boolean;
  /** action is what Enter or a click does instead of choosing the option: Clone on a disabled one, Existing issue… on one that isn't. */
  action?: ItemAction;
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
  /** size is the height of the trigger; xs, inside a row, writes the choice in the meta size. */
  size?: "md" | "sm" | "xs";
  /** variant is the look of the trigger: a field, or the trigger in the tone of the sidebar. */
  variant?: "field" | "sidebar";
  loading?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

/** choiceName is how a trigger names its choice: the label, and · unavailable when it is no longer offered. */
export function choiceName(choice: { label: string; unavailable?: boolean }): string {
  return choice.unavailable ? `${choice.label} · unavailable` : choice.label;
}

/**
 * SELECT_TRIGGER is the look of a field that opens a list, shared with Listbox. Disabled rides on
 * aria-disabled, whose variant outweighs the plain classes; focused, it keeps the focus border and halo.
 */
export const SELECT_TRIGGER =
  "flex h-(--size-control) w-full items-center justify-between gap-(--space-2) rounded-sm border border-line-3 bg-surface-input px-(--space-2-5) text-(length:--text-ui) leading-(--leading-ui) text-ink-1 transition-[border-color,box-shadow] duration-(--duration-fast) ease-standard hover:border-ink-3 aria-expanded:border-focus focus-visible:field-focus aria-disabled:dashed-disabled aria-disabled:focus-visible:field-focus";

/**
 * SIDEBAR_TRIGGER is the trigger in the tone of the sidebar: smaller, on the sidebar's own input
 * with its control border, and the choice in the meta size and the second ink.
 */
const SIDEBAR_TRIGGER =
  "h-(--size-control-sm) border-sidebar-control bg-sidebar-input text-(length:--text-meta) leading-(--leading-meta) text-ink-2";

/** Select is a field that opens a menu of choices, one of them checked; while they are read, the saved choice shimmers. */
export function Select({
  label,
  value,
  options,
  groups,
  onValueChange,
  placeholder = "",
  message,
  size = "md",
  variant = "field",
  loading,
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
      aria-label={`${label}: ${chosen !== undefined ? choiceName(chosen) : placeholder}`}
      {...(disabled ? { "aria-disabled": true } : {})}
      {...(withReason ? { "aria-describedby": reasonId } : {})}
      {...(loading ? { "aria-busy": true } : {})}
      className={cn(
        SELECT_TRIGGER,
        size === "sm" && "h-(--size-control-sm)",
        size === "xs" &&
          "h-(--size-control-xs) gap-(--space-1) px-(--space-2) text-(length:--text-meta) leading-(--leading-meta)",
        variant === "sidebar" && SIDEBAR_TRIGGER,
      )}
    >
      <CutText text={chosen !== undefined ? choiceName(chosen) : placeholder}>
        {chosen === undefined ? (
          <span className="text-ink-4">{placeholder}</span>
        ) : (
          <ChosenText choice={chosen} loading={loading === true} />
        )}
      </CutText>
      <Icon icon={ICONS.expanded} size="sm" tone="muted" />
    </MenuTrigger>
  );

  return (
    <Menu {...(disabled ? { open: false } : {})}>
      {withReason ? (
        <span className="inline-flex items-center gap-(--space-2)">
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
          <MenuRadioGroup value={value} onValueChange={(next: string) => onValueChange(next)}>
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
          </MenuRadioGroup>
        )}
      </MenuContent>
    </Menu>
  );
}

/** ChosenText is the choice written on a trigger: the blocked glyph and · unavailable when it is no longer offered, shimmering while the choices are read. */
export function ChosenText({
  choice,
  loading,
}: {
  choice: { label: string; unavailable?: boolean };
  loading: boolean;
}) {
  const name = choiceName(choice);
  return (
    <>
      {choice.unavailable === true && (
        <StateGlyph state="blocked" className="mr-(--space-1-5) align-middle" />
      )}
      {loading ? <Shimmer>{name}</Shimmer> : name}
    </>
  );
}

/** SelectItem is a choice of the menu of a Select: one with an action runs it instead of being chosen. */
function SelectItem({ option }: { option: SelectOption }) {
  const sub = {
    ...(option.sub !== undefined ? { sub: option.sub } : {}),
    ...(option.subTone !== undefined ? { subTone: option.subTone } : {}),
    ...(option.blocked ? { subBlocked: true } : {}),
  };
  if (option.action !== undefined) {
    return (
      <MenuActionItem
        label={option.label}
        action={option.action}
        {...(option.disabled ? { disabled: true } : {})}
        {...sub}
      />
    );
  }
  return (
    <MenuRadioItem
      value={option.value}
      {...(option.unavailable ? { unavailable: true } : {})}
      {...(option.disabled ? { disabled: true } : {})}
      {...sub}
    >
      {option.label}
    </MenuRadioItem>
  );
}
