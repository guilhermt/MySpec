import type { ReviewFallback, ReviewMode, StepReport } from "@/lib/wails";

/** REVIEW_MODES are the review modes, in the order the pickers list them. */
export const REVIEW_MODES: readonly ReviewMode[] = ["manual", "agent"];

/** MAX_REVIEW_ROUNDS mirrors flow.MaxReviewRounds: the reports with changes the implementer gets before the step goes to the user. */
export const MAX_REVIEW_ROUNDS = 3;

/** reviewModeLabel is the name of a mode, the same wherever the app shows it. */
export function reviewModeLabel(mode: ReviewMode): string {
  return mode === "agent" ? "Agent" : "Manual";
}

/** reviewModeHint is what a mode does to a task, as the creation dialog explains it. */
export function reviewModeHint(mode: ReviewMode): string {
  return mode === "agent"
    ? "An agent reviews each step, and the task runs to the pull request on its own."
    : "You review each step in VS Code before its commit.";
}

/** fallbackReason says why a step that started under the agent review was reviewed by the user; "" while its mode held. */
export function fallbackReason(fallback: ReviewFallback): string {
  switch (fallback) {
    case "taken_over":
      return "Taken over from the agent review";
    case "rounds_exhausted":
      return "The agent review didn't come clean after three rounds";
    case "commit_failed":
      return "The commit after the agent review didn't happen";
    case "":
      return "";
  }
}

/** stepReportLabel names a report of the agent review of a step, with its verdict: "Review 2 · clean". */
export function stepReportLabel(pass: number, clean: boolean): string {
  return `Review ${pass} · ${clean ? "clean" : "changes"}`;
}

/**
 * findStepReport is the report of the agent review a file names, with the step that lists it, or
 * null once no step lists it anymore.
 */
export function findStepReport<S extends { reports: StepReport[] | null }>(
  steps: readonly S[],
  file: string,
): { step: S; report: StepReport } | null {
  for (const step of steps) {
    const report = (step.reports ?? []).find((candidate) => candidate.file === file);
    if (report !== undefined) {
      return { step, report };
    }
  }
  return null;
}
