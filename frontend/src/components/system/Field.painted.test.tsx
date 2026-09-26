import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { Field } from "./Field";
import { Input } from "./Input";
import { SearchInput } from "./SearchInput";

describe.each(THEMES)("Field in the %s theme", (theme) => {
  it("writes the label in the second ink and the complement a space after it, quieter", () => {
    setTheme(theme);
    render(
      <Field label="Title" complement="optional">
        <Input />
      </Field>,
    );
    const complement = screen.getByText("optional");
    const label = complement.parentElement;
    expect(label).not.toBeNull();
    if (label === null) return;
    const want = {
      color: token("--ink-2"),
      fontSize: resolve("var(--text-meta)", "font-size"),
    };
    expect(paintOf(label, want)).toEqual(want);
    expect(paintOf(complement, { color: "" })).toEqual({ color: token("--ink-3") });
    // The complement follows the label after a space, not after the gap of the ui label.
    const range = document.createRange();
    const text = label.firstChild;
    if (text === null) return;
    range.selectNodeContents(text);
    const gap = complement.getBoundingClientRect().left - range.getBoundingClientRect().right;
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(6);
  });

  it("writes the help quiet and the error in the error ink, in the micro type", () => {
    setTheme(theme);
    render(
      <>
        <Field label="Title" help="Shown on the board">
          <Input />
        </Field>
        <Field label="Branch" error="Spaces aren't allowed">
          <Input />
        </Field>
      </>,
    );
    const help = {
      color: token("--ink-3"),
      fontSize: resolve("var(--text-micro)", "font-size"),
    };
    expect(paintOf(screen.getByText("Shown on the board"), help)).toEqual(help);
    expect(paintOf(screen.getByText("Spaces aren't allowed"), { color: "" })).toEqual({
      color: token("--state-error"),
    });
  });

  it("shows the gerund on the help line with the spinner in the current ink", () => {
    setTheme(theme);
    render(
      <Field label="Name" help="Where the work starts">
        <Input loading loadingLabel="Checking the name…" />
      </Field>,
    );
    const gerund = screen.getByText("Checking the name…");
    expect(paintOf(gerund, { color: "" })).toEqual({ color: token("--ink-3") });
    const spinner = gerund.querySelector('[data-tone="current"]');
    expect(spinner).not.toBeNull();
  });
});

/** Typing is a field outside a Field whose loading comes on with the first character typed. */
function Typing({ search }: { search: boolean }) {
  const [value, setValue] = useState("");
  const loading = value.length > 0;
  return search ? (
    <SearchInput
      label="Search tasks"
      placeholder="Search"
      value={value}
      onValueChange={setValue}
      loading={loading}
      loadingLabel="Searching…"
    />
  ) : (
    <Input
      aria-label="Search tasks"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      loading={loading}
      loadingLabel="Searching…"
    />
  );
}

describe("a field outside a Field", () => {
  it.each([
    ["the search", true],
    ["the input", false],
  ] as const)(
    "keeps the focus and what is typed in %s while its loading comes and goes",
    async (_, search) => {
      render(<Typing search={search} />);
      const box = screen.getByRole(search ? "searchbox" : "textbox", { name: "Search tasks" });
      await userEvent.click(box);
      await userEvent.keyboard("auth");
      expect(screen.getByText("Searching…")).toBeInTheDocument();
      const after = screen.getByRole(search ? "searchbox" : "textbox", { name: "Search tasks" });
      expect(after).toBe(box);
      expect(after).toHaveFocus();
      expect(after).toHaveValue("auth");
      await userEvent.keyboard("{Backspace>4/}");
      expect(screen.queryByText("Searching…")).not.toBeInTheDocument();
      expect(after).toHaveFocus();
      expect(after).toHaveValue("");
    },
  );
});
