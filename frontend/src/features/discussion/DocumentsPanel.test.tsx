import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentsPanel } from "@/features/discussion/DocumentsPanel";
import { api, type DiscussionSummary } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore, type StoreOptions } from "@/test/render";
import { makeDiscussion, makeState } from "@/test/wails-mock";

function panel(
  overrides: Partial<DiscussionSummary> = {},
  ui: NonNullable<StoreOptions["ui"]> = {},
) {
  const discussion = makeDiscussion(overrides);
  return renderWithStore(<DocumentsPanel discussion={discussion} />, {
    state: makeState({ discussions: [discussion] }),
    ui,
  });
}

describe("DocumentsPanel", () => {
  it("opens on the context while the agent has written no document", async () => {
    panel();

    await waitFor(() => {
      expect(api.readDiscussionArtifact).toHaveBeenCalledWith("discussion-1", "context.md");
    });
    expect(screen.getByRole("button", { name: "Context" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Document" })).not.toBeInTheDocument();
  });

  it("opens on the document when there is one", async () => {
    panel({ hasDocument: true, documentRevision: 1 });

    await waitFor(() => {
      expect(api.readDiscussionArtifact).toHaveBeenCalledWith("discussion-1", "discussion.md");
    });
    expect(await screen.findByTestId("markdown")).toHaveTextContent("# Discussion");
    expect(screen.getByRole("button", { name: "Document" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("opens on the document it was asked for and forgets the request", async () => {
    panel({ hasDocument: true }, { panelDocument: "context.md" });

    await waitFor(() => {
      expect(api.readDiscussionArtifact).toHaveBeenCalledWith("discussion-1", "context.md");
    });
    expect(useAppStore.getState().panelDocument).toBeNull();
    expect(api.readDiscussionArtifact).not.toHaveBeenCalledWith("discussion-1", "discussion.md");
  });

  it("changes the choice to the document asked for with the panel open", async () => {
    panel({ hasDocument: true });
    await screen.findByTestId("markdown");

    useAppStore.getState().openPanelAt("documents", "context.md");

    await waitFor(() => {
      expect(api.readDiscussionArtifact).toHaveBeenCalledWith("discussion-1", "context.md");
    });
    expect(screen.getByRole("button", { name: "Context" })).toHaveAttribute("aria-pressed", "true");
  });

  it("does not move to the document the moment the agent writes it", async () => {
    const { rerender } = panel();
    await waitFor(() => {
      expect(api.readDiscussionArtifact).toHaveBeenCalledWith("discussion-1", "context.md");
    });

    rerender(
      <DocumentsPanel discussion={makeDiscussion({ hasDocument: true, documentRevision: 1 })} />,
    );

    expect(screen.getByRole("button", { name: "Context" })).toHaveAttribute("aria-pressed", "true");
    expect(api.readDiscussionArtifact).not.toHaveBeenCalledWith("discussion-1", "discussion.md");
  });

  it("goes to the document the user picks, and back to the context", async () => {
    const { user } = panel({ hasDocument: true, documentRevision: 1 });
    await screen.findByTestId("markdown");

    await user.click(screen.getByRole("button", { name: "Context" }));
    await waitFor(() => {
      expect(api.readDiscussionArtifact).toHaveBeenCalledWith("discussion-1", "context.md");
    });

    await user.click(screen.getByRole("button", { name: "Document" }));
    expect(screen.getByRole("button", { name: "Document" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("shows the failure of a read and reads again with Try again", async () => {
    vi.mocked(api.readDiscussionArtifact).mockRejectedValueOnce(new Error("No such file."));
    const { user } = panel();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't read the document");
    expect(alert).toHaveTextContent("No such file.");

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByTestId("markdown")).toBeInTheDocument();
    expect(api.readDiscussionArtifact).toHaveBeenCalledTimes(2);
  });
});
