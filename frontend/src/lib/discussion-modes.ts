import type { DiscussionMode } from "@/lib/wails";

/** DISCUSSION_MODES are the modes of a discussion, in the order the creation dialog offers them. */
export const DISCUSSION_MODES: readonly DiscussionMode[] = ["refine", "register"];

/** discussionModeLabel is the name of a mode, the same wherever the app shows it. */
export function discussionModeLabel(mode: DiscussionMode): string {
  return mode === "register" ? "Register" : "Refine";
}

/** discussionModeHint is what a mode does to a discussion, as the creation dialog explains it. */
export function discussionModeHint(mode: DiscussionMode): string {
  return mode === "register"
    ? "The agent writes the card from what you wrote and the cards, asking only what it must."
    : "The agent asks until the demand is clear and writes structured cards.";
}
