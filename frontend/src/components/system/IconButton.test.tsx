import { screen } from "@testing-library/react";
import { Settings } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { IconButton } from "./IconButton";

describe("IconButton", () => {
  it("is named by its label", () => {
    renderWithStore(<IconButton label="Settings" icon={Settings} />);
    const button = screen.getByRole("button", { name: "Settings" });
    expect(button).toHaveClass("w-(--size-control)", "bg-transparent");
  });

  it("shows the name and the key in the tooltip on focus", async () => {
    const { user } = renderWithStore(
      <IconButton label="Settings" icon={Settings} shortcut="Ctrl ," />,
    );
    await user.tab();
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Settings");
    expect(tooltip).toHaveTextContent("Ctrl ,");
  });

  it("has the hover of the system", () => {
    renderWithStore(<IconButton label="Settings" icon={Settings} />);
    expect(screen.getByRole("button", { name: "Settings" })).toHaveClass(
      "not-aria-disabled:not-aria-pressed:hover:bg-veil-hover",
    );
  });

  it("takes the focus with the focus ring", async () => {
    const { user } = renderWithStore(<IconButton label="Settings" icon={Settings} />);
    await user.tab();
    const button = screen.getByRole("button", { name: "Settings" });
    expect(button).toHaveFocus();
    expect(button).toHaveClass("focus-visible:focus-ring");
  });

  it("tells the disabled reason in the description and the tooltip", async () => {
    const onClick = vi.fn();
    const { user } = renderWithStore(
      <IconButton
        label="Settings"
        icon={Settings}
        disabled
        disabledReason="A session is running"
        onClick={onClick}
      />,
    );
    const button = screen.getByRole("button", { name: "Settings" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("A session is running");
    expect(button).toHaveClass("aria-disabled:dashed-disabled");
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Settings · A session is running");
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is busy while loading and ignores the click", async () => {
    const onClick = vi.fn();
    const { user } = renderWithStore(
      <IconButton label="Refresh" icon={Settings} loading onClick={onClick} />,
    );
    const button = screen.getByRole("button", { name: "Refresh" });
    expect(button).toHaveAttribute("aria-busy", "true");
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
