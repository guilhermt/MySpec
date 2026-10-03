import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkerLine } from "@/features/chat/entries/MarkerLine";
import type { MarkerView } from "@/features/chat/markers";
import { cutTexts, setTheme, THEMES, withoutTooltip } from "@/test/painted";
import { renderWithStore } from "@/test/render";

/** STOPPED is the line of a publication that stopped, with a list whose state is longer than its half. */
const STOPPED: MarkerView = {
  icon: "problem",
  text: "Publication stopped",
  complement: "round 1 · 3 published · Overage on the monthly invoice failed",
  tone: "error",
  timeHidden: false,
  body: {
    kind: "drafts",
    rows: [
      {
        key: "a",
        glyph: "error",
        prefix: "",
        title: "Overage on the monthly invoice",
        status:
          "acme/billing rejected the issue: the label Billing doesn't exist in the repository",
        tone: "error",
        link: null,
      },
    ],
  },
};

describe.each(THEMES)("MarkerLine in the %s theme", (theme) => {
  it("says in a tooltip the complement and the state of a row it cuts", async () => {
    setTheme(theme);
    const { container } = renderWithStore(
      <div style={{ width: "480px" }}>
        <MarkerLine view={STOPPED} createdAt="" />
      </div>,
    );
    // Opened without the pointer, which would rest on the complement it then hovers.
    act(() => screen.getByRole("button", { expanded: false }).click());
    const cut = cutTexts(container as HTMLElement).map((element) => element.textContent);

    expect(cut).toEqual(expect.arrayContaining([STOPPED.complement]));
    const list = within(container as HTMLElement).getByRole("list");
    expect(cutTexts(list).map((element) => element.textContent)).toContain(
      "acme/billing rejected the issue: the label Billing doesn't exist in the repository",
    );
    expect(await withoutTooltip(cutTexts(container as HTMLElement))).toEqual([]);
  });
});
