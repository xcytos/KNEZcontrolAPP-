# CP17: Installation, Updates, and State Persistence Strategy

**Status**: Planning
**Priority**: High
**Context**: User requires a robust strategy for installing the KNEZ Control Surface, handling updates without data loss, and synchronizing state between Development and Production environments.

## 1. Installation Strategy

### Prerequisites
- **Runtime**: The end-user machine needs the Tauri runtime (WebView2 on Windows).
- **Backend**: The KNEZ backend (Python) is currently spawned as a sidecar. It must be packaged with the Tauri app or distributed as a standalone executable (using PyInstaller).

### Build Process
1. **Frontend**: `npm run build` generates the static assets in `dist/`.
2. **Backend**: 
   - Use `pyinstaller` to bundle `KNEZ/run.py` into a single executable `knez-backend.exe`.
   - Place this executable in `src-tauri/bin/` with the target triple name (e.g., `knez-backend-x86_64-pc-windows-msvc.exe`).
3. **Tauri**: `npm run tauri build` packages the frontend and bundles the sidecar.

### Installer
- The output will be an `.msi` or `.exe` installer in `src-tauri/target/release/bundle/nsis/`.
- This installer handles placing files in `Program Files`.

## 2. Updates & Data Persistence

To ensure updates do not wipe memory or history:

### Separation of Concerns
- **Application Binaries**: Located in `Program Files` (ReadOnly, replaced on update).
- **User Data**: Located in `%APPDATA%\KNEZ` (Windows) or `~/.config/knez` (Linux/Mac).

### Implementation
1. **Database**: The KNEZ backend must be configured to write its SQLite/ChromaDB files to the **User Data** directory, not the application directory.
   - *Action*: Update `KNEZ/config.py` to check for an environment variable `KNEZ_DATA_DIR` or default to `%APPDATA%\KNEZ`.
2. **Frontend State**: `IndexedDB` and `localStorage` are automatically preserved by the WebView across updates, keyed by the application bundle ID (`com.knez.control`).

### Update Flow
1. **Detection**: The app checks for a new version (e.g., from a GitHub release or S3 bucket).
2. **Download**: Downloads the new installer.
3. **Install**: Runs the installer silently.
4. **Migration**: On first launch of the new version, the backend checks the database schema in `KNEZ_DATA_DIR` and applies migrations if necessary. **Data is never overwritten by the installer.**

## 3. Synchronizing Dev and Prod State

To allow the Development environment (localhost) and the Installed App to share the same "Brain" (Memory & DB):

### Shared Data Directory
- **Concept**: Both the Dev instance (`uvicorn run`) and the Installed App (`knez-backend.exe`) should point to the **same data directory**.
- **Configuration**:
  - Create a global config file at `~/.knez/config.json`.
  - Content: `{ "dataDir": "C:\\Users\\User\\AppData\\Roaming\\KNEZ" }`
  - Both environments read this config on startup.

### Development Workflow
1. **Start Backend**: Run `python KNEZ/run.py --data-dir "C:\Users\...\AppData\Roaming\KNEZ"`.
2. **Start Frontend**: Run `npm run dev`.
3. **Result**: You are developing against the *real* production database.
   - *Warning*: Schema changes in dev will affect the prod database. Use a `dev` flag to append a suffix (e.g., `KNEZ_DEV`) if isolation is preferred.

## 4. Execution Plan (Next Steps)

1. **Backend Config Update**: Modify `KNEZ` to accept `--data-dir` argument and default to standard OS user data paths.
2. **Sidecar Bundling**: Set up PyInstaller pipeline for `KNEZ`.
3. **Tauri Config**: Update `tauri.conf.json` to define the sidecar.
4. **Migration System**: Implement a lightweight migration system for the SQLite DB.
