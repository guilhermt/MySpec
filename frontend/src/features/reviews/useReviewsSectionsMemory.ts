import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_COLLAPSED,
  isReviewsSectionsMemory,
  type ReviewSectionId,
} from "@/features/reviews/review-list";
import { REVIEWS_SECTIONS_KEY, readStored, writeStored } from "@/lib/ui-storage";

interface SectionsState {
  collapsed: ReviewSectionId[];
  /** chosen is whether the user has collapsed or expanded a section: only then is the choice kept. */
  chosen: boolean;
}

/**
 * useReviewsSectionsMemory is the sections of Reviews the user collapsed, read once from the last run
 * and kept from the first choice on. Until then the default holds: the sections that never wait for
 * the user start collapsed.
 */
export function useReviewsSectionsMemory(): [
  ReadonlySet<ReviewSectionId>,
  (id: ReviewSectionId) => void,
] {
  const [state, setState] = useState<SectionsState>(() => {
    const stored = readStored(REVIEWS_SECTIONS_KEY, null, isReviewsSectionsMemory);
    return stored === null
      ? { collapsed: [...DEFAULT_COLLAPSED], chosen: false }
      : { collapsed: stored.collapsed, chosen: true };
  });

  useEffect(() => {
    if (state.chosen) {
      writeStored(REVIEWS_SECTIONS_KEY, { collapsed: state.collapsed });
    }
  }, [state]);

  const collapsed = useMemo(() => new Set(state.collapsed), [state.collapsed]);
  const toggle = useCallback(
    (id: ReviewSectionId) =>
      setState((current) => ({
        chosen: true,
        collapsed: current.collapsed.includes(id)
          ? current.collapsed.filter((other) => other !== id)
          : [...current.collapsed, id],
      })),
    [],
  );
  return [collapsed, toggle];
}
