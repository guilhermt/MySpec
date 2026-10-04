import type { ReactNode } from "react";

export interface ArchivedTagsProps {
  children: ReactNode;
}

/** ArchivedTags are the tags of an archived item right after its title: Archived, One-Shot, Merged or Closed. */
export function ArchivedTags({ children }: ArchivedTagsProps) {
  return <span className="flex items-center gap-(--space-1-5)">{children}</span>;
}
