import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { ICONS, type IconGlyph } from "./icons";
import { Kbd } from "./Kbd";
import { Shimmer } from "./Shimmer";
import { Spinner } from "./Spinner";
import { Tooltip } from "./Tooltip";

const META = "text-(length:--text-meta) leading-(--leading-meta)";

export interface StartRowProps {
  icon: IconGlyph;
  label: string;
  /** sub is what the row says of what it leads to: "4 pending in 3 repositories". */
  sub?: string;
  /** subShimmer makes the sub glow while what it says is being read. */
  subShimmer?: boolean;
  shortcut?: string;
  /** disabledReason makes the row unavailable and takes the place of the sub. */
  disabledReason?: string;
  /** trailing takes the place of the key on the right edge. */
  trailing?: ReactNode;
  /** accessibleName replaces the label as the name of the row, when it says more than the label. */
  accessibleName?: string;
  onClick: () => void;
}

/**
 * StartRow is a row of the Home that starts something: the icon, the label, what it leads to and its
 * key. Unavailable, it is dashed and its reason stands where the sub was.
 */
export function StartRow({
  icon,
  label,
  sub,
  subShimmer,
  shortcut,
  disabledReason,
  trailing,
  accessibleName,
  onClick,
}: StartRowProps) {
  const describedId = useId();
  const disabled = disabledReason !== undefined;
  const described = disabled ? disabledReason : sub;
  return (
    <button
      type="button"
      aria-label={accessibleName ?? label}
      {...(described !== undefined && accessibleName === undefined
        ? { "aria-describedby": describedId }
        : {})}
      {...(disabled ? { "aria-disabled": true } : {})}
      onClick={() => {
        if (!disabled) onClick();
      }}
      className={cn(
        "flex min-h-(--size-control) w-full min-w-0 cursor-pointer items-center gap-(--space-3) rounded-md px-(--space-3) py-(--space-1) text-left text-(length:--text-ui) leading-(--leading-ui) text-ink-1 outline-none transition-[background-color] duration-(--duration-fast) ease-standard hover:bg-veil-hover active:bg-veil-press focus-visible:focus-ring",
        disabled &&
          "cursor-not-allowed outline-(length:--border) outline-dashed outline-line-3 -outline-offset-(length:--border) hover:bg-transparent active:bg-transparent",
      )}
    >
      <Icon icon={icon} tone="muted" />
      <span className="shrink-0 font-medium whitespace-nowrap">{label}</span>
      {described !== undefined && (
        <Tooltip content={described}>
          <span className={cn("min-w-0 flex-1 truncate text-ink-3", META)}>
            <span id={describedId}>{subShimmer ? <Shimmer>{described}</Shimmer> : described}</span>
          </span>
        </Tooltip>
      )}
      {described === undefined && <span className="flex-1" />}
      {trailing}
      {shortcut !== undefined && (
        <span aria-hidden="true" className="ml-auto shrink-0">
          <Kbd>{shortcut}</Kbd>
        </span>
      )}
    </button>
  );
}

/** BlockerView is a line under a board or under the repositories without one: what keeps cards from starting a task. */
export type BlockerView =
  | { kind: "read-failed"; message: string; reading: boolean }
  | { kind: "not-cloned"; repositoryId: string; text: string; cloning: boolean; error: string }
  | { kind: "clone-missing"; repositoryId: string; text: string };

/** BoardLineView is a board of the Boards section. */
export interface BoardLineView {
  title: string;
  summary: string;
  reading: { text: string; tone: "quiet" | "failed"; shimmer: boolean };
  label: string;
  blockers: readonly BlockerView[];
}

/** ChangePathError is the refusal of the path a repository was given. */
export interface ChangePathError {
  repositoryId: string;
  message: string;
}

interface BlockerActions {
  /** onRetryRead reads the board again; a list of repositories without a board has none. */
  onRetryRead?: (() => void) | undefined;
  onClone: (repositoryId: string) => void;
  onChangePath: (repositoryId: string) => void;
  changePathError?: ChangePathError | null | undefined;
}

// Busy is the gerund that takes the place of an action while it runs.
function Busy({ children }: { children: string }) {
  return (
    <span
      role="status"
      className={cn("inline-flex items-center gap-(--space-1-5) text-ink-3", META)}
    >
      <Spinner />
      {children}
    </span>
  );
}

function BlockerLine({
  blocker,
  onRetryRead,
  onClone,
  onChangePath,
  changePathError,
}: BlockerActions & { blocker: BlockerView }) {
  const failed = blocker.kind === "not-cloned" && !blocker.cloning && blocker.error !== "";
  const refusal =
    blocker.kind === "clone-missing" && changePathError?.repositoryId === blocker.repositoryId
      ? changePathError.message
      : null;
  return (
    <div className="flex flex-col">
      <div className={cn("flex min-h-(--size-control-sm) items-center gap-(--space-2)", META)}>
        <span className={cn("min-w-0 flex-1", failed ? "text-state-error" : "text-ink-2")}>
          {blocker.kind === "read-failed" ? blocker.message : blocker.text}
        </span>
        {blocker.kind === "read-failed" &&
          onRetryRead !== undefined &&
          (blocker.reading ? (
            <Busy>Reading…</Busy>
          ) : (
            <Button variant="ghost" size="xs" icon={ICONS.refresh} onClick={onRetryRead}>
              Try again
            </Button>
          ))}
        {blocker.kind === "not-cloned" &&
          (blocker.cloning ? (
            <Busy>Cloning…</Busy>
          ) : (
            <Button variant="ghost" size="xs" onClick={() => onClone(blocker.repositoryId)}>
              {failed ? "Try again" : "Clone"}
            </Button>
          ))}
        {blocker.kind === "clone-missing" && (
          <Button variant="ghost" size="xs" onClick={() => onChangePath(blocker.repositoryId)}>
            Change path…
          </Button>
        )}
      </div>
      {refusal !== null && (
        <p role="alert" className={cn("text-state-error", META)}>
          {refusal}
        </p>
      )}
    </div>
  );
}

// Blockers are the lines under a row, indented to its text: the padding, the icon and the gap.
function Blockers({ blockers, ...actions }: BlockerActions & { blockers: readonly BlockerView[] }) {
  if (blockers.length === 0) return null;
  return (
    <div className="flex flex-col pr-(--space-3) pl-[calc(var(--space-3)+var(--icon)+var(--space-3))]">
      {blockers.map((blocker) => (
        <BlockerLine
          key={`${blocker.kind}:${"repositoryId" in blocker ? blocker.repositoryId : ""}`}
          blocker={blocker}
          {...actions}
        />
      ))}
    </div>
  );
}

export interface BoardStartRowProps extends BlockerActions {
  onRetryRead: () => void;
  line: BoardLineView;
  onOpen: () => void;
}

/**
 * BoardStartRow is a board of the Home: the row that opens it, with the age of its reading on the
 * right, and under it a line for each thing that keeps its cards from starting a task.
 */
export function BoardStartRow({ line, onOpen, ...actions }: BoardStartRowProps) {
  const { reading } = line;
  return (
    <div className="flex flex-col">
      <StartRow
        icon={ICONS.board}
        label={line.title}
        sub={line.summary}
        accessibleName={line.label}
        onClick={onOpen}
        trailing={
          <span
            className={cn(
              "shrink-0 whitespace-nowrap",
              META,
              reading.tone === "failed" ? "text-state-error" : "text-ink-3",
            )}
          >
            {reading.shimmer ? <Shimmer>{reading.text}</Shimmer> : reading.text}
          </span>
        }
      />
      <Blockers blockers={line.blockers} {...actions} />
    </div>
  );
}

export interface NoBoardRowProps extends Omit<BlockerActions, "onRetryRead"> {
  /** names are the repositories no board manages. */
  names: string;
  blockers: readonly BlockerView[];
}

/** NoBoardRow is the line of the repositories without a board: the same form as a board, and no button, since it opens no place. */
export function NoBoardRow({ names, blockers, ...actions }: NoBoardRowProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset draws a frame, and this group is a plain row
    <div role="group" aria-label="Repositories without a board" className="flex flex-col">
      <div className="flex min-h-(--size-control) items-center gap-(--space-3) px-(--space-3) py-(--space-1) text-(length:--text-ui) leading-(--leading-ui)">
        <Icon icon={ICONS.repository} tone="muted" />
        <span className="shrink-0 font-medium whitespace-nowrap text-ink-1">No board</span>
        <Tooltip content={names}>
          <span className={cn("min-w-0 flex-1 truncate text-ink-3", META)}>{names}</span>
        </Tooltip>
      </div>
      <Blockers blockers={blockers} {...actions} />
    </div>
  );
}
