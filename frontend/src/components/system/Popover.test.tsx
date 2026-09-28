import { screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { layerOpen } from "@/lib/layers";
import { renderWithStore } from "@/test/render";
import { Popover } from "./Popover";

// Subject opens the popover from a button that is not its trigger, like the ⋯ whose menu already
// closed, and returns the focus to it or to another element.
function Subject({ returnElsewhere = false }: { returnElsewhere?: boolean }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const other = useRef<HTMLButtonElement>(null);
  const choice = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" ref={anchor} onClick={() => setOpen(true)}>
        More
      </button>
      <button type="button" ref={other}>
        Review mode chip
      </button>
      <Popover
        open={open}
        onOpenChange={setOpen}
        anchor={anchor}
        initialFocus={choice}
        {...(returnElsewhere ? { finalFocus: other } : {})}
        title="Review mode"
      >
        <button type="button">Agent</button>
        <button type="button" ref={choice}>
          Manual
        </button>
      </Popover>
    </>
  );
}

describe("Popover", () => {
  it("is closed until its owner opens it", () => {
    renderWithStore(<Subject />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is a dialog named by its visible title", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.click(screen.getByRole("button", { name: "More" }));
    const popover = await screen.findByRole("dialog", { name: "Review mode" });
    expect(popover).toHaveTextContent("Review mode");
  });

  it("gives the focus to initialFocus on open", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.click(screen.getByRole("button", { name: "More" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Manual" })).toHaveFocus());
  });

  it("closes on Escape and returns the focus to the anchor", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.click(screen.getByRole("button", { name: "More" }));
    await screen.findByRole("dialog", { name: "Review mode" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: "More" })).toHaveFocus();
  });

  it("returns the focus to finalFocus when given", async () => {
    const { user } = renderWithStore(<Subject returnElsewhere />);
    await user.click(screen.getByRole("button", { name: "More" }));
    await screen.findByRole("dialog", { name: "Review mode" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: "Review mode chip" })).toHaveFocus();
  });

  it("counts as a layer Esc closes first while open", async () => {
    const { user } = renderWithStore(<Subject />);
    expect(layerOpen()).toBe(false);
    await user.click(screen.getByRole("button", { name: "More" }));
    await screen.findByRole("dialog", { name: "Review mode" });
    expect(layerOpen()).toBe(true);
  });
});
