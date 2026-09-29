import { render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { useFocusRescue } from "@/features/task/request-focus";

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
