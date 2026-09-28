import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

/**
 * whenExitEnds calls done once the exit of element has played: the animation a `data-leaving`
 * attribute starts on the element itself. What runs inside it, a spinner, a skeleton or a pulse
 * that loops forever, is not waited on, and neither is a loop on the element. It calls done at
 * once when no exit plays, as without motion or where animations are not played, and at the latest
 * once the exit's own duration is over. It returns what cancels the wait.
 */
export function whenExitEnds(element: Element | null, done: () => void): () => void {
  const exits =
    element !== null && typeof element.getAnimations === "function"
      ? element
          .getAnimations()
          .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
      : [];
  if (exits.length === 0) {
    done();
    return () => {};
  }
  let waiting = true;
  const finish = () => {
    if (waiting) {
      waiting = false;
      done();
    }
  };
  // The ceiling is the exit's own end, in case it never reports it.
  const end = Math.max(
    ...exits.map((animation) => Number(animation.effect?.getComputedTiming().endTime ?? 0)),
  );
  const ceiling = setTimeout(finish, end);
  void Promise.allSettled(exits.map((animation) => animation.finished)).then(finish);
  return () => {
    waiting = false;
    clearTimeout(ceiling);
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
    // The exit plays on what it holds, the one element inside the wrapper.
    return whenExitEnds(ref.current?.firstElementChild ?? null, () => {
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
