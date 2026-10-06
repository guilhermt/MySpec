import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShellToasts } from "@/features/notice/ShellToasts";
import { type Toast as ToastEntry, useAppStore } from "@/store/app-store";
import { resolve, setTheme, THEMES } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeArchivedTask } from "@/test/wails-mock";
import { AuxPanel, PanelLayout } from "./AuxPanel";
import { ICONS } from "./icons";
import { Presence } from "./Presence";
import { Toast } from "./Toast";

function Place({ open, looping = false }: { open: boolean; looping?: boolean }) {
  return (
    <PanelLayout
      panel={
        open && (
          <AuxPanel id="artifacts" title="Artifacts" onClose={() => undefined}>
            <p>The body</p>
            {/* A loop inside the panel, like the pulse of a working step or a skeleton. */}
            {looping && <span className="animate-pulse">Reading…</span>}
          </AuxPanel>
        )
      }
    >
      <p>The reading column</p>
    </PanelLayout>
  );
}

// exit reads the animation an element leaves by, as the style computes it.
function exit(element: Element) {
  const style = getComputedStyle(element);
  return {
    name: style.animationName,
    duration: style.animationDuration,
    easing: style.animationTimingFunction,
  };
}

// expected is how the panel and the toast leave: --duration-fast with the exit curve.
function expected(name: string) {
  return {
    name,
    duration: resolve("var(--duration-fast)", "animation-duration"),
    easing: resolve("var(--ease-exit)", "animation-timing-function"),
  };
}

describe.each(THEMES)("Exits in the %s theme", (theme) => {
  it("keeps a closed panel for its exit, then lets it go", async () => {
    setTheme(theme);
    const { rerender } = render(<Place open />);
    const panel = screen.getByRole("complementary", { name: "Artifacts" });

    rerender(<Place open={false} />);

    expect(panel).toBeInTheDocument();
    expect(exit(panel)).toEqual(expected("aux-panel-exit"));
    await waitFor(() => expect(panel).not.toBeInTheDocument());
  });

  it("lets a closed panel go even with a loop running inside it", async () => {
    setTheme(theme);
    const { rerender } = render(<Place open looping />);
    const panel = screen.getByRole("complementary", { name: "Artifacts" });

    rerender(<Place open={false} looping />);

    expect(panel).toBeInTheDocument();
    await waitFor(() => expect(panel).not.toBeInTheDocument());
  });

  it("does not wait on a loop of the element it holds", async () => {
    setTheme(theme);
    let gone = false;
    const Held = ({ on }: { on: boolean }) => (
      <Presence
        onGone={() => {
          gone = true;
        }}
      >
        {on && <p className="animate-pulse">Reading…</p>}
      </Presence>
    );
    const { rerender } = render(<Held on />);
    const held = screen.getByText("Reading…");

    rerender(<Held on={false} />);

    await waitFor(() => expect(held).not.toBeInTheDocument(), { timeout: 500 });
    expect(gone).toBe(true);
  });

  it("lets go at the end of an exit that never says it is over", async () => {
    setTheme(theme);
    const Held = ({ on }: { on: boolean }) => (
      <Presence>
        {on && (
          <p
            // The exit lasts 200ms and its finished promise never settles.
            ref={(element) => {
              if (element === null) return;
              const original = element.getAnimations.bind(element);
              element.getAnimations = () =>
                original().map((animation) =>
                  Object.defineProperty(animation, "finished", { value: new Promise(() => {}) }),
                );
            }}
            className="exits"
          >
            Held
          </p>
        )}
      </Presence>
    );
    const style = document.createElement("style");
    style.textContent =
      "[data-leaving] > .exits { animation: exits-out 200ms linear forwards; } @keyframes exits-out { to { opacity: 0; } }";
    document.head.append(style);
    try {
      const { rerender } = render(<Held on />);
      const held = screen.getByText("Held");

      rerender(<Held on={false} />);

      expect(held).toBeInTheDocument();
      await waitFor(() => expect(held).not.toBeInTheDocument(), { timeout: 2000 });
    } finally {
      style.remove();
    }
  });

  it("plays the exit of a toast before it tells it is gone", async () => {
    setTheme(theme);
    let gone = false;
    render(
      <Toast
        icon={ICONS.archive}
        text="“add-login” was archived"
        action={{ label: "Open in History", onClick: () => undefined }}
        onDismiss={() => {
          gone = true;
        }}
      />,
    );

    screen.getByRole("button", { name: "Dismiss" }).click();

    const toast = await waitFor(() => {
      const leaving = document.querySelector(".toast[data-leaving]");
      if (leaving === null) throw new Error("the toast is leaving");
      return leaving;
    });
    expect(gone).toBe(false);
    expect(exit(toast)).toEqual(expected("toast-exit"));
    await waitFor(() => expect(gone).toBe(true));
  });

  it("plays the exit of the oldest toast a fourth one pushes out", async () => {
    setTheme(theme);
    const toastOf = (n: string): ToastEntry => ({
      id: `task-${n}`,
      kind: "task",
      task: makeArchivedTask({ id: `task-${n}`, name: n }),
    });
    const toasts = ["1", "2", "3"].map(toastOf);
    renderWithStore(<ShellToasts />, { ui: { toasts } });
    const oldest = screen.getByText("“1” was archived").closest(".toast");
    if (oldest === null) throw new Error("the oldest toast");

    act(() =>
      useAppStore.setState({
        toasts: [...toasts.slice(1), toastOf("4")],
      }),
    );

    const leaving = screen.getByText("“1” was archived").closest(".toast");
    if (leaving === null) throw new Error("the oldest toast, leaving");
    expect(leaving.parentElement).toHaveAttribute("data-leaving");
    expect(exit(leaving)).toEqual(expected("toast-exit"));
    await waitFor(() => expect(screen.queryByText("“1” was archived")).not.toBeInTheDocument());
  });
});
