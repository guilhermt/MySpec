import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEditedText } from "@/components/useEditedText";
import { useAppStore } from "@/store/app-store";
import { resetAppStore } from "@/test/render";

const KEY = "discussion-1|draft-1|title";
const SAVE_DELAY_MS = 800;

beforeEach(() => {
  vi.useFakeTimers();
  resetAppStore();
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * edit holds one text. live is the revision the text stands at now, which the
 * test moves on its own: it is what the Go side would say as the field goes
 * away.
 */
function edit(stored = "Export the invoices", revision = 1, required = false) {
  const live = { revision: revision as number | null };
  const save = vi.fn();
  const view = renderHook(
    ({ text, rev }: { text: string; rev: number }) =>
      useEditedText(KEY, text, rev, save, required, () => live.revision),
    { initialProps: { text: stored, rev: revision } },
  );
  return { ...view, save, live };
}

describe("useEditedText", () => {
  it("reads what the Go side has until the user types", () => {
    const { result } = edit();

    expect(result.current.value).toBe("Export the invoices");

    act(() => {
      result.current.onChange("Export the invoices as CSV");
    });

    expect(result.current.value).toBe("Export the invoices as CSV");
    expect(useAppStore.getState().findingDrafts[KEY]).toEqual({
      text: "Export the invoices as CSV",
      revision: 1,
    });
  });

  it("records the text once the typing rests", () => {
    const { result, save } = edit();

    act(() => {
      result.current.onChange("Export");
    });
    act(() => {
      vi.advanceTimersByTime(SAVE_DELAY_MS - 1);
    });
    expect(save).not.toHaveBeenCalled();

    act(() => {
      result.current.onChange("Export the invoices as CSV");
    });
    act(() => {
      vi.advanceTimersByTime(SAVE_DELAY_MS);
    });

    expect(save).toHaveBeenCalledExactlyOnceWith("Export the invoices as CSV");
  });

  it("records the text as the field is left, and nothing when it never changed", () => {
    const { result, save } = edit();

    act(() => {
      result.current.onBlur();
    });
    expect(save).not.toHaveBeenCalled();

    act(() => {
      result.current.onChange("Export the invoices as CSV");
    });
    act(() => {
      result.current.onBlur();
    });

    expect(save).toHaveBeenCalledExactlyOnceWith("Export the invoices as CSV");
  });

  it("drops the draft and its waiting save when the agent writes the text again", () => {
    const { result, rerender, save } = edit();

    act(() => {
      result.current.onChange("Export the invoices as CSV");
    });

    rerender({ text: "Export the invoices as a spreadsheet", rev: 2 });
    act(() => {
      vi.advanceTimersByTime(SAVE_DELAY_MS);
    });

    expect(save).not.toHaveBeenCalled();
    expect(useAppStore.getState().findingDrafts[KEY]).toBeUndefined();
    expect(result.current.value).toBe("Export the invoices as a spreadsheet");
  });

  it("drops the draft once the Go side holds it", () => {
    const { result, rerender } = edit();

    act(() => {
      result.current.onChange("Export the invoices as CSV");
    });
    rerender({ text: "Export the invoices as CSV", rev: 1 });

    expect(useAppStore.getState().findingDrafts[KEY]).toBeUndefined();
    expect(result.current.value).toBe("Export the invoices as CSV");
  });

  it("sends a save still waiting when the field goes away before the typing rests", () => {
    const { result, save, unmount } = edit();

    act(() => {
      result.current.onChange("Export the invoices as CSV");
    });
    unmount();

    expect(save).toHaveBeenCalledExactlyOnceWith("Export the invoices as CSV");
  });

  it("sends nothing as the field goes away with the text written again", () => {
    const { result, save, unmount, live } = edit();

    act(() => {
      result.current.onChange("Export the invoices as CSV");
    });
    // The new text removes the field: it goes away with the old revision in its props.
    live.revision = 2;
    unmount();

    expect(save).not.toHaveBeenCalled();
  });

  it("sends nothing as the field goes away with the text gone", () => {
    const { result, save, unmount, live } = edit();

    act(() => {
      result.current.onChange("Export the invoices as CSV");
    });
    live.revision = null;
    unmount();

    expect(save).not.toHaveBeenCalled();
  });

  it("never records a required text blank, and gives it its stored text back", () => {
    const { result, save } = edit(undefined, 1, true);

    act(() => {
      result.current.onChange("  ");
    });
    act(() => {
      vi.advanceTimersByTime(SAVE_DELAY_MS);
    });
    expect(save).not.toHaveBeenCalled();
    expect(result.current.value).toBe("  ");

    act(() => {
      result.current.onBlur();
    });

    expect(save).not.toHaveBeenCalled();
    expect(useAppStore.getState().findingDrafts[KEY]).toBeUndefined();
    expect(result.current.value).toBe("Export the invoices");
  });

  it("records a text that is not required left blank", () => {
    const { result, save } = edit();

    act(() => {
      result.current.onChange("");
    });
    act(() => {
      result.current.onBlur();
    });

    expect(save).toHaveBeenCalledExactlyOnceWith("");
  });
});
