import type { ReactNode } from "react";

export interface LiveRegionProps {
  kind: "status" | "alert";
  className?: string;
  /** children is what the region announces; the region stays mounted without it, so the text arrives into a region the reader already holds. */
  children?: ReactNode;
}

/**
 * LiveRegion is a status or an alert that is always on screen and holds the text only while there is
 * something to say: a reader announces a text that arrives in a region it already knows, never one
 * that is born with its text. The data-live-region attribute is what the width sweep recognises it by.
 */
export function LiveRegion({ kind, className, children }: LiveRegionProps) {
  return (
    <span role={kind} data-live-region="" {...(className !== undefined ? { className } : {})}>
      {children}
    </span>
  );
}
