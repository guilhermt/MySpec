import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { focusRequest, focusTitle } from "@/lib/focus";

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

  it("answers false without the target on screen", () => {
    render(<Screen />);

    expect(focusRequest("question")).toBe(false);
    expect(focusRequest("permission")).toBe(false);
  });
});

describe("focusTitle", () => {
  it("takes the focus to the title of the place", () => {
    render(<Screen />);

    focusTitle();

    expect(screen.getByRole("heading", { name: "Add login" })).toHaveFocus();
  });
});
