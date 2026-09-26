import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";

/** Menu is the root of a system menu. */
export const Menu = DropdownMenu;

/** MenuTrigger opens the menu; render it as a Button, a Chip or an IconButton. */
export function MenuTrigger(props: ComponentProps<typeof DropdownMenuTrigger>) {
  return <DropdownMenuTrigger {...props} />;
}

export interface MenuContentProps extends ComponentProps<typeof DropdownMenuContent> {}

/** MenuContent is the floating surface of the menu. */
export function MenuContent({ className, ...props }: MenuContentProps) {
  return (
    <DropdownMenuContent
      {...props}
      className={cn(
        "flex min-w-(--size-menu-min) flex-col gap-0.5 rounded-lg bg-surface-3 p-1 text-(length:--text-ui) leading-(--leading-ui) text-ink-1 shadow-float ring-0 duration-(--duration-base)",
        className,
      )}
    />
  );
}

export interface MenuGroupLabelProps {
  children: ReactNode;
  note?: string;
}

/** MenuGroupLabel is the caps heading of a group, with an optional note on the same line. */
export function MenuGroupLabel({ children, note }: MenuGroupLabelProps) {
  return (
    <div className="px-2 pt-1 pb-0.5 text-(length:--text-caps) leading-(--leading-caps) font-bold tracking-(--tracking-caps) uppercase text-ink-3">
      {children}
      {note !== undefined && (
        <span className="normal-case font-normal tracking-normal text-ink-4"> {note}</span>
      )}
    </div>
  );
}

/** MENU_ITEM holds the look of a menu row, shared with the items of Select and Listbox. */
export const MENU_ITEM =
  "min-h-(--size-control) gap-2 rounded-sm px-2 py-0 text-(length:--text-ui) leading-(--leading-ui) text-ink-1 focus:bg-veil-hover focus:text-ink-1 not-data-[variant=destructive]:focus:**:text-ink-1 active:bg-veil-press data-disabled:opacity-100 data-disabled:text-ink-4";

export interface MenuItemProps
  extends Omit<ComponentProps<typeof DropdownMenuItem>, "variant" | "className"> {
  icon?: LucideIcon;
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
          "text-state-error data-[variant=destructive]:text-state-error data-[variant=destructive]:focus:bg-state-error-veil data-[variant=destructive]:focus:text-state-error data-[variant=destructive]:*:[svg]:text-state-error",
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
}

/** MenuMessage stands in for the items while the menu loads or when it fails. */
export function MenuMessage({ children, tone = "neutral" }: MenuMessageProps) {
  const error = tone === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      className={cn(
        "max-w-(--size-tooltip-max) px-2 py-1.5 text-(length:--text-meta) leading-(--leading-meta) text-ink-3",
        error && "text-state-error",
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
