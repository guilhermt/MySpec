import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import { CheckboxSign } from "./Checkbox";
import { Icon } from "./Icon";
import { ICONS } from "./icons";
import { Kbd } from "./Kbd";
import { Spinner } from "./Spinner";
import { type GlyphState, StateGlyph } from "./StateGlyph";
import { Tooltip } from "./Tooltip";

/** RowSelection is the state of a card in the select mode. */
export type RowSelection = "selected" | "not selected" | "can't be selected";

/** CardRowTask is what the task column of a row says. */
export type CardRowTask =
  | {
      kind: "task";
      glyph: GlyphState;
      text: string;
      strong: boolean;
      more: number | null;
      tooltip: string;
    }
  | { kind: "discussion"; tooltip: string }
  | { kind: "cloning"; text: string }
  | { kind: "clone-failed" };

/** CardRowView is everything a row draws and says; the caller builds it from the card. */
export interface CardRowView {
  key: string;
  /** number is the reference of the card: #474. */
  number: string;
  title: string;
  isEpic: boolean;
  /** dimmed is an issue closed in a non-final section. */
  dimmed: boolean;
  epic: { text: string; tooltip: string } | null;
  dependency: { text: string; tooltip: string[] } | null;
  task: CardRowTask | null;
  /** canStart and canDiscuss are what the keys column says the keys do. */
  canStart: boolean;
  canDiscuss: boolean;
  /** label is the whole accessible name, with the selection state in the select mode. */
  label: string;
}

export interface CardRowProps {
  model: CardRowView;
  /** open is the card of the panel. */
  open: boolean;
  /** selection is the state in the select mode; null outside it. */
  selection: RowSelection | null;
  /** tabStop is the row the list's one tab stop sits on. */
  tabStop: boolean;
  /** flash is a card a new reading brought: it blinks twice. */
  flash: boolean;
  onActivate: () => void;
  onFocus: () => void;
}

// The classes of the narrow form (@max-[1040px]/list:) are written whole, since Tailwind reads the
// source as text: in the container the scroll area names "list", the meta goes to a second line
// under the title.
const META = "text-(length:--text-meta) leading-(--leading-meta)";

/** Cell is a truncated text of the row with its whole text in the tooltip. */
function Cell({
  text,
  tooltip,
  className,
}: {
  text: string;
  tooltip: string | readonly string[];
  className?: string;
}): ReactElement {
  return (
    <Tooltip content={tooltip}>
      <span className={cn("min-w-0 truncate", className)}>{text}</span>
    </Tooltip>
  );
}

function TaskCell({ model }: { model: CardRowView }): ReactElement | null {
  const { task } = model;
  if (task === null) return null;
  const wrap = cn(
    "col-start-6 row-start-1 inline-flex min-w-0 items-center gap-(--space-1-5) whitespace-nowrap @max-[1040px]/list:col-auto @max-[1040px]/list:row-auto @max-[1040px]/list:flex-[0_1_auto]",
    META,
    model.dependency !== null &&
      "@max-[1040px]/list:max-w-[calc(100%-var(--col-dep)-var(--space-4))]",
  );
  switch (task.kind) {
    case "task":
      return (
        <span className={wrap}>
          <StateGlyph state={task.glyph} size="sm" />
          <Cell
            text={task.text}
            tooltip={task.tooltip}
            className={task.strong ? "font-medium text-ink-1" : "text-ink-2"}
          />
          {task.more !== null && <span className="shrink-0 text-ink-3">{`+${task.more}`}</span>}
        </span>
      );
    case "discussion":
      return (
        <span className={cn(wrap, "text-ink-3")}>
          <Icon icon={ICONS.discussion} size="sm" />
          <Cell text="In discussion" tooltip={task.tooltip} />
        </span>
      );
    case "cloning":
      return (
        <span className={cn(wrap, "text-ink-3")}>
          <Spinner />
          <span className="min-w-0 truncate">{task.text}</span>
        </span>
      );
    case "clone-failed":
      return <span className={cn(wrap, "text-state-error")}>Clone failed</span>;
  }
}

function KeysCell({
  model,
  selection,
}: {
  model: CardRowView;
  selection: RowSelection | null;
}): ReactElement {
  const keys: [string, string][] =
    selection !== null
      ? selection === "can't be selected"
        ? []
        : [["Space", selection === "selected" ? "unselect" : "select"]]
      : [
          ...(model.canStart ? [["S", "start"] as [string, string]] : []),
          ...(model.canDiscuss ? [["D", "discuss"] as [string, string]] : []),
        ];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "col-start-7 row-start-1 invisible inline-flex items-center justify-end gap-(--space-2) whitespace-nowrap text-(length:--text-micro) leading-(--leading-micro) text-ink-3 group-focus-visible/row:visible @max-[1040px]/list:col-start-4",
      )}
    >
      {keys.map(([key, name]) => (
        <span key={key} className="inline-flex items-center gap-(--space-1)">
          <Kbd size="sm">{key}</Kbd>
          {name}
        </span>
      ))}
    </span>
  );
}

/** CardRow is the row of a card in the list of a board: a treeitem of level 2 on a fixed grid of columns. */
export function CardRow({
  model,
  open,
  selection,
  tabStop,
  flash,
  onActivate,
  onFocus,
}: CardRowProps): ReactElement {
  const has2 = model.epic !== null || model.dependency !== null || model.task !== null;
  const disabled = selection === "can't be selected";
  const selectionAria =
    selection === null
      ? { "aria-selected": open }
      : disabled
        ? { "aria-disabled": true as const }
        : { "aria-checked": selection === "selected" };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the list owns the keyboard of its rows
    <div
      role="treeitem"
      aria-level={2}
      aria-label={model.label}
      {...selectionAria}
      tabIndex={tabStop ? 0 : -1}
      data-row-key={model.key}
      onClick={onActivate}
      onFocus={onFocus}
      className={cn(
        "group/row relative grid min-h-(--size-control) cursor-pointer items-center gap-x-(--space-2) rounded-sm px-(--space-2) text-(length:--text-ui) leading-(--leading-ui) text-ink-1 outline-none transition-[background-color,box-shadow] duration-(--duration-fast) ease-standard focus-visible:focus-ring",
        "grid-cols-[var(--icon)_var(--col-num)_minmax(0,1fr)_var(--col-epic)_var(--col-dep)_var(--col-task)_var(--col-keys)]",
        "@max-[1040px]/list:grid-cols-[var(--icon)_var(--col-num)_minmax(0,1fr)_var(--col-keys)]",
        has2 && "@max-[1040px]/list:gap-y-(--space-0-5) @max-[1040px]/list:py-(--space-1-5)",
        open
          ? "bg-brand-tint-plane shadow-[inset_0_0_0_var(--border)_var(--brand-ring)]"
          : "hover:bg-veil-hover active:bg-veil-press",
        disabled &&
          "cursor-not-allowed outline-(length:--border) outline-dashed outline-line-3 -outline-offset-(length:--border)",
        model.task?.kind === "clone-failed" && "error-rail-bar",
        flash && "row-flash",
      )}
    >
      <span
        className={cn(
          "col-start-1 row-start-1 grid size-(--icon) place-items-center text-ink-4",
          open && "text-brand-ink",
        )}
      >
        {selection !== null ? (
          <CheckboxSign checked={selection === "selected"} disabled={disabled} />
        ) : (
          model.isEpic && <Icon icon={ICONS.epic} size="sm" />
        )}
      </span>
      <span
        className={cn(
          "col-start-2 row-start-1 whitespace-nowrap tabular-nums",
          META,
          open ? "text-ink-3" : "text-ink-4",
        )}
      >
        {model.number}
      </span>
      <Cell
        text={model.title}
        tooltip={model.title}
        className={cn(
          "col-start-3 row-start-1",
          model.isEpic && "font-medium",
          disabled || (model.dimmed && !open)
            ? "text-ink-4"
            : model.dimmed
              ? "text-ink-3"
              : "text-ink-1",
        )}
      />
      {has2 && (
        <span className="contents @max-[1040px]/list:col-start-3 @max-[1040px]/list:row-start-2 @max-[1040px]/list:flex @max-[1040px]/list:h-(--leading-meta) @max-[1040px]/list:flex-row-reverse @max-[1040px]/list:flex-wrap @max-[1040px]/list:justify-end @max-[1040px]/list:gap-x-(--space-4) @max-[1040px]/list:overflow-hidden">
          <TaskCell model={model} />
          {model.dependency !== null && (
            <Tooltip content={model.dependency.tooltip}>
              <span
                className={cn(
                  "col-start-5 row-start-1 inline-flex min-w-0 items-center gap-(--space-1-5) whitespace-nowrap text-ink-3",
                  META,
                  "@max-[1040px]/list:col-auto @max-[1040px]/list:row-auto @max-[1040px]/list:flex-none",
                )}
              >
                <StateGlyph state="blocked" size="sm" />
                {model.dependency.text}
              </span>
            </Tooltip>
          )}
          {model.epic !== null && (
            <Cell
              text={model.epic.text}
              tooltip={model.epic.tooltip}
              className={cn(
                "col-start-4 row-start-1 text-ink-3",
                META,
                "@max-[1040px]/list:col-auto @max-[1040px]/list:row-auto @max-[1040px]/list:min-w-(--space-12) @max-[1040px]/list:max-w-max @max-[1040px]/list:flex-[1_1_var(--space-12)]",
              )}
            />
          )}
        </span>
      )}
      <KeysCell model={model} selection={selection} />
    </div>
  );
}
