import { useEffect, useState } from "react";
import type { ArtifactState } from "@/features/task/useArtifact";
import { messageOf } from "@/lib/errors";
import { api } from "@/lib/wails";

const EMPTY: ArtifactState = { status: "empty", content: "", error: "" };

/**
 * useDiscussionArtifact reads one document of a discussion: its context or the
 * document the agent writes. A document written again comes with a new
 * revision, which is what reads it once more, as does a new attempt, the one
 * Try again counts. A late answer to a read no longer waited for is dropped.
 */
export function useDiscussionArtifact(
  discussionId: string,
  name: string | null,
  revision: number,
  attempt: number,
): ArtifactState {
  const [state, setState] = useState<ArtifactState>(EMPTY);

  // A new revision is the document having changed on disk; a new attempt is the user asking again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: that is what rereads it
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
  }, [discussionId, name, revision, attempt]);

  return state;
}
