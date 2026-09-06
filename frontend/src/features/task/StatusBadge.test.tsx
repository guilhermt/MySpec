import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/features/task/StatusBadge";
import { StatusDot } from "@/features/task/StatusDot";
import { renderWithStore } from "@/test/render";
import { makeTask } from "@/test/wails-mock";

describe("StatusBadge", () => {
  it("announces the status of the task", () => {
    renderWithStore(<StatusBadge task={makeTask({ sessionStatus: "needs_permission" })} />);

    expect(screen.getByRole("status")).toHaveTextContent("Permission");
  });
});

describe("StatusDot", () => {
  it("carries the status in sr-only text when asked", () => {
    renderWithStore(<StatusDot labelled task={makeTask({ sessionStatus: "working" })} />);

    expect(screen.getByText("Working")).toBeInTheDocument();
  });

  it("shows nothing but the dot by default", () => {
    const { container } = renderWithStore(<StatusDot task={makeTask()} />);

    expect(container).toHaveTextContent("");
    expect(container.querySelector("span")).toHaveAttribute("aria-hidden", "true");
  });
});
