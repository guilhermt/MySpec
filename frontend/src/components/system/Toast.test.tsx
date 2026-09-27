import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithStore } from "@/test/render";
import { ICONS } from "./icons";
import { TOAST_MS, Toast } from "./Toast";
import { ToastRegion } from "./ToastRegion";

function toast(onDismiss = vi.fn(), onClick = vi.fn()) {
  renderWithStore(
    <ToastRegion announcement={null}>
      <Toast
        icon={ICONS.archive}
        text="“add-login” was archived"
        action={{ label: "Open in History", onClick }}
        onDismiss={onDismiss}
      />
    </ToastRegion>,
  );
  return { onDismiss, onClick };
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says its text inside the live region, with no role of its own", () => {
    toast();

    const region = screen.getByRole("status");
    expect(region).toHaveTextContent("“add-login” was archived");
    expect(region.querySelector("[role]")).toBeNull();
  });

  it("runs its action and dismisses on ×", () => {
    const { onDismiss, onClick } = toast();

    fireEvent.click(screen.getByRole("button", { name: "Open in History" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("leaves once its time runs out", () => {
    const { onDismiss } = toast();

    act(() => vi.advanceTimersByTime(TOAST_MS - 1));
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("stays while it has the pointer, and goes on with the time left after", () => {
    const { onDismiss } = toast();
    const body = screen.getByText("“add-login” was archived").closest(".toast");
    if (body === null) throw new Error("no toast");

    act(() => vi.advanceTimersByTime(4_000));
    fireEvent.pointerEnter(body);
    act(() => vi.advanceTimersByTime(TOAST_MS));
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.pointerLeave(body);
    act(() => vi.advanceTimersByTime(TOAST_MS - 4_000));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("stays while it has the focus", () => {
    const { onDismiss } = toast();

    act(() => screen.getByRole("button", { name: "Open in History" }).focus());
    act(() => vi.advanceTimersByTime(TOAST_MS * 2));

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
