import { type ReactNode, useRef } from "react";
import { useFeed } from "@/features/chat/useFeed";

export interface ArchivedMarkersProps {
  /** label names the list of lines for the reader. */
  label: string;
  children: ReactNode;
}

/**
 * ArchivedMarkers is a list of marker lines read in place: the walk of the conversation, one stop of
 * Tab and the arrows between the lines, → and ← to open and fold them.
 */
export function ArchivedMarkers({ label, children }: ArchivedMarkersProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFeed(ref);
  return (
    <div ref={ref} role="feed" aria-label={label} className="flex flex-col">
      {children}
    </div>
  );
}
