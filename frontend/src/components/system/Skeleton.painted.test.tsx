import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { resolve, setTheme, THEMES } from "@/test/painted";
import { Skeleton, SkeletonBar } from "./Skeleton";

describe.each(THEMES)("Skeleton in the %s theme", (theme) => {
  it("shimmers its bars from the sunken surface, not with the pulse of the primitive", () => {
    setTheme(theme);
    render(
      <Skeleton label="Reading the board…">
        <SkeletonBar className="w-1/2" />
      </Skeleton>,
    );
    const bar = screen.getByRole("group", { name: "Reading the board…" }).firstElementChild;
    expect(bar).not.toBeNull();
    if (bar === null) return;
    const style = getComputedStyle(bar);
    expect(style.animationName).toBe("shimmer");
    expect(style.backgroundImage).toBe(
      resolve(
        "linear-gradient(90deg, var(--surface-0) 40%, var(--line-1) 50%, var(--surface-0) 60%)",
        "background-image",
      ),
    );
  });
});
