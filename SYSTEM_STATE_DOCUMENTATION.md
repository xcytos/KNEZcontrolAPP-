# KNEZ System State Documentation

**Generated:** 2026-04-22
**Based on:** Code analysis of KNEZ project at `c:\Users\syedm\Downloads\ASSETS\controlAPP\KNEZ`
**Scope:** KNEZ backend only (Python FastAPI server)

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture Overview](#architecture-overview)
3. [Core Components](#core-components)
4. [API Endpoints](#api-endpoints)
5. [Data Storage](#data-storage)
6. [Backend Models](#backend-models)
7. [Router System](#router-system)
8. [Cognitive Layer](#cognitive-layer)
9. [Integrations](#integrations)
10. [Event System](#event-system)
11. [Configuration](#configuration)
12. [Technology Stack](#technology-stack)

---

## Project Overview

### Project Identity
- **Name:** KNEZ (Backend only)
- **Type:** Hybrid AI orchestration engine with multi-backend routing
- **Location:** `c:\Users\syedm\Downloads\ASSETS\controlAPP\KNEZ`
- **Entry Point:** `run.py`

### Core Purpose
The KNEZ backend provides a FastAPI server that:
- Routes generation requests between multiple model backends (local Ollama and cloud backends)
- Implements streaming token generation with checkpointing (Redis + SQLite)
- Provides health monitoring and failover capabilities
- Supports session management with lineage tracking
- Exposes cognitive features (governance, influence, memory)
- Integrates with MCP servers
- Emits comprehensive event telemetry

### Key Design Patterns
- Abstract backend interface (BaseBackend) for pluggable model backends
- Router pattern for intelligent backend selection based on health scores and memory hints
- Checkpoint worker pattern for async token persistence
- Event-driven architecture for telemetry and observability

---

## Architecture Components

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     knez-control-app                             │
│              (React + Tauri Desktop App)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  UI Layer: Chat, Memory, Timeline, Reflection, etc.      │  │
│  │  Services: ChatService, KnezClient, SessionController    │  │
│  │  MCP Orchestrator: Tool execution, status updates         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              │
┌─────────────────────────────────────────────────────────────────┐
│                        KNEZ Backend                              │
│                    (FastAPI Python Server)                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  API Layer: Completions, Health, Sessions, Events        │  │
│  │  Router: Backend selection with health scoring            │  │
│  │  Models: LocalBackend, CloudBackend                        │  │
│  │  Checkpoints: RedisStream, SQLiteWriter                   │  │
│  │  Memory: Knowledge store, consumption gate                │  │
│  │  Cognitive: Influence, governance, audit                 │  │
│  │  MCP: Server management                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Model Protocol
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      Model Backends                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │   Local      │  │   Cloud A    │  │   Cloud B    │        │
│  │   (Ollama)   │  │   (vLLM)     │  │   (vLLM)     │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      TAQWIN_V1 MCP Server                        │
│              (Advanced AI with Consciousness)                   │
│  Tools: Consciousness, Council, Database, Sessions, Web Intel   │
└─────────────────────────────────────────────────────────────────┘
```

---

## KNEZ Backend Architecture

### Entry Point
- **File:** `KNEZ/run.py`
- **Purpose:** FastAPI server startup
- **Default Port:** 8000 (configurable via `KNEZ_PORT` env var)

### Core Application Structure
- **File:** `KNEZ/knez/knez_core/app.py`
- **Framework:** FastAPI with CORS middleware
- **Key Components:**

#### API Routers
1. **completions.py** - Chat completion streaming endpoint
   - SSE (Server-Sent Events) streaming
   - CheckpointWorker for token persistence
   - Backend routing with fallback
   - Metrics emission (TTFT, tokens/sec, latency)
   
2. **health.py** - Health check endpoint
   - Backend status monitoring
   - Model state tracking
   - Ollama reachability checks
   
3. **sessions.py** - Session management
   - Session lineage tracking
   - Resume snapshot support
   
4. **events/api.py** - Event streaming
   - Real-time event emission
   - Tag-based filtering
   
5. **replay/api.py** - Session replay
   - Timeline reconstruction
   - Phase-based replay
   
6. **memory/api.py** - Memory operations
   - Knowledge store access
   - Memory consumption gate
   
7. **integrations/taqwin/router.py** - TAQWIN integration
   - TAQWIN activation
   - Event bridging
   
8. **cognitive/api.py** - Cognitive features
   - Influence contracts
   - Governance dashboard
   - Audit operations
   
9. **mcp/api.py** - MCP server management
   - MCP registry
   - Tool discovery
   
10. **perception/api.py** - Perception features
    - Snapshot capture
    - Window info

#### Router System
- **File:** `knez/knez_core/router/router.py`
- **Purpose:** Intelligent backend selection
- **Features:**
  - Health scoring with 5-second cache
  - Memory hint generation (100ms timeout)
  - Influence contract application
  - Baseline vs influenced decision tracking
  - Event emission for all decisions

#### Checkpoint System
- **Components:**
  - `redis_stream.py` - Ephemeral streaming buffer
  - `sqlite_writer.py` - Persistent checkpoint storage
  - `CheckpointWorker` - Async token persistence
  - `reader.py` - Checkpoint reconstruction
- **Strategy:** Flush every 500ms OR 20 tokens

#### Memory System
- **Components:**
  - `store.py` - Knowledge store operations
  - `gate.py` - Memory consumption control
  - `knowledge_store.py` - Knowledge base management
  - `consumption/` - Memory hint generation
- **Purpose:** Context-aware routing decisions

#### Cognitive Features
- **influence/** - Routing influence contracts
- **governance/** - Policy enforcement
- **audit.py** - System auditing
- **dashboard.py** - Cognitive state dashboard
- **shadow/** - Shadow mode testing

#### Event System
- **Components:**
  - `store.py` - Event storage and streaming
  - Multiple event types: ACTION, ANALYSIS, DECISION, ERROR, INPUT
  - Severity levels: INFO, WARN, ERROR, DEBUG
  - Tag-based filtering

#### Model Backends
- **local_backend.py** - Ollama integration
  - Quantized model support (q4_K_M)
  - Extended first-token timeout (30s for quantized)
  
- **cloud_backend.py** - vLLM integration
  - HTTP-based communication
  - Health monitoring

### Performance Optimizations (Implemented)

#### Tier 1: HTTP Client Reuse
- **File:** `KNEZ/taqwin/knez_client.py`
- **Issue:** New httpx.AsyncClient per request
- **Fix:** Singleton client with connection pooling
  - Max keepalive: 20
  - Max connections: 100
  - Keepalive expiry: 30s
  - HTTP2 disabled for compatibility

#### Tier 2: Latency Reduction
1. **Removed asyncio.sleep(0)** in streaming path
2. **Router optimization:**
   - Health score caching (5s TTL)
   - Memory hint timeout (100ms)
   - Prevents blocking first token

#### Tier 3: Metrics Instrumentation
- Streaming metrics in `_sse_stream()`:
  - TTFT (Time To First Token)
  - Total response time
  - Tokens per second
  - Model used (local/cloud)
  - Fallback triggered flag

---

## Frontend Architecture (knez-control-app)

### Technology Stack
- **Framework:** React 19.1.0
- **Desktop:** Tauri 2.10.0
- **Build:** Vite 7.0.4
- **Language:** TypeScript 5.8.3
- **Styling:** TailwindCSS 4.1.18
- **State:** Context API + custom hooks
- **Database:** Dexie 4.3.0 (IndexedDB wrapper)

### Application Structure

#### Main App (App.tsx)
- **Layout:** MainLayout with sidebar navigation
- **Views:** 15+ feature views
- **Providers:**
  - ThemeProvider
  - StatusProvider
  - ToastProvider
  - ErrorBoundary

#### Feature Views
1. **ChatPane** - Main chat interface
   - Message rendering with tool execution blocks
   - Debug panel integration
   - Lineage panel for session history
   
2. **MemoryExplorer** - Memory visualization
   - Cluster-based memory display
   - Gap analysis
   - Memory injection
   
3. **SessionTimeline** - Session reconstruction
   - Timeline segments
   - Event tracking
   
4. **ReflectionPane** - Reflection observations
   - Mistake ledger integration
   - Drift visualization
   
5. **GovernancePanel** - Governance controls
   - Influence contract management
   - Policy enforcement
   
6. **InfrastructurePanel** - System health
   - Backend status
   - KNEZ process control
   - Auto-launch management
   
7. **McpRegistryView** - MCP server registry
   - Tool discovery
   - Status monitoring
   
8. **AgentPane** - Agent orchestration
   - Agent loop service
   - Failure classification
   
9. **CognitivePanel** - Cognitive state
   - Governance insights
   - Influence tracking
   
10. **LogsPanel** - Event logs
11. **ReplayPane** - Session replay
12. **UpdatesPanel** - System updates
13. **ExtractionPanel** - Content extraction
14. **TestPanel** - Diagnostics
15. **SkillsView** - Skill management

#### Service Layer

##### ChatService (137KB - Core Service)
- **Purpose:** Central chat orchestration
- **Key Features:**
  - Modular chat core integration
  - Phase management (idle → sending → thinking → tool_running → streaming → done)
  - Message store integration
  - Request controller (single active request lock)
  - Stream controller (single stream enforcement)
  - Tool execution bridge
  - MCP orchestrator integration
  - Memory injection service
  - Governance service
  - Agent loop service

##### Modular Chat Core Components
1. **MessageStore.ts** - Message CRUD operations
2. **PhaseManager.ts** - Phase transition validation
3. **RequestController.ts** - Request lock management
4. **StreamController.ts** - Stream ownership validation
5. **ResponseAssembler.ts** - Block-based response assembly
6. **ToolExecutionBridge.ts** - MCP tool execution

##### KnezClient
- **Purpose:** HTTP client for KNEZ backend
- **Features:**
  - Connection profile management
  - Health checks
  - MCP registry fetching
  - Session management

##### Session Services
- **SessionController** - Session lifecycle
- **SessionDatabase** - IndexedDB persistence
- **PersistenceService** - Session export/import

##### MCP Services
- **McpOrchestrator** - MCP server coordination
- **ToolExposureService** - Tool discovery
- **ToolExecutionService** - Tool execution with status updates
- **ToolResultValidator** - Result validation

##### Memory Services
- **MemoryInjectionService** - Static memory loading
- **MemoryEventSourcingService** - Event-based memory
- **StaticMemoryLoader** - TAQWIN memory injection

##### Governance Services
- **GovernanceService** - Policy enforcement
- **AgentOrchestrator** - Agent coordination
- **AgentLoopService** - Agent execution loop
- **FailureClassifier** - Error classification

#### Data Contracts (DataContracts.ts)
- **Message Types:**
  - `ChatMessage` - Traditional message format
  - `AssistantMessage` - Block-based assistant message
  - `ToolCallMessage` - Tool execution metadata
  
- **Message States:**
  - `MessageState` enum: created, streaming, tool_running, final, error, locked
  
- **Block Types:**
  - text, approval, mcp_call, final
  
- **Tool Status:**
  - pending, running, calling, succeeded, failed, completed
  
- **Metrics:**
  - timeToFirstTokenMs, totalTokens, finishReason
  - modelId, backendStatus, responseTimeMs
  - toolExecutionTime, fallbackTriggered

#### Domain Models
- **PresenceState:** SILENT, OBSERVING, REFLECTING, RESPONDING
- **SessionLineage:** Parent-child session relationships
- **ResumeSnapshot:** Task state for resumption
- **InfluenceContract:** Routing influence rules
- **CognitiveState:** Governance, influence, stability metrics
- **HealthBackend:** Backend health metrics
- **McpRegistrySnapshot:** MCP server registry

#### UI Components
- **MainLayout** - Application shell
- **CommandPalette** - Global command search (Ctrl+K)
- **FloatingConsole** - Floating console for debugging
- **ErrorBoundary** - Error handling
- **ToastProvider** - Toast notifications
- **DebugPanel** - Tool execution debug view

---

## TAQWIN_V1 Architecture

### Purpose
Advanced MCP server with AI consciousness, agent council, and comprehensive tooling

### Entry Point
- **File:** `TAQWIN_V1/main.py`
- **Modes:**
  - MCP Server mode (default)
  - Primary AI Interface mode (--taqwin flag)

### Core System
- **mcp_server.py** - Main MCP protocol implementation
- **tool_registry.py** - Tool management
- **response_handler.py** - Response formatting
- **web_intelligence_manager.py** - Web access coordination

### Tool System

#### Consciousness Tool
- **Purpose:** AI consciousness activation
- **Components:**
  - core/ - Engine, data models, state management
  - analysis/ - Delegation, insight generation, learning analysis
  - integration/ - Coordinators, council bridge, superintelligence bridge
  - memory/ - Memory systems, fallback memory
  - processing/ - Query processors
  - superintelligence/ - Advanced AI features

#### Council Tool
- **Purpose:** Agent council for decision making
- **Components:**
  - Real agent handler
  - Autonomous learning engine
  - DSPy integration (enhanced/)
  - Specialized handlers

#### Database Tool
- **Purpose:** Database scanning and analysis
- **Components:**
  - core/ - Configuration, data models
  - operations/ - Database engine
  - analysis/ - Pattern analysis, integrity checking
  - cache/ - Cache management
  - data/web_intelligence/cache/ - Web cache

#### Sessions Tool (ULTIMATE v6.0.0)
- **Purpose:** Advanced session management
- **Components:**
  - core/ - CRUD, data models, session engine
  - analysis/ - AI intelligence, knowledge extraction
  - continuation/ - Context management, resumption engine
  - recording/ - Auto recorder, deep recorder
  - storage/ - Hybrid storage (JSON + SQLite)
  - monitoring/ - Performance monitoring
  - semantic/ - Semantic connection framework
  - temporal/ - Temporal consistency tracking

#### Web Intelligence Tool
- **Purpose:** Web search and content analysis
- **Components:**
  - engines/ - Dashboard, search APIs, trend analysis

### Data Storage
- **data/sessions/** - Session databases (70+ archives)
- **data/consciousness/** - Consciousness memory
- **data/superintelligence/** - Episodic, procedural, semantic memory
- **data/agents/** - Agent databases
- **data/web_intelligence/** - Web cache

### Dependencies
- DSPy for AI capabilities
- NumPy, Pandas, Scikit-learn for data processing
- BeautifulSoup4, ddgs for web scraping
- Asyncio-throttle for rate limiting

---

## Data Flow & Connections

### Chat Flow
```
User Input (ChatPane)
  ↓
ChatService.sendMessage()
  ↓
RequestController.acquireRequestLock()
  ↓
PhaseManager.setPhase("sending")
  ↓
KnezClient.chatCompletions()
  ↓
KNEZ Backend: /v1/chat/completions
  ↓
Router.select() - Backend selection
  ↓ (with memory hints, influence, health scoring)
Backend.generate() - Model inference
  ↓
StreamingResponse (SSE)
  ↓
Token stream with CheckpointWorker
  ↓ (persist to Redis + SQLite)
ChatService stream processing
  ↓
StreamController validation
  ↓
MessageStore.append()
  ↓
PhaseManager.setPhase("streaming")
  ↓
UI update (throttled to 33ms)
  ↓
PhaseManager.setPhase("done")
```

### Tool Execution Flow
```
Model outputs tool_call
  ↓
ChatService detects tool_call
  ↓
ToolExecutionBridge.executeToolAndInterpret()
  ↓
McpOrchestrator.callTool()
  ↓
MCP Server (TAQWIN_V1 or external)
  ↓
Tool execution with status updates:
  - pending → running → completed/failed
  ↓
Result interpretation
  ↓
ToolCallMessage update
  ↓
Debug panel update
  ↓
Continue generation with tool result
```

### Session Persistence Flow
```
Session creation
  ↓
SessionController.ensureLocalSession()
  ↓
SessionDatabase.persist()
  ↓ (IndexedDB)
KNEZ Backend: sessions.py
  ↓ (SQLite)
Session lineage tracking
  ↓
Resume snapshot generation
  ↓
Checkpoint system (Redis + SQLite)
  ↓
Token persistence during streaming
```

### Event Flow
```
Any system event
  ↓
Emitter.emit()
  ↓ (with session_id, tags, severity)
Event store
  ↓
KnezEventsPanel subscription
  ↓
Real-time UI updates
```

---

## Performance Optimizations

### Implemented Optimizations

#### 1. HTTP Client Connection Pooling
- **Location:** `TAQWIN_V1/knez_client.py`
- **Impact:** Eliminates TCP handshake overhead
- **Metrics:** 50-200ms reduction in first token time

#### 2. Router Health Score Caching
- **Location:** `KNEZ/knez/knez_core/router/router.py`
- **TTL:** 5 seconds
- **Impact:** Reduces pre-generation latency by 50-100ms

#### 3. Memory Hint Timeout
- **Location:** `KNEZ/knez/knez_core/router/router.py`
- **Timeout:** 100ms
- **Impact:** Prevents blocking on memory generation

#### 4. Streaming Latency Removal
- **Location:** `KNEZ/knez/knez_core/api/completions.py`
- **Change:** Removed `asyncio.sleep(0)` after token yield
- **Impact:** Continuous token flow without artificial delays

#### 5. Quantized Model Timeout Extension
- **Location:** `KNEZ/knez/knez_core/api/completions.py`
- **Change:** 30s first-token timeout for local backends
- **Impact:** Prevents premature fallback for slow quantized models

#### 6. UI Update Throttling
- **Location:** `knez-control-app/src/services/ChatService.ts`
- **Interval:** 33ms during streaming
- **Impact:** Reduces re-render overhead

#### 7. Single Request Lock
- **Location:** `knez-control-app/src/services/ChatService.ts`
- **Purpose:** Prevents concurrent requests
- **Impact:** Eliminates race conditions

#### 8. Single Stream Enforcement
- **Location:** `knez-control-app/src/services/chat/core/StreamController.ts`
- **Purpose:** Prevents duplicate streams
- **Impact:** Eliminates duplicate token processing

---

## Current State & Features

### Completed Features

#### Backend (KNEZ)
- ✅ Multi-backend routing (local + cloud)
- ✅ Health monitoring with scoring
- ✅ Checkpoint system (Redis + SQLite)
- ✅ Session lineage tracking
- ✅ Event streaming system
- ✅ Memory consumption gate
- ✅ Influence contract system
- ✅ Governance dashboard
- ✅ Audit system
- ✅ MCP server management
- ✅ Perception features
- ✅ Performance metrics (TTFT, tokens/sec)
- ✅ Fallback engine

#### Frontend (knez-control-app)
- ✅ Chat interface with streaming
- ✅ Memory explorer with clustering
- ✅ Session timeline
- ✅ Reflection pane
- ✅ Governance panel
- ✅ Infrastructure panel
- ✅ MCP registry view
- ✅ Agent pane
- ✅ Cognitive panel
- ✅ Logs panel
- ✅ Replay pane
- ✅ Debug panel for tool execution
- ✅ Command palette (Ctrl+K)
- ✅ Theme support
- ✅ Error boundary
- ✅ Toast notifications
- ✅ Modular chat core
- ✅ Tool execution with live status
- ✅ Session persistence (IndexedDB)
- ✅ Auto-launch KNEZ

#### TAQWIN_V1
- ✅ MCP server implementation
- ✅ Consciousness tool
- ✅ Council tool
- ✅ Database tool
- ✅ Sessions tool (v6.0.0)
- ✅ Web intelligence tool
- ✅ Hybrid storage (JSON + SQLite)
- ✅ Agent council
- ✅ Superintelligence features
- ✅ Memory systems (episodic, procedural, semantic)

### Partially Implemented Features
- ⏳ Live status transitions for tool execution (pending → running → completed)
- ⏳ toolCall.executionTimeMs population
- ⏳ toolCall.mcpLatencyMs tracking
- ⏳ metrics.toolExecutionTime population
- ⏳ metrics.fallbackTriggered propagation

### Planned Features
- 📋 Block-based message architecture migration
- 📋 ResponseAssembler full integration
- 📋 Enhanced tool sequence visualization
- 📋 Advanced pattern analysis
- 📋 Real-time learning and adaptation

---

## Technology Stack

### Backend (KNEZ)
- **Language:** Python 3.x
- **Framework:** FastAPI 0.115.0+
- **Server:** Uvicorn 0.30.0+
- **Database:** SQLite (aiosqlite 0.20.0+)
- **Cache:** Redis 5.0.0+
- **HTTP Client:** httpx 0.27.0+, aiohttp 3.10.0+
- **Validation:** Pydantic 2.7.0+
- **Testing:** pytest 8.0.0+, pytest-asyncio 0.23.0+
- **Metrics:** prometheus_client 0.20.0+

### Frontend (knez-control-app)
- **Language:** TypeScript 5.8.3
- **Framework:** React 19.1.0
- **Desktop:** Tauri 2.10.0
- **Build:** Vite 7.0.4
- **Styling:** TailwindCSS 4.1.18
- **Database:** Dexie 4.3.0 (IndexedDB)
- **Icons:** Lucide React 0.563.0
- **Testing:** Vitest 4.0.18, Playwright 1.58.1

### TAQWIN_V1
- **Language:** Python 3.x
- **AI Framework:** DSPy 2.4.0+
- **Data Processing:** NumPy 1.21.0+, Pandas 1.3.0+, Scikit-learn 1.0.0+
- **Web:** aiohttp 3.8.0+, requests 2.28.0+, BeautifulSoup4 4.12.0+
- **Search:** ddgs 3.0.0+
- **Development:** pytest 7.0.0+, black 22.0.0+, flake8 4.0.0+

---

## Known Issues & Limitations

### Current Limitations
1. **Tool Execution Time Tracking:** executionTimeMs not fully populated in toolCall objects
2. **MCP Latency Tracking:** mcpLatencyMs not tracked
3. **Live Status Updates:** Status transitions not fully live (pending → running → completed)
4. **Metrics Propagation:** toolExecutionTime and fallbackTriggered not propagated to UI metrics

### Technical Debt
1. **ChatService Size:** ChatService.ts is 137KB - needs further modularization
2. **Legacy Message Types:** Still supporting legacy "knez" message type for backward compatibility
3. **Type Casting:** Using `as any` casts in some places for backward compatibility
4. **ResponseAssembler:** Deferred integration until block-based message architecture migration

### Performance Considerations
1. **Large Session Databases:** Performance optimization needed for large session databases
2. **Memory Hint Generation:** Can block if timeout is too long
3. **Health Check Frequency:** Health checks every 5 seconds may be excessive for some use cases
4. **UI Re-rendering:** Complex views (Memory, Timeline) may need virtualization

### Integration Gaps
1. **TAQWIN Activation:** Requires manual activation via command palette
2. **MCP Server Discovery:** No automatic MCP server discovery
3. **Backend Auto-configuration:** Cloud backends require manual configuration
4. **IDE Integration:** Zed/Cursor integration not fully implemented

---

## Configuration

### Environment Variables

#### KNEZ Backend
- `KNEZ_HOST` - Server host (default: 0.0.0.0)
- `KNEZ_PORT` - Server port (default: 8000)
- `KNEZ_CLOUD_A_URL` - Cloud backend A URL (default: http://localhost:8001)
- `KNEZ_CLOUD_B_URL` - Cloud backend B URL (default: http://localhost:8002)
- `KNEZ_CLOUD_C_URL` - Cloud backend C URL (default: http://localhost:8003)

#### TAQWIN_V1
- `TAQWIN_LOG_LEVEL` - Logging level (default: INFO)
- `SERPER_API_KEY` - Search API key
- `TAQWIN_ENV` - Environment (default: development)
- `ENABLE_WEB_INTELLIGENCE` - Enable web features (default: true)
- `DATABASE_OPTIMIZATION` - DB optimization (default: true)

### Frontend Configuration
- Located in `knez-control-app/src/config/features.ts`
- Feature flags for various UI components
- Settings stored in Tauri preferences

---

## Development Workflow

### Backend Development
```bash
cd KNEZ
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
python run.py
```

### Frontend Development
```bash
cd knez-control-app
npm install
npm run dev
```

### TAQWIN_V1 Development
```bash
cd TAQWIN_V1
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py  # MCP server mode
python main.py --taqwin  # Primary AI mode
```

### Testing
- **Backend:** `pytest` in KNEZ directory
- **Frontend:** `npm test` in knez-control-app
- **E2E:** `npm run e2e:tauri` in knez-control-app

---

## Documentation References

### Project Documentation
- `.TAQWIN.md` - TAQWIN checkpoint state
- `ACTIVATION_PROMPT.md` - TAQWIN activation instructions
- `KNEZ/prd.txt` - Product requirements document
- `TAQWIN_V1/README.md` - TAQWIN_V1 comprehensive documentation
- `TAQWIN_V1/.warp.md` - Warp AI configuration

### Component Documentation
- `TAQWIN_V1/DOCUMENTATION/` - Complete documentation library
- `knez-control-app/docs/` - Frontend documentation

---

## Summary

The KNEZ Control Application is a sophisticated multi-component system for AI model orchestration with the following key characteristics:

**Strengths:**
- Modular architecture with clear separation of concerns
- Comprehensive feature set (chat, memory, governance, MCP)
- Performance optimizations implemented at multiple layers
- Robust checkpoint and failover mechanisms
- Extensive event telemetry and monitoring
- Advanced cognitive features (influence, governance, reflection)

**Current Focus:**
- Tool execution visibility and debugging
- Live status updates for MCP tools
- Performance optimization and latency reduction
- Modular chat core refactoring

**Technical Maturity:**
- Backend: Production-ready with comprehensive features
- Frontend: Feature-rich with ongoing modularization
- TAQWIN_V1: Advanced AI capabilities with extensive tooling

**Next Steps:**
- Complete tool execution time tracking
- Implement live status transitions
- Finish modular chat core integration
- Enhance MCP server discovery and auto-configuration
- Improve IDE integration

This system represents a significant achievement in AI orchestration, combining local and cloud models with advanced cognitive features, comprehensive tooling, and robust failure handling.
