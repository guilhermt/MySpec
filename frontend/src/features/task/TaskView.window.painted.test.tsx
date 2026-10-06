import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { measuredConversation, OPEN_STRETCHES } from "@/dev/measure-conversation";
import { TaskView } from "@/features/task/TaskView";
import { sessionKey } from "@/lib/wails";
import { fromTranscript } from "@/store/transcript";
import { conversationScene } from "@/test/conversation-scenes";
import { layoutInCommits, mainArea } from "@/test/painted";
import { renderWithStore } from "@/test/render";
import { TASK_ID } from "@/test/task-scenes";

// Only the boundary is replaced, as in the jsdom suite: no call reaches the runtime of Wails.
vi.mock("@/lib/wails", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wails")>()),
  ...(await import("@/test/wails-mock")),
}));

/**
 * The task screen with the implementer's conversation of 1,500 entries in stretches too short to
 * fold, 362 units, far past the 60 a conversation holds before it is windowed, in the area of a
 * 1450px window with the sidebar closed: it opens at the end, and ↓ takes the reader back there, with
 * the list laid out in the middle of each commit as WebKitGTK lays it out.
 */
const MAIN_WIDTH = 1134;
const MAIN_HEIGHT = 1080;
const STAGE = "step:6";

function draw() {
  const scene = conversationScene("long");
  const transcripts = {
    ...scene.transcripts,
    [sessionKey(TASK_ID, STAGE)]: fromTranscript({
      taskId: TASK_ID,
      sessionId: "long",
      stage: STAGE,
      entries: measuredConversation(OPEN_STRETCHES),
      pending: [],
    }),
  };
  const { container, user } = renderWithStore(
    <div style={{ ...mainArea(MAIN_WIDTH), height: `${MAIN_HEIGHT}px`, display: "flex" }}>
      <TaskView taskId={TASK_ID} />
    </div>,
    {
      state: scene.state,
      ui: { location: { kind: "task", id: TASK_ID }, transcripts, openStepTab: scene.openStepTab },
    },
  );
  const scroll = container.querySelector<HTMLElement>("[data-window-viewport]");
  if (scroll === null) {
    throw new Error("the conversation is not windowed");
  }
  // In place before the window first moves, which waits for the scroll the opening makes.
  layoutInCommits(screen.getByRole("feed"), scroll);
  return { user, scroll };
}

const atEnd = (scroll: HTMLElement) =>
  Math.abs(scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight) <= 1;

describe("the task screen with a long conversation", () => {
  it("opens at the end and takes the reader back there with ↓", async () => {
    const { user, scroll } = draw();
    await vi.waitFor(() => expect(atEnd(scroll)).toBe(true));
    await new Promise((done) => setTimeout(done, 300));
    expect(atEnd(scroll)).toBe(true);

    scroll.scrollTo({ top: 0 });
    const back = await screen.findByRole("button", { name: /Go to the end\./ });
    await user.click(back);

    await vi.waitFor(() => expect(atEnd(scroll)).toBe(true));
    await new Promise((done) => setTimeout(done, 300));
    expect(atEnd(scroll)).toBe(true);
  });
});
