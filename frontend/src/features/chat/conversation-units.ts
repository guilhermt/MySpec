import { isValidElement, type ReactNode } from "react";
import type { Row, Stretch } from "@/features/chat/conversation";
import { MarkerLine } from "@/features/chat/entries/MarkerLine";
import { discussionOpeningOf, type MarkerContext, markerOf } from "@/features/chat/markers";

/**
 * ConversationUnit is what the window of the conversation draws as one piece: the line of a folded
 * stretch, or a row. A stretch that is open is its line and a row for each of its rows.
 */
export type ConversationUnit =
  | { kind: "fold"; key: string; stretch: Stretch; open: boolean }
  | { kind: "row"; key: string; row: Row };

/** UnitFolds is what decides how the stretches are drawn: which fold, which of those are open. */
export interface UnitFolds {
  /** foldable are the keys of the stretches that fold. */
  foldable: ReadonlySet<string>;
  /** open are the keys of the folded stretches the reader opened. */
  open: ReadonlySet<string>;
  /** anchored tells a stretch that holds a derived line, which stays open and is drawn in place. */
  anchored: (stretch: Stretch) => boolean;
}

// drawn tells whether RowView draws something for the row: a row without what it shows is no unit.
function drawn(row: Row, ctx: MarkerContext): boolean {
  switch (row.kind) {
    case "speech":
      return row.entry.assistant !== null;
    case "user":
    case "product":
      return row.entry.user !== null;
    case "marker":
      return row.entry.marker !== null && markerOf(row.entry.marker, ctx, row.entry.id) !== null;
    case "question":
      return row.entry.question !== null;
    case "permission":
      return row.entry.permission !== null;
    case "error":
      return row.entry.error !== null;
    case "start":
    case "group":
      return true;
  }
}

/** conversationUnits are the units of the conversation in the order of the screen. */
export function conversationUnits(
  model: { stretches: readonly Stretch[] },
  folds: UnitFolds,
  ctx: MarkerContext,
): ConversationUnit[] {
  const units: ConversationUnit[] = [];
  for (const stretch of model.stretches) {
    const folded = folds.foldable.has(stretch.key) && !folds.anchored(stretch);
    const open = folds.open.has(stretch.key);
    if (folded) {
      units.push({ kind: "fold", key: `fold:${stretch.key}`, stretch, open });
    }
    if (folded && !open) {
      continue;
    }
    for (const row of stretch.rows) {
      if (drawn(row, ctx)) {
        units.push({ kind: "row", key: row.key, row });
      }
    }
  }
  return units;
}

// numbered tells whether a before or after node draws an article that is numbered: a line does, a
// decision card is an article with the role of group, which takes no position.
function numbered(node: ReactNode): boolean {
  return isValidElement(node) && node.type === MarkerLine;
}

/** unitArticles is how many numbered top-level articles a unit draws: its row's, and one for each before and after line. */
export function unitArticles(
  unit: ConversationUnit,
  ctx: MarkerContext,
  before: ReadonlyMap<string, ReactNode> | undefined,
  after: ReadonlyMap<string, ReactNode> | undefined,
): number {
  if (unit.kind === "fold") {
    return 1;
  }
  let count = 1;
  if (unit.row.kind === "start") {
    const opening = discussionOpeningOf(unit.row.prompt, ctx);
    count += (opening.context !== null ? 1 : 0) + (opening.message !== "" ? 1 : 0);
  }
  return (
    count +
    (numbered(before?.get(unit.row.key)) ? 1 : 0) +
    (numbered(after?.get(unit.row.key)) ? 1 : 0)
  );
}
