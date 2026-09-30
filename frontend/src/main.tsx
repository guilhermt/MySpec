import "@/styles/fonts.css";
import "@/styles/globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("missing #root element");
}

// The measurements (src/dev) take the place of the app only under the dev server; the production
// build drops these branches, and the modules with them.
const measure = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get("measure")
  : null;

if (measure === "conversation") {
  void import("@/dev/measure-conversation").then(({ measureConversation }) =>
    measureConversation(container),
  );
} else if (measure === "board") {
  void import("@/dev/measure-board").then(({ measureBoard }) => measureBoard(container));
} else {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
