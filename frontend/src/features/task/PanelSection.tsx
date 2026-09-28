import type { ReactNode } from "react";

export interface PanelSectionProps {
  /** legend is the title of the group, drawn in capitals: Steps · 2 of 7 committed, Task. */
  legend: string;
  children: ReactNode;
}

/** PanelSection is a group of a panel of the task, with its legend in capitals, named by it. */
export function PanelSection({ legend, children }: PanelSectionProps) {
  return (
    <section aria-label={legend} className="flex flex-col">
      <h3 className="pb-(--space-2) text-(length:--text-caps) leading-(--leading-caps) font-bold tracking-(--tracking-caps) text-ink-3 uppercase">
        {legend}
      </h3>
      {children}
    </section>
  );
}
