# KNEZ Control App - Connection Guide

**Version:** 0.1.0  
**Last Updated:** April 22, 2026

---

## Overview

The KNEZ Control App is a Tauri-based desktop application that connects to the KNEZ AI backend to provide an AI Operating System with full execution visibility. This guide explains how the app connects, its features, startup behavior, and what it provides.

---

## Connection Architecture

### Connection Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    KNEZ Control App                         │
│                  (Tauri + React + TS)                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP (Fetch API)
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   KNEZ Backend                               │
│              (Python + FastAPI)                              │
│              Endpoint: http://127.0.0.1:8000               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Ollama                                      │
│              (Local Inference Server)                        │
│              Endpoint: http://localhost:11434               │
└─────────────────────────────────────────────────────────────┘
```

### Connection Components

#### 1. KNEZ Client Service
**Location:** `src/services/knez/KnezClient.ts`

**Responsibilities:**
- Manages HTTP communication with KNEZ backend
- Handles connection profiles and trust verification
- Manages session lifecycle
- Performs health checks with retry logic
- Emits events to backend
- Fetches MCP registry, memory, governance state

**Default Connection Profile:**
```typescript
{
  id: "local-default",
  type: "local",
  transport: "http",
  endpoint: "http://127.0.0.1:8000",
  trustLevel: "untrusted"
}
```

**Connection Methods:**
- `health()` - Health check with 15s timeout
- `ensureSession()` - Validates/creates session
- `validateSession()` - Checks if session exists
- `emitEvent()` - Sends events to backend
- `listEvents()` - Fetches event stream
- `getMcpRegistry()` - Fetches MCP server registry

#### 2. Status Provider
**Location:** `src/contexts/StatusProvider.tsx`

**Responsibilities:**
- Polls health endpoint with adaptive intervals
- Fetches cognitive state
- Derives connection status (online, connected, degraded)
- Provides force check capability

**Polling Strategy:**
- **Healthy:** Every 30 seconds
- **Unhealthy:** Exponential backoff (2.5s × 2^attempt, max 60s)
- **Hidden Tab:** +180 seconds penalty
- **Jitter:** +0-500ms random

#### 3. System Orchestrator
**Location:** `src/features/system/useSystemOrchestrator.ts`

**Responsibilities:**
- Auto-launches KNEZ backend (if configured)
- Auto-launches Ollama (if configured)
- Manages process lifecycle
- Performs health probe with retry logic
- Warms up model to prevent first-request delay

**Startup Conditions:**
- Endpoint is local (localhost:8000 or 127.0.0.1:8000)
- Running in Tauri runtime (not web mode)
- Keep-alive enabled in settings
- System not already starting or running
- Maximum 3 auto-launch attempts

---

## Startup Sequence

### Application Launch

When the KNEZ Control App starts, the following sequence occurs:

#### Phase 1: Initialization (main.tsx)
```
1. Import observer utility for telemetry
2. Initialize Rust event bridge for MCP (rustEventBridge.ts)
3. Initialize governance service
4. Render App component with ErrorBoundary
```

#### Phase 2: App Component Mount (App.tsx)
```
1. Initialize session controller
2. Subscribe to session changes
3. Initialize MCP boot sequence
4. Load static memories
5. Subscribe to tab error store
6. Set up keyboard shortcuts (Ctrl/Cmd + K, Ctrl/Cmd + R)
7. Initialize system orchestrator
8. Set up auto-launch logic
9. Initialize observer state
10. Set up navigation event listeners
11. Set up TAQWIN activation listener
```

#### Phase 3: MCP Boot (mcp/mcpBoot.ts)
```
1. Load MCP inspector configuration
2. Start MCP orchestrator
3. Ensure all enabled MCP servers are started
```

#### Phase 4: Status Provider Initialization (StatusProvider.tsx)
```
1. Perform initial health check
2. Fetch cognitive state
3. Schedule adaptive polling
4. Set derived connection states
```

#### Phase 5: Session Management (SessionController.ts)
```
1. Check for existing session ID in localStorage
2. If exists, validate with backend
3. If invalid or missing, create new session
4. Emit session bootstrap event
5. Notify listeners of session change
```

#### Phase 6: Chat Service Initialization (ChatService.ts)
```
1. Initialize modular chat core controllers:
   - MessageStore
   - RequestController
   - PhaseManager
   - ResponseAssembler
   - ToolExecutionBridge
2. Load messages from database
3. Flush outgoing queue
4. Set up queue flush interval (500ms)
```

#### Phase 7: Auto-Launch (if conditions met)
```
1. Check system requirements (Python, Ollama, ports)
2. Fast-path verification (check if already running)
3. Start Ollama (if not running):
   - Kill existing processes
   - Spawn ollama serve
   - Wait for API ready (20 attempts × 1s)
4. Start KNEZ (if not running):
   - Kill existing Python processes
   - Spawn uvicorn process
   - Wait for health check (30 attempts with backoff)
5. Warm up model (load into memory)
6. Set status to running
```

---

## Features Provided

### 1. Chat Interface
**Location:** `src/features/chat/`

**Features:**
- Real-time streaming responses from AI
- Tool execution visualization with status indicators
- Message history with session context
- Debug panel with tool call history and statistics
- Execution time tracking per tool
- MCP latency tracking
- Expandable tool details (input, output, error)
- Message metadata display (tokens, model, backend status)

**Message Types:**
- `user` - User messages
- `assistant` - AI responses
- `tool_execution` - Tool execution blocks
- `tool_result` - Tool results
- `system` - System messages

**Tool Status States:**
- `pending` - Tool queued
- `running` - Tool executing (with pulse animation)
- `calling` - Tool being called
- `succeeded` - Tool completed successfully
- `failed` - Tool failed
- `completed` - Tool finalized

### 2. Memory Management
**Location:** `src/features/memory/`

**Features:**
- Memory explorer with clustering visualization
- Memory injection service
- Static memory loading on startup
- Memory gap detection and visualization
- Knowledge base management
- Memory detail view
- Memory filtering by session

**Memory Types:**
- Summary memories
- Evidence-based memories
- Context memories
- Knowledge documents

### 3. Session Management
**Location:** `src/services/session/`

**Features:**
- Session timeline visualization
- Session lineage tracking (fork tree)
- Fork session from any point
- Resume session from snapshot
- Session metadata management
- Session list with search
- Session deletion and cleanup

**Session Operations:**
- `createNewSession()` - Create fresh session
- `useSession()` - Switch to existing session
- `resumeSession()` - Resume from snapshot
- `forkSession()` - Create fork from existing

### 4. Governance Controls
**Location:** `src/features/governance/`

**Features:**
- Governance snapshot viewing
- Influence contract management
- Operator controls configuration
- Policy enforcement visualization
- Phase violation detection
- Governance event logging

**Governance Metrics:**
- Active insights count
- Blocked operations count
- Monitoring scope
- Eligible contracts
- Drift metrics
- Confidence metrics

### 5. Infrastructure Panel
**Location:** `src/features/infrastructure/`

**Features:**
- System status monitoring
- Backend health visualization
- Ollama status tracking
- System orchestration controls (start/stop)
- Health probe with retry visualization
- Process status display
- Startup log output

**System Status States:**
- `idle` - System not running
- `starting` - System starting up
- `running` - System operational
- `failed` - System startup failed
- `degraded` - System partially operational

### 6. MCP Integration
**Location:** `src/features/mcp/` and `src/mcp/`

**Features:**
- MCP registry view with server status
- MCP inspector for debugging
- Tool execution service
- MCP runtime monitoring
- Traffic event logging
- Tool discovery and listing
- MCP server start/stop controls

**MCP Runtime States:**
- `IDLE` - Not running
- `STARTING` - Starting up
- `SPAWNING` - Process spawning
- `INITIALIZING` - Initializing protocol
- `INITIALIZED` - Protocol initialized
- `DISCOVERING` - Discovering tools
- `READY` - Ready for requests
- `ERROR` - Error state
- `STOPPING` - Shutting down
- `STOPPED` - Stopped

**Traffic Events:**
- Raw stdout/stderr logging
- Parse error tracking
- Request/response logging
- Unsolicited message handling
- Process close detection
- Spawn error tracking
- State transition logging

### 7. Reflection & Analysis
**Location:** `src/features/reflection/`, `src/features/mistakes/`, `src/features/drift/`

**Features:**
- Reflection observation viewing
- Mistake ledger with recurrence tracking
- Drift analysis visualization
- Challenge system for governance
- Cognitive state visualization
- Self-reflection tools

**Analysis Types:**
- Reflection observations (confidence-scored)
- Mistake entries (active/archived/disputed)
- Drift metrics (scope, rule, focus)
- Challenge events (soft_nudge/explicit/hard_stop)

### 8. Perception
**Location:** `src/features/perception/`

**Features:**
- Snapshot capture
- Active window information
- Perception data management
- Screenshot capabilities

### 9. Logs Panel
**Location:** `src/features/logs/`

**Features:**
- Real-time log viewing
- Log filtering by level
- Log search functionality
- Log export capabilities
- Slice limits for performance

### 10. Replay
**Location:** `src/features/replay/`

**Features:**
- Session replay timeline
- Phase-by-phase replay
- Event count tracking
- Duration tracking
- Replay controls

### 11. Settings
**Location:** `src/features/settings/`

**Features:**
- Connection profile management
- Endpoint configuration
- Trust level management
- Keep-alive toggle
- Model selection
- Theme settings
- Layout density settings

### 12. Command Palette
**Location:** `src/components/ui/CommandPalette.tsx`

**Features:**
- Quick navigation (Ctrl/Cmd + K)
- View switching
- Settings access
- TAQWIN tools access
- TAQWIN activation

### 13. Floating Console
**Location:** `src/components/ui/FloatingConsole.tsx`

**Features:**
- In-app terminal
- Command execution
- Output viewing
- Error display

---

## Configuration

### Connection Profile

**Storage:** localStorage key `knez_connection_profile`

**Structure:**
```typescript
{
  id: string;                    // "local-default" or custom UUID
  type: "local" | "remote";      // Connection type
  transport: "http" | "ipc";     // Transport protocol
  endpoint: string;              // e.g., "http://localhost:8000"
  instanceId?: string;           // Filled after handshake
  pinnedFingerprint?: string;    // For trust verification
  verifiedAt?: string;           // ISO timestamp of verification
  declaredCapabilities?: string[]; // Capabilities from backend
  trustLevel: "untrusted" | "verified"; // Trust status
}
```

**Default Profile:**
```typescript
{
  id: "local-default",
  type: "local",
  transport: "http",
  endpoint: "http://127.0.0.1:8000",
  trustLevel: "untrusted"
}
```

### Session Configuration

**Storage:** localStorage key `knez_session_id`

**Behavior:**
- Auto-created on first launch if not exists
- Validated on startup via events endpoint
- Bootstrap event emitted on creation
- Persisted across app restarts

### Feature Flags

**Location:** `src/config/features.ts`

```typescript
{
  taqwinTools: true,      // Enable TAQWIN tools
  floatingConsole: true,  // Enable floating console
  mcpViews: true,         // Enable MCP views
  logViews: true          // Enable log views
}
```

**Environment Variables:**
- `VITE_ENABLE_TAQWIN_TOOLS` - Enable/disable TAQWIN tools
- `VITE_ENABLE_FLOATING_CONSOLE` - Enable/disable floating console
- `VITE_ENABLE_MCP_VIEWS` - Enable/disable MCP views
- `VITE_ENABLE_LOG_VIEWS` - Enable/disable log views
- `VITE_ENABLE_MCP_RUNTIME_REPORT` - Enable MCP runtime reporting

### Timeout Configuration

**Location:** `src/config/features.ts`

```typescript
{
  DEFAULT_UI_TIMEOUT_MS: 5000,              // Default UI timeout
  DEFAULT_UI_INTERVAL_MS: 100,              // Default UI check interval
  TOOL_CACHE_DEFAULT_TTL_MS: 300000,        // Tool cache TTL (5 minutes)
  TOOL_CACHE_MAX_ENTRIES: 1000,             // Max tool cache entries
  PROGRESSIVE_LOAD_DELAY_MS: 1000,          // Progressive load delay
  CONTENT_LENGTH_THRESHOLD: 100,            // Content length threshold
  HEALTH_BACKEND_STALE_MS: 60000,           // Health backend stale time (1 minute)
  TEST_RUNNER_TIMEOUT_MS: 8000,            // Test runner timeout
  TEST_RUNNER_INTERVAL_MS: 250,             // Test runner interval
  CACHE_CLEANUP_INTERVAL_MS: 300000,        // Cache cleanup interval (5 minutes)
  CONTEXT_WINDOW_TOKENS: 128000             // Context window size
}
```

### System Orchestrator Configuration

**Hardcoded Paths:**
- KNEZ Path: `C:\Users\syedm\Downloads\ASSETS\controlAPP\KNEZ`
- Model: `qwen2.5:7b-instruct-q4_K_M`
- KNEZ Endpoint: `http://127.0.0.1:8000`
- Ollama Endpoint: `http://localhost:11434`

**Timeouts:**
- Startup timeout: 120 seconds
- Health check timeout: 2 seconds
- Model warmup timeout: 60 seconds
- Ollama ready wait: 20 attempts × 1 second
- KNEZ ready wait: 30 attempts with exponential backoff

---

## What It Provides

### To Users

1. **AI Chat Interface**
   - Natural language conversation with AI
   - Streaming responses for real-time feedback
   - Tool execution visibility
   - Message history and context

2. **System Control**
   - Start/stop KNEZ backend
   - Start/stop Ollama
   - Monitor system health
   - View system logs

3. **Memory Management**
   - View AI memories
   - Inject knowledge
   - Manage memory clusters
   - Track memory gaps

4. **Session Management**
   - Create new sessions
   - Resume from snapshots
   - Fork sessions
   - View session lineage

5. **Governance**
   - View governance state
   - Manage influence contracts
   - Monitor policy enforcement
   - Track violations

6. **Debugging**
   - Tool call history
   - Execution time tracking
   - MCP traffic inspection
   - Error logging

### To Developers

1. **Extensible Architecture**
   - Modular service layer
   - Feature-based organization
   - React context providers
   - Custom hooks

2. **Observability**
   - Structured logging
   - Event emission
   - Metrics tracking
   - Performance monitoring

3. **Testing**
   - Vitest unit tests
   - Playwright E2E tests
   - Tauri automation support
   - Test window spawning

4. **Development Tools**
   - Hot module replacement
   - Fast refresh
   - TypeScript strict mode
   - ESLint integration

---

## Connection Troubleshooting

### Common Issues

#### 1. "System is not ready" Error
**Cause:** KNEZ backend not responding  
**Solution:**
- Check if KNEZ is running (Infrastructure panel)
- Click "Start" button in Infrastructure panel
- Check system requirements (Python, Ollama)
- Verify port 8000 is not in use

#### 2. "Health check failed" Error
**Cause:** Backend unreachable or unhealthy  
**Solution:**
- Verify endpoint configuration (Settings)
- Check if backend is running
- Verify network connectivity
- Check firewall settings

#### 3. "Session validation failed" Error
**Cause:** Session ID invalid or expired  
**Solution:**
- App will auto-create new session
- Check events endpoint is accessible
- Verify backend is healthy

#### 4. MCP Servers Not Starting
**Cause:** MCP configuration or path issues  
**Solution:**
- Check MCP registry (MCP view)
- Verify MCP server paths
- Check MCP traffic logs
- Verify MCP server dependencies

#### 5. Ollama Not Starting
**Cause:** Ollama not installed or port conflict  
**Solution:**
- Verify Ollama is installed
- Check port 11434 availability
- Check Ollama logs in Infrastructure panel
- Manually start Ollama: `ollama serve`

#### 6. Model Not Loading
**Cause:** Model not available or Ollama issue  
**Solution:**
- Check Ollama status
- Verify model is downloaded: `ollama list`
- Download model: `ollama pull qwen2.5:7b-instruct-q4_K_M`
- Check model warmup logs

### Debug Mode

Enable debug logging:
1. Open browser DevTools (F12)
2. Check Console tab for logs
3. Check Network tab for HTTP requests
4. Use Infrastructure panel for system logs

### Logs Location

**Application Logs:**
- Console: Browser DevTools → Console
- System Logs: Infrastructure panel
- MCP Traffic: MCP view → Traffic tab

**Backend Logs:**
- KNEZ: Terminal where KNEZ is running
- Ollama: Terminal where Ollama is running

---

## API Endpoints

### KNEZ Backend Endpoints

**Base URL:** `http://127.0.0.1:8000`

**Health:**
- `GET /health` - Health check
- `GET /identity` - Instance identity

**Sessions:**
- `POST /sessions/{sessionId}/fork` - Fork session
- `POST /sessions/{sessionId}/resume` - Resume session
- `GET /sessions/{sessionId}/resume_snapshot` - Get resume snapshot
- `GET /sessions/{sessionId}/lineage` - Get session lineage
- `GET /sessions/{sessionId}/replay` - Get replay timeline
- `GET /sessions/{sessionId}/checkpoints` - List checkpoints

**Chat:**
- `POST /v1/chat/completions` - Chat completion (streaming)

**Memory:**
- `GET /memory` - List memories
- `GET /memory/{memoryId}` - Get memory detail
- `POST /memory/gate/check` - Check memory gate
- `GET /memory/knowledge` - List knowledge
- `POST /memory/knowledge` - Add knowledge

**Events:**
- `GET /events` - List events
- `POST /events` - Emit event

**MCP:**
- `GET /mcp/registry` - Get MCP registry
- `POST /mcp/registry/{itemId}/toggle` - Toggle MCP item
- `POST /mcp/registry/report` - Report MCP runtime

**Governance:**
- `GET /governance/snapshot` - Get governance snapshot
- `GET /operator/influence/global` - Get operator controls
- `GET /operator/influence/contracts` - Get active contracts

**State:**
- `GET /state/overview` - Get cognitive state
- `GET /state/{subsystem}` - Get subsystem state

**System:**
- `GET /system/ollama-status` - Get Ollama status
- `POST /system/load-model` - Load model

**Perception:**
- `POST /perception/snapshot` - Take snapshot
- `GET /perception/active_window` - Get active window

**Runbooks:**
- `GET /runbooks/{sessionId}` - Get runbook

**Audit:**
- `GET /audit/consistency` - Get audit consistency

**TAQWIN:**
- `POST /taqwin/events` - Emit TAQWIN event

### Ollama Endpoints

**Base URL:** `http://localhost:11434`

**Models:**
- `GET /api/tags` - List available models

**Inference:**
- `POST /api/generate` - Generate completion
- `POST /api/chat` - Chat completion

---

## Security Considerations

### Trust Verification

The app supports trust verification via fingerprint pinning:

1. **Initial Connection:**
   - App fetches identity from `/identity` endpoint
   - Backend returns `knez_instance_id` and `fingerprint`
   - User can pin fingerprint for trust

2. **Subsequent Connections:**
   - App compares current fingerprint with pinned fingerprint
   - Mismatch → Trust revoked
   - Match → Trust maintained

3. **Trust Levels:**
   - `untrusted` - Default, no verification
   - `verified` - Fingerprint verified

### Localhost Only

Default configuration uses localhost endpoints:
- KNEZ: `http://127.0.0.1:8000`
- Ollama: `http://localhost:11434`

This ensures:
- No external network exposure
- No remote access by default
- Local-only operation

### Shell Access

The app uses Tauri's shell plugin for:
- System orchestration (starting/stopping processes)
- Command execution
- Process management

**Security Note:** Shell access is only available in Tauri runtime, not in web mode.

### CSP Configuration

Content Security Policy is currently disabled (`null`) in Tauri config. This is for development convenience. For production, consider enabling CSP.

---

## Performance Optimizations

### Health Check Caching
- **TTL:** 5 seconds
- **Purpose:** Reduce redundant health checks
- **Implementation:** Cached in ChatService

### Streaming Throttling
- **Throttle:** 33ms during streaming
- **Purpose:** Reduce UI re-renders
- **Implementation:** Throttled notify() in ChatService

### Adaptive Polling
- **Healthy:** 30 seconds
- **Unhealthy:** Exponential backoff (max 60s)
- **Hidden Tab:** +180 seconds penalty
- **Purpose:** Reduce unnecessary requests

### Connection Reuse
- **Implementation:** Browser HTTP connection pooling
- **Purpose:** Eliminate TCP handshake overhead

### Progressive Loading
- **Delay:** 1 second
- **Purpose:** Defer loading of large content
- **Implementation:** Progressive load delay in config

### Slice Limits
- **Log Lines:** 150
- **URL Alternatives:** 4
- **Memory Retrieval:** 2
- **Headings:** 6
- **Links:** 8
- **Console Errors:** 5
- **Purpose:** Prevent UI overload

---

## Development Setup

### Prerequisites

1. **Node.js** (v18 or higher)
2. **Python** (v3.8 or higher)
3. **Ollama** (for local inference)
4. **Rust** (for Tauri development)
5. **KNEZ Backend** (Python project)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start Tauri dev mode
npm run tauri dev

# Start all services (KNEZ + Ollama + App)
npm run dev:all
```

### Build

```bash
# Build for production
npm run build

# Build Tauri app
npm run tauri build
```

### Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run e2e:tauri
```

---

## Summary

The KNEZ Control App is a comprehensive desktop application that:

1. **Connects** to the KNEZ AI backend via HTTP on localhost:8000
2. **Provides** a full-featured AI chat interface with tool execution visibility
3. **Manages** sessions, memory, governance, and MCP integration
4. **Auto-launches** KNEZ and Ollama when configured
5. **Monitors** system health with adaptive polling
6. **Offers** extensive debugging and observability tools
7. **Supports** trust verification and secure local-only operation

The app is built with modern technologies (React 19, Tauri 2, TypeScript) and follows a modular architecture for extensibility and maintainability.
