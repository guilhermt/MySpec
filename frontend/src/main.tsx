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

installInputModality();
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
