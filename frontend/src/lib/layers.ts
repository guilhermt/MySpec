// What is layered over the screen, read from the DOM: the dialogs of the
// system carry the data-slot shadcn gives them, and the menus, listboxes and
// popovers say they are open with data-open.

const MODALS = '[data-slot="dialog-content"], [data-slot="alert-dialog-content"]';
const LAYERS = `${MODALS}, [role="menu"][data-open], [role="listbox"][data-open], [data-slot="popover-content"][data-open]`;

/** modalOpen tells whether a modal dialog is on screen: a dialog or an alert dialog of the system. */
export function modalOpen(doc: Document = document): boolean {
  return doc.querySelector(MODALS) !== null;
}

/** layerOpen tells whether anything that Esc closes first is on screen: a modal, a menu, a listbox or a popover. */
export function layerOpen(doc: Document = document): boolean {
  return doc.querySelector(LAYERS) !== null;
}
