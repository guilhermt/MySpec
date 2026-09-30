import { type ReactElement, type RefObject, useMemo } from "react";
import { type PullRequestRowView, PullRequestRow as Row } from "@/components/system/ListRow";
import { ListSectionHeader } from "@/components/system/ListSectionHeader";
import { entryId, type ListTreeEntry, useListTree } from "@/features/board/useListTree";
import {
  type ReviewListRow,
  type ReviewSectionId,
  sectionLabel,
} from "@/features/reviews/review-list";
import type { PullRequestRow } from "@/lib/wails";

export interface PullRequestTreeProps {
  rows: readonly ReviewListRow[];
  models: ReadonlyMap<string, PullRequestRowView>;
  /** openKey is the pull request of the panel; null while the list has none open. */
  openKey: string | null;
  /** newKeys are the pull requests a new reading brought, which flash. */
  newKeys: ReadonlySet<string>;
  treeRef: RefObject<HTMLDivElement | null>;
  onToggleSection: (id: ReviewSectionId) => void;
  /** onActivate runs on a click or Enter on a pull request. */
  onActivate: (row: PullRequestRow) => void;
}

// entryOf is a row of the list as the tree walks it.
function entryOf(row: ReviewListRow): ListTreeEntry<ReviewSectionId> {
  return row.kind === "section"
    ? {
        kind: "section",
        id: row.section.id,
        foldable: row.section.rows.length > 0,
        collapsed: row.collapsed,
      }
    : { kind: "item", key: row.row.key, sectionId: row.sectionId };
}

/**
 * PullRequestTree is the list of Reviews as a tree: the section headers and the pull request rows side
 * by side, with one tab stop and the arrows walking the rows. The view handles the letters.
 */
export function PullRequestTree({
  rows,
  models,
  openKey,
  newKeys,
  treeRef,
  onToggleSection,
  onActivate,
}: PullRequestTreeProps): ReactElement {
  const entries = useMemo(() => rows.map(entryOf), [rows]);
  const pullRequests = useMemo(
    () =>
      new Map(rows.flatMap((row) => (row.kind === "pr" ? [[row.row.key, row.row] as const] : []))),
    [rows],
  );
  const tree = useListTree({
    entries,
    openKey,
    treeRef,
    onToggleSection,
    onActivateItem: (key) => {
      const row = pullRequests.get(key);
      if (row !== undefined) {
        onActivate(row);
      }
    },
  });

  return (
    <div
      ref={treeRef}
      role="tree"
      aria-label="Open pull requests, by what they wait for"
      onKeyDown={tree.onKeyDown}
      className="flex flex-col"
    >
      {rows.map((row) => {
        const id = entryId(entryOf(row));
        const focusThis = () => tree.onEntryFocus(id);
        if (row.kind === "section") {
          const { section } = row;
          return (
            <ListSectionHeader
              key={id}
              id={section.id}
              name={section.name}
              count={section.rows.length}
              collapsed={row.collapsed}
              empty={section.rows.length === 0}
              tooltip={section.tooltip}
              label={sectionLabel(section)}
              tabStop={id === tree.tabStop}
              onToggle={() => onToggleSection(section.id)}
              onFocus={focusThis}
            />
          );
        }
        const model = models.get(row.row.key);
        if (model === undefined) {
          return null;
        }
        return (
          <Row
            key={id}
            model={model}
            open={row.row.key === openKey}
            tabStop={id === tree.tabStop}
            flash={newKeys.has(row.row.key)}
            onActivate={() => onActivate(row.row)}
            onFocus={focusThis}
          />
        );
      })}
    </div>
  );
}
