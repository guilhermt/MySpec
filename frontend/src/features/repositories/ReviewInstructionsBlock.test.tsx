import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReviewInstructionsBlock } from "@/features/repositories/ReviewInstructionsBlock";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeRepository, makeState } from "@/test/wails-mock";

function block(reviewInstructions = "") {
  const onClose = vi.fn();
  const onParentKey = vi.fn();
  const rendered = renderWithStore(
    // biome-ignore lint/a11y/noStaticElementInteractions: the test listens for the key that reaches the parent
    <div onKeyDown={onParentKey}>
      <ReviewInstructionsBlock
        repository={makeRepository({ reviewInstructions })}
        onClose={onClose}
      />
    </div>,
    { state: makeState() },
  );
  return { ...rendered, onClose, onParentKey };
}

const FIELD = "Review instructions";

describe("ReviewInstructionsBlock", () => {
  it("opens with the saved text and the focus at its end", () => {
    block("Look at the migrations.");

    const field = screen.getByRole("textbox", { name: FIELD }) as HTMLTextAreaElement;
    expect(field).toHaveValue("Look at the migrations.");
    expect(field).toHaveFocus();
    expect(field.selectionStart).toBe("Look at the migrations.".length);
    expect(field).toHaveAttribute("rows", "5");
    expect(
      screen.getByText(
        "Added to every pull request review of dev/web, the reviews of task pull requests included. A change applies from the next pass.",
      ),
    ).toBeInTheDocument();
  });

  it("holds Save until something changes", async () => {
    const { user } = block();
    const save = screen.getByRole("button", { name: "Save" });

    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toHaveAccessibleDescription("Nothing changed yet.");

    await user.type(screen.getByRole("textbox", { name: FIELD }), "Look at the tests.");

    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-disabled", "false");
  });

  it("saves the change and closes", async () => {
    const { user, onClose } = block();

    await user.type(screen.getByRole("textbox", { name: FIELD }), "Look at the tests.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(api.setReviewInstructions).toHaveBeenCalledWith("repo-1", "Look at the tests.");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("drops the text on Cancel", async () => {
    const { user, onClose } = block();

    await user.type(screen.getByRole("textbox", { name: FIELD }), "Look at the tests.");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.setReviewInstructions).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("cancels on Esc and marks the key so Settings stays open", async () => {
    const { user, onClose, onParentKey } = block();

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
    expect(onParentKey.mock.calls[0]?.[0].defaultPrevented).toBe(true);
  });

  it("keeps what was typed and shows the refusal in the block, with Save to repeat", async () => {
    vi.mocked(api.setReviewInstructions).mockRejectedValueOnce(new Error("Couldn't save."));
    const { user, onClose } = block();

    await user.type(screen.getByRole("textbox", { name: FIELD }), "Look at the tests.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save.");
    expect(screen.getByRole("textbox", { name: FIELD })).toHaveValue("Look at the tests.");
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(api.setReviewInstructions).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
