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
  it("opens on the context, the only document", async () => {
    panel();

    await waitFor(() => {
      expect(api.readDiscussionArtifact).toHaveBeenCalledWith("discussion-1", "context.md");
    });
    expect(screen.getByRole("button", { name: "Context" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("opens on the document it was asked for and forgets the request", async () => {
    panel({}, { panelDocument: "context.md" });

    await waitFor(() => {
      expect(api.readDiscussionArtifact).toHaveBeenCalledWith("discussion-1", "context.md");
    });
    expect(useAppStore.getState().panelDocument).toBeNull();
  });

  it("shows the context as Markdown", async () => {
    panel();

    expect(await screen.findByTestId("markdown")).toBeInTheDocument();
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
