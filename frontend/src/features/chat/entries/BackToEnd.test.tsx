import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BackToEnd } from "@/features/chat/entries/BackToEnd";
import { renderWithStore } from "@/test/render";

describe("BackToEnd", () => {
  it("says what arrived and what the agent does", async () => {
    const onClick = vi.fn();
    const { user } = renderWithStore(
      <BackToEnd newCount={2} voice="Implementer" work="writing" onClick={onClick} />,
    );

    const button = screen.getByRole("button", {
      name: "New messages: 2. Go to the end. The implementer is writing.",
    });
    expect(button).toHaveTextContent("New messages 2");
    expect(button).toHaveTextContent("Implementer writing");
    await user.click(button);
    expect(onClick).toHaveBeenCalled();
  });

  it("is only the way to the end with nothing new and no work", () => {
    renderWithStore(<BackToEnd newCount={0} voice="PRD agent" work={null} onClick={() => {}} />);

    const button = screen.getByRole("button", { name: "Go to the end." });
    expect(button).toHaveTextContent("");
    expect(button).toHaveClass("min-w-(--newmsg-w)", "shadow-float");
  });

  it("says the work of an agent with an acronym as written", () => {
    renderWithStore(<BackToEnd newCount={0} voice="PRD agent" work="working" onClick={() => {}} />);

    expect(
      screen.getByRole("button", { name: "Go to the end. The PRD agent is working." }),
    ).toHaveTextContent("PRD agent working");
  });
});
