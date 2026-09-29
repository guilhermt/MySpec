import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Speech } from "@/features/chat/entries/Speech";
import type { AssistantEntry } from "@/lib/wails";
import { clockTime } from "@/lib/when";
import { renderWithStore } from "@/test/render";

const AT = "2026-09-05T10:00:00Z";
const TIME = clockTime(AT, Date.now());

function assistant(overrides: Partial<AssistantEntry> = {}): AssistantEntry {
  return {
    messageId: "msg_1",
    blockIndex: 0,
    text: "On it.",
    complete: true,
    interrupted: false,
    parentToolUseId: "",
    interruptedBy: "",
    ...overrides,
  };
}

describe("Speech", () => {
  it("writes who talks where the voice changes, with the time in its name", () => {
    renderWithStore(
      <Speech assistant={assistant()} createdAt={AT} voice="Implementer" voiceShown />,
    );

    const speech = screen.getByRole("article", { name: `Implementer, ${TIME}` });
    expect(speech).toHaveTextContent("Implementer");
    expect(speech).toHaveAttribute("data-feed-item");
    expect(screen.getByText(TIME)).toHaveClass("entry-time");
  });

  it("keeps the word out where the voice goes on", () => {
    renderWithStore(
      <Speech assistant={assistant()} createdAt={AT} voice="Implementer" voiceShown={false} />,
    );

    expect(screen.getByRole("article", { name: `Implementer, ${TIME}` })).not.toHaveTextContent(
      "Implementer",
    );
  });

  it("says the agent is writing while the text streams, with the word", () => {
    renderWithStore(
      <Speech
        assistant={assistant({ complete: false })}
        createdAt={AT}
        voice="Implementer"
        voiceShown={false}
      />,
    );

    expect(
      screen.getByRole("article", { name: `Implementer, ${TIME}, writing` }),
    ).toHaveTextContent("Implementer");
  });

  it.each([
    [
      "by you",
      { interrupted: true, interruptedBy: "user" },
      "Interrupted by you",
      ", interrupted by you",
    ],
    ["in an old transcript", { interrupted: true, interruptedBy: "" }, "Interrupted", ""],
  ])("says the speech was interrupted %s", (_, overrides, line, suffix) => {
    renderWithStore(
      <Speech assistant={assistant(overrides)} createdAt={AT} voice="Reviewer" voiceShown />,
    );

    expect(screen.getByRole("article", { name: `Reviewer, ${TIME}${suffix}` })).toHaveTextContent(
      line,
    );
  });

  it("says nothing more when a crash cut the speech", () => {
    renderWithStore(
      <Speech
        assistant={assistant({ interrupted: true, interruptedBy: "crash" })}
        createdAt={AT}
        voice="Reviewer"
        voiceShown
      />,
    );

    expect(screen.queryByText(/Interrupted/)).not.toBeInTheDocument();
  });
});
