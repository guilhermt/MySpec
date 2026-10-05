/** ReducedMotion is a value of the prefers-reduced-motion media feature. */
type ReducedMotion = "reduce" | "no-preference";

/**
 * emulateReducedMotion puts the page of the painted suite under prefers-reduced-motion: "reduce", or
 * back under "no-preference". It is a command of the browser provider, registered in vitest.config.ts:
 * Chromium takes the preference from the provider, so a test reads the page as it paints for a person
 * who turned the animations off.
 */
export async function emulateReducedMotion(
  context: { page: { emulateMedia(options: { reducedMotion: ReducedMotion }): Promise<void> } },
  value: ReducedMotion,
): Promise<void> {
  await context.page.emulateMedia({ reducedMotion: value });
}

/** PointerPage is the part of the page of the provider the pointer commands use. */
interface PointerPage {
  page: { mouse: { down(): Promise<void>; up(): Promise<void> } };
}

/**
 * pressPointer holds the main button of the pointer down where it rests, so the element under it is
 * :active until releasePointer: userEvent of vitest/browser only clicks, and a press it can't hold is
 * a state a test can't read. The pointer goes to the element first, by userEvent.hover.
 */
export async function pressPointer(context: PointerPage): Promise<void> {
  await context.page.mouse.down();
}

/** releasePointer lets go of the button pressPointer holds. */
export async function releasePointer(context: PointerPage): Promise<void> {
  await context.page.mouse.up();
}
