import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { ScrollArea } from "./ScrollArea";

describe("ScrollArea", () => {
  it("renders its content", () => {
    renderWithStore(<ScrollArea>The transcript</ScrollArea>);
    expect(screen.getByText("The transcript")).toBeInTheDocument();
  });

  it("names its viewport with the label", () => {
    renderWithStore(<ScrollArea label="Conversation">The transcript</ScrollArea>);
    expect(screen.getByLabelText("Conversation")).toHaveClass(
      "focus-visible:-outline-offset-(length:--focus-width)",
    );
  });

  it("draws the thumb of the system", async () => {
    // jsdom lays nothing out: the content is made taller than the viewport.
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
    const { container } = renderWithStore(<ScrollArea>The transcript</ScrollArea>);
    fireEvent.scroll(screen.getByText("The transcript"));
    const thumb = await vi.waitFor(() => {
      const found = container.querySelector('[data-orientation="vertical"] > div');
      if (found === null) throw new Error("no thumb");
      return found;
    });
    vi.restoreAllMocks();
    expect(thumb).toHaveClass("bg-line-2", "hover:bg-line-3");
  });
});
