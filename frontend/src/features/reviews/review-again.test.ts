import { describe, expect, it } from "vitest";
import { againNote, againText, discardsDecisions } from "@/features/reviews/review-again";
import type { ReviewPass } from "@/lib/wails";
import { makeReviewFinding, makeReviewPass, makeReviewSummary } from "@/test/wails-mock";

const decided = makeReviewFinding({ decision: "approved" });
const undecided = makeReviewFinding({ decision: "" });

describe("discardsDecisions and againNote", () => {
  it.each<{ name: string; passes: ReviewPass[]; want: string | null }>([
    {
      name: "a decision on the last report",
      passes: [makeReviewPass({ pass: 1, findings: [decided, undecided] })],
      want: "The decisions and edits of review 1 will be discarded.",
    },
    {
      name: "an edit on the last report",
      passes: [makeReviewPass({ pass: 2, edited: true, findings: [undecided] })],
      want: "The decisions and edits of review 2 will be discarded.",
    },
    {
      name: "the last report, past a pass asked for after it",
      passes: [
        makeReviewPass({ pass: 1, findings: [decided] }),
        makeReviewPass({ pass: 2, recorded: false, findings: [] }),
      ],
      want: "The decisions and edits of review 1 will be discarded.",
    },
    {
      name: "nothing decided or edited",
      passes: [makeReviewPass({ findings: [undecided] })],
      want: null,
    },
    {
      name: "a published pass",
      passes: [makeReviewPass({ published: true, findings: [decided] })],
      want: null,
    },
    {
      name: "a pass sent to the agent",
      passes: [makeReviewPass({ sent: true, findings: [decided] })],
      want: null,
    },
    { name: "no report", passes: [], want: null },
  ])("with $name", ({ passes, want }) => {
    const review = makeReviewSummary({ passes });

    expect(discardsDecisions(review)).toBe(want !== null);
    expect(againNote(review)).toBe(want);
  });
});

describe("againText", () => {
  const published = (placements: string[]) =>
    makeReviewPass({
      pass: 1,
      published: true,
      findings: placements.map((placement, i) =>
        makeReviewFinding({
          number: i + 1,
          placement,
          decision: placement === "" ? "discarded" : "approved",
        }),
      ),
    });

  it.each([
    {
      name: "the new commits against the published findings",
      status: "new_commits",
      newCommits: 3,
      passes: [published(["inline", "body", ""])],
      want: "Pass 2 reads the 3 new commits and the checks, and says which of the 2 published findings they fix.",
    },
    {
      name: "commits of an unknown count",
      status: "new_commits",
      newCommits: -1,
      passes: [published(["inline", "inline"])],
      want: "Pass 2 reads the new commits and the checks, and says which of the 2 published findings they fix.",
    },
    {
      name: "one commit against one published finding",
      status: "new_commits",
      newCommits: 1,
      passes: [published(["inline"])],
      want: "Pass 2 reads the new commit and the checks, and says whether it fixes the published finding.",
    },
    {
      name: "the new commits without a published finding",
      status: "new_commits",
      newCommits: 3,
      passes: [published([""])],
      want: "Pass 2 reads the 3 new commits and the checks, and writes a new report.",
    },
    {
      name: "a failed check or a conflict",
      status: "trouble",
      newCommits: 0,
      passes: [published(["inline"])],
      want: "Pass 2 reads the checks and the conflict again, and turns what failed into findings.",
    },
    {
      name: "a blocked pass",
      status: "pass_blocked",
      newCommits: 0,
      passes: [published(["inline"]), makeReviewPass({ pass: 2, recorded: false })],
      want: "Pass 2 reads the pull request again, and starts when the checks finish.",
    },
    {
      name: "the rest",
      status: "awaiting_decision",
      newCommits: 0,
      passes: [makeReviewPass({ pass: 1 }), makeReviewPass({ pass: 2 })],
      want: "Pass 3 reads the pull request and the checks again, and writes a new report.",
    },
  ])("says $name", ({ status, newCommits, passes, want }) => {
    expect(againText(makeReviewSummary({ status, newCommits, passes }))).toBe(want);
  });
});
