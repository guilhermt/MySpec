import { type ReactElement, useRef } from "react";
import { cn } from "@/lib/utils";
import { CheckboxSign } from "./Checkbox";
import { useFits } from "./fits";
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

/** PullRequestRowState is what the state column of a pull request row says. */
export type PullRequestRowState =
  | { kind: "text"; text: string; tone: "ink-2" | "ink-3"; tooltip: string | null }
  | {
      kind: "review";
      glyph: GlyphState;
      long: string;
      short: string;
      strong: boolean;
      tooltip: string;
    }
  | { kind: "task"; text: string; tooltip: string }
  | { kind: "cloning"; text: string }
  | { kind: "clone-failed" };

/** PullRequestRowView is everything a pull request row draws and says; the caller builds it from the row. */
export interface PullRequestRowView {
  key: string;
  reference: string;
  referenceTooltip: string;
  title: string;
  tags: { text: string; tooltip: string | null }[];
  author: string;
  state: PullRequestRowState;
  /** keys is what R does on the row: "review", "open", "open task"; null where R does nothing. */
  keys: "review" | "open" | "open task" | null;
  /** dashed is a row from a fork: drawn disabled, still on the path, still opening the panel. */
  dashed: boolean;
  label: string;
}

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

// The classes of the narrow form (@max-[1041px]/list:, which Tailwind reads as a container under
// 1041px, so a list of 1040px or less) are written whole, since Tailwind reads the
// source as text: in the container the scroll area names "list", the meta goes to a second line
// under the title.
const META = "text-(length:--text-meta) leading-(--leading-meta)";

/** ROW is the root of a row of a list: a line of --size-control, ringed on keyboard focus. */
const ROW =
  "group/row relative grid min-h-(--size-control) cursor-pointer items-center gap-x-(--space-2) rounded-sm px-(--space-2) text-(length:--text-ui) leading-(--leading-ui) text-ink-1 outline-none transition-[background-color,box-shadow] duration-(--duration-fast) ease-standard focus-visible:focus-ring";

/** ROW_OPEN is the row of the panel, on the brand plane with its ring. */
const ROW_OPEN = "bg-brand-tint-plane shadow-[inset_0_0_0_var(--border)_var(--brand-ring)]";

/** ROW_REST is a row that is not open: it steps up on hover and press. */
const ROW_REST = "hover:bg-veil-hover active:bg-veil-press";

/** ROW_DASHED is the dashed outline of a row drawn disabled. */
const ROW_DASHED =
  "outline-(length:--border) outline-dashed outline-line-3 -outline-offset-(length:--border)";

/** KEYS is the column of the keys, shown only with the keyboard focus on the row. */
const KEYS =
  "row-start-1 invisible inline-flex items-center justify-end gap-(--space-2) whitespace-nowrap text-(length:--text-micro) leading-(--leading-micro) text-ink-3 group-focus-visible/row:visible";

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
    "col-start-6 row-start-1 inline-flex min-w-0 items-center gap-(--space-1-5) whitespace-nowrap @max-[1041px]/list:col-auto @max-[1041px]/list:row-auto @max-[1041px]/list:flex-[0_1_auto]",
    META,
    model.dependency !== null &&
      "@max-[1041px]/list:max-w-[calc(100%-var(--col-dep)-var(--space-4))]",
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
    <span aria-hidden="true" className={cn("col-start-7 @max-[1041px]/list:col-start-4", KEYS)}>
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
        ROW,
        "grid-cols-[var(--icon)_var(--col-num)_minmax(0,1fr)_var(--col-epic)_var(--col-dep)_var(--col-task)_var(--col-keys)]",
        "@max-[1041px]/list:grid-cols-[var(--icon)_var(--col-num)_minmax(0,1fr)_var(--col-keys)]",
        has2 && "@max-[1041px]/list:gap-y-(--space-0-5) @max-[1041px]/list:py-(--space-1-5)",
        open ? ROW_OPEN : ROW_REST,
        disabled && cn("cursor-not-allowed", ROW_DASHED),
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
        <span className="contents @max-[1041px]/list:col-[3/-1] @max-[1041px]/list:row-start-2 @max-[1041px]/list:flex @max-[1041px]/list:h-(--leading-meta) @max-[1041px]/list:flex-row-reverse @max-[1041px]/list:flex-wrap @max-[1041px]/list:justify-end @max-[1041px]/list:gap-x-(--space-4) @max-[1041px]/list:overflow-hidden">
          <TaskCell model={model} />
          {model.dependency !== null && (
            <Tooltip content={model.dependency.tooltip}>
              <span
                className={cn(
                  "col-start-5 row-start-1 inline-flex min-w-0 items-center gap-(--space-1-5) whitespace-nowrap text-ink-3",
                  META,
                  "@max-[1041px]/list:col-auto @max-[1041px]/list:row-auto @max-[1041px]/list:flex-none",
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
                "@max-[1041px]/list:col-auto @max-[1041px]/list:row-auto @max-[1041px]/list:min-w-(--space-12) @max-[1041px]/list:max-w-max @max-[1041px]/list:flex-[1_1_var(--space-12)]",
              )}
            />
          )}
        </span>
      )}
      <KeysCell model={model} selection={selection} />
    </div>
  );
}

export interface PullRequestRowProps {
  model: PullRequestRowView;
  /** open is the pull request of the panel. */
  open: boolean;
  /** tabStop is the row the list's one tab stop sits on. */
  tabStop: boolean;
  /** flash is a pull request a new reading brought: it blinks twice. */
  flash: boolean;
  onActivate: () => void;
  onFocus: () => void;
}

/**
 * ReviewText is the review in the state column: the long form while it fits the column, else the
 * short one, cut with the tooltip after that. The measure is an invisible, nowrap copy of the long form.
 */
function ReviewText({
  state,
}: {
  state: Extract<PullRequestRowState, { kind: "review" }>;
}): ReactElement {
  const box = useRef<HTMLSpanElement>(null);
  const measure = useRef<HTMLSpanElement>(null);
  const fits = useFits(box, measure, state.long);
  return (
    <span ref={box} className="relative flex min-w-0 flex-1">
      <span
        ref={measure}
        aria-hidden="true"
        className="invisible absolute top-0 left-0 whitespace-nowrap"
      >
        {state.long}
      </span>
      <Cell
        text={fits ? state.long : state.short}
        tooltip={state.tooltip}
        className={state.strong ? "font-medium text-ink-1" : "text-ink-2"}
      />
    </span>
  );
}

function StateCell({ state }: { state: PullRequestRowState }): ReactElement {
  const wrap = cn(
    "col-start-4 row-start-1 inline-flex min-w-0 items-center gap-(--space-1-5) whitespace-nowrap @max-[1041px]/list:col-auto @max-[1041px]/list:row-auto @max-[1041px]/list:flex-[1_1_0]",
    META,
  );
  switch (state.kind) {
    case "text":
      return (
        <span className={cn(wrap, state.tone === "ink-2" ? "text-ink-2" : "text-ink-3")}>
          {state.tooltip === null ? (
            <span className="min-w-0 truncate">{state.text}</span>
          ) : (
            <Cell text={state.text} tooltip={state.tooltip} />
          )}
        </span>
      );
    case "review":
      return (
        <span className={wrap}>
          <StateGlyph state={state.glyph} size="sm" />
          <ReviewText state={state} />
        </span>
      );
    case "task":
      return (
        <span className={cn(wrap, "text-ink-2")}>
          <Icon icon={ICONS.task} size="sm" />
          <Cell text={state.text} tooltip={state.tooltip} />
        </span>
      );
    case "cloning":
      return (
        <span className={cn(wrap, "text-ink-3")}>
          <Spinner />
          <span className="min-w-0 truncate">{state.text}</span>
        </span>
      );
    case "clone-failed":
      return <span className={cn(wrap, "text-state-error")}>Clone failed</span>;
  }
}

/**
 * PullRequestRow is the row of a pull request in the list of reviews: a treeitem of level 2 on a
 * fixed grid of columns, with the author and the state under the title on a narrow list.
 */
export function PullRequestRow({
  model,
  open,
  tabStop,
  flash,
  onActivate,
  onFocus,
}: PullRequestRowProps): ReactElement {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the list owns the keyboard of its rows
    <div
      role="treeitem"
      aria-level={2}
      aria-label={model.label}
      aria-selected={open}
      tabIndex={tabStop ? 0 : -1}
      data-row-key={model.key}
      onClick={onActivate}
      onFocus={onFocus}
      className={cn(
        ROW,
        "grid-cols-[var(--col-ref)_minmax(0,1fr)_var(--col-author)_var(--col-state)_var(--col-keys)]",
        "@max-[1041px]/list:grid-cols-[var(--col-ref)_minmax(0,1fr)_var(--col-keys)] @max-[1041px]/list:gap-y-(--space-0-5) @max-[1041px]/list:py-(--space-1-5)",
        open ? ROW_OPEN : ROW_REST,
        model.dashed && ROW_DASHED,
        model.state.kind === "clone-failed" && "error-rail-bar",
        flash && "row-flash",
      )}
    >
      <Cell
        text={model.reference}
        tooltip={model.referenceTooltip}
        className={cn(
          "col-start-1 row-start-1 tabular-nums",
          META,
          open ? "text-ink-3" : "text-ink-4",
        )}
      />
      <span className="col-start-2 row-start-1 flex min-w-0 items-center gap-(--space-2) overflow-hidden">
        <Cell
          text={model.title}
          tooltip={model.title}
          className={cn("min-w-[calc(100%/3)]", model.dashed ? "text-ink-4" : "text-ink-1")}
        />
        {model.tags.map((tag) => {
          const drawn = (
            <span
              key={tag.text}
              className="inline-flex shrink-0 items-center rounded-xs border border-line-2 px-(--space-1) text-(length:--text-micro) leading-(--leading-micro) whitespace-nowrap text-ink-3"
            >
              {tag.text}
            </span>
          );
          return tag.tooltip === null ? (
            drawn
          ) : (
            <Tooltip key={tag.text} content={tag.tooltip}>
              {drawn}
            </Tooltip>
          );
        })}
      </span>
      <span className="contents @max-[1041px]/list:col-[2/-1] @max-[1041px]/list:row-start-2 @max-[1041px]/list:flex @max-[1041px]/list:h-(--leading-meta) @max-[1041px]/list:flex-nowrap @max-[1041px]/list:gap-x-(--space-4) @max-[1041px]/list:overflow-hidden">
        <Cell
          text={model.author}
          tooltip={model.author}
          className={cn(
            "col-start-3 row-start-1 text-ink-3",
            META,
            "@max-[1041px]/list:col-auto @max-[1041px]/list:row-auto @max-[1041px]/list:flex-[0_1_auto]",
          )}
        />
        <StateCell state={model.state} />
      </span>
      <span aria-hidden="true" className={cn("col-start-5 @max-[1041px]/list:col-start-3", KEYS)}>
        {model.keys !== null && (
          <span className="inline-flex items-center gap-(--space-1)">
            <Kbd size="sm">R</Kbd>
            {model.keys}
          </span>
        )}
      </span>
    </div>
  );
}
