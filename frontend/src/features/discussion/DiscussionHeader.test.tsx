import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiscussionHeader } from "@/features/discussion/DiscussionHeader";
import { api, type DiscussionSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeDiscussion, makeSituation, makeState } from "@/test/wails-mock";

function header(overrides: Partial<DiscussionSummary> = {}) {
  const discussion = makeDiscussion(overrides);
  return renderWithStore(<DiscussionHeader discussion={discussion} />, {
    state: makeState({ discussions: [discussion] }),
    ui: { location: { kind: "discussion", id: discussion.id } },
  });
}

describe("DiscussionHeader", () => {
  it("names the place after the discussion, with where it stands on the right", () => {
    header();

    expect(screen.getByRole("heading", { level: 1, name: "Invoices" })).toBeInTheDocument();
    expect(screen.getByText("Discussing")).toBeInTheDocument();
  });

  it("leaves the kind and the board to the tree and the breadcrumb", () => {
    header();

    expect(screen.queryByText("Discussion")).not.toBeInTheDocument();
    expect(screen.queryByText("Roadmap")).not.toBeInTheDocument();
  });

  it("pauses the conversation of the discussion", async () => {
    const { user } = header();

    await user.click(screen.getByRole("button", { name: "Pause" }));

    expect(api.pause).toHaveBeenCalledWith("discussion-1", "discussion");
  });

  it("resumes a paused conversation", async () => {
    const { user } = header({ sessionStatus: "paused" });

    await user.click(screen.getByRole("button", { name: "Resume" }));

    expect(api.resume).toHaveBeenCalledWith("discussion-1", "discussion");
  });

  it("offers the documents panel", async () => {
    const { user } = header();

    await user.click(screen.getByRole("button", { name: "Documents" }));

    expect(useAppStore.getState().panel).toBe("documents");
  });

  it("asks before archiving and before deleting", async () => {
    const { user } = header();

    await user.click(screen.getByRole("button", { name: "Archive discussion" }));
    expect(await screen.findByRole("heading", { name: 'Archive "Invoices"?' })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Delete discussion" }));
    expect(await screen.findByRole("heading", { name: 'Delete "Invoices"?' })).toBeInTheDocument();
  });

  it("says why the discussion can't be archived yet", async () => {
    const { user } = header({
      canArchive: false,
      archiveHint: "A draft is still being published.",
    });

    expect(screen.getByRole("button", { name: "Archive discussion" })).toBeDisabled();
    await user.hover(
      screen.getByRole("button", { name: "Archive discussion" }).parentElement as HTMLElement,
    );

    expect(await screen.findByText("A draft is still being published.")).toBeInTheDocument();
  });

  it("takes the colour of what waits for the user over the status", () => {
    const { container } = header({
      status: "deciding",
      situations: [
        makeSituation({
          taskId: "discussion-1",
          kind: "drafts",
          form: "decide",
          place: { kind: "discussion", stage: "", step: 0 },
        }),
      ],
    });

    expect(
      container.querySelector(".bg-\\[var\\(--status-attention-fill\\)\\]"),
    ).toBeInTheDocument();
  });

  it("shows a discussion ready to archive with the done dot", () => {
    const { container } = header({
      status: "ready_to_archive",
      situations: [
        makeSituation({
          taskId: "discussion-1",
          kind: "ready_to_archive",
          group: "closing",
          place: { kind: "discussion", stage: "", step: 0 },
        }),
      ],
    });

    expect(screen.getByText("Ready to archive")).toBeInTheDocument();
    expect(container.querySelector(".bg-\\[var\\(--status-success\\)\\]")).toBeInTheDocument();
  });
});
