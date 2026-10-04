/**
 * revealItem scrolls an item of a list that scrolls into view: centred when it fits in the box that
 * scrolls it, and by its top when it is taller, so its head never lands above what is seen. The
 * item's scroll margin counts as part of it, which keeps its head clear of a fade at the top. Only
 * that box scrolls, never the boxes around it. With a control of the item, the scroll goes on until
 * the control is whole above the scroll padding at the bottom of the box, which is the room for what
 * floats over its end.
 */
export function revealItem(element: HTMLElement, control?: HTMLElement): void {
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
  if (control === undefined) {
    return;
  }
  const limit = box.getBoundingClientRect().bottom - bottomPadding(box);
  const hidden = control.getBoundingClientRect().bottom - limit;
  if (hidden > 0) {
    box.scrollTop += Math.ceil(hidden);
  }
}

/** bottomPadding is the scroll padding at the bottom of a box that scrolls, in pixels. */
export function bottomPadding(box: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(box).scrollPaddingBottom) || 0;
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
