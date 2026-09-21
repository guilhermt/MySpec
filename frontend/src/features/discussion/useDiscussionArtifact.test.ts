import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDiscussionArtifact } from "@/features/discussion/useDiscussionArtifact";
import { api } from "@/lib/wails";

describe("useDiscussionArtifact", () => {
  it("reads the document and holds what came back", async () => {
    const { result } = renderHook(() => useDiscussionArtifact("discussion-1", "discussion.md", 1));

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.content).toBe("# Discussion\n");
    expect(api.readDiscussionArtifact).toHaveBeenCalledWith("discussion-1", "discussion.md");
  });

  it("reads nothing while there is no document to read", () => {
    const { result } = renderHook(() => useDiscussionArtifact("discussion-1", null, 0));

    expect(result.current.status).toBe("empty");
    expect(api.readDiscussionArtifact).not.toHaveBeenCalled();
  });

  it("reads the document again when the agent writes it again", async () => {
    const { result, rerender } = renderHook(
      ({ revision }: { revision: number }) =>
        useDiscussionArtifact("discussion-1", "discussion.md", revision),
      { initialProps: { revision: 1 } },
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));

    vi.mocked(api.readDiscussionArtifact).mockResolvedValueOnce("# Discussion\n\n## Cards\n");
    rerender({ revision: 2 });

    await waitFor(() => expect(result.current.content).toBe("# Discussion\n\n## Cards\n"));
  });

  it("keeps the failure of a read where the panel can show it", async () => {
    vi.mocked(api.readDiscussionArtifact).mockRejectedValueOnce(new Error("No such file."));
    const { result } = renderHook(() => useDiscussionArtifact("discussion-1", "discussion.md", 1));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("No such file.");
  });
});
