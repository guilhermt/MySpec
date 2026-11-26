import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDiscussionArtifact } from "@/features/discussion/useDiscussionArtifact";
import { api } from "@/lib/wails";

describe("useDiscussionArtifact", () => {
  it("reads the context and holds what came back", async () => {
    const { result } = renderHook(() => useDiscussionArtifact("discussion-1", "context.md", 0));

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.content).toBe("# Discussion\n");
    expect(api.readDiscussionArtifact).toHaveBeenCalledWith("discussion-1", "context.md");
  });

  it("reads nothing while there is nothing to read", () => {
    const { result } = renderHook(() => useDiscussionArtifact("discussion-1", null, 0));

    expect(result.current.status).toBe("empty");
    expect(api.readDiscussionArtifact).not.toHaveBeenCalled();
  });

  it("keeps the failure of a read where the panel can show it", async () => {
    vi.mocked(api.readDiscussionArtifact).mockRejectedValueOnce(new Error("No such file."));
    const { result } = renderHook(() => useDiscussionArtifact("discussion-1", "context.md", 0));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("No such file.");
  });

  it("reads the context again on a new attempt", async () => {
    vi.mocked(api.readDiscussionArtifact).mockRejectedValueOnce(new Error("No such file."));
    const { result, rerender } = renderHook(
      ({ attempt }: { attempt: number }) =>
        useDiscussionArtifact("discussion-1", "context.md", attempt),
      { initialProps: { attempt: 0 } },
    );
    await waitFor(() => expect(result.current.status).toBe("error"));

    rerender({ attempt: 1 });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(api.readDiscussionArtifact).toHaveBeenCalledTimes(2);
  });
});
