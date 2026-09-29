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

  it("fades the top only when something is above", () => {
    const { container, rerender } = renderWithStore(
      <ConversationColumn fadeTop={false}>An entry</ConversationColumn>,
    );
    expect(container.querySelector(".conversation-fade-bottom")).not.toBeNull();

    rerender(<ConversationColumn fadeTop>An entry</ConversationColumn>);
    expect(container.querySelector(".conversation-fade")).not.toBeNull();
    expect(container.querySelector(".conversation-fade-bottom")).toBeNull();
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
