import { screen } from "@testing-library/react";
import { Info } from "lucide-react";
import { describe, expect, it } from "vitest";
import { renderWithStore } from "@/test/render";
import { Button } from "./Button";
import { SunkenLine } from "./SunkenLine";

describe("SunkenLine", () => {
  it("renders its text and action", () => {
    renderWithStore(
      <SunkenLine action={<Button>Open</Button>}>The checks are still running.</SunkenLine>,
    );
    expect(screen.getByText("The checks are still running.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
  });

  it("draws a muted icon", () => {
    const { container } = renderWithStore(<SunkenLine icon={Info}>Waiting.</SunkenLine>);
    expect(container.querySelector("svg")).toHaveClass("text-ink-3");
  });

  it("draws the blocked glyph", () => {
    const { container } = renderWithStore(<SunkenLine icon="blocked">Waiting.</SunkenLine>);
    expect(container.querySelector('[data-state="blocked"]')).toBeInTheDocument();
  });

  it("draws the GitHub glyph", () => {
    const { container } = renderWithStore(<SunkenLine icon="github">Waiting.</SunkenLine>);
    expect(container.querySelector('[data-state="github"]')).toBeInTheDocument();
  });

  it("describes a button that points to it", () => {
    renderWithStore(
      <>
        <button type="button" aria-describedby="approve-reason">
          Approve
        </button>
        <SunkenLine id="approve-reason">The checks are still running.</SunkenLine>
      </>,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toHaveAccessibleDescription(
      "The checks are still running.",
    );
  });
});
