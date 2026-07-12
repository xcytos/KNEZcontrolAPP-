import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import "./utils/observer"; // Initialize observer
import "./mcp/rustEventBridge";
import { governanceService } from "./services/governance/GovernanceService";
import { markReactInitStart } from "./observability/StartupMetrics";

// Tauri API is available globally via window.__TAURI__

// Initialize governance service
void governanceService.getSnapshot().catch(() => null);

// Note: MemoryLoaderService disabled for browser compatibility
// It uses Node.js fs module which doesn't work in browser/Tauri environment
// To enable: Move file watching to Rust backend or use Tauri's file system API

markReactInitStart();
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
