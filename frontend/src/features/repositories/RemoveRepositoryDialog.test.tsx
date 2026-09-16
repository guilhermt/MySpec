import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RemoveRepositoryDialog } from "@/features/repositories/RemoveRepositoryDialog";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeRepository, makeState } from "@/test/wails-mock";

function dialog() {
  const onOpenChange = vi.fn();
  const rendered = renderWithStore(
    <RemoveRepositoryDialog repository={makeRepository()} open onOpenChange={onOpenChange} />,
    { state: makeState() },
  );
  return { ...rendered, onOpenChange };
}

describe("RemoveRepositoryDialog", () => {
  it("says what removing does, and what it leaves alone", () => {
    dialog();

    expect(screen.getByText("Remove dev/web?")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The repository leaves MySpec. Nothing is deleted on disk: the clone stays where it is.",
      ),
    ).toBeInTheDocument();
  });

  it("removes the repository and closes", async () => {
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(api.removeRepository).toHaveBeenCalledWith("repo-1");
    expect(onOpenChange.mock.calls.at(-1)?.[0]).toBe(false);
  });

  it("leaves the repository alone on Cancel", async () => {
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.removeRepository).not.toHaveBeenCalled();
    expect(onOpenChange.mock.calls.at(-1)?.[0]).toBe(false);
  });
});
