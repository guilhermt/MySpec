import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { paintOf, resolve, setTheme, THEMES, TRANSPARENT, token } from "@/test/painted";
import { SearchInput, type SearchInputProps } from "./SearchInput";

function Subject(props: Partial<SearchInputProps>) {
  return (
    <SearchInput
      label="Search tasks"
      placeholder="Search"
      value=""
      onValueChange={() => {}}
      {...props}
    />
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

  it("is dashed, without a body and in faint ink when disabled", async () => {
    setTheme(theme);
    render(<Subject disabled disabledReason="No cards yet" value="auth" />);
    await userEvent.hover(screen.getByRole("searchbox", { name: "Search tasks" }));
    const want = {
      background: TRANSPARENT,
      border: token("--line-3"),
      borderStyle: "dashed",
    };
    expect(paintOf(screen.getByRole("search"), want)).toEqual(want);
    expect(paintOf(screen.getByRole("searchbox", { name: "Search tasks" }), { color: "" })).toEqual(
      { color: token("--ink-4") },
    );
  });
});
