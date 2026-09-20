import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { draftTextKey, useDraftText } from "@/features/discussion/useDraftText";
import { useAppStore } from "@/store/app-store";
import { resetAppStore } from "@/test/render";
import { makeDiscussion, makeDraft, makeState } from "@/test/wails-mock";

const KEY = draftTextKey("discussion-1", "draft-1", "title");
const SAVE_DELAY_MS = 800;

beforeEach(() => {
  vi.useFakeTimers();
  resetAppStore();
});

afterEach(() => {
  vi.useRealTimers();
});

/** standAt has the store hold the draft of the edited text at a revision. */
function standAt(revision: number) {
  const discussion = makeDiscussion({ drafts: [makeDraft({ revision })] });
  useAppStore.setState({ app: makeState({ discussions: [discussion] }) });
}

function edit(stored = "Export the invoices", revision = 1) {
  standAt(revision);
  const save = vi.fn();
  const view = renderHook(
    ({ text, rev }: { text: string; rev: number }) =>
      useDraftText("discussion-1", "draft-1", "title", text, rev, save),
    { initialProps: { text: stored, rev: revision } },
  );
  return { ...view, save };
}

describe("useDraftText", () => {
  it("names the texts of a draft apart", () => {
    expect(draftTextKey("discussion-1", "draft-1", "title")).toBe("discussion-1|draft-1|title");
    expect(draftTextKey("discussion-1", "draft-1", "body")).toBe("discussion-1|draft-1|body");
  });

  it("records the text once the typing rests", () => {
    const { result, save } = edit();

    act(() => {
      result.current.onChange("Export the invoices as CSV");
    });
    expect(useAppStore.getState().textDrafts[KEY]).toEqual({
      text: "Export the invoices as CSV",
      revision: 1,
    });

    act(() => {
      vi.advanceTimersByTime(SAVE_DELAY_MS);
    });

    expect(save).toHaveBeenCalledExactlyOnceWith("Export the invoices as CSV");
  });

  it("never records the text blank", () => {
    const { result, save } = edit();

    act(() => {
      result.current.onChange("  ");
    });
    act(() => {
      vi.advanceTimersByTime(SAVE_DELAY_MS);
      result.current.onBlur();
    });

    expect(save).not.toHaveBeenCalled();
    expect(result.current.value).toBe("Export the invoices");
  });

  it("drops what was typed when the agent writes the draft again", () => {
    const { result, rerender, save } = edit();

    act(() => {
      result.current.onChange("Export the invoices as CSV");
    });
    rerender({ text: "Export the invoices as XLSX", rev: 2 });
    act(() => {
      vi.advanceTimersByTime(SAVE_DELAY_MS);
    });

    expect(save).not.toHaveBeenCalled();
    expect(result.current.value).toBe("Export the invoices as XLSX");
  });

  it("sends nothing as the field goes away with the draft gone", () => {
    const { result, save, unmount } = edit();

    act(() => {
      result.current.onChange("Export the invoices as CSV");
    });
    useAppStore.setState({ app: makeState({ discussions: [makeDiscussion({ drafts: [] })] }) });
    unmount();

    expect(save).not.toHaveBeenCalled();
  });
});
