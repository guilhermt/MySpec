import { Fragment, useRef, useState } from "react";
import { MenuRow } from "@/components/MenuRow";
import { IconButton } from "@/components/system/IconButton";
import { ICONS } from "@/components/system/icons";
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/components/system/Menu";
import { useNow } from "@/features/attention/useNow";
import { DeleteTaskDialog } from "@/features/task/DeleteTaskDialog";
import { DiscardStepDialog } from "@/features/task/DiscardStepDialog";
import { ModelsPopover } from "@/features/task/ModelsPopover";
import { ReviewModePopover } from "@/features/task/ReviewModePopover";
import { StageActionDialog } from "@/features/task/StageActionDialog";
import type { StageAction } from "@/features/task/stage-actions";
import { currentStepOf } from "@/features/task/step-status";
import { type TaskMenuAction, taskMenuOf } from "@/features/task/task-menu";
import type { TaskStage, TaskSummary } from "@/lib/wails";
import {
  discardDraft,
  openExternal,
  openInEditor,
  refreshPR,
  reviewAgain,
  reviewStepMyself,
} from "@/store/actions";

/** Opened is what an item of the ⋯ left open: a dialog or a popover. */
type Opened =
  | { kind: "discardStep" }
  | { kind: "deleteTask" }
  | { kind: "reviewModePopover" }
  | { kind: "modelsPopover" }
  | { kind: "stage"; action: StageAction; stage: TaskStage };

// MINUTE is how often the ages in the ⋯ are read again.
const MINUTE = 60_000;

export interface TaskMenuProps {
  task: TaskSummary;
}

/** TaskMenu is the ⋯ of a task: what can be done to its step, its pull request, its stages and itself. */
export function TaskMenu({ task }: TaskMenuProps) {
  const moreRef = useRef<HTMLButtonElement>(null);
  // The item hands the focus to the dialog it opens; the menu doesn't take it back.
  const handsFocus = useRef(false);
  const [opened, setOpened] = useState<Opened | null>(null);
  const groups = taskMenuOf(task, useNow(MINUTE, true));
  const step = currentStepOf(task);

  const run = (action: TaskMenuAction) => {
    switch (action.kind) {
      case "reviewMyself":
        void reviewStepMyself(task.id);
        break;
      case "openInEditor":
        void openInEditor(task.id);
        break;
      case "discardDraft":
        void discardDraft(task.id);
        break;
      case "openPR":
        if (task.pr !== null) {
          void openExternal(task.pr.prUrl);
        }
        break;
      case "refreshPR":
        void refreshPR(task.id);
        break;
      case "reviewAgain":
        void reviewAgain(task.id);
        break;
      default:
        handsFocus.current =
          action.kind === "deleteTask" || action.kind === "discardStep" || action.kind === "stage";
        setOpened(action);
    }
  };
  const close = (open: boolean) => {
    if (!open) {
      setOpened(null);
    }
  };
  // A dialog the item handed the focus to gives it back to the ⋯ when it closes.
  const closeDialog = (open: boolean) => {
    close(open);
    if (!open) {
      moreRef.current?.focus();
    }
  };

  return (
    <>
      <Menu>
        <MenuTrigger
          render={<IconButton ref={moreRef} label="More actions" icon={ICONS.more} size="sm" />}
        />
        <MenuContent
          align="end"
          finalFocus={() => {
            const handed = handsFocus.current;
            handsFocus.current = false;
            return !handed;
          }}
        >
          {groups.map((group) => (
            <Fragment key={group.label ?? "last"}>
              {group.label === null && <MenuSeparator />}
              <MenuGroup>
                {group.label !== null && <MenuGroupLabel>{group.label}</MenuGroupLabel>}
                {group.items.map((item) => (
                  <MenuRow key={item.id} item={item} onSelect={() => run(item.action)} />
                ))}
              </MenuGroup>
            </Fragment>
          ))}
        </MenuContent>
      </Menu>

      {opened?.kind === "discardStep" && step !== null && (
        <DiscardStepDialog task={task} step={step} open onOpenChange={closeDialog} />
      )}
      {opened?.kind === "stage" && (
        <StageActionDialog
          task={task}
          action={opened.action}
          stage={opened.stage}
          open
          onOpenChange={closeDialog}
        />
      )}
      <DeleteTaskDialog
        task={task}
        open={opened?.kind === "deleteTask"}
        onOpenChange={closeDialog}
      />
      <ReviewModePopover
        task={task}
        open={opened?.kind === "reviewModePopover"}
        onOpenChange={close}
        anchor={moreRef}
      />
      <ModelsPopover
        task={task}
        open={opened?.kind === "modelsPopover"}
        onOpenChange={close}
        anchor={moreRef}
      />
    </>
  );
}
