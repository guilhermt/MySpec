import type { ReactNode, Ref } from "react";
import { ScrollArea } from "@/components/system/ScrollArea";
import { cn } from "@/lib/utils";

/**
 * COLUMN_CLASS is the conversation column, centred on a whole pixel: --measure-conversation wide
 * at most, inside a container that keeps --space-6 on each side. The request bar, the composer
 * and the tabs stand in it too.
 */
export const COLUMN_CLASS =
  "w-full max-w-(--measure-conversation) ml-[max(0px,round(down,calc((100%_-_var(--measure-conversation))/2),1px))]";

export interface ConversationColumnProps {
  children: ReactNode;
  label?: string;
  viewportRef?: Ref<HTMLDivElement>;
  contentRef?: Ref<HTMLDivElement>;
  /** fadeTop fades the top edge, when something is above what shows. */
  fadeTop: boolean;
  /** endRoom leaves room at the end as high as the way back to the end, which floats over it. */
  endRoom?: boolean;
}

/**
 * ConversationColumn scrolls the conversation, faded at its edges, in the conversation column. The
 * column takes the focus from code: it comes back here from an earlier conversation.
 */
export function ConversationColumn({
  children,
  label,
  viewportRef,
  contentRef,
  fadeTop,
  endRoom = false,
}: ConversationColumnProps) {
  return (
    <ScrollArea
      className="h-full"
      viewportClassName={cn(
        // The list corrects the scroll when a row above the view changes height; the browser does not.
        "[overflow-anchor:none]",
        fadeTop ? "conversation-fade" : "conversation-fade-bottom",
      )}
      {...(label !== undefined ? { label } : {})}
      {...(viewportRef !== undefined ? { viewportRef } : {})}
    >
      <div className="px-(--space-6)">
        <div
          ref={contentRef}
          data-slot="conversation"
          tabIndex={-1}
          className={cn(
            COLUMN_CLASS,
            "flex flex-col gap-(--space-3) pt-(--space-6) outline-none",
            endRoom ? "pb-[calc(var(--space-4)+var(--size-control-sm))]" : "pb-(--space-4)",
          )}
        >
          {children}
        </div>
      </div>
    </ScrollArea>
  );
}
