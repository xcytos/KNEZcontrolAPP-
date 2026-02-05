# NEXTPLAN.md

## 🎫 Ticket Set #3 (Deployment & Scaling)

### 🎫 Major Tickets (Cloud & Production)

1. **CP7-A: Cloud Sync & Auth Integration**
   * **Why**: Users want to access KNEZ from multiple devices.
   * **What**: Integrate Supabase/Firebase Auth. Sync `.taqwin` state to cloud storage.
   * **Dependencies**: CP6-I

2. **CP7-B: Docker Containerization**
   * **Why**: Deployment ease.
   * **What**: `Dockerfile` for KNEZ backend. `docker-compose.yml` for full stack (excluding Tauri).
   * **Dependencies**: CP5-10

3. **CP7-C: Model Router Configuration UI**
   * **Why**: Users want to switch between OpenAI, Anthropic, and Local LLMs easily.
   * **What**: "Models" tab in Settings. API Key management (secure storage).
   * **Dependencies**: CP6-G

4. **CP7-D: Plugin Marketplace (MCP Store)**
   * **Why**: Extensibility.
   * **What**: Browse and install community MCP servers via URL.
   * **Dependencies**: CP5-6

5. **CP7-E: Headless Mode (CLI/Service)**
   * **Why**: Server usage.
   * **What**: Run KNEZ without GUI, accessible via API only.
   * **Dependencies**: CP6-B

### 🎫 Minor Tickets (Security & Opt)

6. **CP7-F: End-to-End Encryption**
   * **Why**: Privacy.
   * **What**: Client-side encryption of chat history before sync.
   * **Dependencies**: CP7-A

7. **CP7-G: Database Migration System**
   * **Why**: Data stability.
   * **What**: Alembic/SQLAlchemy migrations for KNEZ backend (moving off mock memory).
   * **Dependencies**: CP6-D

8. **CP7-H: Keyboard Shortcuts Manager**
   * **Why**: Power users.
   * **What**: Customizable hotkeys for "Capture", "Voice", "Agent".
   * **Dependencies**: CP6-A

### 🎫 Micro Tickets (Polish)

9. **CP7-I: Onboarding Tour**
   * **Why**: New user experience.
   * **What**: "Welcome to KNEZ" modal with step-by-step guide.
   * **Dependencies**: CP7-H

10. **CP7-J: Auto-Updater**
    * **Why**: Maintenance.
    * **What**: Tauri updater integration.
    * **Dependencies**: CP7-B
