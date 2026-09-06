import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UserEntry } from "@/lib/wails";
import { removePending } from "@/store/actions";

export interface PendingMessageProps {
  taskId: string;
  entryId: string;
  user: UserEntry;
}

/**
 * PendingMessage is a message the user sent while the agent was busy. It waits
 * in the queue, and it can still be taken back.
 */
export function PendingMessage({ taskId, entryId, user }: PendingMessageProps) {
  return (
    <div className="flex max-w-[85%] items-center gap-1 self-end">
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Remove queued message"
        className="text-muted-foreground"
        onClick={() => void removePending(taskId, entryId)}
      >
        <X />
      </Button>
      <div className="flex min-w-0 flex-col items-end gap-1">
        <div className="rounded-2xl rounded-br-md bg-muted px-4 py-2.5 break-words whitespace-pre-wrap opacity-70 select-text">
          {user.text}
        </div>
        <span className="text-xs text-muted-foreground">Queued</span>
      </div>
    </div>
  );
}
