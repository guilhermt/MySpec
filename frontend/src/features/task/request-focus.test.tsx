import { render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { focusRequest, useFocusRescue } from "@/features/task/request-focus";

// Screen is the parts of the task screen the focus of a request lands on.
function Screen({ card = null }: { card?: "question" | "permission" | null }) {
  return (
    <>
      <h1 tabIndex={-1}>Add login</h1>
      {card === "question" && (
        <div data-pending-card="question">
          {/* biome-ignore lint/a11y/useSemanticElements: the options of the card are radios drawn by the system, as here */}
          <div role="radio" aria-checked="true" tabIndex={-1}>
            SQLite
          </div>
          {/* biome-ignore lint/a11y/useSemanticElements: the options of the card are radios drawn by the system, as here */}
          <div role="radio" aria-checked="false" tabIndex={-1}>
            Postgres
          </div>
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
  it("takes the focus to the first option not chosen of the pending question", () => {
    render(<Screen card="question" />);

    expect(focusRequest("question")).toBe(true);
    expect(screen.getByText("Postgres")).toHaveFocus();
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
  });
});

// Rescued is a place whose button goes away once pressed, with or without a composer.
function Rescued({ composer }: { composer: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pressed, setPressed] = useState(false);
  useFocusRescue(ref);
  return (
    <div ref={ref}>
      <h1 tabIndex={-1}>Add login</h1>
      {!pressed && (
        <button type="button" onClick={() => setPressed(true)}>
          Approve
        </button>
      )}
      {composer && <textarea id="composer-input" aria-label="Reply" />}
    </div>
  );
}

describe("useFocusRescue", () => {
  it("takes the focus to the composer when what held it goes away", () => {
    render(<Rescued composer />);
    const approve = screen.getByRole("button", { name: "Approve" });

    approve.focus();
    approve.click();

    return expect
      .poll(() => document.activeElement)
      .toBe(screen.getByRole("textbox", { name: "Reply" }));
  });

  it("takes the focus to the title without a composer", () => {
    render(<Rescued composer={false} />);
    const approve = screen.getByRole("button", { name: "Approve" });

    approve.focus();
    approve.click();

    return expect
      .poll(() => document.activeElement)
      .toBe(screen.getByRole("heading", { name: "Add login" }));
  });
});
