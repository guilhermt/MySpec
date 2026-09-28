import { Fragment, useRef, useState } from "react";
import { IconButton } from "@/components/system/IconButton";
import { ICONS } from "@/components/system/icons";
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/system/Menu";
import { Tooltip } from "@/components/system/Tooltip";
import { useNow } from "@/features/attention/useNow";
import { DeleteTaskDialog } from "@/features/task/DeleteTaskDialog";
import { DiscardStepDialog } from "@/features/task/DiscardStepDialog";
import { ModelsPopover } from "@/features/task/ModelsPopover";
import { ReviewModePopover } from "@/features/task/ReviewModePopover";
import { StageActionDialog } from "@/features/task/StageActionDialog";
import type { StageAction } from "@/features/task/stage-actions";
import { currentStepOf } from "@/features/task/step-status";
import { type TaskMenuAction, type TaskMenuItem, taskMenuOf } from "@/features/task/task-menu";
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
        setOpened(action);
    }
  };
  const close = (open: boolean) => {
    if (!open) {
      setOpened(null);
    }
  };

  return (
    <>
      <Menu>
        <MenuTrigger
          render={<IconButton ref={moreRef} label="More actions" icon={ICONS.more} size="sm" />}
        />
        <MenuContent align="end">
          {groups.map((group) => (
            <Fragment key={group.label ?? "last"}>
              {group.label === null && <MenuSeparator />}
              <MenuGroup>
                {group.label !== null && <MenuGroupLabel>{group.label}</MenuGroupLabel>}
                {group.items.map((item) => (
                  <TaskMenuRow key={item.id} item={item} onSelect={() => run(item.action)} />
                ))}
              </MenuGroup>
            </Fragment>
          ))}
        </MenuContent>
      </Menu>

      {opened?.kind === "discardStep" && step !== null && (
        <DiscardStepDialog task={task} step={step} open onOpenChange={close} />
      )}
      {opened?.kind === "stage" && (
        <StageActionDialog
          task={task}
          action={opened.action}
          stage={opened.stage}
          open
          onOpenChange={close}
        />
      )}
      <DeleteTaskDialog
        taskId={task.id}
        name={task.name}
        archived={false}
        open={opened?.kind === "deleteTask"}
        onOpenChange={close}
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

/** TaskMenuRow is one item of the ⋯, with its tooltip when it has one. */
function TaskMenuRow({ item, onSelect }: { item: TaskMenuItem; onSelect: () => void }) {
  const row = (
    <MenuItem
      onClick={onSelect}
      {...(item.icon !== undefined ? { icon: ICONS[item.icon] } : {})}
      {...(item.shortcut !== undefined ? { shortcut: item.shortcut } : {})}
      {...(item.sub !== undefined ? { sub: item.sub } : {})}
      {...(item.disabledReason !== undefined ? { disabledReason: item.disabledReason } : {})}
      {...(item.destructive ? { destructive: true } : {})}
    >
      {item.label}
      {item.opensPopover && <span aria-hidden="true"> ›</span>}
    </MenuItem>
  );
  return item.tooltip === undefined ? row : <Tooltip content={item.tooltip}>{row}</Tooltip>;
}
