import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DraftDiff } from "@/features/discussion/DraftDiff";
import { renderWithStore } from "@/test/render";

describe("DraftDiff", () => {
  it("marks the lines the draft adds and the ones it takes away", () => {
    renderWithStore(<DraftDiff current={"One\nTwo\n"} next={"One\nThree\n"} />);

    const diff = screen.getByLabelText("Changes to the body");
    expect(diff).toHaveTextContent("+Three");
    expect(diff).toHaveTextContent("-Two");
    expect(screen.getByText("+Three")).toHaveClass("bg-[var(--status-success)]/15");
    expect(screen.getByText("-Two")).toHaveClass("bg-destructive/15");
  });

  it("leaves the lines both bodies share unmarked", () => {
    renderWithStore(<DraftDiff current={"One\n"} next={"One\nTwo\n"} />);

    const same = screen.getByText(" One", { normalizer: (text) => text });
    expect(same).not.toHaveClass("bg-[var(--status-success)]/15");
    expect(same).not.toHaveClass("bg-destructive/15");
  });
});
