import { useCallback, useEffect, useRef } from "react";
import { useAppStore, useTextDraft } from "@/store/app-store";

/** SAVE_DELAY_MS is how long the typing rests before the text is recorded. */
const SAVE_DELAY_MS = 800;

/** EditedText is one text of the interface as the user is leaving it. */
export interface EditedText {
  value: string;
  onChange: (text: string) => void;
  onBlur: () => void;
}

/**
 * useEditedText holds a text of the Go side while the user edits it: what is
 * typed is recorded when the field is left and shortly after the typing stops,
 * and a save still waiting when the field goes away, or takes another text, is
 * sent right then. A required text is never recorded blank: leaving it blank
 * gives the field back the text it had. A draft belongs to the revision it was
 * typed on: a text the agent wrote again drops it, and the save still waiting
 * for it, even when the field was off the screen as it happened, because it was
 * about a text that no longer exists. A draft the Go side already holds is
 * dropped too. liveRevision is the revision the text stands at now, read as the
 * field goes away, and null when the text is gone.
 */
export function useEditedText(
  key: string,
  stored: string,
  revision: number,
  save: (text: string) => void,
  required: boolean,
  liveRevision: () => number | null,
): EditedText {
  const entry = useTextDraft(key);
  const setTextDraft = useAppStore((state) => state.setTextDraft);
  const clearTextDraft = useAppStore((state) => state.clearTextDraft);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef({ text: "", revision });
  const draft = entry !== null && entry.revision === revision ? entry.text : null;
  // The save and the revision the save still waiting goes out with are the
  // ones of the last render.
  const saveRef = useRef(save);
  const liveRef = useRef(liveRevision);
  useEffect(() => {
    saveRef.current = save;
    liveRef.current = liveRevision;
  });

  const stop = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // A new revision makes the save still waiting a save of the old text onto it.
  const seenRevision = useRef(revision);
  useEffect(() => {
    if (seenRevision.current !== revision) {
      seenRevision.current = revision;
      stop();
    }
  }, [revision, stop]);

  useEffect(() => {
    if (entry !== null && (entry.revision !== revision || entry.text === stored)) {
      clearTextDraft(key);
    }
  }, [entry, key, revision, stored, clearTextDraft]);

  // A field removed while focused does not reliably blur: a save still waiting
  // goes out as it unmounts, or the draft on screen would never reach the Go
  // side. A field that stays on screen with another text, a new key, sends it
  // the same way: React runs this cleanup before the effects of the render
  // that brought the new key, so the refs still hold the save and the live
  // revision of the text being left behind. A field removed by the text
  // written again never sees the new revision in its props: the store tells
  // whether the text it was typed on still stands.
  // biome-ignore lint/correctness/useExhaustiveDependencies: key is what the flush follows
  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
        if (liveRef.current() === pending.current.revision) {
          saveRef.current(pending.current.text);
        }
      }
    },
    [key],
  );

  const blank = (text: string) => required && text.trim() === "";

  return {
    value: draft ?? stored,
    onChange: (text: string) => {
      setTextDraft(key, { text, revision });
      stop();
      if (blank(text)) {
        return;
      }
      pending.current = { text, revision };
      timer.current = setTimeout(() => {
        timer.current = null;
        save(text);
      }, SAVE_DELAY_MS);
    },
    onBlur: () => {
      stop();
      if (draft === null) {
        return;
      }
      if (blank(draft)) {
        clearTextDraft(key);
      } else if (draft !== stored) {
        save(draft);
      }
    },
  };
}
