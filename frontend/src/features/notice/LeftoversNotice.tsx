import { Banner } from "@/features/notice/Notice";
import { useAppStore, useLeftover } from "@/store/app-store";

/**
 * LeftoversNotice is what the last deletion could not take with it. A task is
 * never kept for a folder git refused to remove, so what stayed on disk is
 * shown with its path for the user to clean up by hand.
 */
export function LeftoversNotice() {
  const leftover = useLeftover();
  const setLeftover = useAppStore((state) => state.setLeftover);

  if (leftover === null) {
    return null;
  }

  return (
    <Banner title="Some files stayed on disk" onDismiss={() => setLeftover(null)}>
      <p>The task is gone, but git couldn't remove everything:</p>
      <div className="mt-1 flex flex-col">
        {leftover.path !== "" && (
          <span className="font-mono text-xs break-all">{leftover.path}</span>
        )}
        {leftover.branch !== "" && (
          <span className="font-mono text-xs break-all">{leftover.branch}</span>
        )}
        <span className="text-xs text-muted-foreground">{leftover.error}</span>
      </div>
    </Banner>
  );
}
