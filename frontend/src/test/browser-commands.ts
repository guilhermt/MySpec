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
