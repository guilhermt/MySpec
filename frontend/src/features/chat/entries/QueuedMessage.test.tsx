import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueuedMessage } from "@/features/chat/entries/QueuedMessage";
import { IDLE_SESSION, type SessionState } from "@/features/chat/session";
import { api, type UserEntry } from "@/lib/wails";
import { renderWithStore } from "@/test/render";
import { makeEntry } from "@/test/wails-mock";

function queued(session: SessionState = IDLE_SESSION) {
  const user = makeEntry("user").user as UserEntry;
  return renderWithStore(
    <QueuedMessage
      taskId="task-1"
      stage="prd"
      entryId="entry-9"
      user={{ ...user, text: "and dark mode", pending: true }}
      session={session}
    />,
  );
}

describe("QueuedMessage", () => {
  it.each<[string, Partial<SessionState>, string]>([
    ["as the turn ends", {}, "sends when the turn ends"],
    [
      "after the retry",
      { sessionStatus: "error", lastError: "claude exited" },
      "sends after the retry",
    ],
    ["when the task resumes", { sessionStatus: "paused" }, "sends when the task resumes"],
  ])("says the message goes %s", (_, session, when) => {
    queued({ ...IDLE_SESSION, ...session });

    expect(screen.getByRole("article", { name: `You, queued, ${when}` })).toHaveTextContent(
      `Queued · ${when}`,
    );
  });

  it("takes the message back from the queue", async () => {
    let finish = () => {};
    vi.mocked(api.removePending).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { user } = queued();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(api.removePending).toHaveBeenCalledWith("task-1", "prd", "entry-9");
    expect(screen.getByRole("button", { name: "Removing…" })).toBeInTheDocument();
    finish();
    expect(await screen.findByRole("button", { name: "Remove" })).toBeInTheDocument();
  });
});
