import type { ReactNode } from "react";

export interface ArchivedSectionProps {
  title: string;
  children: ReactNode;
}

/** ArchivedSection is a part of the body of an archived item, under its title in caps. */
export function ArchivedSection({ title, children }: ArchivedSectionProps) {
  return (
    <section className="flex flex-col gap-(--space-2)">
      <h2 className="text-(length:--text-caps) leading-(--leading-caps) font-bold tracking-(--tracking-caps) text-ink-3 uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}
