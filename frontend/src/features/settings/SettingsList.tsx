import { type ReactNode, useId } from "react";
import { Icon } from "@/components/system/Icon";
import { ICONS, type IconMeaning } from "@/components/system/icons";

export interface SettingsListProps {
  children: ReactNode;
  /** label names the list for a screen reader when its group or section doesn't. */
  label?: string;
}

/** SettingsList is the outlined list of the rows of a page, a rule between one row and the next. */
export function SettingsList({ children, label }: SettingsListProps) {
  return (
    <ul
      {...(label !== undefined ? { "aria-label": label } : {})}
      className="overflow-hidden rounded-md border border-line-1 [&>li+li]:shadow-[inset_0_var(--border)_0_var(--line-1)]"
    >
      {children}
    </ul>
  );
}

export interface SettingsGroupProps {
  title: string;
  count: number;
  /** note is said after the count: why the group is apart. */
  note?: string;
  children: ReactNode;
}

/** SettingsGroup is a group of rows under its title and its count, like the repositories that need a clone. */
export function SettingsGroup({ title, count, note, children }: SettingsGroupProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-(--space-2)">
      <div className="flex flex-wrap items-baseline gap-x-(--space-2) text-(length:--text-meta) leading-(--leading-meta)">
        <h4 id={titleId} className="font-semibold text-ink-2">
          {title}
        </h4>
        <span className="tabular-nums text-ink-4">{count}</span>
        {note !== undefined && <span className="text-ink-3">{note}</span>}
      </div>
      {children}
    </section>
  );
}

export interface SettingsRowProps {
  icon: IconMeaning;
  /** name is the accessible name of the row. */
  name: string;
  /** lines are the name and the details of the row, already laid out. */
  lines: ReactNode;
  /** trailing is the state and the actions at the right; in a narrow area they go under the text. */
  trailing?: ReactNode;
  /** below is what blocks the row, or the block it opens: a line sunk under the row. */
  below?: ReactNode;
}

/** SettingsRow is a row of a SettingsList: the icon, the lines, the state and actions at the right, and under them what blocks it. */
export function SettingsRow({ icon, name, lines, trailing, below }: SettingsRowProps) {
  return (
    <li aria-label={name} className="flex flex-col gap-(--space-2) px-(--space-3) py-(--space-3)">
      <div className="grid grid-cols-[var(--icon)_minmax(0,1fr)_auto] items-start gap-x-(--space-3) gap-y-(--space-2) @max-[720px]/main:grid-cols-[var(--icon)_minmax(0,1fr)]">
        <Icon icon={ICONS[icon]} tone="muted" className="mt-(--space-0-5)" />
        <div className="flex min-w-0 flex-col">{lines}</div>
        {trailing !== undefined && (
          <div className="flex items-center gap-(--space-2) @max-[720px]/main:col-start-2">
            {trailing}
          </div>
        )}
      </div>
      {below}
    </li>
  );
}
