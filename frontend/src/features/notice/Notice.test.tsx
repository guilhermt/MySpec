import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorNotice, Notice } from "@/features/notice/Notice";
import type { NoticeReason } from "@/lib/wails";
import { renderWithStore } from "@/test/render";

const PATH = "/home/dev/gone";

const MESSAGES: [NoticeReason, string][] = [
  ["not_found", "/home/dev/gone doesn't exist."],
  ["not_directory", "/home/dev/gone isn't a folder."],
  ["not_readable", "/home/dev/gone can't be read."],
  ["last_recent_missing", "Your last workspace, /home/dev/gone, is no longer on disk."],
];

describe("Notice", () => {
  it.each(MESSAGES)("explains %s", (reason, message) => {
    renderWithStore(<Notice path={PATH} reason={reason} onDismiss={vi.fn()} />);

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("Couldn't open folder");
    expect(banner).toHaveTextContent(message);
  });

  it("dismisses through the callback", async () => {
    const onDismiss = vi.fn();
    const { user } = renderWithStore(
      <Notice path={PATH} reason="not_found" onDismiss={onDismiss} />,
    );

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("shows a binding failure as an error", async () => {
    const onDismiss = vi.fn();
    const { user } = renderWithStore(<ErrorNotice message="open failed" onDismiss={onDismiss} />);

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("Something went wrong");
    expect(banner).toHaveTextContent("open failed");

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
