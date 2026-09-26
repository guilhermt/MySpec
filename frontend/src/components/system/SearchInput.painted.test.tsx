import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { SearchInput } from "./SearchInput";

function Subject() {
  return (
    <SearchInput label="Search tasks" placeholder="Search" value="" onValueChange={() => {}} />
  );
}

describe.each(THEMES)("SearchInput in the %s theme", (theme) => {
  it("rests on the input surface with the control line", () => {
    setTheme(theme);
    render(<Subject />);
    const want = {
      background: token("--surface-input"),
      border: token("--line-3"),
      height: "28px",
    };
    expect(paintOf(screen.getByRole("search"), want)).toEqual(want);
  });

  it("darkens its line on hover", async () => {
    setTheme(theme);
    render(<Subject />);
    await userEvent.hover(screen.getByRole("searchbox", { name: "Search tasks" }));
    expect(paintOf(screen.getByRole("search"), { border: "" })).toEqual({
      border: token("--ink-3"),
    });
  });

  it("shows focus on the whole box, with the halo", async () => {
    setTheme(theme);
    render(<Subject />);
    await userEvent.click(screen.getByRole("searchbox", { name: "Search tasks" }));
    const want = {
      border: token("--focus"),
      shadow: resolve("0 0 0 var(--halo) var(--focus-halo)", "box-shadow"),
    };
    expect(paintOf(screen.getByRole("search"), want)).toEqual(want);
  });
});
