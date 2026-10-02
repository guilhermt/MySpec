import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { textKey } from "@/components/useEditedText";
import { useFindingText } from "@/features/reviews/useFindingText";
import { useAppStore } from "@/store/app-store";
import { resetAppStore } from "@/test/render";
import { makeReviewPass, makeReviewSummary, makeState } from "@/test/wails-mock";

const KEY = textKey("review-1", 1, 2);
const SAVE_DELAY_MS = 800;

beforeEach(() => {
  vi.useFakeTimers();
  resetAppStore();
});

afterEach(() => {
  vi.useRealTimers();
});

/** standAt has the store hold the pass of the edited text at a report. */
function standAt(revision: number) {
  const review = makeReviewSummary({ passes: [makeReviewPass({ revision })] });
  useAppStore.setState({ app: makeState({ reviews: [review] }) });
}

function edit(stored = "The token is never cleared.", revision = 1, required = false) {
  standAt(revision);
  const save = vi.fn();
  const view = renderHook(
    ({ text, rev }: { text: string; rev: number }) =>
      useFindingText("review-1", 1, 2, text, rev, save, required),
    { initialProps: { text: stored, rev: revision } },
  );
  return { ...view, save };
}

describe("useFindingText", () => {
  it("names the texts of a review apart", () => {
    expect(textKey("review-1", 2, 3)).toBe("review-1|2|3");
    expect(textKey("review-1", 2, "summary")).toBe("review-1|2|summary");
  });

  it("reads what the Go side has until the user types", () => {
    const { result } = edit();

    expect(result.current.value).toBe("The token is never cleared.");

    act(() => {
      result.current.onChange("Clear the token.");
    });

    expect(result.current.value).toBe("Clear the token.");
    expect(useAppStore.getState().textDrafts[KEY]).toEqual({
      text: "Clear the token.",
      revision: 1,
    });
  });

  it("records the text once the typing rests", () => {
    const { result, save } = edit();

    act(() => {
      result.current.onChange("Clear");
    });
    act(() => {
      vi.advanceTimersByTime(SAVE_DELAY_MS - 1);
    });
    expect(save).not.toHaveBeenCalled();

    act(() => {
      result.current.onChange("Clear the token.");
    });
    act(() => {
      vi.advanceTimersByTime(SAVE_DELAY_MS);
    });

    expect(save).toHaveBeenCalledExactlyOnceWith("Clear the token.");
  });

  it("records the text as the field is left, and nothing when it never changed", () => {
    const { result, save } = edit();

    act(() => {
      result.current.onBlur();
    });
    expect(save).not.toHaveBeenCalled();

    act(() => {
      result.current.onChange("Clear the token.");
    });
    act(() => {
      result.current.onBlur();
    });

    expect(save).toHaveBeenCalledExactlyOnceWith("Clear the token.");
    act(() => {
      vi.advanceTimersByTime(SAVE_DELAY_MS);
    });
    expect(save).toHaveBeenCalledOnce();
  });

  it("drops the draft and its waiting save when the agent writes the report again", () => {
    const { result, rerender, save } = edit();

    act(() => {
      result.current.onChange("Clear the token.");
    });

    rerender({ text: "The session is never closed.", rev: 2 });
    act(() => {
      vi.advanceTimersByTime(SAVE_DELAY_MS);
    });

    expect(save).not.toHaveBeenCalled();
    expect(useAppStore.getState().textDrafts[KEY]).toBeUndefined();
    expect(result.current.value).toBe("The session is never closed.");
  });

  it("drops a draft of another report when the field comes back", () => {
    const first = edit();
    act(() => {
      first.result.current.onChange("Clear the token.");
      first.result.current.onBlur();
    });
    first.unmount();

    const { result, save } = edit("The session is never closed.", 2);
    act(() => {
      result.current.onBlur();
    });

    expect(result.current.value).toBe("The session is never closed.");
    expect(useAppStore.getState().textDrafts[KEY]).toBeUndefined();
    expect(save).not.toHaveBeenCalled();
  });

  it("drops the draft once the Go side holds it", () => {
    const { result, rerender } = edit();

    act(() => {
      result.current.onChange("Clear the token.");
    });
    rerender({ text: "Clear the token.", rev: 1 });

    expect(useAppStore.getState().textDrafts[KEY]).toBeUndefined();
    expect(result.current.value).toBe("Clear the token.");
  });

  it("keeps the draft while the report stands", () => {
    const { result, rerender } = edit();

    act(() => {
      result.current.onChange("Clear the token.");
    });
    rerender({ text: "The token is never cleared.", rev: 1 });

    expect(result.current.value).toBe("Clear the token.");
  });

  it("sends a save still waiting when the field goes away before the typing rests", () => {
    const { result, save, unmount } = edit();

    act(() => {
      result.current.onChange("Clear the token.");
    });
    unmount();

    expect(save).toHaveBeenCalledExactlyOnceWith("Clear the token.");
  });

  it("sends nothing as the field goes away with the report written again", () => {
    const { result, save, unmount } = edit();

    act(() => {
      result.current.onChange("Clear the token.");
    });
    // The new report removes the finding: the field goes away with the old revision in its props.
    standAt(2);
    unmount();

    expect(save).not.toHaveBeenCalled();
  });

  it("sends nothing as the field goes away when everything was already saved", () => {
    const { result, save, unmount } = edit();

    act(() => {
      result.current.onChange("Clear the token.");
    });
    act(() => {
      vi.advanceTimersByTime(SAVE_DELAY_MS);
    });
    unmount();

    expect(save).toHaveBeenCalledOnce();
  });

  it("never records a required text blank", () => {
    const { result, save } = edit(undefined, 1, true);

    act(() => {
      result.current.onChange("  ");
    });
    act(() => {
      vi.advanceTimersByTime(SAVE_DELAY_MS);
    });

    expect(save).not.toHaveBeenCalled();
    expect(result.current.value).toBe("  ");
  });

  it("gives a required text left blank its stored text back", () => {
    const { result, save } = edit(undefined, 1, true);

    act(() => {
      result.current.onChange("");
    });
    act(() => {
      result.current.onBlur();
    });

    expect(save).not.toHaveBeenCalled();
    expect(useAppStore.getState().textDrafts[KEY]).toBeUndefined();
    expect(result.current.value).toBe("The token is never cleared.");
  });

  it("records a summary left blank", () => {
    const { result, save } = edit("Two things to fix.");

    act(() => {
      result.current.onChange("");
    });
    act(() => {
      result.current.onBlur();
    });

    expect(save).toHaveBeenCalledExactlyOnceWith("");
  });
});
