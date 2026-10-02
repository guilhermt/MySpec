import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { BodyDiff } from "./BodyDiff";

const LINES = [
  { kind: "same", text: "Bill the overage monthly." },
  { kind: "removed", text: "Cap it at the plan." },
  { kind: "added", text: "Charge past the plan." },
] as const;

describe("BodyDiff", () => {
  it("is a group named for the changes to the body", () => {
    renderWithStore(<BodyDiff lines={LINES} />);

    expect(screen.getByRole("group", { name: "Changes to the body" })).toBeInTheDocument();
  });

  it("says Added and Removed to the reader, and shows + and − to the eye", () => {
    renderWithStore(<BodyDiff lines={LINES} />);
    const [same, removed, added] = screen.getByRole("group").children;

    expect(same).toHaveTextContent(/^Bill the overage monthly\.$/);
    expect(removed).toHaveTextContent(/^Removed: − Cap it at the plan\.$/);
    expect(added).toHaveTextContent(/^Added: \+ Charge past the plan\.$/);
    expect(screen.getByText("Removed:")).toHaveClass("sr-only");
    expect(screen.getByText("+")).toHaveAttribute("aria-hidden", "true");
  });

  it("strikes the line it takes away", () => {
    renderWithStore(<BodyDiff lines={LINES} />);

    expect(screen.getByText("Cap it at the plan.")).toHaveClass("line-through");
    expect(screen.getByText("Charge past the plan.")).not.toHaveClass("line-through");
  });
});
