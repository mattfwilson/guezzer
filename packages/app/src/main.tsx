import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

// Temporary placeholder mount — replaced by <App/> in Task 3 (hash router + nav skeleton).
const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("#root element not found");
}

createRoot(rootEl).render(
  <StrictMode>
    <div>Guezzer</div>
  </StrictMode>,
);
