import "@/styles/fonts.css";
import "@/styles/globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("missing #root element");
}

// The measurement of the conversation (src/dev) takes the place of the app only under the dev
// server; the production build drops this branch, and the module with it.
if (
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("measure") === "conversation"
) {
  void import("@/dev/measure-conversation").then(({ measureConversation }) =>
    measureConversation(container),
  );
} else {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
