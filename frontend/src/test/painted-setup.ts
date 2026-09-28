import "@/styles/fonts.css";
import "@/styles/globals.css";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll } from "vitest";

// Base UI closes its popups only after their exit animation; the painted tests
// read the open state and move on, so closing stays synchronous here too.
Object.assign(globalThis, { BASE_UI_ANIMATIONS_DISABLED: true });

// A transition would be read halfway; the suite reads the state a control settles in.
const settled = document.createElement("style");
settled.textContent = "*, *::before, *::after { transition-duration: 0s !important; }";
document.head.append(settled);

// The painted tests measure text, so the faces `fonts.css` imports must be loaded
// before any of them run; otherwise the first ones measure with the fallback font.
const FACES = [
  "400 16px 'Fira Sans'",
  "italic 400 16px 'Fira Sans'",
  "500 16px 'Fira Sans'",
  "600 16px 'Fira Sans'",
  "700 16px 'Fira Sans'",
  "400 16px 'Fira Code'",
  "500 16px 'Fira Code'",
];

beforeAll(async () => {
  await Promise.all(FACES.map((face) => document.fonts.load(face)));
  await document.fonts.ready;
});

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.theme;
});
