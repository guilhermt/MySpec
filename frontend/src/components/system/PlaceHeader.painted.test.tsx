import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { mainArea, paintOf, setTheme, THEMES, token } from "@/test/painted";
import { PlaceHeader } from "./PlaceHeader";

// header draws the header inside a main area of a fixed width, the container its
// queries measure.
function header(width: number) {
  render(
    <div style={mainArea(width)}>
      <PlaceHeader
        back={null}
        forward={null}
        crumbs={[
          { label: "Platform Roadmap", onOpen: () => undefined },
          { label: "API hardening" },
        ]}
        title="Rotate API keys without downtime"
        titleRef={createRef()}
        backRef={createRef()}
        forwardRef={createRef()}
      />
    </div>,
  );
  return screen.getByRole("banner");
}

describe.each(THEMES)("PlaceHeader in the %s theme", (theme) => {
  it("is a band of --size-head over the first line", () => {
    setTheme(theme);
    const band = header(1700);
    expect(paintOf(band, { height: "" })).toEqual({ height: "48px" });
    const style = getComputedStyle(band);
    expect(style.borderBottomColor).toBe(token("--line-1"));
    expect(style.borderBottomWidth).toBe("1px");
  });

  it("writes the breadcrumb in the third ink, with the slashes in the decoration line", () => {
    setTheme(theme);
    header(1700);
    const want = { color: token("--ink-3"), fontSize: "13px" };
    expect(paintOf(screen.getByRole("button", { name: "Platform Roadmap" }), want)).toEqual(want);
    expect(paintOf(screen.getByText("API hardening"), want)).toEqual(want);
    for (const slash of screen.getAllByText("/")) {
      expect(paintOf(slash, { color: "" })).toEqual({ color: token("--line-deco") });
    }
  });

  it("titles the place in the body size, semibold, in the first ink", () => {
    setTheme(theme);
    header(1700);
    const title = screen.getByRole("heading", { level: 1 });
    expect(paintOf(title, { color: "", fontSize: "" })).toEqual({
      color: token("--ink-1"),
      fontSize: "15px",
    });
    expect(getComputedStyle(title).fontWeight).toBe("600");
  });

  it("shows the levels from 1660px of main area", () => {
    setTheme(theme);
    header(1700);
    expect(screen.getByRole("list")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /^Show the hidden levels/, hidden: true }),
    ).not.toBeVisible();
  });

  it("folds the levels into … below 1660px of main area", () => {
    setTheme(theme);
    header(1600);
    expect(screen.getByRole("list", { hidden: true })).not.toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Show the hidden levels: Platform Roadmap / API hardening",
      }),
    ).toBeVisible();
  });
});
