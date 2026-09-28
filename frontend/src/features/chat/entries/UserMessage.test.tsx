import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PendingMessage } from "@/features/chat/entries/PendingMessage";
import { UserMessage } from "@/features/chat/entries/UserMessage";
import { api } from "@/lib/wails";
import { renderWithStore } from "@/test/render";

const USER = {
  text: "Add a login screen",
  pending: false,
  prompt: false,
  app: false,
  sent: "",
  appKind: "",
  appPass: 0,
  appRound: 0,
  appRounds: 0,
  appCount: 0,
};

describe("UserMessage", () => {
  it("shows what the user said", () => {
    renderWithStore(<UserMessage user={USER} />);

    expect(screen.getByText("Add a login screen")).toBeInTheDocument();
  });
});

describe("PendingMessage", () => {
  it("marks the message as queued", () => {
    renderWithStore(<PendingMessage stage="prd" taskId="task-1" entryId="entry-9" user={USER} />);

    expect(screen.getByText("Add a login screen")).toBeInTheDocument();
    expect(screen.getByText("Queued")).toBeInTheDocument();
  });

  it("takes the message back out of the queue", async () => {
    const { user } = renderWithStore(
      <PendingMessage stage="prd" taskId="task-1" entryId="entry-9" user={USER} />,
    );

    await user.click(screen.getByRole("button", { name: "Remove queued message" }));

    expect(api.removePending).toHaveBeenCalledWith("task-1", "prd", "entry-9");
  });
});
