import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon } from "./Icon";
import { DiscussionIcon, MarkIcon, OneShotIcon, ReviewIcon, TaskIcon } from "./type-icons";

describe("type icons", () => {
  it.each([
    ["TaskIcon", TaskIcon],
    ["OneShotIcon", OneShotIcon],
    ["ReviewIcon", ReviewIcon],
    ["DiscussionIcon", DiscussionIcon],
    ["MarkIcon", MarkIcon],
  ])("renders %s hidden from assistive technology", (_, glyph) => {
    const { container } = render(<Icon icon={glyph} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("viewBox", "0 0 16 16");
  });
});
