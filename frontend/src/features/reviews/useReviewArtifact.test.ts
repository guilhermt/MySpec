import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useReviewArtifact } from "@/features/reviews/useReviewArtifact";
import { api } from "@/lib/wails";

describe("useReviewArtifact", () => {
  it("reads the document and holds what came back", async () => {
    const { result } = renderHook(() => useReviewArtifact("review-1", "review-1.md", 1));

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.content).toBe("## Findings\n");
    expect(api.readReviewArtifact).toHaveBeenCalledWith("review-1", "review-1.md");
  });

  it("reads nothing while there is no document to read", () => {
    const { result } = renderHook(() => useReviewArtifact("review-1", null, 1));

    expect(result.current.status).toBe("empty");
    expect(api.readReviewArtifact).not.toHaveBeenCalled();
  });

  it("reads the report again when the agent writes it again", async () => {
    const { result, rerender } = renderHook(
      ({ revision }: { revision: number }) =>
        useReviewArtifact("review-1", "review-1.md", revision),
      { initialProps: { revision: 1 } },
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));

    vi.mocked(api.readReviewArtifact).mockResolvedValueOnce("## Findings\n\n### 1\n");
    rerender({ revision: 2 });

    await waitFor(() => expect(result.current.content).toBe("## Findings\n\n### 1\n"));
  });

  it("keeps the failure of a read where the panel can show it", async () => {
    vi.mocked(api.readReviewArtifact).mockRejectedValueOnce(new Error("No such file."));
    const { result } = renderHook(() => useReviewArtifact("review-1", "review-9.md", 1));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("No such file.");
  });
});
