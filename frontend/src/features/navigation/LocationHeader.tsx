import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { type PlaceCrumb, PlaceHeader } from "@/components/system/PlaceHeader";
import { breadcrumbOf, locationTitle } from "@/lib/locations";
import { useAppStore, useBackTarget, useForwardTarget, useLocation } from "@/store/app-store";

export interface LocationHeaderProps {
  /** progress is where the item stands, after the title: the stepper of a task. */
  progress?: ReactNode;
  /** children is what the place holds on the right, in its order. */
  children?: ReactNode;
}

/**
 * LocationHeader is the header of the place on screen: back and forward through the history, the
 * breadcrumb and the title, read from the store. It takes the focus a navigation asked for once
 * the new place is on screen.
 */
export function LocationHeader({ progress, children }: LocationHeaderProps) {
  const app = useAppStore((state) => state.app);
  const location = useLocation();
  const backTarget = useBackTarget();
  const forwardTarget = useForwardTarget();
  const pendingFocus = useAppStore((state) => state.pendingFocus);
  const go = useAppStore((state) => state.go);
  const goBack = useAppStore((state) => state.goBack);
  const goForward = useAppStore((state) => state.goForward);
  const clearPendingFocus = useAppStore((state) => state.clearPendingFocus);

  const titleRef = useRef<HTMLHeadingElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const forwardRef = useRef<HTMLButtonElement>(null);

  const crumbs = useMemo<PlaceCrumb[]>(
    () =>
      breadcrumbOf(app, location).map(({ label, location: place }) =>
        place === null ? { label } : { label, onOpen: () => go(place, { focus: "title" }) },
      ),
    [app, location, go],
  );

  // The header is drawn again with every place, so the focus a navigation
  // asked for lands here: the title, or the button that was clicked. Forward
  // with nowhere left to go leaves the focus on Back. What a situation of a task asks is the task
  // screen's to settle.
  useEffect(() => {
    if (pendingFocus === null || pendingFocus === "request") {
      return;
    }
    const target =
      pendingFocus === "title"
        ? titleRef.current
        : pendingFocus === "back"
          ? backRef.current
          : (forwardRef.current ?? backRef.current);
    target?.focus();
    clearPendingFocus();
  }, [pendingFocus, clearPendingFocus]);

  return (
    <PlaceHeader
      back={
        backTarget === null
          ? null
          : {
              title: locationTitle(app, backTarget),
              onClick: () => goBack({ focus: "back" }),
            }
      }
      forward={
        forwardTarget === null
          ? null
          : {
              title: locationTitle(app, forwardTarget),
              onClick: () => goForward({ focus: "forward" }),
            }
      }
      crumbs={crumbs}
      title={locationTitle(app, location)}
      titleRef={titleRef}
      backRef={backRef}
      forwardRef={forwardRef}
      progress={progress}
    >
      {children}
    </PlaceHeader>
  );
}
