import "@/styles/fonts.css";
import "@/styles/globals.css";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Base UI closes its popups only after their exit animation; the painted tests
// read the open state and move on, so closing stays synchronous here too.
Object.assign(globalThis, { BASE_UI_ANIMATIONS_DISABLED: true });

// A transition would be read halfway; the suite reads the state a control settles in.
const settled = document.createElement("style");
settled.textContent = "*, *::before, *::after { transition-duration: 0s !important; }";
document.head.append(settled);

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.theme;
});
