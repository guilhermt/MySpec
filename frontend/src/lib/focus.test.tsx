import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { activeDraftId, currentDraftId, focusDraft, focusRequest, focusTitle } from "@/lib/focus";

// Group is a question of the card: a radio group whose stop of Tab is the chosen option, else the
// first, as the card draws it.
function Group({ at, options, chosen }: { at: number; options: string[]; chosen: number | null }) {
  const stop = chosen ?? 0;
  return (
    <div role="radiogroup" aria-label={`Question ${at + 1}`} data-question={at}>
      {options.map((option, index) => (
        // biome-ignore lint/a11y/useSemanticElements: the options of the card are radios drawn by the system, as here
        <div
          key={option}
          role="radio"
          aria-checked={index === chosen}
          tabIndex={index === stop ? 0 : -1}
        >
          {option}
        </div>
      ))}
    </div>
  );
}

// Screen is the parts of the task screen the focus of a request lands on; chosen is the option
// picked in each question of the pending question card.
function Screen({
  card = null,
  chosen = [],
}: {
  card?: "question" | "permission" | null;
  chosen?: (number | null)[];
}) {
  return (
    <>
      <h1 tabIndex={-1}>Add login</h1>
      {card === "question" && (
        <div data-pending-card="question">
          {chosen.map((choice, at) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the questions of the card never move
            <Group key={at} at={at} options={[`Q${at + 1} A`, `Q${at + 1} B`]} chosen={choice} />
          ))}
        </div>
      )}
      {card === "permission" && (
        <div data-pending-card="permission">
          <button type="button">Allow</button>
          <button type="button" data-default-focus="">
            Deny…
          </button>
        </div>
      )}
      <section aria-label="Request" tabIndex={-1}>
        <button type="button" data-variant="secondary">
          Open in VS Code
        </button>
        <button type="button" data-variant="primary">
          Approve
        </button>
      </section>
      <textarea id="composer-input" aria-label="Reply" />
    </>
  );
}

describe("focusRequest", () => {
  it.each<[string, (number | null)[], string]>([
    ["the first question of a card with no choice", [null, null], "Q1 A"],
    ["the first question without a choice, past a chosen one", [1, null, null], "Q2 A"],
    ["the first question without a choice, past two chosen", [1, 0, null], "Q3 A"],
    ["the chosen option of the first question when all are chosen", [1, 0], "Q1 B"],
  ])("takes the focus to %s", (_, chosen, focused) => {
    render(<Screen card="question" chosen={chosen} />);

    expect(focusRequest("question")).toBe(true);
    expect(screen.getByRole("radio", { name: focused })).toHaveFocus();
  });

  it("takes the focus to the default answer of the pending permission", () => {
    render(<Screen card="permission" />);

    expect(focusRequest("permission")).toBe(true);
    expect(screen.getByRole("button", { name: "Deny…" })).toHaveFocus();
  });

  it("takes the focus to the primary of the bar, the composer or the bar", () => {
    render(<Screen />);

    focusRequest("primary");
    expect(screen.getByRole("button", { name: "Approve" })).toHaveFocus();
    focusRequest("composer");
    expect(screen.getByRole("textbox", { name: "Reply" })).toHaveFocus();
    focusRequest("bar");
    expect(screen.getByRole("region", { name: "Request" })).toHaveFocus();
  });

  it("takes the focus to the first finding to decide, else to the first finding, centred", () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const { rerender } = render(
      <div data-decision-card="">
        <button
          type="button"
          aria-label="Finding 1"
          tabIndex={-1}
          data-finding=""
          data-decided="true"
        />
        <button
          type="button"
          aria-label="Finding 2"
          tabIndex={-1}
          data-finding=""
          data-decided="false"
          data-disabled=""
        />
        <button
          type="button"
          aria-label="Finding 3"
          tabIndex={-1}
          data-finding=""
          data-decided="false"
        />
      </div>,
    );

    expect(focusRequest("finding")).toBe(true);
    const third = screen.getByRole("button", { name: "Finding 3" });
    expect(third).toHaveFocus();
    expect(scroll).toHaveBeenCalledWith({ block: "center" });

    rerender(
      <div data-decision-card="">
        <button
          type="button"
          aria-label="Finding 1"
          tabIndex={-1}
          data-finding=""
          data-decided="true"
        />
      </div>,
    );
    focusRequest("finding");
    expect(screen.getByRole("button", { name: "Finding 1" })).toHaveFocus();
    scroll.mockRestore();
  });

  it("takes the focus to the draft the bar asks for, centred", () => {
    render(
      <div data-decision-card>
        <button type="button" data-card-item="d1" />
        <button type="button" data-card-item="d2" data-request-target="" />
      </div>,
    );
    const target = document.querySelector<HTMLElement>('[data-card-item="d2"]');
    const scroll = vi.fn();
    if (target !== null) {
      target.scrollIntoView = scroll;
    }

    expect(focusRequest("draft")).toBe(true);
    expect(target).toHaveFocus();
    expect(scroll).toHaveBeenCalledWith({ block: "center" });
  });

  it("answers false without the target on screen", () => {
    render(<Screen />);

    expect(focusRequest("question")).toBe(false);
    expect(focusRequest("permission")).toBe(false);
    expect(focusRequest("finding")).toBe(false);
  });
});

describe("focusTitle", () => {
  it("takes the focus to the title of the place", () => {
    render(<Screen />);

    focusTitle();

    expect(screen.getByRole("heading", { name: "Add login" })).toHaveFocus();
  });
});

// Card is the drafts card: the open draft is the current one and holds a Retry; the folded one is
// a stop of its own.
function Card({ retry = true }: { retry?: boolean }) {
  return (
    <div data-decision-card="">
      <button type="button" aria-label="Draft 1" tabIndex={-1} data-card-item="draft-1" />
      {/* biome-ignore lint/a11y/useSemanticElements: the open draft of the card is a group the system draws */}
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: and the current draft holds the stop of Tab */}
      <div role="group" aria-label="Draft 2" tabIndex={0} data-card-item="draft-2" data-current="">
        {retry && (
          <button type="button" data-retry="">
            Retry
          </button>
        )}
        <button type="button">Edit</button>
      </div>
    </div>
  );
}

describe("focusDraft", () => {
  it("takes the focus to the draft, centred", () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    render(<Card />);

    expect(focusDraft("draft-1", false)).toBe(true);

    expect(screen.getByRole("button", { name: "Draft 1" })).toHaveFocus();
    expect(scroll).toHaveBeenCalledWith({ block: "center" });
    scroll.mockRestore();
  });

  it("goes on to the Retry of the draft on the next frame", async () => {
    render(<Card />);

    focusDraft("draft-2", true);

    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toHaveFocus());
  });

  it("stays on the draft when it has no Retry yet", async () => {
    render(<Card retry={false} />);

    focusDraft("draft-2", true);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(screen.getByRole("group", { name: "Draft 2" })).toHaveFocus();
  });

  it("answers false when the draft is not on screen", () => {
    render(<Card />);

    expect(focusDraft("draft-9", false)).toBe(false);
  });
});

describe("activeDraftId and currentDraftId", () => {
  it("tell the draft around the focus and the current draft", () => {
    render(<Card />);

    expect(activeDraftId()).toBeNull();
    expect(currentDraftId()).toBe("draft-2");

    screen.getByRole("button", { name: "Edit" }).focus();
    expect(activeDraftId()).toBe("draft-2");

    screen.getByRole("button", { name: "Draft 1" }).focus();
    expect(activeDraftId()).toBe("draft-1");
  });

  it("answer null without a card", () => {
    render(<Screen />);

    expect(activeDraftId()).toBeNull();
    expect(currentDraftId()).toBeNull();
  });
});
