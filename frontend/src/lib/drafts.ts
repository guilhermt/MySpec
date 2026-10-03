import type { Draft } from "@/lib/wails";
import { asDraftKind, asDraftOutcome } from "@/lib/wails";

const UNTITLED_EPIC = "Untitled epic";
const UNTITLED_DRAFT = "Untitled draft";

/** draftTitle is the title of a draft as the screen writes it: never the id. */
export function draftTitle(draft: Draft): string {
  const title = draft.title.trim();
  if (title !== "") {
    return title;
  }
  return asDraftKind(draft.kind) === "epic" ? UNTITLED_EPIC : UNTITLED_DRAFT;
}

/**
 * publishedOutcome is what the drafts given became on GitHub: "4 created, 1 updated", "1 created";
 * "" when none of them is published.
 */
export function publishedOutcome(drafts: readonly Draft[]): string {
  const published = drafts.filter((draft) => draft.published);
  const created = published.filter((draft) => asDraftOutcome(draft.outcome) === "created").length;
  const updated = published.filter((draft) => asDraftOutcome(draft.outcome) === "updated").length;
  return [created > 0 ? `${created} created` : "", updated > 0 ? `${updated} updated` : ""]
    .filter((part) => part !== "")
    .join(", ");
}
