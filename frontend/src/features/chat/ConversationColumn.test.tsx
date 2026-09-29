import { screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { COLUMN_CLASS, ConversationColumn } from "@/features/chat/ConversationColumn";
import { renderWithStore } from "@/test/render";

describe("ConversationColumn", () => {
  it("lays the conversation in the column, with its spacings", () => {
    const contentRef = createRef<HTMLDivElement>();
    renderWithStore(
      <ConversationColumn fadeTop={false} contentRef={contentRef}>
        <p>An entry</p>
      </ConversationColumn>,
    );

    const column = screen.getByText("An entry").parentElement;
    expect(column).toBe(contentRef.current);
    expect(column).toHaveClass(
      ...COLUMN_CLASS.split(" "),
      "pt-(--space-6)",
      "pb-(--space-4)",
      "gap-(--space-3)",
    );
    expect(column).toHaveAttribute("tabindex", "-1");
  });

  it("fades the top of the viewport only when something is above, never the scrollbar", () => {
    const { rerender } = renderWithStore(
      <ConversationColumn fadeTop={false} label="Conversation">
        An entry
      </ConversationColumn>,
    );
    const viewport = screen.getByLabelText("Conversation");
    expect(viewport).toHaveClass("conversation-fade-bottom");
    expect(viewport.parentElement).not.toHaveClass("conversation-fade-bottom");

    rerender(
      <ConversationColumn fadeTop label="Conversation">
        An entry
      </ConversationColumn>,
    );
    expect(viewport).toHaveClass("conversation-fade");
    expect(viewport).not.toHaveClass("conversation-fade-bottom");
  });

  it("hands its scroller to the viewport ref", () => {
    const viewportRef = createRef<HTMLDivElement>();
    renderWithStore(
      <ConversationColumn fadeTop label="Conversation" viewportRef={viewportRef}>
        An entry
      </ConversationColumn>,
    );

    expect(viewportRef.current).toBe(screen.getByLabelText("Conversation"));
  });
});
