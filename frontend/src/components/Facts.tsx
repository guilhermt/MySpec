import type { ReactNode } from "react";

/** FACTS is a list of keys and values, a `dl`: the key in its column, the value beside it. */
export const FACTS =
  "grid grid-cols-[minmax(0,var(--col-keys))_minmax(0,1fr)] items-baseline gap-x-(--space-3) gap-y-(--space-1-5)";

/**
 * ARCHIVED_FACTS is the facts of an archived item: the keys in a column as wide as the widest, the
 * values beside them, in the meta size.
 */
export const ARCHIVED_FACTS =
  "grid grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-(--space-5) gap-y-(--space-1) text-(length:--text-meta) leading-(--leading-meta)";

export interface FactProps {
  label: string;
  children: ReactNode;
}

/** Fact is one key and its value in a list of facts. */
export function Fact({ label, children }: FactProps) {
  return (
    <>
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0 text-ink-1 wrap-anywhere">{children}</dd>
    </>
  );
}
