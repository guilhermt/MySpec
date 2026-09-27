import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShellToasts } from "@/features/notice/ShellToasts";
import { useAppStore } from "@/store/app-store";
import { renderWithStore } from "@/test/render";

describe("ShellToasts", () => {
  it("says what the store announces", () => {
    renderWithStore(<ShellToasts />);

    act(() => useAppStore.getState().announce("Nothing else needs you now."));

    expect(screen.getByRole("status")).toHaveTextContent("Nothing else needs you now.");
  });

  it("says nothing before an announcement", () => {
    renderWithStore(<ShellToasts />);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
