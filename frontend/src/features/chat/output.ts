/** OUTPUT_FULL_LINES is the most lines an output shows whole; above it only the last OUTPUT_TAIL_LINES show. */
export const OUTPUT_FULL_LINES = 16;

/** OUTPUT_TAIL_LINES is how many lines a long output shows. */
export const OUTPUT_TAIL_LINES = 12;

/** OutputView is what an output shows: its text and how many lines are left above it. */
export interface OutputView {
  text: string;
  /** above is the lines the whole output has beyond the ones shown. */
  above: number;
}

/**
 * outputView is how an output reads: up to OUTPUT_FULL_LINES lines whole, above that the last
 * OUTPUT_TAIL_LINES. lines is how many lines the whole output has, which may be more than text holds.
 */
export function outputView(text: string, lines: number): OutputView {
  const parts = text.split("\n");
  const shown = parts.length > OUTPUT_FULL_LINES ? parts.slice(-OUTPUT_TAIL_LINES) : parts;
  return { text: shown.join("\n"), above: Math.max(lines - shown.length, 0) };
}
