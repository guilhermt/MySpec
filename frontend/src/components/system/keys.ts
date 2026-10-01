/**
 * isTyping is whether a key went to a text field, where the letters are text and not shortcuts: an
 * input, a textarea or an editable element.
 */
export function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable === true)
  );
}
