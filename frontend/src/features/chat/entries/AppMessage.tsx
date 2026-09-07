import type { UserEntry } from "@/lib/wails";

export interface AppMessageProps {
  user: UserEntry;
}

/** AppMessage is what MySpec itself said to the agent, on the task's behalf. */
export function AppMessage({ user }: AppMessageProps) {
  return (
    <div className="self-stretch rounded-lg border bg-muted/40 px-4 py-3 select-text">
      <p className="text-xs font-medium text-muted-foreground">MySpec · sent to the agent</p>
      <p className="text-sm break-words whitespace-pre-wrap">{user.text}</p>
    </div>
  );
}
