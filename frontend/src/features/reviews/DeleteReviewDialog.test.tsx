import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteReviewDialog } from "@/features/reviews/DeleteReviewDialog";
import { api } from "@/lib/wails";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";
import { makeLeftover, makeReviewSummary, makeState } from "@/test/wails-mock";

function dialog(props: { archived?: boolean; neighbor?: string | null } = {}) {
  const onOpenChange = vi.fn();
  const view = renderWithStore(
    <DeleteReviewDialog review={makeReviewSummary()} open onOpenChange={onOpenChange} {...props} />,
    { state: makeState() },
  );
  return { ...view, onOpenChange };
}

// pending is a deletion that ends when `finish` is called.
function pendingDeletion() {
  let finish: (error?: Error) => void = () => {};
  vi.mocked(api.deleteReview).mockImplementationOnce(
    () =>
      new Promise((resolve, reject) => {
        finish = (error) => (error === undefined ? resolve({ leftover: null }) : reject(error));
      }),
  );
  return (error?: Error) => finish(error);
}

describe("DeleteReviewDialog", () => {
  it("says what the deletion takes and what it leaves on GitHub", () => {
    dialog();

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Delete the review of web#31?" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/What was published on GitHub stays/)).toBeInTheDocument();
  });

  it("says what the deletion of an archived review takes and leaves", () => {
    dialog({ archived: true });

    expect(
      screen.getByRole("heading", { name: "Delete the review of web#31?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This removes the archived review and its reports from History. It can't be undone.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nothing changes on GitHub: what was published stays."),
    ).toBeInTheDocument();
  });

  it("opens on Cancel, not on the deletion", async () => {
    dialog();

    // The dialog moves the focus once it opens, after the button is drawn.
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
  });

  it("deletes the review, keeps what stayed on disk by its id and closes", async () => {
    const leftover = makeLeftover();
    vi.mocked(api.deleteReview).mockResolvedValueOnce({ leftover });
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Delete review" }));

    expect(api.deleteReview).toHaveBeenCalledWith("review-1");
    expect(useAppStore.getState().leftovers).toEqual({ "review-1": leftover });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("deletes an archived review and asks History for the focus on its neighbor", async () => {
    const { user, onOpenChange } = dialog({ archived: true, neighbor: "review-2" });

    await user.click(screen.getByRole("button", { name: "Delete review" }));

    expect(api.deleteReview).toHaveBeenCalledWith("review-1");
    expect(useAppStore.getState().historyFocus).toBe("review-2");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it.each([
    ["an active review", false],
    ["an archived review", true],
  ])(
    "waits for the end of the deletion of %s: Cancel and Esc do nothing meanwhile",
    async (_, archived) => {
      const finish = pendingDeletion();
      const { user, onOpenChange } = dialog({ archived });

      await user.click(screen.getByRole("button", { name: "Delete review" }));

      expect(screen.getByRole("button", { name: "Deleting…" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      await user.keyboard("{Escape}");
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();

      finish();

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    },
  );

  it("keeps a refusal in the footer, the dialog open and the confirmation back", async () => {
    vi.mocked(api.deleteReview).mockRejectedValueOnce(new Error("the database is locked"));
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Delete review" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't delete the review: the database is locked",
    );
    expect(screen.getByRole("button", { name: "Delete review" })).toBeEnabled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(useAppStore.getState().error).toBeNull();
  });

  it("doesn't confirm with Ctrl+Enter", async () => {
    const { user } = dialog();

    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(api.deleteReview).not.toHaveBeenCalled();
  });

  it("closes without deleting on Cancel", async () => {
    const { user, onOpenChange } = dialog();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.deleteReview).not.toHaveBeenCalled();
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
  });
});
