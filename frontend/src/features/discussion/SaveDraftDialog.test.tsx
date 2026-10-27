import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SaveDraftDialog } from "@/features/discussion/SaveDraftDialog";
import { renderWithStore } from "@/test/render";

function subject(props: Partial<Parameters<typeof SaveDraftDialog>[0]> = {}) {
  const handlers = {
    onKeep: vi.fn(),
    onDiscard: vi.fn(() => Promise.resolve()),
    onSave: vi.fn(() => Promise.resolve()),
  };
  const view = renderWithStore(
    <SaveDraftDialog open resumed={false} saveReason={null} {...handlers} {...props} />,
  );
  return { ...view, ...handlers };
}

describe("SaveDraftDialog", () => {
  it("says what you wrote is lost, or that Discard deletes the draft it was resumed from", () => {
    const { unmount } = subject();
    expect(screen.getByText("What you wrote is lost unless you save it.")).toBeInTheDocument();
    unmount();

    subject({ resumed: true });
    expect(screen.getByText("Discard deletes this draft.")).toBeInTheDocument();
  });

  it("opens on Keep editing, which keeps the form", async () => {
    const { user, onKeep } = subject();

    await waitFor(() => expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus());
    await user.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(onKeep).toHaveBeenCalled();
  });

  it("discards and saves with their buttons", async () => {
    const { user, onDiscard, onSave } = subject();

    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(onDiscard).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: /Save draft/ }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("shows the failure of an action", async () => {
    const { user } = subject({ onSave: vi.fn(() => Promise.reject(new Error("disk full"))) });

    await user.click(screen.getByRole("button", { name: /Save draft/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("disk full");
  });

  it("holds Save draft back with its reason", async () => {
    const { user, onSave } = subject({
      saveReason: "Write a title or what to discuss to save a draft.",
    });

    const save = screen.getByRole("button", { name: /Save draft/ });
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByText("Write a title or what to discuss to save a draft."),
    ).toBeInTheDocument();
    await user.click(save);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves on Ctrl+Enter", async () => {
    const { user, onSave } = subject();
    await waitFor(() => expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus());

    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(onSave).toHaveBeenCalledOnce();
  });

  it("forgets a failure once Keep editing closes it", async () => {
    const { user, rerender, ...handlers } = subject({
      onSave: vi.fn(() => Promise.reject(new Error("disk full"))),
    });
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("disk full");

    await user.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(handlers.onKeep).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
