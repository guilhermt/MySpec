import { act, fireEvent, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useGlobalShortcuts } from "@/app/useGlobalShortcuts";
import { stepFeed, useFeed } from "@/features/chat/useFeed";
import { renderWithStore } from "@/test/render";

// Feed is a conversation of three entries: a speech with a link, a group whose line opens a
// command with its output, and a card with a control, with the composer after it.
function Feed({
  pending = false,
  composer = true,
  own = false,
  innerStop = false,
}: {
  pending?: boolean;
  composer?: boolean;
  own?: boolean;
  innerStop?: boolean;
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
          {...(innerStop ? { "data-feed-stop": "inner" } : {})}
        >
          <button type="button">Allow</button>
        </article>
      </div>
      {composer && <textarea id="composer-input" aria-label="Composer" />}
    </>
  );
}

// Group is an entry whose line is its stop: the line opens the command, whose output has a control.
function Group() {
  const [open, setOpen] = useState(false);
  return (
    <article data-feed-entry aria-label="Group">
      <button
        type="button"
        data-feed-item
        data-feed-toggle
        tabIndex={-1}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        3 actions
      </button>
      <ul hidden={!open}>
        <li data-feed-entry>
          <button type="button" data-feed-item tabIndex={-1} aria-label="Command">
            go test
          </button>
          <button type="button">Show all</button>
        </li>
      </ul>
    </article>
  );
}

const entry = (name: string) => screen.getByLabelText(name);
const group = () => screen.getByRole("button", { name: "3 actions" });
const control = (name: string) => screen.getByRole("button", { name, hidden: true });

function key(target: Element, name: string) {
  fireEvent.keyDown(target, { key: name });
}

// synced waits for the feed to see what changed in it.
const synced = () => act(() => Promise.resolve());

describe("useFeed", () => {
  it("is one stop of Tab, the last entry, arriving, and Tab leaves it after", async () => {
    const { user } = renderWithStore(<Feed />);

    await user.click(screen.getByLabelText("Composer"));
    await user.tab({ shift: true });
    expect(control("Allow")).toHaveFocus();
    await user.tab({ shift: true });
    expect(entry("Card")).toHaveFocus();

    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Before" })).toHaveFocus();

    await user.tab();
    expect(entry("Card")).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(screen.getByLabelText("Composer")).toHaveFocus();
  });

  it("goes by Tab through the controls of the current entry only, and then out", async () => {
    const { user } = renderWithStore(<Feed />);
    entry("Speech").focus();

    await user.tab();
    expect(screen.getByRole("link", { name: "The PRD" })).toHaveFocus();
    expect(entry("Speech")).toHaveAttribute("tabindex", "0");
    expect(control("Allow")).toHaveAttribute("tabindex", "-1");

    await user.tab();
    expect(screen.getByLabelText("Composer")).toHaveFocus();
  });

  it("gives an entry its controls back when it becomes the current one", async () => {
    const { user } = renderWithStore(<Feed />);
    entry("Speech").focus();
    expect(control("Allow")).toHaveAttribute("tabindex", "-1");

    key(entry("Speech"), "End");

    expect(entry("Card")).toHaveFocus();
    expect(control("Allow")).not.toHaveAttribute("tabindex");
    expect(screen.getByRole("link", { name: "The PRD" })).toHaveAttribute("tabindex", "-1");
    await user.tab();
    expect(control("Allow")).toHaveFocus();
  });

  it("keeps the controls of an inner entry for it, not for the entry around it", async () => {
    const { user } = renderWithStore(<Feed />);
    group().focus();
    key(group(), "ArrowRight");
    expect(control("Show all")).toHaveAttribute("tabindex", "-1");

    key(group(), "ArrowDown");

    expect(entry("Command")).toHaveFocus();
    expect(group()).toHaveAttribute("tabindex", "-1");
    await user.tab();
    expect(control("Show all")).toHaveFocus();
  });

  it("takes out of Tab what mounts in an entry that is not the current one, and what rewrites its tabindex", async () => {
    renderWithStore(<Feed />);
    entry("Card").focus();
    const link = document.createElement("a");
    link.href = "#y";
    link.textContent = "A new link";

    entry("Speech").append(link);
    await synced();
    expect(link).toHaveAttribute("tabindex", "-1");

    // A card that moves its own stop writes its tabindex: it stays out, and comes back as written.
    link.setAttribute("tabindex", "0");
    await synced();
    expect(link).toHaveAttribute("tabindex", "-1");
    entry("Speech").focus();
    expect(link).toHaveAttribute("tabindex", "0");
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
    expect(group()).toHaveFocus();
    expect(group()).toHaveAttribute("tabindex", "0");
    expect(entry("Card")).toHaveAttribute("tabindex", "-1");
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });

    key(group(), "Home");
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
    expect(group()).toHaveFocus();
    expect(group()).toHaveAttribute("tabindex", "0");
  });

  it("keeps an entry whose stop is inside it out of Tab, its stop a control of its own", () => {
    renderWithStore(<Feed own innerStop />);

    expect(entry("Card")).toHaveAttribute("tabindex", "-1");
    expect(control("Allow")).not.toHaveAttribute("tabindex");
    control("Allow").focus();
    expect(entry("Card")).toHaveAttribute("tabindex", "-1");
  });

  it("opens and folds an entry with → and ←, and goes from an inner entry to its own", () => {
    renderWithStore(<Feed />);
    group().focus();

    key(group(), "ArrowRight");
    expect(group()).toHaveAttribute("aria-expanded", "true");

    key(group(), "ArrowDown");
    expect(entry("Command")).toHaveFocus();
    key(entry("Command"), "ArrowLeft");
    expect(group()).toHaveFocus();

    key(group(), "ArrowLeft");
    expect(group()).toHaveAttribute("aria-expanded", "false");
    key(group(), "ArrowLeft");
    expect(group()).toHaveFocus();
    key(group(), "Enter");
    expect(group()).toHaveAttribute("aria-expanded", "true");
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
