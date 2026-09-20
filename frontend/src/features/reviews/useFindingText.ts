import { type EditedText, useEditedText } from "@/components/useEditedText";
import { useAppStore } from "@/store/app-store";

/**
 * textKey names one editable text of a review: a finding by its number, or the
 * summary of a pass.
 */
export function textKey(reviewId: string, pass: number, number: number | "summary"): string {
  return `${reviewId}|${pass}|${number}`;
}

/** passRevision is the report a pass of a review stands at now, null when the review no longer has it. */
function passRevision(reviewId: string, pass: number): number | null {
  const review = useAppStore.getState().app?.reviews?.find((each) => each.id === reviewId);
  return review?.passes?.find((each) => each.pass === pass)?.revision ?? null;
}

export type { EditedText };

/**
 * useFindingText holds the text of a finding or of a summary while the user
 * edits it, as useEditedText does it: the text belongs to the report of its
 * pass, so a pass the agent wrote again drops what was typed on the old one.
 */
export function useFindingText(
  reviewId: string,
  pass: number,
  number: number | "summary",
  stored: string,
  revision: number,
  save: (text: string) => void,
  required = false,
): EditedText {
  return useEditedText(textKey(reviewId, pass, number), stored, revision, save, required, () =>
    passRevision(reviewId, pass),
  );
}
