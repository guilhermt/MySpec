/** DropHint covers the target of a drag of files, which says what dropping does. */
export function DropHint() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md bg-surface-input/80 text-(length:--text-meta) leading-(--leading-meta) text-ink-2"
    >
      Drop images to attach
    </div>
  );
}
