import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FindingCard } from "@/features/reviews/FindingCard";
import { api, type ReviewFinding } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeReviewFinding, makeState } from "@/test/wails-mock";

function card(overrides: Partial<ReviewFinding> = {}, published = false) {
  return renderWithStore(
    <FindingCard
      reviewId="review-1"
      pass={1}
      revision={1}
      finding={makeReviewFinding(overrides)}
      published={published}
    />,
    { state: makeState() },
  );
}

describe("FindingCard", () => {
  it("shows the finding and where it points", () => {
    card();

    expect(screen.getByText("1.")).toBeInTheDocument();
    expect(screen.getByLabelText("Finding 1")).toHaveValue("The token is never cleared.");
    expect(screen.getByRole("button", { name: "src/login.ts:12" })).toBeInTheDocument();
  });

  it("opens the line of an anchored finding in the editor", async () => {
    const { user } = card();

    await user.click(screen.getByRole("button", { name: "src/login.ts:12" }));

    expect(api.openFindingInEditor).toHaveBeenCalledWith("review-1", 1, 1);
  });

  it("has nothing to open for a general finding", () => {
    card({ path: "", line: 0 });

    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "General" })).not.toBeInTheDocument();
  });

  it("approves a finding, and takes the decision back", async () => {
    const { user } = card({ decision: "approved" });

    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(api.decideFinding).toHaveBeenCalledWith("review-1", 1, 1, "discarded");

    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(api.decideFinding).toHaveBeenLastCalledWith("review-1", 1, 1, "");
  });

  it("records the text the user left as the field is left", async () => {
    const { user } = card();

    await user.clear(screen.getByLabelText("Finding 1"));
    await user.type(screen.getByLabelText("Finding 1"), "Clear the token.");
    await user.tab();

    expect(api.setFindingText).toHaveBeenCalledWith("review-1", 1, 1, "Clear the token.");
  });

  it("is there to read once the pass was published, with where the finding went", () => {
    card({ decision: "approved", placement: "inline" }, true);

    expect(screen.getByText("Inline comment")).toBeInTheDocument();
    expect(screen.getByText("The token is never cleared.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("says when a published finding was left out", () => {
    card({ decision: "discarded" }, true);

    expect(screen.getByText("Not published")).toBeInTheDocument();
  });

  it("never sends a blank finding, and gives the field its text back", async () => {
    const { user } = card();

    await user.clear(screen.getByLabelText("Finding 1"));
    await user.tab();

    expect(api.setFindingText).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Finding 1")).toHaveValue("The token is never cleared.");
  });
});
