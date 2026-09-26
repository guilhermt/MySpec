import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { Skeleton, SkeletonBar } from "./Skeleton";

describe("Skeleton", () => {
  it("is a status named for the reader", () => {
    renderWithStore(
      <Skeleton label="Reading the board…">
        <SkeletonBar className="w-1/2" />
      </Skeleton>,
    );
    expect(screen.getByRole("status", { name: "Reading the board…" })).toBeInTheDocument();
  });

  it("shimmers its bars instead of pulsing them", () => {
    renderWithStore(
      <Skeleton label="Reading the board…">
        <SkeletonBar className="w-1/2" />
      </Skeleton>,
    );
    const bar = screen.getByRole("status", { name: "Reading the board…" }).firstElementChild;
    expect(bar).toHaveClass("shimmer-fill", "w-1/2");
    expect(bar).not.toHaveClass("animate-pulse");
  });
});
