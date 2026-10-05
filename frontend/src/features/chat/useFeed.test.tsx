import { act, fireEvent, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useGlobalShortcuts } from "@/app/useGlobalShortcuts";
import { type FeedUnits, stepFeed, useFeed } from "@/features/chat/useFeed";
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

const ENTRY_NUMBERS = Array.from({ length: 30 }, (_, at) => at + 1);

// LongFeed is thirty entries, for the keys that walk by ten.
function LongFeed() {
  const ref = useRef<HTMLDivElement>(null);
  useFeed(ref);
  return (
    <div ref={ref} role="feed" aria-label="Long conversation">
      {ENTRY_NUMBERS.map((number) => (
        <article key={number} data-feed-item tabIndex={-1} aria-label={`Entry ${number}`} />
      ))}
    </div>
  );
}

// Windowed is a feed of twelve units of two entries each, of which only the ones in mounted are in
// the DOM, as the window of the conversation has it. The reveal is a spy: the test mounts the unit.
function Windowed({
  mounted,
  reveal,
  onCurrent,
  tail = false,
}: {
  mounted: readonly number[];
  reveal: (index: number) => void;
  onCurrent?: (index: number) => void;
  tail?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFeed(ref, { count: 12, reveal, onCurrent: onCurrent ?? (() => {}) } satisfies FeedUnits);
  return (
    <div ref={ref} role="feed" aria-label="Windowed conversation">
      {mounted.map((unit) => (
        <div key={unit} role="none" data-unit-index={unit}>
          {["a", "b"].map((part) => (
            <article key={part} data-feed-item tabIndex={-1} aria-label={`Unit ${unit}${part}`} />
          ))}
        </div>
      ))}
      {tail ? <article data-feed-item tabIndex={-1} aria-label="Tail" /> : null}
    </div>
  );
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

  it("syncs when a control arrives, not when the text of an entry grows", async () => {
    renderWithStore(<Feed />);
    const feed = screen.getByRole("feed");
    const scan = vi.spyOn(feed, "querySelectorAll");
    const speech = entry("Speech");

    await act(async () => {
      speech.append(document.createTextNode(" and more words"));
      speech.append(document.createElement("span"));
    });
    expect(scan).not.toHaveBeenCalled();

    await act(async () => {
      const link = document.createElement("a");
      link.href = "#y";
      speech.append(link);
    });
    expect(scan).toHaveBeenCalled();
    expect(speech.querySelector('a[href="#y"]')).toHaveAttribute("tabindex", "-1");
  });

  it("walks ten entries with Page Down and Page Up", () => {
    renderWithStore(<LongFeed />);
    entry("Entry 1").focus();

    key(entry("Entry 1"), "PageDown");
    expect(entry("Entry 11")).toHaveFocus();
    key(entry("Entry 11"), "PageDown");
    expect(entry("Entry 21")).toHaveFocus();
    key(entry("Entry 21"), "PageDown");
    expect(entry("Entry 30")).toHaveFocus();

    key(entry("Entry 30"), "PageUp");
    expect(entry("Entry 20")).toHaveFocus();
    key(entry("Entry 20"), "PageUp");
    expect(entry("Entry 10")).toHaveFocus();
    key(entry("Entry 10"), "PageUp");
    expect(entry("Entry 1")).toHaveFocus();
  });

  it("brings an unmounted unit into view on Home, and focuses its first entry once it mounts", async () => {
    const reveal = vi.fn();
    const { rerender } = renderWithStore(<Windowed mounted={[5, 6]} reveal={reveal} />);
    entry("Unit 5a").focus();

    key(entry("Unit 5a"), "Home");

    expect(reveal).toHaveBeenCalledWith(0);
    expect(entry("Unit 5a")).toHaveFocus();

    rerender(<Windowed mounted={[0, 5, 6]} reveal={reveal} />);
    await synced();

    expect(entry("Unit 0a")).toHaveFocus();
  });

  it("goes over a hole of units with the arrows, to the last entry of the unit above", async () => {
    const reveal = vi.fn();
    const { rerender } = renderWithStore(<Windowed mounted={[5, 6]} reveal={reveal} />);
    entry("Unit 5a").focus();

    key(entry("Unit 5a"), "ArrowUp");

    expect(reveal).toHaveBeenCalledWith(4);
    rerender(<Windowed mounted={[4, 5, 6]} reveal={reveal} />);
    await synced();
    expect(entry("Unit 4b")).toHaveFocus();

    key(entry("Unit 4b"), "ArrowDown");
    expect(entry("Unit 5a")).toHaveFocus();
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it("walks ten entries with Page Down and Page Up, a unit counting its entries and one not mounted one", async () => {
    const reveal = vi.fn();
    const { rerender } = renderWithStore(<Windowed mounted={[0, 1]} reveal={reveal} />);
    entry("Unit 0a").focus();

    // 0b, 1a and 1b are three entries; the units 2 to 8 are not mounted, one entry each.
    key(entry("Unit 0a"), "PageDown");

    expect(reveal).toHaveBeenCalledWith(8);
    rerender(<Windowed mounted={[1, 8, 9]} reveal={reveal} />);
    await synced();
    expect(entry("Unit 8a")).toHaveFocus();

    // 7 to 2 are six, 1b and 1a two more, 0 the ninth: the first entry of the feed.
    key(entry("Unit 8a"), "PageUp");
    expect(reveal).toHaveBeenLastCalledWith(0);
  });

  it("counts each entry a mounted unit holds, as an open group holds its commands", () => {
    renderWithStore(<Windowed mounted={[0, 1, 2, 3, 4, 5, 6]} reveal={vi.fn()} />);
    entry("Unit 6b").focus();

    key(entry("Unit 6b"), "PageUp");
    expect(entry("Unit 1b")).toHaveFocus();

    key(entry("Unit 1b"), "PageDown");
    expect(entry("Unit 6b")).toHaveFocus();
  });

  it("goes to the last entry of the feed with Page Down near the end", async () => {
    const reveal = vi.fn();
    const { rerender } = renderWithStore(<Windowed mounted={[5, 6]} reveal={reveal} />);
    entry("Unit 6b").focus();

    key(entry("Unit 6b"), "PageDown");

    expect(reveal).toHaveBeenCalledWith(11);
    rerender(<Windowed mounted={[5, 6, 11]} reveal={reveal} />);
    await synced();
    expect(entry("Unit 11b")).toHaveFocus();
  });

  it("goes to the last entry with Page Down from inside the last unit", () => {
    const reveal = vi.fn();
    renderWithStore(<Windowed mounted={[10, 11]} reveal={reveal} />);
    entry("Unit 11a").focus();

    key(entry("Unit 11a"), "PageDown");

    expect(entry("Unit 11b")).toHaveFocus();
    expect(reveal).not.toHaveBeenCalled();
  });

  it("keeps focus at the end with Page Down from the tail", () => {
    const reveal = vi.fn();
    renderWithStore(<Windowed mounted={[10, 11]} reveal={reveal} tail />);
    entry("Tail").focus();

    key(entry("Tail"), "PageDown");

    expect(entry("Tail")).toHaveFocus();
    expect(reveal).not.toHaveBeenCalled();
  });

  it("tells which unit holds the stop of Tab", () => {
    const onCurrent = vi.fn();
    renderWithStore(<Windowed mounted={[2, 3]} reveal={vi.fn()} onCurrent={onCurrent} />);

    entry("Unit 2b").focus();

    expect(onCurrent).toHaveBeenLastCalledWith(2);
  });
});
