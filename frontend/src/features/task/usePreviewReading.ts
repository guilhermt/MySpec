import { useEffect, useRef, useState } from "react";
import type { PreviewReading } from "@/features/task/deletion";
import { readDeletePreview } from "@/store/actions";

// NOTHING is the reading of a task with no worktree to ask about: nothing to read, nothing to list.
const NOTHING: PreviewReading = {
  kind: "ready",
  preview: { worktree: null, branch: null, pr: null },
};

/**
 * usePreviewReading reads what the deletion of a task destroys each time its dialog opens, and
 * drops the answer of an opening that has gone by. Without enabled it answers an empty reading and
 * never asks.
 */
export function usePreviewReading(taskId: string, open: boolean, enabled = true): PreviewReading {
  const [reading, setReading] = useState<PreviewReading>({ kind: "reading" });
  const opening = useRef(0);

  useEffect(() => {
    if (!open || !enabled) {
      return;
    }
    const current = ++opening.current;
    setReading({ kind: "reading" });
    void readDeletePreview(taskId).then((answer) => {
      if (opening.current === current) {
        setReading(answer);
      }
    });
    return () => {
      // A dialog that closed, or a task that changed, does not take the answer.
      opening.current++;
    };
  }, [taskId, open, enabled]);

  return enabled ? reading : NOTHING;
}
