import { useId } from "react";
import { Checkbox } from "@/components/system/Checkbox";
import { CutText } from "@/components/system/CutText";
import { Select } from "@/components/system/Select";
import { linkText, pluralize } from "@/features/boards/board-dialog";
import { displayPath } from "@/lib/paths";
import { cn } from "@/lib/utils";
import type { BoardRepositoryOption, Repository } from "@/lib/wails";

export interface BoardRepositoryRowProps {
  option: BoardRepositoryOption;
  /** repository is the registered one, for the clone that is missing and the consequence. */
  repository: Repository | null;
  /** chosenClone is the clone a found repository ties to; "" for the other links. */
  chosenClone: string;
  disabled: boolean;
  /** consequence is what unchecking does; "" outside an edit or while checked. */
  consequence: string;
  onCheckedChange: (checked: boolean) => void;
  onCloneChange: (path: string) => void;
}

/**
 * BoardRepositoryRow is one repository of a board in its dialog: whether the board manages it, how
 * it ties to the app, and, unchecked, what happens to it.
 */
export function BoardRepositoryRow({
  option,
  repository,
  chosenClone,
  disabled,
  consequence,
  onCheckedChange,
  onCloneChange,
}: BoardRepositoryRowProps) {
  const consequenceId = useId();
  const otherBoard = option.link === "other_board";
  const clones = option.clones ?? [];
  const picksClone = option.link === "clone" && clones.length > 1;
  const text = linkText(option, repository);

  return (
    <li className={cn("flex flex-col px-3 py-1.5", consequence !== "" && "bg-surface-0")}>
      <div className="flex items-center gap-3">
        <Checkbox
          checked={option.checked && !otherBoard}
          onCheckedChange={onCheckedChange}
          disabled={otherBoard || disabled}
          {...(otherBoard ? { disabledReason: text } : {})}
          {...(consequence !== "" ? { describedBy: consequenceId } : {})}
          className="shrink-0"
        >
          <span className="font-medium">{option.fullName}</span>{" "}
          <span className="text-ink-3">{pluralize(option.cards, "card")}</span>
        </Checkbox>
        {!otherBoard && (
          <CutText
            text={text}
            className="ml-auto text-(length:--text-meta) leading-(--leading-meta) text-ink-3"
          />
        )}
        {picksClone && (
          <div className="w-1/3 min-w-0 shrink-0">
            <Select
              size="sm"
              label={`Clone of ${option.fullName}`}
              value={chosenClone}
              options={clones.map((clone) => ({ value: clone, label: displayPath(clone) }))}
              onValueChange={onCloneChange}
              disabled={disabled}
            />
          </div>
        )}
      </div>
      {consequence !== "" && (
        <p
          id={consequenceId}
          className="pb-1 pl-[calc(var(--space-2)+var(--icon)+var(--space-2))] text-(length:--text-meta) leading-(--leading-meta) text-ink-2"
        >
          {`→ ${consequence}`}
        </p>
      )}
    </li>
  );
}
