import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { AuthGate } from "./auth/AuthGate.tsx";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("#root element not found");
}

// THE CRUX (Plan 18-06, AUTH-02): the boot gate is the root — it interposes a
// synchronous, offline-safe identity check between the DOM mount and <App/>.
// Boot NEVER awaits a network auth call (D-05/D-06, RESEARCH Pitfall 1).
createRoot(rootEl).render(
  <StrictMode>
    <AuthGate />
  </StrictMode>,
);
