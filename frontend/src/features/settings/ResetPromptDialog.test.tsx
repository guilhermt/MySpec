import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResetPromptDialog } from "@/features/settings/ResetPromptDialog";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makePrompt, makeState } from "@/test/wails-mock";

function dialog() {
  const onOpenChange = vi.fn();
  const onReset = vi.fn();
  const rendered = renderWithStore(
    <ResetPromptDialog stage="prd" open onOpenChange={onOpenChange} onReset={onReset} />,
    { state: makeState() },
  );
  return { ...rendered, onOpenChange, onReset };
}

describe("ResetPromptDialog", () => {
  it("says what the reset does and opens on Cancel", async () => {
    dialog();

    expect(
      screen.getByRole("alertdialog", { name: "Reset the PRD prompt to the default?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your edits are replaced by the default of this version, and the prompt follows the default of new versions again.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("A session that is running keeps the prompt it started with."),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
  });

  it("resets the prompt, hands the default over and closes", async () => {
    const { user, onReset, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Reset prompt" }));

    expect(api.restorePrompt).toHaveBeenCalledWith("prd");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onReset).toHaveBeenCalledWith(makePrompt({ stage: "prd" }));
  });

  it("stays open with Resetting… while the call runs", async () => {
    vi.mocked(api.restorePrompt).mockReturnValue(new Promise(() => {}));
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Reset prompt" }));

    expect(await screen.findByRole("button", { name: "Resetting…" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("keeps the failure in the footer and lets the user try again", async () => {
    vi.mocked(api.restorePrompt).mockRejectedValueOnce(new Error("disk is full"));
    const { user, onReset, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Reset prompt" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("disk is full");
    expect(onReset).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Reset prompt" }));

    await waitFor(() => expect(onReset).toHaveBeenCalled());
  });
});
