import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscardChangesDialog } from "@/features/settings/DiscardChangesDialog";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeState } from "@/test/wails-mock";

function dialog() {
  const leave = vi.fn();
  const rendered = renderWithStore(<DiscardChangesDialog />, {
    state: makeState(),
    ui: {
      location: { kind: "settings", section: "commit" },
      promptEdit: { stage: "commit", original: "a", text: "b" },
      pendingLeave: leave,
    },
  });
  return { ...rendered, leave };
}

describe("DiscardChangesDialog", () => {
  it("names the prompt whose edits would be lost and opens on Keep editing", async () => {
    dialog();

    expect(screen.getByRole("alertdialog", { name: "Discard your changes?" })).toBeInTheDocument();
    expect(
      screen.getByText("The edits to the Commit prompt haven't been saved."),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus());
  });

  it("keeps the edit and drops the pending navigation on Keep editing", async () => {
    const { user, leave } = dialog();

    await user.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(useAppStore.getState().pendingLeave).toBeNull();
    expect(useAppStore.getState().promptEdit).not.toBeNull();
    expect(leave).not.toHaveBeenCalled();
  });

  it("drops the edit and runs the navigation on Discard", async () => {
    const { user, leave } = dialog();

    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(leave).toHaveBeenCalled();
    expect(useAppStore.getState().promptEdit).toBeNull();
    expect(useAppStore.getState().pendingLeave).toBeNull();
  });

  it("is closed without a pending navigation", () => {
    renderWithStore(<DiscardChangesDialog />, { state: makeState() });

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
