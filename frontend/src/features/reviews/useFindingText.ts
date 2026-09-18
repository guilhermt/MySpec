import { useCallback, useEffect, useRef } from "react";
import { useAppStore, useFindingDraft } from "@/store/app-store";

/** SAVE_DELAY_MS is how long the typing rests before the text is recorded. */
const SAVE_DELAY_MS = 800;

/**
 * textKey names one editable text of a review: a finding by its number, or the
 * summary of a pass.
 */
export function textKey(reviewId: string, pass: number, number: number | "summary"): string {
  return `${reviewId}|${pass}|${number}`;
}

/** EditedText is one text of a report as the user is leaving it. */
export interface EditedText {
  value: string;
  onChange: (text: string) => void;
  onBlur: () => void;
}

/**
 * useFindingText holds the text of a finding or of a summary while the user
 * edits it: what is typed is recorded when the field is left and shortly after
 * the typing stops, and a save still waiting when the field goes away is sent
 * right then. A required text, the one of a finding, is never recorded blank:
 * leaving it blank gives the field back the text it had. A draft belongs to the
 * report it was typed on: a pass the agent wrote again drops it, and the save
 * still waiting for it, even when the field was off the screen as it happened,
 * because it was about a text that no longer exists. A draft the Go side
 * already holds is dropped too.
 */
export function useFindingText(
  key: string,
  stored: string,
  revision: number,
  save: (text: string) => void,
  required = false,
): EditedText {
  const entry = useFindingDraft(key);
  const setFindingDraft = useAppStore((state) => state.setFindingDraft);
  const clearFindingDraft = useAppStore((state) => state.clearFindingDraft);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef("");
  const draft = entry !== null && entry.revision === revision ? entry.text : null;
  // The save the unmount flushes with is the one of the last render.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });

  const stop = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // A new report makes the save still waiting a save of the old text onto it.
  const seenRevision = useRef(revision);
  useEffect(() => {
    if (seenRevision.current !== revision) {
      seenRevision.current = revision;
      stop();
    }
  }, [revision, stop]);

  useEffect(() => {
    if (entry !== null && (entry.revision !== revision || entry.text === stored)) {
      clearFindingDraft(key);
    }
  }, [entry, key, revision, stored, clearFindingDraft]);

  // A field removed while focused does not reliably blur: a save still waiting
  // goes out as it unmounts, or the draft on screen would never reach the Go
  // side.
  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
        saveRef.current(pending.current);
      }
    },
    [],
  );

  const blank = (text: string) => required && text.trim() === "";

  return {
    value: draft ?? stored,
    onChange: (text: string) => {
      setFindingDraft(key, { text, revision });
      stop();
      if (blank(text)) {
        return;
      }
      pending.current = text;
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
        clearFindingDraft(key);
      } else if (draft !== stored) {
        save(draft);
      }
    },
  };
}
