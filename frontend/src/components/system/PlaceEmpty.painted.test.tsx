import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { PlaceEmpty } from "./PlaceEmpty";

describe.each(THEMES)("PlaceEmpty in the %s theme", (theme) => {
  it("writes the title in the title size at 600 in the first ink, the body in the third", () => {
    setTheme(theme);
    render(
      <PlaceEmpty title="No steps were found">
        <p>The plan has no step files.</p>
      </PlaceEmpty>,
    );
    const title = screen.getByText("No steps were found");
    expect(paintOf(title, { color: "" })).toEqual({ color: token("--ink-1") });
    expect(getComputedStyle(title).fontSize).toBe(resolve("var(--text-title)", "font-size"));
    expect(getComputedStyle(title).fontWeight).toBe("600");
    const body = screen.getByText("The plan has no step files.");
    expect(paintOf(body, { color: "" })).toEqual({ color: token("--ink-3") });
    expect(getComputedStyle(body).maxWidth).toBe(resolve("var(--measure-read)", "max-width"));
  });

  it("stands two --space-16 below the top of the column", () => {
    setTheme(theme);
    render(<PlaceEmpty title="No steps were found" />);
    expect(getComputedStyle(screen.getByRole("status")).paddingTop).toBe(
      resolve("calc(var(--space-16) * 2)", "padding-top"),
    );
  });
});
