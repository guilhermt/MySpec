import type { ReactNode } from "react";

export interface LiveRegionProps {
  kind: "status" | "alert";
  /** as is the element of the region: a span inside a line of text, a div in a column of blocks. */
  as?: "span" | "div";
  className?: string;
  /** children is what the region announces; the region stays mounted without it, so the text arrives into a region the reader already holds. */
  children?: ReactNode;
}

/**
 * LiveRegion is a status or an alert that is always on screen and holds the text only while there is
 * something to say: a reader announces a text that arrives in a region it already knows, never one
 * that is born with its text. A region never takes display: contents, which WebKit drops from the accessibility tree with its role. The data-live-region attribute is what the width sweep recognises it by.
 */
export function LiveRegion({ kind, as: Tag = "span", className, children }: LiveRegionProps) {
  return (
    <Tag role={kind} data-live-region="" {...(className !== undefined ? { className } : {})}>
      {children}
    </Tag>
  );
}
