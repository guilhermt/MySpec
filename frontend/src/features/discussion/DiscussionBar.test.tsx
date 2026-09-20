import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiscussionBar } from "@/features/discussion/DiscussionBar";
import type { DiscussionSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeDiscussion, makeState } from "@/test/wails-mock";

function bar(overrides: Partial<DiscussionSummary> = {}) {
  const discussion = makeDiscussion(overrides);
  return renderWithStore(<DiscussionBar discussion={discussion} />, {
    state: makeState({ discussions: [discussion] }),
  });
}

describe("DiscussionBar", () => {
  it("says where the discussion stands", () => {
    bar({ status: "deciding" });

    expect(screen.getByRole("status")).toHaveTextContent("Decide drafts");
  });

  it("warns that the drafts could not be read", () => {
    bar({ unreadableDrafts: "Draft export-invoices has no title." });

    expect(screen.getByText("Draft export-invoices has no title.")).toHaveAttribute(
      "title",
      "Draft export-invoices has no title.",
    );
  });

  it("says it is publishing while it publishes", () => {
    bar({ status: "publishing" });

    expect(screen.getByText("Publishing…")).toBeInTheDocument();
  });
});
