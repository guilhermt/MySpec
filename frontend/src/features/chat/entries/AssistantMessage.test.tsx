import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AssistantMessage } from "@/features/chat/entries/AssistantMessage";
import type { AssistantEntry } from "@/lib/wails";
import { renderWithStore } from "@/test/render";

function assistant(overrides: Partial<AssistantEntry> = {}): AssistantEntry {
  return {
    messageId: "msg_1",
    blockIndex: 0,
    text: "On it.",
    complete: true,
    interrupted: false,
    ...overrides,
  };
}

describe("AssistantMessage", () => {
  it("renders the block as Markdown", () => {
    renderWithStore(<AssistantMessage assistant={assistant()} />);

    expect(screen.getByTestId("markdown")).toHaveTextContent("On it.");
    expect(screen.queryByText("Interrupted")).not.toBeInTheDocument();
  });

  it("says when the user cut the answer short", () => {
    renderWithStore(<AssistantMessage assistant={assistant({ interrupted: true })} />);

    expect(screen.getByText("Interrupted")).toBeInTheDocument();
  });
});
