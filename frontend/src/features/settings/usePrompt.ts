import { useCallback, useEffect, useState } from "react";
import { messageOf } from "@/lib/errors";
import type { Prompt, PromptStage } from "@/lib/wails";
import { getPrompt } from "@/store/actions";

/** PromptState is one prompt as the page holds it. */
export type PromptState =
  | { status: "loading" }
  | { status: "ready"; prompt: Prompt }
  | { status: "failed"; message: string };

export interface PromptReading {
  state: PromptState;
  /** setPrompt takes the prompt a save or a reset answered with. */
  setPrompt: (prompt: Prompt) => void;
  /** retry reads the prompt again. */
  retry: () => void;
}

/**
 * usePrompt reads the text of one prompt. A late answer to a read nobody waits for any more is
 * dropped.
 */
export function usePrompt(stage: PromptStage): PromptReading {
  const [state, setState] = useState<PromptState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new attempt reads the prompt again.
  useEffect(() => {
    let stale = false;
    setState({ status: "loading" });
    getPrompt(stage)
      .then((prompt) => {
        if (!stale) setState({ status: "ready", prompt });
      })
      .catch((reason: unknown) => {
        if (!stale) setState({ status: "failed", message: messageOf(reason) });
      });
    return () => {
      stale = true;
    };
  }, [stage, attempt]);

  const setPrompt = useCallback((prompt: Prompt) => setState({ status: "ready", prompt }), []);
  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { state, setPrompt, retry };
}
