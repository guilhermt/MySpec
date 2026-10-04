import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
  dashedDisabled,
  focusRing,
  paintOf,
  resolve,
  setTheme,
  THEMES,
  token,
} from "@/test/painted";
import { ICONS } from "./icons";
import { BoardStartRow, type BoardStartRowProps, NoBoardRow, StartRow } from "./StartRow";

function draw(disabledReason?: string) {
  render(
    <StartRow
      icon={ICONS.review}
      label="Review a pull request"
      sub="4 pending in 3 repositories"
      {...(disabledReason !== undefined ? { disabledReason } : {})}
      onClick={() => {}}
    />,
  );
  return screen.getByRole("button");
}

describe.each(THEMES)("StartRow in the %s theme", (theme) => {
  it("is --size-control tall, with the label at 500 and the sub in the third ink", () => {
    setTheme(theme);
    const row = draw();
    expect(`${row.getBoundingClientRect().height}px`).toBe(
      resolve("var(--size-control)", "height"),
    );
    expect(getComputedStyle(screen.getByText("Review a pull request")).fontWeight).toBe("500");
    expect(getComputedStyle(screen.getByText("4 pending in 3 repositories")).color).toBe(
      token("--ink-3"),
    );
  });

  it("steps up on hover and shows the focus ring", async () => {
    setTheme(theme);
    const row = draw();
    await userEvent.hover(row);
    const want = { background: token("--veil-hover") };
    expect(paintOf(row, want)).toEqual(want);
    await userEvent.tab();
    expect(paintOf(row, focusRing())).toEqual(focusRing());
  });

  it("is dashed when disabled, and has no hover", async () => {
    setTheme(theme);
    const row = draw("Add a repository first");
    const style = getComputedStyle(row);
    expect(style.outlineStyle).toBe("dashed");
    expect(style.outlineColor).toBe(dashedDisabled().border);
    await userEvent.hover(row);
    expect(getComputedStyle(row).backgroundColor).not.toBe(token("--veil-hover"));
  });

  it("indents the lines under a board to the text of its row", () => {
    setTheme(theme);
    render(
      <BoardStartRow
        line={{
          title: "Platform Roadmap",
          summary: "46 open cards · api",
          reading: {
            text: "Read failed 18m ago",
            tone: "failed",
            shimmer: false,
            failure: { failedAt: "2026-09-24T13:52:00Z", readAt: "2026-09-24T11:30:00Z" },
          },
          label: "Platform Roadmap, 46 open cards, read failed 18m ago",
          blockers: [{ kind: "read-failed", message: "gh: rate limited", reading: false }],
        }}
        now={Date.parse("2026-09-24T14:10:00Z")}
        onOpen={() => {}}
        onRetryRead={() => {}}
        onClone={() => {}}
        onChangePath={() => {}}
      />,
    );
    const label = screen.getByText("Platform Roadmap").getBoundingClientRect();
    const message = screen.getByText("gh: rate limited").getBoundingClientRect();
    expect(message.left).toBe(label.left);
    // The failure is neutral, never a situation.
    expect(getComputedStyle(screen.getByText("Read failed 18m ago")).color).toBe(token("--ink-2"));
  });

  it("tells the age of a failed reading at the size of the ages beside it", () => {
    setTheme(theme);
    const row = (title: string, reading: BoardStartRowProps["line"]["reading"]) => (
      <BoardStartRow
        line={{ title, summary: "46 open cards · api", reading, label: title, blockers: [] }}
        now={Date.parse("2026-09-24T14:10:00Z")}
        onOpen={() => {}}
        onRetryRead={() => {}}
        onClone={() => {}}
        onChangePath={() => {}}
      />
    );
    render(
      <>
        {row("Platform Roadmap", {
          text: "Read failed 18m ago",
          tone: "failed",
          shimmer: false,
          failure: { failedAt: "2026-09-24T13:52:00Z", readAt: "2026-09-24T11:30:00Z" },
        })}
        {row("Mobile", { text: "read 1d ago", tone: "quiet", shimmer: false })}
      </>,
    );
    const failed = getComputedStyle(screen.getByText("Read failed 18m ago")).fontSize;
    expect(failed).toBe(getComputedStyle(screen.getByText("read 1d ago")).fontSize);
    expect(failed).toBe(resolve("var(--text-meta)", "font-size"));
  });

  it("draws the line of the repositories without a board as a group, not a button", () => {
    setTheme(theme);
    render(
      <NoBoardRow names="docs, tools" blockers={[]} onClone={() => {}} onChangePath={() => {}} />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(getComputedStyle(screen.getByText("No board")).fontWeight).toBe("500");
  });
});
