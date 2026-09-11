import { act, renderHook } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mergePresence, type Presence, usePresence } from "@/features/attention/usePresence";

interface Item {
  id: string;
  label: string;
}

const EXIT_MS = 150;

const keyOf = (item: Item) => item.id;

const A: Item = { id: "a", label: "Review step 3" };
const B: Item = { id: "b", label: "Draft to approve" };
const C: Item = { id: "c", label: "Question" };

function present(item: Item): Presence<Item> {
  return { key: item.id, item, leaving: false };
}

function leaving(item: Item): Presence<Item> {
  return { key: item.id, item, leaving: true };
}

// A new object for every item, the way each snapshot of the app brings new
// objects for the same situations.
function fresh(items: readonly Item[]): Item[] {
  return items.map((item) => ({ ...item }));
}

function keys(shown: readonly Presence<Item>[]): string[] {
  return shown.map((entry) => entry.key);
}

// mount also records what every commit put on screen: a render React throws
// away before committing is never seen by the user, so it is not recorded.
function mount(items: readonly Item[]) {
  const commits: (readonly Presence<Item>[])[] = [];
  const hook = renderHook(
    ({ current }: { current: readonly Item[] }) => {
      const shown = usePresence(current, keyOf, EXIT_MS);
      useLayoutEffect(() => {
        commits.push(shown);
      });
      return shown;
    },
    { initialProps: { current: items } },
  );
  const rerender = (next: readonly Item[]) => hook.rerender({ current: next });
  return { result: hook.result, rerender, unmount: hook.unmount, commits };
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("mergePresence", () => {
  it("shows every item as present when nothing was on screen", () => {
    expect(mergePresence([], [A, B], keyOf)).toEqual([present(A), present(B)]);
  });

  it("follows the new order and keeps what left where it was, marked as leaving", () => {
    expect(mergePresence([present(A), present(B), present(C)], [C, A], keyOf)).toEqual([
      present(C),
      leaving(B),
      present(A),
    ]);
  });

  it("puts what left at the end of a list that got shorter", () => {
    expect(mergePresence([present(A), present(B), present(C)], [A], keyOf)).toEqual([
      present(A),
      leaving(B),
      leaving(C),
    ]);
  });

  it("keeps an item still gone on its way out and takes back one that returned, as it is now", () => {
    const findings = { id: "b", label: "Findings to decide" };

    expect(mergePresence([leaving(A), leaving(B)], [findings], keyOf)).toEqual([
      leaving(A),
      present(findings),
    ]);
  });
});

describe("usePresence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps an item that left on its way out for exitMs, then lets it go", () => {
    const { result, rerender } = mount([A, B]);

    rerender([A]);
    expect(result.current).toEqual([present(A), leaving(B)]);

    advance(EXIT_MS - 1);
    expect(result.current).toEqual([present(A), leaving(B)]);

    advance(1);
    expect(result.current).toEqual([present(A)]);
  });

  it("lets an item go exitMs after it left, however often the items change identity", () => {
    const { result, rerender } = mount([A, B]);

    rerender(fresh([A]));
    // A new snapshot every 50 ms, a pace no exit of 150 ms could wait out if
    // each change started the exit over.
    advance(50);
    rerender(fresh([A]));
    advance(50);
    rerender(fresh([A]));
    advance(49);
    rerender(fresh([A]));
    expect(keys(result.current)).toEqual(["a", "b"]);

    advance(1);
    expect(keys(result.current)).toEqual(["a"]);

    rerender(fresh([A]));
    expect(keys(result.current)).toEqual(["a"]);
  });

  it("shows the new data of an item still on screen in the very commit it changes in", () => {
    const { result, rerender, commits } = mount([A, B]);
    const staged = { id: "a", label: "Step 3 · 50% staged" };
    commits.length = 0;

    rerender([staged]);

    // No commit ever showed the item as it was before.
    expect(commits.map((shown) => shown.map((entry) => entry.item.label))).toEqual([
      ["Step 3 · 50% staged", "Draft to approve"],
    ]);
    expect(result.current[0]?.item).toBe(staged);
  });

  it("takes back an item that returns before its exit finished, and starts a new exit when it leaves again", () => {
    const { result, rerender } = mount([A, B]);
    const findings = { id: "b", label: "Findings to decide" };

    rerender([A]);
    advance(100);
    rerender([A, findings]);
    expect(result.current).toEqual([present(A), present(findings)]);

    // Past the moment the first exit would have ended.
    advance(EXIT_MS);
    expect(result.current).toEqual([present(A), present(findings)]);

    rerender([A]);
    advance(EXIT_MS - 1);
    expect(result.current).toEqual([present(A), leaving(findings)]);

    advance(1);
    expect(result.current).toEqual([present(A)]);
  });

  it("leaves no exit behind once it is gone", () => {
    const { rerender, unmount } = mount([A, B, C]);

    rerender([A]);
    expect(vi.getTimerCount()).not.toBe(0);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
