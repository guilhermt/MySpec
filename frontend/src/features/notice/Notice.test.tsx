import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorNotice } from "@/features/notice/Notice";
import { renderWithStore } from "@/test/render";

describe("ErrorNotice", () => {
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
