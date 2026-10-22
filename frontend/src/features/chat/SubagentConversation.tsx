import { useEffect, useMemo, useRef, useState } from "react";
import { Conversation } from "@/features/chat/Conversation";
import { MarkerLine } from "@/features/chat/entries/MarkerLine";
import { SubagentTask } from "@/features/chat/entries/SubagentTask";
import { SubagentFoot } from "@/features/chat/SubagentFoot";
import { IDLE_SESSION } from "@/features/chat/session";
import {
  type SubagentModel,
  type SubagentStatus,
  subagentConversationOf,
  subagentEndView,
} from "@/features/chat/subagent";
import { readActionOutput } from "@/store/actions";
import { useTranscript } from "@/store/app-store";

// useEndOutput is the output of the call of a subagent that ended, which is its report when it
// finished and what it printed when it failed. It is read once the call ends, and stays null while
// it is not read, when the call has none or when the reading failed: the line then has no body.
function useEndOutput(
  itemId: string,
  stage: string,
  status: SubagentStatus,
  root: SubagentModel["root"],
): string | null {
  const [read, setRead] = useState<{ entryId: string; text: string } | null>(null);
  const entryId = root?.id ?? "";
  const lines = root?.action?.outputLines ?? 0;
  const ended = status === "finished" || status === "failed";

  useEffect(() => {
    if (!ended || entryId === "" || lines === 0) {
      return;
    }
    let current = true;
    readActionOutput(itemId, stage, entryId).then(
      (output) => {
        if (current) {
          setRead({ entryId, text: output.text });
        }
      },
      () => undefined,
    );
    return () => {
      current = false;
    };
  }, [itemId, stage, entryId, ended, lines]);

  return ended && read?.entryId === entryId ? read.text : null;
}

export interface SubagentConversationProps {
  itemId: string;
  stage: string;
  /** toolUseId is the Agent/Task call that started the subagent. */
  toolUseId: string;
  /** voice is the agent of the conversation the subagent came from, who gave it its task. */
  voice: string;
  /** sessionOpen says the session behind the conversation is alive, so its task can be stopped. */
  sessionOpen: boolean;
}

/**
 * SubagentConversation is what a subagent said and did, read live in place of the conversation it
 * came from: its task first, its speeches and actions as they come, how it ended last, and a strip
 * with the way back where the composer would be. It takes no message. It takes the focus as it opens.
 */
export function SubagentConversation({
  itemId,
  stage,
  toolUseId,
  voice,
  sessionOpen,
}: SubagentConversationProps) {
  const transcript = useTranscript(itemId, stage);
  const ref = useRef<HTMLElement>(null);
  const entries = transcript?.entries;
  const model = useMemo(
    () => subagentConversationOf(entries ?? [], toolUseId),
    [entries, toolUseId],
  );
  const output = useEndOutput(itemId, stage, model.status, model.root);
  const endView = subagentEndView(model.status, output);
  const firstId = model.entries[0]?.id ?? "";
  const startedAt = model.root?.action?.startedAt ?? "";

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const task = useMemo(
    () => (model.prompt === "" ? null : <SubagentTask prompt={model.prompt} voice={voice} />),
    [model.prompt, voice],
  );
  const end =
    endView === null ? null : (
      <MarkerLine view={endView} createdAt={model.root?.action?.finishedAt ?? ""} />
    );
  // The task is drawn right before the first entry; without entries it comes first at the end.
  const before = useMemo(
    () => (task === null || firstId === "" ? undefined : new Map([[firstId, task]])),
    [task, firstId],
  );

  return (
    <>
      <section
        ref={ref}
        aria-label={`${model.name}, a subagent's conversation`}
        tabIndex={-1}
        className="flex min-h-0 flex-1 flex-col outline-none"
      >
        <Conversation
          taskId={itemId}
          stage={stage}
          session={IDLE_SESSION}
          subagent={model}
          {...(before === undefined ? {} : { before })}
          endLine={
            firstId === "" ? (
              <>
                {task}
                {end}
              </>
            ) : (
              end
            )
          }
        />
      </section>
      <SubagentFoot
        itemId={itemId}
        stage={stage}
        toolUseId={toolUseId}
        name={model.name}
        status={model.status}
        startedAt={startedAt}
        voice={voice}
        sessionOpen={sessionOpen}
      />
    </>
  );
}
