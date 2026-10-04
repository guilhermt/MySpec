import { type RefObject, useLayoutEffect } from "react";

// LIFTS is, per main area, the lift each element docked at its foot asks for.
const LIFTS = new WeakMap<HTMLElement, Map<HTMLElement, number>>();

function publish(main: HTMLElement, lifts: Map<HTMLElement, number>): void {
  if (lifts.size === 0) {
    main.style.removeProperty("--toast-lift");
    return;
  }
  main.style.setProperty("--toast-lift", `${Math.max(...lifts.values())}px`);
}

/**
 * useToastLift lifts the toasts of the main area above an element docked at its foot, the composer
 * or the request bar: while the element is drawn, the toasts stand above its top edge instead of
 * over it. The lift of an element is the distance from that edge to the foot of the main area, on a
 * whole pixel, and follows the element as it grows; with several docked, the toasts clear the
 * highest.
 */
export function useToastLift(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const element = ref.current;
    const main = element?.closest<HTMLElement>(".main-area");
    if (element === null || element === undefined || main === null || main === undefined) {
      return;
    }
    const lifts = LIFTS.get(main) ?? new Map<HTMLElement, number>();
    LIFTS.set(main, lifts);
    const lift = () => {
      const height = main.getBoundingClientRect().bottom - element.getBoundingClientRect().top;
      lifts.set(element, Math.max(0, Math.ceil(height)));
      publish(main, lifts);
    };
    lift();
    const observer = new ResizeObserver(lift);
    observer.observe(element);
    observer.observe(main);
    return () => {
      observer.disconnect();
      lifts.delete(element);
      publish(main, lifts);
    };
  }, [ref]);
}
