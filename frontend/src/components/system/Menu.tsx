import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ComponentProps, ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { ICONS, type IconGlyph } from "./icons";

/** Menu is the root of a system menu. */
export const Menu = DropdownMenu;

/** MenuTrigger opens the menu; render it as a Button, a Chip or an IconButton. */
export function MenuTrigger(props: ComponentProps<typeof DropdownMenuTrigger>) {
  return <DropdownMenuTrigger {...props} />;
}

export interface MenuContentProps extends ComponentProps<typeof DropdownMenuContent> {}

/**
 * MenuContent is the floating surface of the menu. The shadow is written shadow-(--shadow-float),
 * the form cn reads as a shadow, so it replaces the shadow-md of the primitive instead of joining it.
 * The menu is as wide as its longest item, from --size-menu-min up to the room the window leaves, so
 * no item breaks its line, and never narrower than its trigger, as the menu of a Select; w-max
 * replaces the width of the trigger the primitive gives.
 */
export function MenuContent({ className, ...props }: MenuContentProps) {
  return (
    <DropdownMenuContent
      {...props}
      className={cn(
        "flex w-max max-w-(--available-width) min-w-[max(var(--size-menu-min),var(--anchor-width))] flex-col gap-0.5 rounded-lg bg-surface-3 p-1 text-(length:--text-ui) leading-(--leading-ui) text-ink-1 shadow-(--shadow-float) ring-0 duration-(--duration-base)",
        className,
      )}
    />
  );
}

export interface MenuGroupLabelProps {
  children: ReactNode;
  note?: string;
}

/**
 * MenuGroupLabel is the caps heading of a group, with an optional note on the same line. It sits in
 * a MenuGroup, which it names.
 */
export function MenuGroupLabel({ children, note }: MenuGroupLabelProps) {
  return (
    <DropdownMenuLabel className="px-2 pt-1 pb-0.5 text-(length:--text-caps) leading-(--leading-caps) font-bold tracking-(--tracking-caps) uppercase text-ink-3">
      {children}
      {note !== undefined && (
        <span className="normal-case font-normal tracking-normal text-ink-4"> {note}</span>
      )}
    </DropdownMenuLabel>
  );
}

/** MENU_ITEM holds the look of a menu row, shared with the items of Select and Listbox. */
export const MENU_ITEM =
  "min-h-(--size-control) gap-2 rounded-sm px-2 py-0 text-(length:--text-ui) leading-(--leading-ui) text-ink-1 focus:bg-veil-hover focus:text-ink-1 not-data-[variant=destructive]:focus:**:text-ink-1 active:bg-veil-press data-disabled:opacity-100 data-disabled:text-ink-4";

export interface MenuItemProps
  extends Omit<ComponentProps<typeof DropdownMenuItem>, "variant" | "className"> {
  icon?: IconGlyph;
  shortcut?: string;
  sub?: string;
  destructive?: boolean;
  disabledReason?: string;
}

/** MenuItem is a menu row: icon, label, sub, key, destructive or disabled with the reason. */
export function MenuItem({
  icon,
  shortcut,
  sub,
  destructive,
  disabledReason,
  children,
  ...props
}: MenuItemProps) {
  return (
    <DropdownMenuItem
      {...props}
      {...(disabledReason !== undefined ? { disabled: true } : {})}
      variant={destructive ? "destructive" : "default"}
      className={cn(
        MENU_ITEM,
        destructive &&
          "text-state-error data-[variant=destructive]:text-state-error data-[variant=destructive]:focus:bg-state-error-veil dark:data-[variant=destructive]:focus:bg-state-error-veil data-[variant=destructive]:focus:text-state-error data-[variant=destructive]:*:[svg]:text-state-error",
      )}
    >
      {icon !== undefined && <Icon icon={icon} size="md" tone="muted" />}
      <span>
        {children}
        {disabledReason !== undefined && ` · ${disabledReason}`}
      </span>
      {sub !== undefined && " "}
      {sub !== undefined && (
        <span className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">{sub}</span>
      )}
      {shortcut !== undefined && " "}
      {shortcut !== undefined && (
        <kbd className="ml-auto font-mono text-(length:--text-micro) leading-(--leading-micro) text-ink-3">
          {shortcut}
        </kbd>
      )}
    </DropdownMenuItem>
  );
}

/** UNAVAILABLE marks a choice that is no longer offered. */
export const UNAVAILABLE = "◇";

/** MenuRadioGroup holds the choices of a menu, one of them checked. */
export function MenuRadioGroup(props: ComponentProps<typeof DropdownMenuRadioGroup>) {
  return <DropdownMenuRadioGroup {...props} />;
}

export interface MenuRadioItemProps {
  value: string;
  children: ReactNode;
  icon?: IconGlyph;
  sub?: string;
  /** subTone paints the sub as an error: the clone that failed. */
  subTone?: "error";
  /** unavailable is a choice that is no longer offered: kept, marked with ◇, and not chosen again. */
  unavailable?: boolean;
  /** disabled is a choice that can't be made, its reason in sub. */
  disabled?: boolean;
}

/** MenuSub is the small text after the label of an item: its sub, or the reason a choice is off. */
function MenuSub({ children, tone }: { children: ReactNode; tone?: "error" | undefined }) {
  return (
    <span
      className={cn(
        "text-(length:--text-meta) leading-(--leading-meta) text-ink-3",
        tone === "error" && "text-state-error",
      )}
    >
      {children}
    </span>
  );
}

/**
 * MenuRadioItem is a choice of a MenuRadioGroup, with its check at the start in the brand ink. It is
 * built on the Base UI item, since the radio item of the ui puts the check at the end.
 */
export function MenuRadioItem({
  value,
  children,
  icon,
  sub,
  subTone,
  unavailable,
  disabled,
}: MenuRadioItemProps) {
  return (
    <BaseMenu.RadioItem
      value={value}
      {...(unavailable || disabled ? { disabled: true } : {})}
      className={cn(
        "relative flex cursor-default items-center outline-hidden select-none",
        MENU_ITEM,
      )}
    >
      <BaseMenu.RadioItemIndicator
        keepMounted
        className="size-(--icon) text-brand-ink data-unchecked:invisible"
      >
        <Icon icon={ICONS.done} />
      </BaseMenu.RadioItemIndicator>
      {icon !== undefined && <Icon icon={icon} size="md" tone="muted" />}
      <span>
        {unavailable && `${UNAVAILABLE} `}
        {children}
        {unavailable && " · unavailable"}
      </span>
      {sub !== undefined && " "}
      {sub !== undefined && <MenuSub tone={subTone}>{sub}</MenuSub>}
    </BaseMenu.RadioItem>
  );
}

/** ItemAction is what Enter or a click does on a disabled item instead of choosing it: Clone. */
export interface ItemAction {
  label: string;
  onAction: () => void;
}

/** actionItemLabel is the accessible name of a disabled item with an action: "acme/billing, not cloned. Enter clones it." */
export function actionItemLabel(
  label: string,
  sub: string | undefined,
  action: ItemAction,
): string {
  const reason = sub === undefined ? "" : `, ${sub.toLowerCase()}`;
  return `${label}${reason}. Enter ${action.label.toLowerCase()}s it.`;
}

export interface MenuActionItemProps {
  label: string;
  sub?: string;
  subTone?: "error";
  action: ItemAction;
}

/**
 * MenuActionItem is a choice that can't be made and offers an action in its place: the label in the
 * fourth ink, the reason, and the action as ghost text on the right. It stays on the path of the
 * arrows, is not chosen, and keeps the menu open, so the action shows its own progress.
 */
export function MenuActionItem({ label, sub, subTone, action }: MenuActionItemProps) {
  return (
    <DropdownMenuItem
      closeOnClick={false}
      aria-disabled="true"
      aria-label={actionItemLabel(label, sub, action)}
      onClick={() => action.onAction()}
      className={cn(MENU_ITEM, "text-ink-4 focus:text-ink-4")}
    >
      <span>{label}</span>
      {sub !== undefined && <MenuSub tone={subTone}>{sub}</MenuSub>}
      <span
        aria-hidden="true"
        className="ml-auto text-(length:--text-micro) leading-(--leading-micro) text-ink-3"
      >
        {action.label}
      </span>
    </DropdownMenuItem>
  );
}

export interface MenuCheckboxItemProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
}

/**
 * MenuCheckboxItem is a choice that is on or off, with its check at the start in the brand ink like
 * MenuRadioItem. A click closes the menu, so a filter chosen from it takes effect at once.
 */
export function MenuCheckboxItem({ checked, onCheckedChange, children }: MenuCheckboxItemProps) {
  return (
    <BaseMenu.CheckboxItem
      checked={checked}
      onCheckedChange={onCheckedChange}
      closeOnClick
      className={cn(
        "relative flex cursor-default items-center outline-hidden select-none",
        MENU_ITEM,
      )}
    >
      <BaseMenu.CheckboxItemIndicator
        keepMounted
        className="size-(--icon) text-brand-ink data-unchecked:invisible"
      >
        <Icon icon={ICONS.done} />
      </BaseMenu.CheckboxItemIndicator>
      <span>{children}</span>
    </BaseMenu.CheckboxItem>
  );
}

/** FilterCycle is the state of a three-way filter: no filter, hidden, or only this. */
export type FilterCycle = "any" | "hidden" | "only";

export interface MenuCycleItemProps {
  label: string;
  state: FilterCycle;
  onStateChange: (next: FilterCycle) => void;
}

const NEXT: Record<FilterCycle, FilterCycle> = { any: "hidden", hidden: "only", only: "any" };
const PREFIX: Record<FilterCycle, string> = { any: "", hidden: "−", only: "+" };
const SPOKEN: Record<FilterCycle, string> = {
  any: "no filter",
  hidden: "hidden",
  only: "only this",
};

/** MenuCycleItem cycles a filter through any, hidden and only, and keeps the menu open. */
export function MenuCycleItem({ label, state, onStateChange }: MenuCycleItemProps) {
  return (
    <DropdownMenuItem
      closeOnClick={false}
      aria-label={`${label}: ${SPOKEN[state]}. Click to cycle.`}
      onClick={() => onStateChange(NEXT[state])}
      className={MENU_ITEM}
    >
      {`${PREFIX[state]}${label}`}
    </DropdownMenuItem>
  );
}

export interface MenuMessageProps {
  children: ReactNode;
  tone?: "neutral" | "error";
  onRetry?: () => void;
}

/** MenuMessage stands in for the items while the menu loads or when it fails, with Try again. */
export function MenuMessage({ children, tone = "neutral", onRetry }: MenuMessageProps) {
  const error = tone === "error";
  return (
    <div className="flex flex-col items-start gap-1 px-2 py-1.5">
      <div
        role={error ? "alert" : "status"}
        className={cn(
          "max-w-(--size-tooltip-max) text-(length:--text-meta) leading-(--leading-meta) text-ink-3",
          error && "text-state-error",
        )}
      >
        {children}
      </div>
      {onRetry !== undefined && (
        <Button size="xs" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export interface MenuTextProps {
  children: ReactNode;
}

/**
 * MenuText is a line of text among the items that is not an item: a level of the folded breadcrumb
 * that is not a place, like an epic. It has the height of an item and the third ink, and takes
 * neither the highlight nor the keyboard.
 */
export function MenuText({ children }: MenuTextProps) {
  return (
    <div className="flex min-h-(--size-control) items-center px-2 text-(length:--text-ui) leading-(--leading-ui) text-ink-3">
      {children}
    </div>
  );
}

/** MenuSeparator is the line between groups. */
export function MenuSeparator(
  props: Omit<ComponentProps<typeof DropdownMenuSeparator>, "className">,
) {
  return <DropdownMenuSeparator {...props} className="-mx-1 my-1 h-(--border) bg-line-1" />;
}

/** MenuGroup groups items under a MenuGroupLabel. */
export function MenuGroup(props: ComponentProps<typeof DropdownMenuGroup>) {
  return <DropdownMenuGroup {...props} />;
}
