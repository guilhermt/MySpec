import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KEY_NOTICE_MS, KeyNotice, useKeyNotice } from "./KeyNotice";

const FIRST = { title: "No task from #412", reason: "#412 already has a task: 412-rate-limit." };
const SECOND = { title: "No task from #409", reason: "The issue is closed." };

function Subject() {
  const { notice, show, hide } = useKeyNotice();
  return (
    <>
      <div
        role="treeitem"
        aria-selected={false}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "s") show(event.currentTarget, FIRST);
          if (event.key === "c") show(event.currentTarget, SECOND);
        }}
      >
        Row
      </div>
      <KeyNotice notice={notice} onHide={hide} />
    </>
  );
}

async function press(key: string) {
  await act(async () => {
    await userEvent.keyboard(key);
  });
}

describe("KeyNotice", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  async function shown() {
    render(<Subject />);
    screen.getByRole("treeitem").focus();
    await press("s");
  }

  it("has its region on screen before the notice, and the notice arrives into it", async () => {
    render(<Subject />);
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();
    expect(status).toHaveAttribute("data-live-region");

    screen.getByRole("treeitem").focus();
    await press("s");

    expect(screen.getByRole("status")).toBe(status);
    expect(status).toHaveTextContent(`${FIRST.title} · ${FIRST.reason}`);
  });

  it("says what did not happen and why, as a status", async () => {
    await shown();
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(`${FIRST.title} · ${FIRST.reason}`);
  });

  it("does not take the focus from the row", async () => {
    await shown();
    await screen.findByRole("status");
    expect(screen.getByRole("treeitem")).toHaveFocus();
  });

  it("stays through the key that showed it", async () => {
    await shown();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("goes away after four seconds", async () => {
    await shown();
    await screen.findByRole("status");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(KEY_NOTICE_MS + 1);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("goes away on the next key", async () => {
    await shown();
    await screen.findByRole("status");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    await press("x");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("goes away on a click", async () => {
    await shown();
    await screen.findByRole("status");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    await act(async () => {
      await userEvent.click(document.body);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("gives its place to a new notice", async () => {
    await shown();
    await screen.findByRole("status");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    await press("c");
    expect(await screen.findByRole("status")).toHaveTextContent(SECOND.title);
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("is not a layer of the app", async () => {
    await shown();
    await screen.findByRole("status");
    expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
  });
});
