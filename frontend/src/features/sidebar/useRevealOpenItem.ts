import { useEffect } from "react";
import { nodesOfItem, sidebarTree } from "@/features/sidebar/sidebar-tree";
import { openItemId } from "@/lib/locations";
import { setRepositoryFilter } from "@/store/actions";
import { useAppStore, useLocation } from "@/store/app-store";

/**
 * useRevealOpenItem shows the item on screen in the tree: it expands the nodes
 * holding it and, when the repository filter hides a task, shows every
 * repository again. It acts when the place changes and when the open item
 * joins the state after opening; collapsing a node or choosing a filter
 * afterwards stays.
 */
export function useRevealOpenItem(): void {
  const location = useLocation();
  const itemId = openItemId(location);
  const present = useAppStore((state) => {
    const app = state.app;
    return (
      itemId !== null &&
      app !== null &&
      [...(app.tasks ?? []), ...(app.reviews ?? []), ...(app.discussions ?? [])].some(
        (item) => item.id === itemId,
      )
    );
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: location stands for a new place, which reveals again
  useEffect(() => {
    const { app, expandSidebarNodes } = useAppStore.getState();
    if (!present || itemId === null || app === null) {
      return;
    }
    expandSidebarNodes(nodesOfItem(sidebarTree(app, "", Date.now()), itemId));
    const task = app.tasks?.find((candidate) => candidate.id === itemId);
    if (
      task !== undefined &&
      app.repositoryFilter !== "" &&
      task.repositoryId !== app.repositoryFilter
    ) {
      void setRepositoryFilter("");
    }
  }, [location, present]);
}
