import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { YourMessage } from "@/features/chat/entries/YourMessage";
import { clockTime } from "@/lib/when";
import { renderWithStore } from "@/test/render";
import { makeEntry } from "@/test/wails-mock";

describe("YourMessage", () => {
  it("shows what the user wrote, as written, named with its time", () => {
    const entry = makeEntry("user");
    const user = entry.user;
    if (user === null) throw new Error("no user");
    renderWithStore(
      <YourMessage user={{ ...user, text: "one\ntwo **not bold**" }} createdAt={entry.createdAt} />,
    );

    const message = screen.getByRole("article", {
      name: `You, ${clockTime(entry.createdAt, Date.now())}`,
    });
    expect(message).toHaveTextContent("You");
    expect(screen.getByText(/two \*\*not bold\*\*/)).toHaveClass("whitespace-pre-wrap");
  });
});
