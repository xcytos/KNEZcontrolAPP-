# CP7: Cloud, Auth & Remote Expansion

## Overview
With the Verification Layer (CP6.1) established, KNEZ is ready to expand beyond the local machine. CP7 focuses on connecting the local "Identity" to a cloud synchronization layer, enabling remote agent access, and securing the perimeter.

## Ticket Plan

### Major (Cloud & Auth)
1.  **[CP7-M1] Cloud Sync Protocol**
    *   **Goal:** Implement the sync engine to push/pull `SessionLineage` and `Memory` to a remote KNEZ Cloud instance.
    *   **Tech:** Websockets (or gRPC), Differential Sync, Encrypted payload.
2.  **[CP7-M2] User Authentication (OAuth/Key)**
    *   **Goal:** Secure the Control App with a login screen (connecting to KNEZ Cloud or local Key).
    *   **Tech:** JWT handling, Secure Storage for tokens, "Lock Screen" state.
3.  **[CP7-M3] Remote Agent Provisioning**
    *   **Goal:** Allow the Control App to "spawn" or "connect" to a remote KNEZ agent (e.g., on a VPS).
    *   **Tech:** SSH Tunneling or Cloud Relay, Connection Profile UI updates.
4.  **[CP7-M4] Multi-Device Session Handover**
    *   **Goal:** Pause a session on Desktop, resume on Mobile (simulated via another browser/window).
    *   **Tech:** Session serialization, locking mechanisms.
5.  **[CP7-M5] End-to-End Encryption (E2EE) Layer**
    *   **Goal:** Ensure memory and chat data is encrypted before leaving the local machine.
    *   **Tech:** WebCrypto API, Key Management UI.

### Minor (Resilience & Ops)
6.  **[CP7-N1] UX Resilience & Crash Recovery**
    *   **Goal:** If the backend crashes, the UI should offer a "Safe Mode" restart or "Download Logs" option.
    *   **Tech:** Error Boundaries, Log aggregation to file.
7.  **[CP7-N2] Advanced Log Explorer**
    *   **Goal:** A dedicated UI panel to browse internal KNEZ logs (structured JSON logs) with filtering.
    *   **Tech:** Virtualized list, Search/Filter logic.
8.  **[CP7-N3] Connection Profile Manager**
    *   **Goal:** Better UI for managing multiple KNEZ backends (Local, Dev, Prod, Remote).
    *   **Tech:** CRUD UI for profiles, connection testing.

### Micro (Polish)
9.  **[CP7-P1] Telemetry & Usage Heatmap**
    *   **Goal:** Visualize "Tokens used per hour" or "Active times" on the dashboard.
    *   **Tech:** Recharts implementation.
10. **[CP7-P2] Config File Editor**
    *   **Goal:** Edit `knez.toml` or `config.json` directly from the UI settings.
    *   **Tech:** Monaco Editor integration (or simple text area).

## Verification Strategy (CP7-VERIFY)
*   **Auth:** Mock OAuth flow in Playwright.
*   **Sync:** Verify "Cloud" mock receives data when "Sync" is clicked.
*   **Encryption:** Verify data sent to network is ciphertext.
