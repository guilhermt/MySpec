import { createContext, type RefObject, useContext, useEffect, useState } from "react";
import { observeSize } from "@/components/system/fits";

/** NARROW_PX is the sidebar width under which the rows take their short forms and drop the meta. */
export const NARROW_PX = 330;

/** SidebarWidthContext tells the tree whether the sidebar is narrow, under NARROW_PX. */
export const SidebarWidthContext = createContext(false);

/** useNarrow is the sidebar being narrow, under NARROW_PX. */
export function useNarrow(): boolean {
  return useContext(SidebarWidthContext);
}

/** useWidth is the width of an element, followed by the shared ResizeObserver of observeSize. */
export function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    const measure = () => setWidth(element.clientWidth);
    measure();
    return observeSize(element, measure);
  }, [ref]);

  return width;
}
