import { useAppStore } from "@/store/app-store";

/** passRevision is the report a pass of a review stands at now, null when the review no longer has it. */
export function passRevision(reviewId: string, pass: number): number | null {
  const review = useAppStore.getState().app?.reviews?.find((each) => each.id === reviewId);
  return review?.passes?.find((each) => each.pass === pass)?.revision ?? null;
}
