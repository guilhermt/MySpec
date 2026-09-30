import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { paintOf, resolve, setTheme, THEMES, token } from "@/test/painted";
import { GonePage } from "./GonePage";
import { ICONS } from "./icons";

function subject() {
  render(
    <GonePage
      icon={ICONS.archive}
      title="acme/web#2291 was merged"
      description="jdoe merged it into main at 13:41."
      actions={[{ label: "Open in History", onClick: () => {} }]}
    />,
  );
}

describe.each(THEMES)("GonePage in the %s theme", (theme) => {
  it("writes the title in the first ink, semibold", () => {
    setTheme(theme);
    subject();
    const title = screen.getByText("acme/web#2291 was merged");
    expect(paintOf(title, { color: "" })).toEqual({ color: token("--ink-1") });
    expect(getComputedStyle(title).fontWeight).toBe("600");
  });

  it("writes the description in the body size and the second ink, within the reading measure", () => {
    setTheme(theme);
    subject();
    const description = screen.getByText("jdoe merged it into main at 13:41.");
    const want = { color: token("--ink-2"), fontSize: resolve("var(--text-body)", "font-size") };
    expect(paintOf(description, want)).toEqual(want);
    expect(getComputedStyle(description).maxWidth).toBe(
      resolve("var(--measure-read)", "max-width"),
    );
  });
});
