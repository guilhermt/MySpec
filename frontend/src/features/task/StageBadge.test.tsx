import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StageBadge } from "@/features/task/StageBadge";
import { renderWithStore } from "@/test/render";
import { makeTask } from "@/test/wails-mock";

describe("StageBadge", () => {
  it("names the stage in progress", () => {
    renderWithStore(<StageBadge task={makeTask()} />);

    expect(screen.getByText("PRD")).toBeInTheDocument();
  });

  it("marks a finished stage", () => {
    renderWithStore(<StageBadge task={makeTask({ stage: "prd_done" })} />);

    expect(screen.getByText("PRD done")).toBeInTheDocument();
  });
});
