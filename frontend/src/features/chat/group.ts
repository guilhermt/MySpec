import type { ActionEntry, Entry } from "@/lib/wails";

/** ActionsItem is the run of tool calls the agent made without saying anything. */
export interface ActionsItem {
  kind: "actions";
  key: string;
  turnId: string;
  items: ActionEntry[];
}

/** EntryItem is one entry drawn on its own. */
export interface EntryItem {
  kind: "entry";
  key: string;
  entry: Entry;
}

/** ConversationItem is one block of the conversation as it is drawn. */
export type ConversationItem = ActionsItem | EntryItem;

/**
 * groupEntries folds the consecutive tool calls of one turn into a single item.
 * Everything else passes through untouched, so what the user reads keeps the
 * order in which it happened.
 */
export function groupEntries(entries: readonly Entry[]): ConversationItem[] {
  const items: ConversationItem[] = [];
  let group: ActionsItem | null = null;

  for (const entry of entries) {
    const action = entry.kind === "action" ? entry.action : null;
    if (action === null) {
      group = null;
      items.push({ kind: "entry", key: entry.id, entry });
      continue;
    }
    if (group !== null && group.turnId === entry.turnId) {
      group.items.push(action);
      continue;
    }
    group = { kind: "actions", key: entry.id, turnId: entry.turnId, items: [action] };
    items.push(group);
  }
  return items;
}
