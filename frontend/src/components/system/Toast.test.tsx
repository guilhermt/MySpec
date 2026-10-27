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

  it("runs its action and leaves after it", () => {
    const { onDismiss, onClick } = toast();

    fireEvent.click(screen.getByRole("button", { name: "Open in History" }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("leaves on ×", () => {
    const { onDismiss, onClick } = toast();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(onClick).not.toHaveBeenCalled();
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

  it("writes the detail under the text, and not without one", () => {
    renderWithStore(
      <ToastRegion announcement={null}>
        <Toast
          icon={ICONS.archive}
          text="“add-login” was archived"
          detail="Closed at 15:02"
          action={{ label: "Open in History", onClick: vi.fn() }}
          onDismiss={vi.fn()}
        />
      </ToastRegion>,
    );
    const text = screen.getByText("“add-login” was archived");
    expect(text.nextElementSibling).toHaveTextContent("Closed at 15:02");
    expect(screen.getByText("Closed at 15:02").nextElementSibling).toBe(
      screen.getByRole("button", { name: "Open in History" }),
    );
  });

  it("has no detail line without a detail", () => {
    toast();
    const text = screen.getByText("“add-login” was archived");
    expect(text.nextElementSibling).toBe(screen.getByRole("button", { name: "Open in History" }));
  });

  it("draws the error rail and the error ink on the error tone only", () => {
    const view = (tone?: "error") =>
      renderWithStore(
        <ToastRegion announcement={null}>
          <Toast
            icon={ICONS.problem}
            text="dev/api · Staging failed to deploy"
            {...(tone === undefined ? {} : { tone })}
            action={{ label: "Open in Deploys", onClick: vi.fn() }}
            onDismiss={vi.fn()}
          />
        </ToastRegion>,
      );

    const plain = view();
    const body = () => screen.getByText("dev/api · Staging failed to deploy").closest(".toast");
    expect(body()?.className).not.toContain("--error-rail");
    expect(body()?.querySelector("svg")?.getAttribute("class")).not.toContain("text-state-error");
    plain.unmount();

    view("error");
    expect(body()?.className).toContain("--error-rail");
    expect(body()?.querySelector("svg")?.getAttribute("class")).toContain("text-state-error");
  });
});
