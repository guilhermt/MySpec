import { type EditedText, useEditedText } from "@/components/useEditedText";
import { storedDraft } from "@/store/app-store";

/** DraftField is one of the two texts of a draft the user writes. */
export type DraftField = "title" | "body";

/** draftTextKey names one editable text of a draft: a draft of a discussion by its field. */
export function draftTextKey(discussionId: string, draftId: string, field: DraftField): string {
  return `${discussionId}|${draftId}|${field}`;
}

/** draftRevision is the revision a draft stands at now, null when the discussion no longer has it. */
function draftRevision(discussionId: string, draftId: string): number | null {
  return storedDraft(discussionId, draftId)?.revision ?? null;
}

export type { EditedText };

/**
 * useDraftText holds the title or the body of a draft while the user edits it,
 * as useEditedText does it: a required text is never left blank (the body of an
 * epic the user wrote is not), and a draft the agent wrote again drops what was
 * typed on the old one.
 */
export function useDraftText(
  discussionId: string,
  draftId: string,
  field: DraftField,
  stored: string,
  revision: number,
  save: (text: string) => void,
  required: boolean,
): EditedText {
  return useEditedText(
    draftTextKey(discussionId, draftId, field),
    stored,
    revision,
    save,
    required,
    () => draftRevision(discussionId, draftId),
  );
}
