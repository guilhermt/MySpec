import { screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { SearchInput, type SearchInputProps } from "./SearchInput";

function Subject(props: Partial<SearchInputProps>) {
  const [value, setValue] = useState("");
  return (
    <SearchInput
      label="Search tasks"
      placeholder="Search"
      value={value}
      onValueChange={setValue}
      {...props}
    />
  );
}

describe("SearchInput", () => {
  it("is a search landmark with a named searchbox", () => {
    renderWithStore(<Subject />);
    const search = screen.getByRole("search");
    expect(within(search).getByRole("searchbox", { name: "Search tasks" })).toBeInTheDocument();
    expect(within(search).getByText("/")).toBeInTheDocument();
  });

  it("reports what is typed", async () => {
    const onValueChange = vi.fn();
    const { user } = renderWithStore(<Subject value="" onValueChange={onValueChange} />);
    await user.type(screen.getByRole("searchbox", { name: "Search tasks" }), "a");
    expect(onValueChange).toHaveBeenCalledWith("a");
  });

  it("clears with Clear search and keeps the focus", async () => {
    const { user } = renderWithStore(<Subject />);
    const box = screen.getByRole("searchbox", { name: "Search tasks" });
    await user.type(box, "auth");
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(box).toHaveValue("");
    expect(box).toHaveFocus();
  });

  it("calls the handlers of Escape and ArrowDown", async () => {
    const onEscape = vi.fn();
    const onArrowDown = vi.fn();
    const { user } = renderWithStore(<Subject onEscape={onEscape} onArrowDown={onArrowDown} />);
    await user.click(screen.getByRole("searchbox", { name: "Search tasks" }));
    await user.keyboard("{Escape}{ArrowDown}");
    expect(onEscape).toHaveBeenCalledOnce();
    expect(onArrowDown).toHaveBeenCalledOnce();
  });

  it("has the hover and the focus of the system", async () => {
    const { user } = renderWithStore(<Subject />);
    await user.tab();
    expect(screen.getByRole("searchbox", { name: "Search tasks" })).toHaveFocus();
    expect(screen.getByRole("search")).toHaveClass(
      "hover:border-ink-3",
      "focus-within:field-focus",
    );
  });
});
