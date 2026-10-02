import { Fragment } from "react";
import type { GestureLineView } from "@/components/system/draft-views";
import { ICONS } from "./icons";
import { SunkenLine, type SunkenLineProps } from "./SunkenLine";

export interface GestureLineProps {
  /** id makes the line the accessible description of Approve. */
  id: string;
  view: GestureLineView;
}

/** GESTURE_ICONS are the sign of each line: a chain, a wait, or what blocks it. */
const GESTURE_ICONS: Record<GestureLineView["icon"], NonNullable<SunkenLineProps["icon"]>> = {
  chain: ICONS.chain,
  hourglass: ICONS.waiting,
  blocked: "blocked",
};

/** GestureLine says what Approve and Discard publish now, before the decision of a draft. */
export function GestureLine({ id, view }: GestureLineProps) {
  return (
    <SunkenLine id={id} icon={GESTURE_ICONS[view.icon]}>
      {view.segments.map((segment, index) =>
        segment.strong ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: a segment is its place in the line
          <strong key={index} className="font-semibold">
            {segment.text}
          </strong>
        ) : (
          // A plain text keeps its spaces in the description, which a span around it would lose.
          // biome-ignore lint/suspicious/noArrayIndexKey: a segment is its place in the line
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </SunkenLine>
  );
}
