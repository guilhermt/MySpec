import type { ReactNode, Ref } from "react";

export interface SettingsPageProps {
  title: string;
  /** sentence says what the page is for, in a line or two. */
  sentence: string;
  /** action is the action of the page, at the right of its header: Add board. */
  action?: ReactNode;
  children: ReactNode;
  titleRef?: Ref<HTMLHeadingElement>;
}

/** SettingsPage is a page of Settings: the title and its sentence with the action of the page, then the sections. */
export function SettingsPage({ title, sentence, action, children, titleRef }: SettingsPageProps) {
  return (
    <div className="flex min-w-0 flex-col gap-(--space-8)">
      <header className="flex items-start justify-between gap-(--space-4)">
        <div className="flex min-w-0 flex-col gap-(--space-1)">
          <h2
            ref={titleRef}
            tabIndex={-1}
            className="text-(length:--text-title) leading-(--leading-title) font-semibold text-ink-1 outline-none"
          >
            {title}
          </h2>
          <p className="max-w-(--measure-read) text-(length:--text-body) leading-(--leading-body) text-ink-3">
            {sentence}
          </p>
        </div>
        {action}
      </header>
      {children}
    </div>
  );
}

export interface SettingsBlockProps {
  title: string;
  /** sentence is said at the side of the title, on its baseline. */
  sentence?: ReactNode;
  children: ReactNode;
  id?: string;
}

/** SettingsBlock is a section of a page: the title in capitals, its sentence on the same baseline, and the content. */
export function SettingsBlock({ title, sentence, children, id }: SettingsBlockProps) {
  return (
    <section {...(id !== undefined ? { id } : {})} className="flex flex-col gap-(--space-3)">
      <div className="flex flex-wrap items-baseline gap-x-(--space-3)">
        <h3 className="text-(length:--text-caps) leading-(--leading-caps) font-bold tracking-(--tracking-caps) text-ink-3 uppercase">
          {title}
        </h3>
        {sentence !== undefined && (
          <p className="text-(length:--text-meta) leading-(--leading-meta) text-ink-3">
            {sentence}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
