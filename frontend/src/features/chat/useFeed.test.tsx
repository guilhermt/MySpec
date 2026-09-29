import { fireEvent, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { useGlobalShortcuts } from "@/app/useGlobalShortcuts";
import { stepFeed, useFeed } from "@/features/chat/useFeed";
import { renderWithStore } from "@/test/render";

// Feed is a conversation of three entries: a speech, a group that opens with a command inside, and
// a card, with the composer after it.
function Feed({
  pending = false,
  composer = true,
  own = false,
}: {
  pending?: boolean;
  composer?: boolean;
  own?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFeed(ref);
  useGlobalShortcuts();
  return (
    <>
      <button type="button">Before</button>
      <div ref={ref} role="feed" aria-label="Conversation">
        <article data-feed-item tabIndex={-1} aria-label="Speech">
          <a href="#x">The PRD</a>
        </article>
        <Group />
        <article
          data-feed-item
          tabIndex={-1}
          aria-label="Card"
          {...(pending ? { "data-pending-card": "question" } : {})}
          {...(own ? { "data-feed-keys": "own" } : {})}
        />
      </div>
      {composer && <textarea id="composer-input" aria-label="Composer" />}
    </>
  );
}

function Group() {
  const ref = useRef(false);
  return (
    <article data-feed-item tabIndex={-1} aria-label="Group">
      <button
        type="button"
        data-feed-toggle
        aria-expanded="false"
        onClick={(event) => {
          ref.current = !ref.current;
          event.currentTarget.setAttribute("aria-expanded", String(ref.current));
          const inner = event.currentTarget.parentElement?.querySelector("[aria-label=Command]");
          inner?.toggleAttribute("hidden", !ref.current);
        }}
      >
        3 actions
      </button>
      <article data-feed-item tabIndex={-1} aria-label="Command" hidden />
    </article>
  );
}

const entry = (name: string) => screen.getByLabelText(name);

function key(target: Element, name: string) {
  fireEvent.keyDown(target, { key: name });
}

describe("useFeed", () => {
  it("is one stop of Tab, the last entry, arriving", async () => {
    const { user } = renderWithStore(<Feed />);

    await user.click(screen.getByLabelText("Composer"));
    await user.tab({ shift: true });

    expect(entry("Card")).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "3 actions" })).toHaveFocus();
    expect(entry("Group")).toHaveAttribute("tabindex", "0");
    expect(entry("Card")).toHaveAttribute("tabindex", "-1");
  });

  it("arrives at the pending card", () => {
    renderWithStore(<Feed pending />);

    expect(entry("Card")).toHaveAttribute("tabindex", "0");
    expect(entry("Speech")).toHaveAttribute("tabindex", "-1");
  });

  it("walks the entries with the arrows, Home and End, one stop at a time", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      value: scrollIntoView,
      configurable: true,
    });
    renderWithStore(<Feed />);
    entry("Card").focus();

    key(entry("Card"), "ArrowUp");
    expect(entry("Group")).toHaveFocus();
    expect(entry("Group")).toHaveAttribute("tabindex", "0");
    expect(entry("Card")).toHaveAttribute("tabindex", "-1");
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });

    key(entry("Group"), "Home");
    expect(entry("Speech")).toHaveFocus();
    key(entry("Speech"), "End");
    expect(entry("Card")).toHaveFocus();
    key(entry("Card"), "PageUp");
    expect(entry("Speech")).toHaveFocus();
    key(entry("Speech"), "PageDown");
    expect(entry("Card")).toHaveFocus();
  });

  it("leaves the keys to a control inside an entry", () => {
    renderWithStore(<Feed />);
    const link = screen.getByRole("link", { name: "The PRD" });
    link.focus();

    key(link, "ArrowDown");

    expect(link).toHaveFocus();
  });

  it("leaves the arrows to an entry that keeps its own, which hands over at its ends", () => {
    renderWithStore(<Feed own />);
    entry("Card").focus();

    key(entry("Card"), "ArrowUp");
    expect(entry("Card")).toHaveFocus();

    stepFeed(entry("Card"), 1);
    expect(entry("Card")).toHaveFocus();
    stepFeed(entry("Card"), -1);
    expect(entry("Group")).toHaveFocus();
    expect(entry("Group")).toHaveAttribute("tabindex", "0");
  });

  it("opens and folds an entry with → and ←, and goes from an inner entry to its own", () => {
    renderWithStore(<Feed />);
    const toggle = screen.getByRole("button", { name: "3 actions" });
    entry("Group").focus();

    key(entry("Group"), "ArrowRight");
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    key(entry("Group"), "ArrowDown");
    expect(entry("Command")).toHaveFocus();
    key(entry("Command"), "ArrowLeft");
    expect(entry("Group")).toHaveFocus();

    key(entry("Group"), "ArrowLeft");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    key(entry("Group"), "Enter");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("takes the focus to the composer on Esc", () => {
    renderWithStore(<Feed />);
    entry("Speech").focus();

    key(entry("Speech"), "Escape");

    expect(screen.getByLabelText("Composer")).toHaveFocus();
  });

  it("leaves the focus in the conversation on Esc without a composer", () => {
    renderWithStore(<Feed composer={false} />);
    entry("Speech").focus();

    key(entry("Speech"), "Escape");

    expect(entry("Speech")).toHaveFocus();
  });
});
