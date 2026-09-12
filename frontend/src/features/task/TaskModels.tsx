import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

/** TaskModelsButton opens the models of the stages of a task, from its header. */
export function TaskModelsButton({ task }: { task: TaskSummary }) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={<PopoverTrigger render={<Button variant="ghost" size="icon-sm" />} />}
          aria-label="Models"
        >
          <Sparkles />
        </TooltipTrigger>
        <TooltipContent>Models</TooltipContent>
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
