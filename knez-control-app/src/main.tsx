import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import "./utils/observer"; // Initialize observer
import "./mcp/rustEventBridge";
import { governanceService } from "./services/GovernanceService";

void governanceService.getSnapshot().catch(() => null);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
