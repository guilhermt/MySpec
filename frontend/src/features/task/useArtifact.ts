import { useEffect, useState } from "react";
import { messageOf } from "@/lib/errors";
import { api } from "@/lib/wails";

/** ArtifactState is one document of a task as the panel holds it. */
export interface ArtifactState {
  status: "empty" | "loading" | "ready" | "error";
  content: string;
  error: string;
}

const EMPTY: ArtifactState = { status: "empty", content: "", error: "" };

/**
 * useArtifact reads one document of a task, again on every version the watcher
 * announces. A late answer to a read the panel no longer waits for is dropped.
 */
export function useArtifact(
  taskId: string,
  name: string | null,
  artifactVersion: number,
): ArtifactState {
  const [state, setState] = useState<ArtifactState>(EMPTY);

  // A new artifactVersion is the watcher saying the file changed on disk.
  // biome-ignore lint/correctness/useExhaustiveDependencies: that is what rereads it
  useEffect(() => {
    if (name === null) {
      setState(EMPTY);
      return;
    }
    let stale = false;
    setState({ status: "loading", content: "", error: "" });
    api
      .readArtifact(taskId, name)
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
  }, [taskId, name, artifactVersion]);

  return state;
}
