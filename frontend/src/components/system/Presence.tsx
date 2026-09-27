import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

/**
 * whenExitEnds calls done once every animation running in element and under it has ended: the exit
 * animation a `data-leaving` attribute starts. It calls done at once when nothing runs, as without
 * motion or where animations are not played, and returns what cancels the wait.
 */
export function whenExitEnds(element: Element | null, done: () => void): () => void {
  const animations =
    element !== null && typeof element.getAnimations === "function"
      ? element.getAnimations({ subtree: true })
      : [];
  if (animations.length === 0) {
    done();
    return () => {};
  }
  let waiting = true;
  void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
    if (waiting) {
      done();
    }
  });
  return () => {
    waiting = false;
  };
}

export interface PresenceProps {
  /** children is what is on screen; null, undefined or false once it leaves. */
  children: ReactNode;
}

/**
 * Presence keeps what it held on screen while it plays its exit, then lets it go. Leaving, the
 * wrapper carries `data-leaving`, which the exit animation of what it holds keys on, and is inert,
 * so nothing in it takes a click or the focus. The wrapper is `display: contents` and adds no box.
 */
export function Presence({ children }: PresenceProps) {
  const present = children !== null && children !== undefined && children !== false;
  const kept = useRef<ReactNode>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [, setGone] = useState(0);
  if (present) {
    kept.current = children;
  }
  const leaving = !present && kept.current !== null;

  useLayoutEffect(() => {
    if (!leaving) {
      return;
    }
    return whenExitEnds(ref.current, () => {
      kept.current = null;
      setGone((count) => count + 1);
    });
  }, [leaving]);

  return (
    <div ref={ref} className="contents" {...(leaving ? { "data-leaving": "", inert: true } : {})}>
      {kept.current}
    </div>
  );
}
