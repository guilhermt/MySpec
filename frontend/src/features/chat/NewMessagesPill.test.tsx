import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewMessagesPill } from "@/features/chat/NewMessagesPill";
import { renderWithStore } from "@/test/render";

describe("NewMessagesPill", () => {
  it("centres itself on whole pixels, whatever its width", () => {
    renderWithStore(<NewMessagesPill onClick={vi.fn()} />);

    const pill = screen.getByRole("button", { name: "New messages" });
    expect(pill).toHaveClass("left-[round(50%,1px)]", "translate-x-[round(-50%,1px)]");
    expect(pill).not.toHaveClass("left-1/2");
    expect(pill).not.toHaveClass("-translate-x-1/2");
  });
});
