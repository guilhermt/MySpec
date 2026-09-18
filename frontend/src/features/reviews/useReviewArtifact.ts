import { useEffect, useState } from "react";
import type { ArtifactState } from "@/features/task/useArtifact";
import { messageOf } from "@/lib/errors";
import { api } from "@/lib/wails";

const EMPTY: ArtifactState = { status: "empty", content: "", error: "" };

/**
 * useReviewArtifact reads one document of a review: its context or the report
 * of a pass. A report the agent wrote again comes with a new revision, which is
 * what reads it once more. A late answer to a read no longer waited for is
 * dropped.
 */
export function useReviewArtifact(
  reviewId: string,
  name: string | null,
  revision: number,
): ArtifactState {
  const [state, setState] = useState<ArtifactState>(EMPTY);

  // A new revision is the report having changed on disk.
  // biome-ignore lint/correctness/useExhaustiveDependencies: that is what rereads it
  useEffect(() => {
    if (name === null) {
      setState(EMPTY);
      return;
    }
    let stale = false;
    setState({ status: "loading", content: "", error: "" });
    api
      .readReviewArtifact(reviewId, name)
      .then((content) => {
        if (!stale) {
          setState({ status: "ready", content, error: "" });
        }
      })
      .catch((reason: unknown) => {
        if (!stale) {
          setState({ status: "error", content: "", error: messageOf(reason) });
        }
      });
    return () => {
      stale = true;
    };
  }, [reviewId, name, revision]);

  return state;
}
