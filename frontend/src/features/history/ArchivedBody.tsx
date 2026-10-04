import type { ReactNode } from "react";

export interface ArchivedBodyProps {
  children: ReactNode;
}

/**
 * ArchivedBody is the body of an archived item: an area that scrolls, with the column of --measure
 * centred on whole pixels and --space-6 free at each side at least. Nothing in it runs.
 */
export function ArchivedBody({ children }: ArchivedBodyProps) {
  return (
    // The area is relative, so what is positioned inside it scrolls with it and is cut by it.
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-[min(round(down,var(--measure),1px),100%-2*var(--space-6))] flex-col gap-(--space-6) pt-(--space-8) pb-(--space-16)">
        {children}
      </div>
    </div>
  );
}
