import { Button } from "@/components/system/Button";
import { ICONS } from "@/components/system/icons";
import { Spinner } from "@/components/system/Spinner";
import { voiceInSentence } from "@/features/chat/markers";

export interface BackToEndProps {
  /** newCount is how many entries were born since the reader left the end. */
  newCount: number;
  /** voice is the word of who talks: "Implementer". */
  voice: string;
  /** work is what the session does now, null when it does nothing. */
  work: "writing" | "working" | null;
  onClick: () => void;
}

/** BackToEnd is the way back to the end of the conversation, with what arrived and what goes on. */
export function BackToEnd({ newCount, voice, work, onClick }: BackToEndProps) {
  const name = [
    newCount > 0 ? `New messages: ${newCount}.` : "",
    "Go to the end.",
    work === null ? "" : `The ${voiceInSentence(voice)} is ${work}.`,
  ]
    .filter((part) => part !== "")
    .join(" ");

  return (
    <Button
      size="sm"
      icon={ICONS.toEnd}
      aria-label={name}
      onClick={onClick}
      className="absolute bottom-(--space-3) left-[round(50%,1px)] min-w-(--newmsg-w) translate-x-[round(-50%,1px)] rounded-(--radius-pill) border-transparent bg-surface-3 shadow-float hover:bg-surface-2"
    >
      {newCount > 0 && (
        <span className="font-medium">
          New messages <span className="tabular-nums">{newCount}</span>
        </span>
      )}
      {work !== null && (
        <>
          {newCount > 0 && (
            <span aria-hidden="true" className="h-(--icon-sm) w-(--border) bg-line-2" />
          )}
          <Spinner />
          <span>
            {voice} {work}
          </span>
        </>
      )}
    </Button>
  );
}
