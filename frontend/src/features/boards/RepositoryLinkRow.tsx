import { ChevronsUpDown } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { linkText, pluralize } from "@/features/boards/board-dialog";
import { cn } from "@/lib/utils";
import type { BoardRepositoryOption } from "@/lib/wails";

export interface RepositoryLinkRowProps {
  option: BoardRepositoryOption;
  /** chosenClone is the clone a found repository ties to; "" for the other links. */
  chosenClone: string;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
  onCloneChange: (path: string) => void;
}

/** RepositoryLinkRow is one repository of a board in its dialog: whether the board manages it, and how it ties to the app. */
export function RepositoryLinkRow({
  option,
  chosenClone,
  disabled,
  onCheckedChange,
  onCloneChange,
}: RepositoryLinkRowProps) {
  const nameId = useId();
  const otherBoard = option.link === "other_board";
  const picksClone = option.link === "clone" && (option.clones ?? []).length > 1;

  return (
    <li className={cn("flex items-start gap-3 px-4 py-3", otherBoard && "opacity-70")}>
      <Checkbox
        aria-labelledby={nameId}
        checked={option.checked && !otherBoard}
        disabled={otherBoard || disabled}
        onCheckedChange={onCheckedChange}
        className="mt-0.5"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span id={nameId} className="font-medium">
            {option.fullName}
          </span>
          <span className="text-xs text-muted-foreground">{pluralize(option.cards, "card")}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <span className="break-all">{linkText(option)}</span>
          {picksClone && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="xs" disabled={disabled} />}
                aria-label={`Clone of ${option.fullName}: ${chosenClone}`}
                className="min-w-0 font-mono text-muted-foreground"
              >
                <span className="truncate">{chosenClone}</span>
                <ChevronsUpDown aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuRadioGroup value={chosenClone} onValueChange={onCloneChange}>
                  {(option.clones ?? []).map((clone) => (
                    <DropdownMenuRadioItem key={clone} value={clone} className="font-mono">
                      {clone}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </span>
      </div>
    </li>
  );
}
