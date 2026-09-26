import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { paintOf, resolve, setTheme, THEMES, TRANSPARENT, token } from "@/test/painted";
import { Listbox, type ListboxProps } from "./Listbox";

const ITEMS = [
  { value: "main", label: "main" },
  { value: "develop", label: "develop" },
];

function Subject(props: Partial<ListboxProps>) {
  return (
    <Listbox
      label="Base branch"
      value="main"
      items={ITEMS}
      onValueChange={() => {}}
      searchLabel="Search branches"
      emptyText="No branch matches"
      {...props}
    />
  );
}

describe.each(THEMES)("Listbox in the %s theme", (theme) => {
  it("has the anatomy of the input", () => {
    setTheme(theme);
    render(<Subject />);
    const want = {
      background: token("--surface-input"),
      color: token("--ink-1"),
      border: token("--line-3"),
      borderStyle: "solid",
    };
    expect(paintOf(screen.getByRole("combobox", { name: "Base branch: main" }), want)).toEqual(
      want,
    );
  });

  it("shows focus on its border, with the halo", async () => {
    setTheme(theme);
    render(<Subject />);
    await userEvent.tab();
    const want = {
      border: token("--focus"),
      shadow: resolve("0 0 0 var(--halo) var(--focus-halo)", "box-shadow"),
    };
    expect(paintOf(screen.getByRole("combobox", { name: "Base branch: main" }), want)).toEqual(
      want,
    );
  });

  it("highlights the item under the pointer with the veil", async () => {
    setTheme(theme);
    render(<Subject />);
    await userEvent.click(screen.getByRole("combobox", { name: "Base branch: main" }));
    const item = await screen.findByRole("option", { name: "develop" });
    await userEvent.hover(item);
    expect(paintOf(item, { background: "" })).toEqual({ background: token("--veil-hover") });
  });

  it("is dashed when disabled, also under the pointer", async () => {
    setTheme(theme);
    render(<Subject disabled disabledReason="The session is running" />);
    const trigger = screen.getByRole("combobox", { name: "Base branch: main" });
    await userEvent.hover(trigger);
    const want = {
      background: TRANSPARENT,
      color: token("--ink-4"),
      border: token("--line-3"),
      borderStyle: "dashed",
    };
    expect(paintOf(trigger, want)).toEqual(want);
  });

  it("shimmers the saved choice while the catalog is read", () => {
    setTheme(theme);
    render(<Subject loading />);
    const choice = within(screen.getByRole("combobox", { name: "Base branch: main" })).getByText(
      "main",
    );
    expect(getComputedStyle(choice).animationName).toBe("shimmer");
    expect(paintOf(choice, { color: "" })).toEqual({ color: TRANSPARENT });
  });
});
