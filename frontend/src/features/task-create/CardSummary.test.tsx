import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardSummary } from "@/features/task-create/CardSummary";
import { makeBoardCard } from "@/test/wails-mock";

describe("CardSummary", () => {
  it("names the card, its repository and its status", () => {
    render(<CardSummary card={makeBoardCard()} />);

    expect(screen.getByText("#12")).toBeInTheDocument();
    expect(screen.getByText("Add the login screen")).toBeInTheDocument();
    expect(screen.getByText("dev/web")).toBeInTheDocument();
    expect(screen.getByText("Todo")).toBeInTheDocument();
  });

  it("shows no status for a card without one", () => {
    render(<CardSummary card={makeBoardCard({ status: "" })} />);

    expect(screen.queryByText("Todo")).not.toBeInTheDocument();
  });
});
