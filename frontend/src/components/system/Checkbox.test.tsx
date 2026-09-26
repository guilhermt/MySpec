import { screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { Checkbox } from "./Checkbox";

function Subject() {
  const [checked, setChecked] = useState(false);
  return (
    <Checkbox checked={checked} onCheckedChange={setChecked}>
      Include tests
    </Checkbox>
  );
}

describe("Checkbox", () => {
  it("is a checkbox named by its row", () => {
    renderWithStore(<Subject />);
    expect(screen.getByRole("checkbox", { name: "Include tests" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("toggles on click", async () => {
    const { user } = renderWithStore(<Subject />);
    const box = screen.getByRole("checkbox", { name: "Include tests" });
    await user.click(box);
    expect(box).toHaveAttribute("aria-checked", "true");
  });

  it("toggles on Space", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.tab();
    await user.keyboard(" ");
    expect(screen.getByRole("checkbox", { name: "Include tests" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("has the hover and the focus of the system", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.tab();
    const box = screen.getByRole("checkbox", { name: "Include tests" });
    expect(box).toHaveFocus();
    expect(box).toHaveClass("group/checkbox", "focus-visible:focus-ring");
    expect(box.querySelector('[aria-hidden="true"]')).toHaveClass(
      "group-hover/checkbox:border-ink-3",
    );
  });

  it("does not toggle while disabled and tells the reason", async () => {
    const onCheckedChange = vi.fn();
    const { user } = renderWithStore(
      <Checkbox
        checked={false}
        onCheckedChange={onCheckedChange}
        disabled
        disabledReason="Tests are required"
      >
        Include tests
      </Checkbox>,
    );
    const box = screen.getByRole("checkbox", { name: "Include tests" });
    expect(box).toHaveAttribute("aria-disabled", "true");
    expect(box).toHaveAccessibleDescription("Tests are required");
    expect(box).toHaveClass("text-ink-4");
    expect(box.querySelector('[aria-hidden="true"]')).not.toHaveClass(
      "group-hover/checkbox:border-ink-3",
      "group-active/checkbox:bg-brand-tint-press",
    );
    await user.click(box);
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(box).toHaveAttribute("aria-checked", "false");
  });

  it("is busy while loading", async () => {
    const onCheckedChange = vi.fn();
    const { user } = renderWithStore(
      <Checkbox checked={false} onCheckedChange={onCheckedChange} loading>
        Include tests
      </Checkbox>,
    );
    const box = screen.getByRole("checkbox", { name: "Include tests" });
    expect(box).toHaveAttribute("aria-busy", "true");
    await user.click(box);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
