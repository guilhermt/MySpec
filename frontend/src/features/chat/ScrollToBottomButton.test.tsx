import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScrollToBottomButton } from "@/features/chat/ScrollToBottomButton";
import { renderWithStore } from "@/test/render";

describe("ScrollToBottomButton", () => {
  it("centres itself on whole pixels, whatever its width", () => {
    renderWithStore(<ScrollToBottomButton hasNew onClick={vi.fn()} />);

    const button = screen.getByRole("button", { name: "New messages" });
    expect(button).toHaveClass("left-[round(50%,1px)]", "translate-x-[round(-50%,1px)]");
    expect(button).not.toHaveClass("left-1/2");
    expect(button).not.toHaveClass("-translate-x-1/2");
  });

  it("is just an arrow when nothing new arrived", () => {
    renderWithStore(<ScrollToBottomButton hasNew={false} onClick={vi.fn()} />);

    const button = screen.getByRole("button", { name: "Scroll to bottom" });
    expect(screen.queryByText("New messages")).not.toBeInTheDocument();
    expect(button).toHaveClass("left-[round(50%,1px)]", "translate-x-[round(-50%,1px)]");
    expect(button).not.toHaveClass("left-1/2");
    expect(button).not.toHaveClass("-translate-x-1/2");
  });
});
