import { ArrowUp, Play, Square } from "lucide-react";
import type { KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { asSessionStatus, type TaskSummary } from "@/lib/wails";
import { interrupt, resume, sendMessage } from "@/store/actions";
import { useAppStore, useDraft } from "@/store/app-store";

function PausedNotice({ taskId, stage }: { taskId: string; stage: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[760px] items-center justify-between gap-3 rounded-lg border bg-muted p-3">
      <p className="text-sm">Paused. Resume to keep talking.</p>
      <Button onClick={() => void resume(taskId, stage)}>
        <Play />
        Resume
      </Button>
    </div>
  );
}

export interface ComposerProps {
  task: TaskSummary;
  /** stage names the session the message goes to. */
  stage: string;
}

/**
 * Composer is where the user answers. It stays open while the agent works: the
 * message waits in the queue instead of the user waiting for a free field.
 */
export function Composer({ task, stage }: ComposerProps) {
  const draft = useDraft(task.id, stage);
  const setDraft = useAppStore((state) => state.setDraft);

  const send = () => {
    const text = draft.trim();
    if (text === "") {
      return;
    }
    setDraft(task.id, stage, "");
    void sendMessage(task.id, stage, text);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
      return;
    }
    if (event.key === "Escape" && task.turnRunning) {
      event.preventDefault();
      void interrupt(task.id, stage);
    }
  };

  if (asSessionStatus(task.sessionStatus) === "paused") {
    return (
      <div className="border-t p-3">
        <PausedNotice taskId={task.id} stage={stage} />
      </div>
    );
  }

  return (
    <div className="border-t p-3">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-1.5">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(task.id, stage, event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Reply to the agent…"
            className="max-h-60 min-h-10 resize-none"
          />
          {task.turnRunning ? (
            <>
              <Button
                variant="outline"
                size="sm"
                aria-label="Stop the response"
                onClick={() => void interrupt(task.id, stage)}
              >
                <Square />
                Stop
              </Button>
              <Tooltip>
                <TooltipTrigger render={<Button size="icon-sm" />} aria-label="Send" onClick={send}>
                  <ArrowUp />
                </TooltipTrigger>
                <TooltipContent>Send when the agent is free</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <Button size="icon-sm" aria-label="Send" onClick={send}>
              <ArrowUp />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Enter to send · Shift+Enter for a new line
          {task.turnRunning && " · Esc to stop"}
        </p>
      </div>
    </div>
  );
}
