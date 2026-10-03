import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { CopyBlock } from "./CopyBlock";

describe("CopyBlock", () => {
  it("shows the label and the text as it is", () => {
    renderWithStore(<CopyBlock label="error" copyLabel="Copy the error" text={"line 1\nline 2"} />);
    expect(screen.getByText("error")).toBeInTheDocument();
    expect(screen.getByText(/line 1/).tagName).toBe("PRE");
  });

  it("copies the text with its button", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    const { user } = renderWithStore(
      <CopyBlock label="error" copyLabel="Copy the error" text="boom" />,
    );
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await user.click(screen.getByRole("button", { name: "Copy the error" }));
    expect(writeText).toHaveBeenCalledWith("boom");
  });
});
