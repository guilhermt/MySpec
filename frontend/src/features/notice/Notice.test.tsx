import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Banner } from "@/features/notice/Notice";
import { renderWithStore } from "@/test/render";

describe("Banner", () => {
  it("shows its title and its body, and a way out", async () => {
    const onDismiss = vi.fn();
    const { user } = renderWithStore(
      <Banner title="Couldn't read the document" onDismiss={onDismiss}>
        open failed
      </Banner>,
    );

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("Couldn't read the document");
    expect(banner).toHaveTextContent("open failed");

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
