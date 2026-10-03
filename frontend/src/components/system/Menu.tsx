import { Menu as BaseMenu } from "@base-ui/react/menu";
import { type ComponentProps, type ReactNode, useId } from "react";
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
  /** disabledReason disables the item and says why on the same line, after the label. */
  disabledReason?: string;
  /** reason says on a line of its own under the label why the item is off, and describes it; the caller disables it. */
  reason?: string;
}

/**
 * MenuItem is a menu row: icon, label, sub, key, destructive or disabled with the reason. A
 * destructive item that is disabled is not drawn in the error ink: what can't be done is not a
 * danger.
 */
export function MenuItem({
  icon,
  shortcut,
  sub,
  destructive,
  disabledReason,
  reason,
  children,
  ...props
}: MenuItemProps) {
  const reasonId = useId();
  const disabled = disabledReason !== undefined || props.disabled === true;
  const danger = destructive === true && !disabled;
  return (
    <DropdownMenuItem
      {...props}
      {...(disabledReason !== undefined ? { disabled: true } : {})}
      {...(reason !== undefined ? { "aria-describedby": reasonId } : {})}
      variant={danger ? "destructive" : "default"}
      className={cn(
        MENU_ITEM,
        reason !== undefined && "h-auto py-1",
        danger &&
          "text-state-error data-[variant=destructive]:text-state-error data-[variant=destructive]:focus:bg-state-error-veil dark:data-[variant=destructive]:focus:bg-state-error-veil data-[variant=destructive]:focus:text-state-error data-[variant=destructive]:*:[svg]:text-state-error",
      )}
    >
      {icon !== undefined && <Icon icon={icon} size="md" tone="muted" />}
      <span className="flex flex-col">
        <span>
          {children}
          {disabledReason !== undefined && ` · ${disabledReason}`}
        </span>
        {reason !== undefined && (
          <span
            id={reasonId}
            className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3"
          >
            {reason}
          </span>
        )}
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
  /** trailing is the small mark at the end of the item: "factory". */
  trailing?: string;
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
  trailing,
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
      {trailing !== undefined && " "}
      {trailing !== undefined && (
        <span className="ml-auto pl-(--space-3) text-(length:--text-micro) leading-(--leading-micro) text-ink-3">
          {trailing}
        </span>
      )}
    </BaseMenu.RadioItem>
  );
}

/** ItemAction is what Enter or a click does on an item instead of choosing it: Clone, Existing issue…. */
export interface ItemAction {
  label: string;
  onAction: () => void;
  /** closes leaves the menu with the action, for one that opens something next to it: Existing issue…. Absent, the menu stays to show the action's progress. */
  closes?: boolean;
}

/** actionItemLabel is the accessible name of an item with an action: "acme/billing, not cloned. Enter clones it." */
export function actionItemLabel(
  label: string,
  sub: string | undefined,
  action: ItemAction,
): string {
  // The sub is a phrase that may end in its own period; the label adds the one that follows.
  const reason = sub === undefined ? "" : `, ${sub.toLowerCase().replace(/\.$/, "")}`;
  return `${label}${reason}. Enter ${action.label.toLowerCase()}s it.`;
}

export interface MenuActionItemProps {
  label: string;
  sub?: string;
  subTone?: "error";
  action: ItemAction;
  /** disabled is a choice that can't be made, offering the action in its place: Clone. Absent, the item is the action itself: Existing issue…. */
  disabled?: boolean;
}

/**
 * MenuActionItem is an item that runs an action instead of being chosen: the label, the sub, and
 * the action as ghost text on the right. Disabled, it is a choice that can't be made, in the fourth
 * ink with aria-disabled; otherwise it is in the ink of any item. It stays on the path of the arrows
 * and keeps the menu open, so the action shows its own progress, unless the action closes it.
 */
export function MenuActionItem({ label, sub, subTone, action, disabled }: MenuActionItemProps) {
  return (
    <BaseMenu.Item
      closeOnClick={action.closes === true}
      {...(disabled ? { "aria-disabled": true } : {})}
      aria-label={actionItemLabel(label, sub, action)}
      onClick={() => action.onAction()}
      className={cn(
        "relative flex cursor-default items-center outline-hidden select-none",
        MENU_ITEM,
        disabled && "text-ink-4 focus:text-ink-4",
      )}
    >
      <span>{label}</span>
      {sub !== undefined && <MenuSub tone={subTone}>{sub}</MenuSub>}
      <span
        aria-hidden="true"
        className="ml-auto text-(length:--text-micro) leading-(--leading-micro) text-ink-3"
      >
        {action.label}
      </span>
    </BaseMenu.Item>
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
  /** micro writes the line small, as the foot of a menu does. */
  micro?: boolean;
}

/**
 * MenuText is a line of text among the items that is not an item: a level of the folded breadcrumb
 * that is not a place, like an epic. It has the height of an item and the third ink, and takes
 * neither the highlight nor the keyboard.
 */
export function MenuText({ children, micro = false }: MenuTextProps) {
  return (
    <div
      className={cn(
        "flex min-h-(--size-control) items-center px-2 text-ink-3",
        micro
          ? "text-(length:--text-micro) leading-(--leading-micro)"
          : "text-(length:--text-ui) leading-(--leading-ui)",
      )}
    >
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
