import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppMessage } from "@/features/chat/entries/AppMessage";
import { renderWithStore } from "@/test/render";

describe("AppMessage", () => {
  it("shows what the app sent, and says it came from the app", () => {
    renderWithStore(
      <AppMessage
        user={{ text: "The plan is not valid yet.", pending: false, prompt: false, app: true }}
      />,
    );

    expect(screen.getByText("MySpec · sent to the agent")).toBeInTheDocument();
    expect(screen.getByText("The plan is not valid yet.")).toBeInTheDocument();
  });
});
