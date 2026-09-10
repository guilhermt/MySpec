import { Banner } from "@/features/notice/Notice";
import { useAppStore, useLeftovers } from "@/store/app-store";

/**
 * LeftoversNotice is what the last deletion could not take with it. A task is
 * never kept for a folder git refused to remove, so what stayed on disk is
 * shown with its path for the user to clean up by hand.
 */
export function LeftoversNotice() {
  const leftovers = useLeftovers();
  const setLeftovers = useAppStore((state) => state.setLeftovers);

  if (leftovers === null || leftovers.length === 0) {
    return null;
  }

  return (
    <Banner title="Some files stayed on disk" onDismiss={() => setLeftovers(null)}>
      <p>The task is gone, but git couldn't remove everything:</p>
      <ul className="mt-1 flex flex-col gap-1">
        {leftovers.map((leftover) => (
          <li key={leftover.repoPath} className="flex flex-col">
            <span>{leftover.repository}</span>
            {leftover.path !== "" && (
              <span className="font-mono text-xs break-all">{leftover.path}</span>
            )}
            {leftover.branch !== "" && (
              <span className="font-mono text-xs break-all">{leftover.branch}</span>
            )}
            <span className="text-xs text-muted-foreground">{leftover.error}</span>
          </li>
        ))}
      </ul>
    </Banner>
  );
}
