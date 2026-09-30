import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders its title and text", () => {
    renderWithStore(<EmptyState title="No tasks yet">Start one from a repository.</EmptyState>);
    expect(screen.getByText("No tasks yet")).toHaveClass("font-semibold");
    expect(screen.getByText("Start one from a repository.")).toBeInTheDocument();
  });

  it("renders its title alone", () => {
    const { container } = renderWithStore(<EmptyState title="Nothing here." />);
    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
    expect(container.firstElementChild?.children).toHaveLength(1);
  });

  it("renders its action as a button", () => {
    renderWithStore(
      <EmptyState title="No tasks yet" action={<Button>New task</Button>}>
        Start one from a repository.
      </EmptyState>,
    );
    expect(screen.getByRole("button", { name: "New task" })).toBeInTheDocument();
  });
});
