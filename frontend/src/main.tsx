import "@/styles/fonts.css";
import "@/styles/globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";
import { installInputModality } from "@/lib/input-modality";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("missing #root element");
}

// The measurements (src/dev) take the place of the app only under the dev server and in the
// measure mode of the build (pnpm measure:build); the production build drops these branches, and
// the modules with them.
const measure =
  import.meta.env.DEV || import.meta.env.MODE === "measure"
    ? new URLSearchParams(window.location.search).get("measure")
    : null;

if (measure === "conversation") {
  void import("@/dev/measure-conversation").then(({ measureConversation }) =>
    measureConversation(container),
  );
} else if (measure === "board") {
  void import("@/dev/measure-board").then(({ measureBoard }) => measureBoard(container));
} else if (measure === "history") {
  void import("@/dev/measure-history").then(({ measureHistory }) => measureHistory(container));
} else {
  installInputModality();
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
