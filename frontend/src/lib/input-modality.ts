/**
 * installInputModality keeps the modality of the last input on the root as data-input, "keyboard"
 * after a key and "pointer" after a press, starting at "pointer". The focus-visible variant of
 * globals.css reads it. It returns the function that removes the listeners.
 */
export function installInputModality(root: HTMLElement = document.documentElement): () => void {
  const toKeyboard = () => {
    root.dataset.input = "keyboard";
  };
  const toPointer = () => {
    root.dataset.input = "pointer";
  };
  root.dataset.input = "pointer";
  document.addEventListener("keydown", toKeyboard, true);
  document.addEventListener("pointerdown", toPointer, true);
  return () => {
    document.removeEventListener("keydown", toKeyboard, true);
    document.removeEventListener("pointerdown", toPointer, true);
  };
}
