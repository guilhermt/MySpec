import { screen } from "@testing-library/react";

/** spoken is what the status regions on screen hold, one text for each region that holds one. */
export function spoken(): string[] {
  return screen
    .queryAllByRole("status")
    .map((region) => region.textContent?.trim() ?? "")
    .filter((text) => text !== "");
}
