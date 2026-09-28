import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { paintOf, setTheme, THEMES, token } from "@/test/painted";
import { RelationList } from "./RelationList";

function relations() {
  render(
    <RelationList
      onOpen={() => {}}
      groups={[
        {
          label: "Dependencies",
          items: [
            {
              key: "dep",
              number: "#398",
              title: "Key store",
              meta: "open",
              url: "https://github.com/acme/api/issues/398",
              warning: "Not satisfied",
            },
          ],
        },
      ]}
    />,
  );
}

describe.each(THEMES)("RelationList in the %s theme", (theme) => {
  it("titles a group in capitals in the third ink", () => {
    setTheme(theme);
    relations();
    const title = screen.getByRole("heading", { name: "Dependencies" });
    expect(paintOf(title, { color: "" })).toEqual({ color: token("--ink-3") });
    expect(getComputedStyle(title).textTransform).toBe("uppercase");
  });

  it("writes the relation as a link in the brand ink", () => {
    setTheme(theme);
    relations();
    expect(paintOf(screen.getByRole("link"), { color: "" })).toEqual({
      color: token("--brand-ink"),
    });
  });

  it("writes the meta in the third ink and the warning in the notice color", () => {
    setTheme(theme);
    relations();
    expect(paintOf(screen.getByText("open"), { color: "" })).toEqual({ color: token("--ink-3") });
    expect(paintOf(screen.getByText("Not satisfied"), { color: "" })).toEqual({
      color: token("--state-notice"),
    });
  });
});
