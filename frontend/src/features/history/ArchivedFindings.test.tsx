import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArchivedFindings } from "@/features/history/ArchivedFindings";
import { renderWithStore } from "@/test/render";

const FINDING = {
  id: "f1",
  title: "Pins `vite` twice",
  location: "package.json:12",
  anchored: true,
  went: "Inline comment",
  text: "Keep one.",
};

describe("ArchivedFindings", () => {
  it("draws the code of a title as code, without its backticks", () => {
    renderWithStore(<ArchivedFindings pass={1} findings={[FINDING]} />);

    const line = screen.getByRole("button", {
      name: "Pins vite twice · package.json:12 · Inline comment",
    });
    expect(line).not.toHaveTextContent("`");
    expect(screen.getByText("vite").tagName).toBe("CODE");
  });
});
