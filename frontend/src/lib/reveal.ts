/**
 * revealItem scrolls an item of a list that scrolls into view: centred when it fits in the box that
 * scrolls it, and by its top when it is taller, so its head never lands above what is seen. The
 * item's scroll margin counts as part of it, which keeps its head clear of a fade at the top. Only
 * that box scrolls, never the boxes around it.
 */
export function revealItem(element: HTMLElement): void {
  const box = scrollerOf(element);
  if (box === null) {
    element.scrollIntoView?.({ block: "center" });
    return;
  }
  const margin = Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
  const item = element.getBoundingClientRect();
  const top = item.top - box.getBoundingClientRect().top + box.scrollTop;
  const tall = item.height + margin > box.clientHeight;
  box.scrollTop = Math.round(tall ? top - margin : top - (box.clientHeight - item.height) / 2);
}

/** scrollerOf is the nearest ancestor that scrolls vertically; null when none does. */
export function scrollerOf(element: HTMLElement): HTMLElement | null {
  for (let node = element.parentElement; node !== null; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") {
      return node;
    }
  }
  return null;
}
