import type { UserEntry } from "@/lib/wails";

export interface UserMessageProps {
  user: UserEntry;
}

/** UserMessage is what the user said, in a bubble on the right. */
export function UserMessage({ user }: UserMessageProps) {
  return (
    <div className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-muted px-4 py-2.5 break-words whitespace-pre-wrap select-text">
      {user.text}
    </div>
  );
}
