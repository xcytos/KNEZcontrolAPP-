# KNEZ Control App Debug Tools

Debugging utilities and analysis tools for TAQWIN Data Explorer and knez-control-app development.

## Directory Structure

```
.debug-tools/
├── README.md                       # This file
├── db-inspector/                   # Database inspection tools
│   ├── postgres-schema.sql         # PostgreSQL schema queries
│   ├── sqlite-schema.sql           # SQLite schema queries
│   └── test-queries.sql            # Test data queries
├── mcp-test/                       # MCP tool testing
│   ├── session-manager-tests.json  # TAQWIN Session MCP tests
│   ├── document-manager-tests.json # Document Manager MCP tests
│   └── taqwin-agent-tests.json     # TAQWIN Agent MCP tests
├── ui-labeller/                    # ✅ UI component inspector (INTEGRATED)
│   ├── injector.js                 # Source code (25KB)
│   ├── deploy.bat                  # Deployment script
│   ├── README.md                   # Usage guide
│   └── INSTALLATION.md             # Integration guide
├── logs/                           # Debug logs
│   ├── rust-backend.log            # Tauri backend logs
│   ├── frontend-console.log        # Browser console logs
│   └── mcp-calls.log               # MCP invocation logs
└── scripts/                        # Utility scripts
    ├── test-postgres-connection.ps1
    ├── test-documents-loading.ps1
    └── analyze-session-data.ps1
```

## Quick Start

### 1. UI Labeller (Element Inspector) ✅
**Status**: INTEGRATED and READY  
**Activation**: Press `Ctrl+Shift+D` in running app  

```powershell
# Start dev server (if not running)
npm run tauri dev

# In browser window:
# 1. Press Ctrl+Shift+D to activate inspector
# 2. Hover over any UI element to see component details
# 3. Click element to copy JSON details to clipboard
```

**Features**:
- ✅ DevTools-style hover highlighting
- ✅ Real React component names (semantic detection + Fiber)
- ✅ Click to copy component details (JSON)
- ✅ Color metrics (background, text, border)
- ✅ File locations (when available)
- ✅ Keyboard shortcut: `Ctrl+Shift+D`
- ✅ Development-only (no production impact)
- ✅ 37+ framework components filtered

**Output Example**:
```json
{
  "component": "Hero.Heading",
  "componentPath": "Hero.Heading → Hero",
  "tag": "h1",
  "text": "TAQWIN Data Explorer",
  "location": "DataExplorer.tsx:42",
  "dimensions": "406×35",
  "colors": {
    "background": "#ffffff",
    "text": "#1a1a1a",
    "border": "none"
  },
  "classes": "text-[1.75rem] font-extrabold",
  "selector": "h1.text-[1.75rem]"
}
```

### 2. Test PostgreSQL Connection
```powershell
cd .debug-tools/scripts
.\test-postgres-connection.ps1
```

### 3. Inspect Database Schema
```sql
-- PostgreSQL
psql -h db.sspsljqdhesqezrmspcj.supabase.co -U postgres -d postgres -f db-inspector/postgres-schema.sql

-- SQLite
sqlite3 C:\Users\syedm\taqwin_memory.db < db-inspector/sqlite-schema.sql
```

### 4. Test MCP Tools
```powershell
# Use Kiro MCP Powers or direct uvx calls
uvx taqwin-mcp-server
```

## Database Connections

### PostgreSQL (Supabase)
- **Host**: `db.sspsljqdhesqezrmspcj.supabase.co`
- **Port**: `5432`
- **Database**: `postgres`
- **User**: `postgres`
- **Tables**: `documents` (46 docs), `document_versions`, `document_checkpoint_links`

### SQLite (TAQWIN)
- **Path**: `C:\Users\syedm\taqwin_memory.db`
- **Tables**: `sessions`, `checkpoints`, `events`, `projects`, `memories`

## Common Debug Tasks

### Check Document Loading
```typescript
// Browser Console
const { mcpDocumentBridge } = await import('/src/services/data/McpDocumentBridge.js');
const docs = await mcpDocumentBridge.listAllDocuments();
console.log(`Loaded ${docs.length} documents`);
```

### Check Session Data
```typescript
// Browser Console
const { taqwinDataService } = await import('/src/services/data/TaqwinDataService.js');
const sessions = await taqwinDataService.listSessions(100);
console.log(`Found ${sessions.length} sessions`);
```

### Check PostgreSQL Connection
```typescript
// Browser Console
const { postgresService } = await import('/src/services/data/DatabaseService.js');
console.log('Connected:', postgresService.isConnected());
```

## Known Issues & Fixes

### Issue 1: Documents Not Loading
**Symptom**: Empty document lists, "[TaqwinDataService] MCP not available"  
**Cause**: MCP Bridge tried to use `window.mcp.call()` (doesn't exist in Tauri)  
**Fix**: Use `postgresService` connection (CA009-CP029)  
**Status**: ✅ FIXED

### Issue 2: Rust Panic on Tags Column
**Symptom**: `ColumnDecode error: TEXT[] not compatible with JSONB`  
**Cause**: PostgreSQL `tags` column is TEXT[], code tried to read as JSONB  
**Fix**: Use `try_get::<Vec<String>, _>()` with JSON fallback  
**Status**: ✅ FIXED

### Issue 3: TLS Connection Error
**Symptom**: "TLS upgrade required but SQLx built without TLS support"  
**Cause**: Missing `tls-native-tls` feature in Cargo.toml  
**Fix**: Added feature to sqlx dependency  
**Status**: ✅ FIXED

### Issue 4: UI Labeller Integration
**Symptom**: Need component inspector during development  
**Solution**: Integrated UI Labeller v4 with Ctrl+Shift+D hotkey  
**Files Modified**:
- `index.html` - Added conditional script loading
- `tauri.conf.json` - Updated CSP for inline scripts
- `public/.debug-tools/ui-labeller.js` - Deployed inspector (25KB)
**Status**: ✅ INTEGRATED (Press Ctrl+Shift+D to activate)

## Session Knowledge

### CA009 (Current Session)
- **Name**: DATA_VISUALIZATION_EXPLORER
- **UUID**: `196bb472-848f-43df-aadb-ec39b81cc410`
- **Checkpoints**: 29 (latest: CA009-CP029)
- **Documents**: 2 specifications
- **Focus**: TAQWIN Data Explorer, document loading, dashboard improvements

### DA003 (Session Lifecycle)
- **Name**: TAQWIN Session MCP - 0 Tools Bug Fix
- **UUID**: `DA003`
- **Checkpoints**: 5 (comprehensive testing complete)
- **Documents**: 12 (specifications, design docs, notes)
- **Contributions**: Heartbeat pattern, auto-activate, status history

## MCP Tools Reference

### TAQWIN Session MCP
- `session_manager` - 5 actions (create, list, resume, update_status, attach)
- `checkpoint_manager` - 5 actions (create, list, get, link, get_session_context)
- `dev_event_logger` - 1 action (add_dev_event)
- `memory_retriever` - 1 action (memory_retrieval)

### Document Manager MCP
- `document_manager` - 12 actions (CRUD, search, versioning, checkpoint integration)

### TAQWIN Agent MCP
- `database_manager` - 3 actions (read, modify, analyze) for SQLite & PostgreSQL
- `activate_taqwin` - Load canonical documents
- `ask_taqwin` - Query with reasoning transparency
- `refresh_agent` - Self-learning cycle

## Troubleshooting

### Documents Not Appearing
1. Check PostgreSQL connection: Browser Console → `postgresService.isConnected()`
2. Check Rust backend: Look for panics in terminal output
3. Check schema alignment: Run `db-inspector/postgres-schema.sql`
4. Check document count: Run MCP query `SELECT COUNT(*) FROM documents`

### Session Data Missing
1. Check SQLite path: `C:\Users\syedm\taqwin_memory.db` exists
2. Check session table: Run `db-inspector/sqlite-schema.sql`
3. Check project_id: Sessions require valid project_id since DA003

### Build Errors
1. Frontend: `npm run build` should show 0 errors
2. Backend: `cargo check` should compile successfully
3. Hot-reload: Watch for "Rebuilding application" in terminal

## Contact & Support

**Session**: CA009 (DATA_VISUALIZATION_EXPLORER)  
**Project**: knez-control-app  
**TAQWIN Session MCP**: Active  
**Document Manager MCP**: Available  
**TAQWIN Agent MCP**: Available

---

**Last Updated**: 2026-06-21 (CA009-CP029)  
**Status**: All systems operational ✅
