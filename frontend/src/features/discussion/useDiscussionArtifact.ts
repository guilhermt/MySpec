import { useEffect, useState } from "react";
import type { ArtifactState } from "@/features/task/useArtifact";
import { messageOf } from "@/lib/errors";
import { api } from "@/lib/wails";

const EMPTY: ArtifactState = { status: "empty", content: "", error: "" };

/**
 * useDiscussionArtifact reads the context of a discussion. A new attempt, the
 * one Try again counts, reads it once more. A late answer to a read no longer
 * waited for is dropped.
 */
export function useDiscussionArtifact(
  discussionId: string,
  name: string | null,
  attempt: number,
): ArtifactState {
  const [state, setState] = useState<ArtifactState>(EMPTY);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new attempt is what rereads it
  useEffect(() => {
    if (name === null) {
      setState(EMPTY);
      return;
    }
    let stale = false;
    setState({ status: "loading", content: "", error: "" });
    api
      .readDiscussionArtifact(discussionId, name)
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
  }, [discussionId, name, attempt]);

  return state;
}
