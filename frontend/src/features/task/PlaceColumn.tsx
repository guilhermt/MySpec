import type { ReactNode } from "react";
import { PlaceEmpty } from "@/components/system/PlaceEmpty";
import { ConversationColumn } from "@/features/chat/ConversationColumn";
import { Activity } from "@/features/chat/entries/Activity";
import { ErrorBlock } from "@/features/chat/entries/ErrorBlock";
import { MarkerLine } from "@/features/chat/entries/MarkerLine";
import type { PlaceView } from "@/features/task/place";

/** ColumnPlace is a place without a conversation: what the app does, why it stopped, or the empty state. */
export type ColumnPlace = Extract<PlaceView, { kind: "activity" | "blocked" | "empty" }>;

export interface PlaceColumnProps {
  view: ColumnPlace;
  /** checks are the live checks the empty place waits for, when it says so. */
  checks?: ReactNode;
  /** endLineAt is when the end line happened (the merge), "" for no time. */
  endLineAt?: string;
}

/**
 * PlaceColumn is a place without a conversation, in the conversation column: the activity, the line
 * of the step that is next with the error block, or the empty state with what it waits for.
 */
export function PlaceColumn({ view, checks, endLineAt = "" }: PlaceColumnProps) {
  let content: ReactNode;
  switch (view.kind) {
    case "activity":
      content = <Activity text={view.text} />;
      break;
    case "blocked":
      content = (
        <>
          <MarkerLine view={view.line} createdAt="" />
          <ErrorBlock explanation={view.explanation} detail={view.detail} />
        </>
      );
      break;
    case "empty": {
      const body = [
        view.body !== "" && <p key="body">{view.body}</p>,
        view.checks && <div key="checks">{checks}</div>,
        view.error !== undefined && (
          <ErrorBlock key="error" explanation={view.error.explanation} detail={view.error.detail} />
        ),
      ].filter(Boolean);
      content = (
        <>
          <PlaceEmpty title={view.title}>{body.length > 0 ? body : undefined}</PlaceEmpty>
          {view.endLine !== null && <MarkerLine view={view.endLine} createdAt={endLineAt} />}
        </>
      );
      break;
    }
  }
  return (
    <div className="relative min-h-0 flex-1">
      <ConversationColumn fadeTop={false}>{content}</ConversationColumn>
    </div>
  );
}
