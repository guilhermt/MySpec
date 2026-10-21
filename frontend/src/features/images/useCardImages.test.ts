import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCardImages } from "@/features/images/useCardImages";
import { api } from "@/lib/wails";
import { makeCardImage, makeCardImageFailure } from "@/test/wails-mock";

describe("useCardImages", () => {
  it("reads nothing without cards, or before the cards are ready", () => {
    const { result, rerender } = renderHook(
      ({ keys, ready }) => useCardImages("board-1", keys, ready),
      { initialProps: { keys: [] as string[], ready: true } },
    );

    expect(result.current.images).toEqual([]);
    expect(result.current.reading).toBe(false);

    rerender({ keys: ["dev/web#12"], ready: false });

    expect(api.cardImages).not.toHaveBeenCalled();
    expect(result.current.reading).toBe(false);
  });

  it("reads the images of the cards once they are ready", async () => {
    vi.mocked(api.cardImages).mockResolvedValue({
      images: [makeCardImage()],
      failures: [makeCardImageFailure()],
    });

    const { result } = renderHook(() => useCardImages("board-1", ["dev/web#12"], true));

    expect(result.current.reading).toBe(true);
    await waitFor(() => expect(result.current.reading).toBe(false));
    expect(api.cardImages).toHaveBeenCalledWith("board-1", ["dev/web#12"]);
    expect(result.current.images).toEqual([makeCardImage()]);
    expect(result.current.failures).toEqual([makeCardImageFailure()]);
  });

  it("settles with the reading in course", async () => {
    let finish: (value: { images: []; failures: [] }) => void = () => {};
    vi.mocked(api.cardImages).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() => useCardImages("board-1", ["dev/web#12"], true));

    const settled = result.current.settled();
    finish({ images: [], failures: [] });

    await expect(settled).resolves.toEqual({ images: [], failures: [] });
  });

  it("ignores a reading that the next one cancels, and reads again when asked to", async () => {
    let first: (value: { images: ReturnType<typeof makeCardImage>[]; failures: [] }) => void =
      () => {};
    vi.mocked(api.cardImages)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          first = resolve;
        }),
      )
      .mockResolvedValueOnce({ images: [makeCardImage({ alt: "Second" })], failures: [] });
    const { result, rerender } = renderHook(
      ({ again }) => useCardImages("board-1", ["dev/web#12"], true, again),
      { initialProps: { again: 0 } },
    );

    rerender({ again: 1 });
    await waitFor(() => expect(result.current.images).toHaveLength(1));
    first({ images: [makeCardImage({ alt: "First" })], failures: [] });
    await Promise.resolve();

    expect(api.cardImages).toHaveBeenCalledTimes(2);
    expect(result.current.images[0]?.alt).toBe("Second");
  });

  it("turns a reading that fails altogether into one failure with no link", async () => {
    vi.mocked(api.cardImages).mockRejectedValue(new Error("gh isn't signed in."));

    const { result } = renderHook(() => useCardImages("board-1", ["dev/web#12"], true));

    await waitFor(() => expect(result.current.failures).toHaveLength(1));
    expect(result.current.failures[0]).toMatchObject({ url: "", reason: "gh isn't signed in" });
    await expect(result.current.settled()).resolves.toMatchObject({ images: [] });
  });

  it("settles with the reading that starts once the cards are ready", async () => {
    const read = makeCardImage();
    vi.mocked(api.cardImages).mockResolvedValue({ images: [read], failures: [] });
    const { result, rerender } = renderHook(
      ({ ready }) => useCardImages("board-1", ["dev/web#12"], ready),
      { initialProps: { ready: false } },
    );

    const settled = result.current.settled();
    expect(api.cardImages).not.toHaveBeenCalled();
    rerender({ ready: true });

    await expect(settled).resolves.toEqual({ images: [read], failures: [] });
  });
});
