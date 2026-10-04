import { type RefObject, useLayoutEffect } from "react";

/**
 * useToastLift lifts the toasts of the main area above an element docked at its foot, the composer:
 * while the element is drawn, the toasts stand above its top edge instead of over it. The lift is
 * the distance from that edge to the foot of the main area, on a whole pixel, and follows the
 * element as it grows.
 */
export function useToastLift(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const element = ref.current;
    const main = element?.closest<HTMLElement>(".main-area");
    if (element === null || element === undefined || main === null || main === undefined) {
      return;
    }
    const lift = () => {
      const height = main.getBoundingClientRect().bottom - element.getBoundingClientRect().top;
      main.style.setProperty("--toast-lift", `${Math.max(0, Math.ceil(height))}px`);
    };
    lift();
    const observer = new ResizeObserver(lift);
    observer.observe(element);
    observer.observe(main);
    return () => {
      observer.disconnect();
      main.style.removeProperty("--toast-lift");
    };
  }, [ref]);
}
