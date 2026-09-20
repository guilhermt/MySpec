import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentsPanel } from "@/features/discussion/DocumentsPanel";
import { api, type DiscussionSummary } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeDiscussion, makeState } from "@/test/wails-mock";

function panel(overrides: Partial<DiscussionSummary> = {}) {
  const discussion = makeDiscussion(overrides);
  return renderWithStore(<DocumentsPanel discussion={discussion} />, {
    state: makeState({ discussions: [discussion] }),
  });
}

describe("DocumentsPanel", () => {
  it("opens on the context while the agent has written no document", async () => {
    panel();

    await waitFor(() => {
      expect(api.readDiscussionArtifact).toHaveBeenCalledWith("discussion-1", "context.md");
    });
    expect(screen.getByRole("button", { name: "Document" })).toBeDisabled();
  });

  it("opens on the document as soon as there is one", async () => {
    panel({ hasDocument: true, documentRevision: 1 });

    await waitFor(() => {
      expect(api.readDiscussionArtifact).toHaveBeenCalledWith("discussion-1", "discussion.md");
    });
    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Discussion");
  });

  it("moves to the document the moment the agent writes it", async () => {
    const { rerender } = panel();
    await waitFor(() => {
      expect(api.readDiscussionArtifact).toHaveBeenCalledWith("discussion-1", "context.md");
    });

    rerender(
      <DocumentsPanel discussion={makeDiscussion({ hasDocument: true, documentRevision: 1 })} />,
    );

    await waitFor(() => {
      expect(api.readDiscussionArtifact).toHaveBeenCalledWith("discussion-1", "discussion.md");
    });
  });

  it("goes back to the context the user asks for", async () => {
    const { user } = panel({ hasDocument: true, documentRevision: 1 });
    await screen.findByTestId("markdown");

    await user.click(screen.getByRole("button", { name: "Context" }));

    await waitFor(() => {
      expect(api.readDiscussionArtifact).toHaveBeenCalledWith("discussion-1", "context.md");
    });
  });

  it("shows the failure of a read", async () => {
    vi.mocked(api.readDiscussionArtifact).mockRejectedValueOnce(new Error("No such file."));
    panel();

    expect(await screen.findByText("No such file.")).toBeInTheDocument();
  });
});
