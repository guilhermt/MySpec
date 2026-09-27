import { ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/system/Button";
import { Icon } from "@/components/system/Icon";
import { Tooltip } from "@/components/system/Tooltip";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ModelPicker, ModelValue } from "@/features/models/ModelPicker";
import { modelStageLabel } from "@/lib/models";
import { asModelStage, type TaskStageModel, type TaskSummary } from "@/lib/wails";
import { setStageModel } from "@/store/actions";

/** ModelRow is one stage of a task: a picker while a session of it is still to start. */
function ModelRow({ taskId, row }: { taskId: string; row: TaskStageModel }) {
  const stage = asModelStage(row.stage);
  const label = modelStageLabel(stage);

  return (
    <li className="flex min-h-10 items-center gap-3">
      <span className="w-28 shrink-0 text-sm">{label}</span>
      {row.editable ? (
        <ModelPicker
          label={label}
          value={row}
          onChange={(choice) => void setStageModel(taskId, stage, choice)}
        />
      ) : (
        <span className="flex min-w-0 flex-col">
          <ModelValue value={row} className="text-sm text-muted-foreground" />
          {row.live && (
            <span className="text-xs text-muted-foreground">Change it in the conversation</span>
          )}
        </span>
      )}
    </li>
  );
}

/**
 * TaskModelsButton opens the models of the stages of a task, from its header. Below 1040px of main
 * area only the icon stays, with the name in the tooltip.
 */
export function TaskModelsButton({ task }: { task: TaskSummary }) {
  return (
    <Popover>
      <Tooltip content="Models">
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              icon={Sparkles}
              className="@max-[1040px]/main:w-(--size-control-sm) @max-[1040px]/main:px-0"
            />
          }
        >
          <span className="@max-[1040px]/main:sr-only">Models</span>
          <Icon icon={ChevronDown} size="sm" className="@max-[1040px]/main:hidden" />
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="end" className="w-96 gap-3 p-3">
        <PopoverHeader>
          <PopoverTitle>Models</PopoverTitle>
          <PopoverDescription>
            A change applies to the sessions of a stage that haven't started.
          </PopoverDescription>
        </PopoverHeader>
        <ul className="flex flex-col">
          {(task.models ?? []).map((row) => (
            <ModelRow key={row.stage} taskId={task.id} row={row} />
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
