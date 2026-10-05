import { act, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { AuxPanel, PanelLayout } from "@/components/system/AuxPanel";
import { Button } from "@/components/system/Button";
import { ICONS } from "@/components/system/icons";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/system/Menu";
import { Presence } from "@/components/system/Presence";
import { Shimmer } from "@/components/system/Shimmer";
import { SkeletonBar } from "@/components/system/Skeleton";
import { Spinner } from "@/components/system/Spinner";
import { Toast } from "@/components/system/Toast";
import { Tooltip } from "@/components/system/Tooltip";
import { BOARD_ID, measuredState } from "@/dev/measure-board";
import {
  measuredConversation,
  OPEN_STRETCHES,
  SESSION,
  STAGE,
  TASK_ID,
} from "@/dev/measure-conversation";
import { BoardView } from "@/features/board/BoardView";
import { EMPTY_FILTERS } from "@/features/board/board-view";
import { Conversation } from "@/features/chat/Conversation";
import { ShellToasts } from "@/features/notice/ShellToasts";
import { revealItem } from "@/lib/reveal";
import { boardViewKey } from "@/lib/ui-storage";
import { sessionKey } from "@/lib/wails";
import { type Toast as ToastEntry, useAppStore } from "@/store/app-store";
import { fromTranscript } from "@/store/transcript";
import { mainArea, resolve, settle, token } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { makeArchivedTask, makeState, makeTask } from "@/test/wails-mock";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/** ZERO is what a computed duration reads for a transition or an animation that takes no time. */
const ZERO = "0s";

// settledTransitions is the sheet of the painted suite that zeroes the transitions, which this test
// turns off: it reads what the real CSS does under each preference.
const settledTransitions = () => {
  const sheet = document.getElementById("settled-transitions");
  if (!(sheet instanceof HTMLStyleElement) || sheet.sheet === null) {
    throw new Error("the sheet that settles the transitions is not in the page");
  }
  return sheet.sheet;
};

beforeEach(() => {
  settledTransitions().disabled = true;
});

afterEach(async () => {
  settledTransitions().disabled = false;
  await commands.emulateReducedMotion("no-preference");
  vi.restoreAllMocks();
});

// durations are the animation and the transition durations an element computes to.
function durations(element: Element): string[] {
  const style = getComputedStyle(element);
  return [style.animationDuration, style.transitionDuration]
    .flatMap((list) => list.split(","))
    .map((value) => value.trim());
}

// token of a duration, in the notation a computed style gives it.
const duration = (name: `--duration-${string}`) => resolve(`var(${name})`, "animation-duration");

// zeroingRule is the rule of globals.css under prefers-reduced-motion: reduce that applies to every
// element, as the style sheets of the page hold it.
function zeroingRule(): CSSStyleRule | undefined {
  for (const sheet of document.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (
        !(rule instanceof CSSMediaRule) ||
        !rule.conditionText.includes("prefers-reduced-motion: reduce")
      ) {
        continue;
      }
      const found = [...rule.cssRules].find(
        (inner): inner is CSSStyleRule =>
          inner instanceof CSSStyleRule &&
          inner.selectorText.startsWith("*") &&
          inner.style.getPropertyValue("transition-duration") !== "",
      );
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}

describe("the global rule of reduced motion", () => {
  it("is the one that zeroes every transition and animation", () => {
    const rule = zeroingRule();

    expect(rule?.selectorText).toBe("*, ::before, ::after");
    for (const property of ["transition-duration", "animation-duration"]) {
      expect(rule?.style.getPropertyValue(property)).toBe("0ms");
      expect(rule?.style.getPropertyPriority(property)).toBe("important");
    }
  });
});

describe("with reduced motion", () => {
  beforeEach(async () => {
    await commands.emulateReducedMotion("reduce");
  });

  it("stops the spinner as a ring of three quarters", () => {
    render(<Spinner />);
    const style = getComputedStyle(document.querySelector("[data-tone]") as Element);

    expect(style.animationName).toBe("none");
    const arc = resolve("var(--state-work)");
    expect([style.borderTopColor, style.borderRightColor, style.borderLeftColor]).toEqual([
      arc,
      arc,
      arc,
    ]);
    expect(style.borderBottomColor).toBe(token("--state-work-track"));
  });

  it("stops the shimmer in its three forms", () => {
    render(
      <>
        <Shimmer>Reading the board…</Shimmer>
        <SkeletonBar className="w-40" />
        <div className="shimmer-track h-2 w-40" data-testid="track" />
      </>,
    );
    const forms = [
      screen.getByText("Reading the board…"),
      document.querySelector('[data-slot="skeleton"]') as Element,
      screen.getByTestId("track"),
    ];

    for (const form of forms) {
      expect(getComputedStyle(form).animationName).toBe("none");
    }
  });

  it("blinks neither a situation nor a card a reading brings", () => {
    render(
      <>
        <div className="situation-flash" data-flash="wait" data-testid="situation" />
        <div className="row-flash" data-testid="row" />
      </>,
    );

    for (const id of ["situation", "row"]) {
      expect(getComputedStyle(screen.getByTestId(id)).animationName).toBe("none");
    }
  });

  it("enters and leaves the auxiliary panel in no time, and Presence lets go at once", async () => {
    const Place = ({ open }: { open: boolean }) => (
      <PanelLayout
        panel={
          open && (
            <AuxPanel id="artifacts" title="Artifacts" onClose={() => undefined}>
              <p>The body</p>
            </AuxPanel>
          )
        }
      >
        <p>The reading column</p>
      </PanelLayout>
    );
    const { rerender } = render(<Place open />);
    const panel = screen.getByRole("complementary", { name: "Artifacts" });
    expect(durations(panel)).toEqual([ZERO, ZERO]);

    rerender(<Place open={false} />);

    expect(durations(panel).every((value) => value === ZERO)).toBe(true);
    await waitFor(() => expect(panel).not.toBeInTheDocument(), { timeout: 100 });
  });

  it("opens a menu and a tooltip in no time", async () => {
    render(
      <Menu>
        <Tooltip content="More actions">
          <MenuTrigger render={<Button />}>Actions</MenuTrigger>
        </Tooltip>
        <MenuContent>
          <MenuItem>Edit</MenuItem>
        </MenuContent>
      </Menu>,
    );

    await userEvent.hover(page.getByRole("button", { name: "Actions" }));
    const tooltip = await screen.findByRole("tooltip", {}, { timeout: 2000 });
    expect(durations(tooltip).every((value) => value === ZERO)).toBe(true);

    await userEvent.click(page.getByRole("button", { name: "Actions" }));
    const menu = await screen.findByRole("menu");
    expect(durations(menu).every((value) => value === ZERO)).toBe(true);
  });

  it("brings a toast in and takes it out in no time", async () => {
    const toast = (n: string): ToastEntry => ({
      id: `task-${n}`,
      kind: "task",
      task: makeArchivedTask({ id: `task-${n}`, name: n }),
    });
    renderWithStore(<ShellToasts />, { ui: { toasts: [toast("1")] } });
    const shown = screen.getByText("“1” was archived").closest(".toast");
    if (shown === null) throw new Error("the toast is not drawn");
    expect(durations(shown).every((value) => value === ZERO)).toBe(true);

    act(() => useAppStore.setState({ toasts: [] }));

    await waitFor(() => expect(screen.queryByText("“1” was archived")).not.toBeInTheDocument(), {
      timeout: 100,
    });
  });

  it("lets Presence go at once, with no exit to wait for", async () => {
    const Held = ({ on }: { on: boolean }) => <Presence>{on && <p>Held</p>}</Presence>;
    const { rerender } = render(<Held on />);
    const held = screen.getByText("Held");

    rerender(<Held on={false} />);

    await waitFor(() => expect(held).not.toBeInTheDocument(), { timeout: 100 });
  });

  it("scrolls the board, the conversation and a revealed item without smooth behaviour", async () => {
    const scrolls = [
      vi.spyOn(Element.prototype, "scrollTo"),
      vi.spyOn(Element.prototype, "scrollBy"),
      vi.spyOn(Element.prototype, "scrollIntoView"),
    ];

    // The board of 2,000 cards: End goes to the last row.
    localStorage.setItem(
      boardViewKey(BOARD_ID),
      JSON.stringify({ filters: EMPTY_FILTERS, collapsed: [] }),
    );
    const board = renderWithStore(
      <div style={{ ...mainArea(1134), height: "1080px", display: "flex" }}>
        <BoardView boardId={BOARD_ID} />
      </div>,
      { state: measuredState(), ui: { location: { kind: "board", id: BOARD_ID } } },
    );
    await settle();
    within(screen.getByRole("tree")).getAllByRole("treeitem")[1]?.focus();
    await board.user.keyboard("{End}");
    await vi.waitFor(() => {
      const last = document.activeElement;
      expect(last?.getAttribute("aria-posinset")).toBe(last?.getAttribute("aria-setsize"));
    });
    board.unmount();

    // The conversation of 1,500 entries: Home goes to the first one, End back to the last.
    const conversation = renderWithStore(
      <div style={{ ...mainArea(1134), height: "1080px", display: "flex" }}>
        <Conversation taskId={TASK_ID} stage={STAGE} session={SESSION} />
      </div>,
      {
        state: makeState({ tasks: [makeTask({ id: TASK_ID })] }),
        ui: {
          transcripts: {
            [sessionKey(TASK_ID, STAGE)]: fromTranscript({
              taskId: TASK_ID,
              sessionId: "measure",
              stage: STAGE,
              entries: measuredConversation(OPEN_STRETCHES),
              pending: [],
            }),
          },
        },
      },
    );
    await settle();
    await conversation.user.click(screen.getAllByRole("article").at(-1) as HTMLElement);
    await conversation.user.keyboard("{Home}");
    await conversation.user.keyboard("{End}");
    await settle();
    conversation.unmount();

    // An item revealed in a box that scrolls.
    render(
      <div style={{ height: "100px", overflowY: "auto" }}>
        <div style={{ height: "400px" }} />
        <p data-testid="item">The item</p>
        <div style={{ height: "400px" }} />
      </div>,
    );
    revealItem(screen.getByTestId("item"));

    const calls = scrolls.flatMap((spy) => spy.mock.calls as unknown[][]);
    expect(calls.length).toBeGreaterThan(0);
    const smooth = calls.filter(
      ([argument]) => (argument as ScrollToOptions)?.behavior === "smooth",
    );
    expect(smooth).toEqual([]);
  });
});

describe("without a preference", () => {
  beforeEach(async () => {
    await commands.emulateReducedMotion("no-preference");
  });

  it("loops the spinner at --duration-spin and the shimmer at --duration-shimmer", () => {
    render(
      <>
        <Spinner />
        <Shimmer>Reading the board…</Shimmer>
      </>,
    );
    const spinner = getComputedStyle(document.querySelector("[data-tone]") as Element);
    const shimmer = getComputedStyle(screen.getByText("Reading the board…"));

    expect(spinner.animationName).toBe("glyph-spin");
    expect(spinner.animationDuration).toBe(duration("--duration-spin"));
    expect(shimmer.animationName).toBe("shimmer");
    expect(shimmer.animationDuration).toBe(duration("--duration-shimmer"));
  });

  it("blinks a situation and a card at --duration-slow", () => {
    render(
      <>
        <div className="situation-flash" data-flash="wait" data-testid="situation" />
        <div className="row-flash" data-testid="row" />
      </>,
    );

    for (const id of ["situation", "row"]) {
      const style = getComputedStyle(screen.getByTestId(id));
      expect(style.animationName).toBe("situation-flash");
      expect(style.animationDuration).toBe(duration("--duration-slow"));
    }
  });

  it("enters the panel at --duration-base and leaves it at --duration-fast", async () => {
    const Place = ({ open }: { open: boolean }) => (
      <PanelLayout
        panel={
          open && (
            <AuxPanel id="artifacts" title="Artifacts" onClose={() => undefined}>
              <p>The body</p>
            </AuxPanel>
          )
        }
      >
        <p>The reading column</p>
      </PanelLayout>
    );
    const { rerender } = render(<Place open />);
    const panel = screen.getByRole("complementary", { name: "Artifacts" });
    expect(getComputedStyle(panel).animationDuration).toBe(duration("--duration-base"));

    rerender(<Place open={false} />);

    expect(getComputedStyle(panel).animationDuration).toBe(duration("--duration-fast"));
    await waitFor(() => expect(panel).not.toBeInTheDocument());
  });

  it("fades a tooltip in at --duration-fast and a menu at --duration-base", async () => {
    render(
      <Menu>
        <Tooltip content="More actions">
          <MenuTrigger render={<Button />}>Actions</MenuTrigger>
        </Tooltip>
        <MenuContent>
          <MenuItem>Edit</MenuItem>
        </MenuContent>
      </Menu>,
    );

    await userEvent.hover(page.getByRole("button", { name: "Actions" }));
    const tooltip = await screen.findByRole("tooltip", {}, { timeout: 2000 });
    expect(getComputedStyle(tooltip).transitionDuration).toBe(duration("--duration-fast"));

    await userEvent.click(page.getByRole("button", { name: "Actions" }));
    const menu = await screen.findByRole("menu");
    expect(durations(menu)).toContain(duration("--duration-base"));
  });

  it("brings a toast in at --duration-base and takes it out at --duration-fast", async () => {
    render(
      <Toast
        icon={ICONS.archive}
        text="“add-login” was archived"
        action={{ label: "Open in History", onClick: () => undefined }}
        onDismiss={() => undefined}
      />,
    );
    const toast = screen.getByText("“add-login” was archived").closest(".toast") as Element;
    expect(getComputedStyle(toast).animationDuration).toBe(duration("--duration-base"));

    screen.getByRole("button", { name: "Dismiss" }).click();

    await waitFor(() => {
      const leaving = document.querySelector(".toast[data-leaving]");
      if (leaving === null) throw new Error("the toast is leaving");
      expect(getComputedStyle(leaving).animationDuration).toBe(duration("--duration-fast"));
    });
  });
});
