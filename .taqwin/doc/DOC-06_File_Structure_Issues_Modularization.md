# DOC-06: File Structure Issues & Modularization

## Executive Summary

This document analyzes the file structure of both KNEZ backend and knez-control-app frontend, identifying issues with organization, modularization, and proposing improvements for better maintainability and scalability.

## Table of Contents

1. [Current File Structure Analysis](#current-file-structure-analysis)
2. [Backend File Structure Issues](#backend-file-structure-issues)
3. [Frontend File Structure Issues](#frontend-file-structure-issues)
4. [Modularization Assessment](#modularization-assessment)
5. [Code Organization Issues](#code-organization-issues)
6. [Dependency Issues](#dependency-issues)
7. [Naming Convention Issues](#naming-convention-issues)
8. [File Size Issues](#file-size-issues)
8. [Circular Dependency Issues](#circular-dependency-issues)
9. [Proposed Restructuring](#proposed-restructuring)
10. [Migration Strategy](#migration-strategy)
11. [Modularization Recommendations](#modularization-recommendations)

---

## Current File Structure Analysis

### Backend Structure (KNEZ)

```
KNEZ/knez/
├── knez_core/                    # Core backend implementation
│   ├── __init__.py
│   ├── app.py                    # FastAPI application (75 lines)
│   ├── agents.py                 # Agent definitions (96 lines)
│   ├── api/                      # API endpoints
│   │   ├── completions.py        # Chat completions (306 lines)
│   │   ├── health.py             # Health checks (118 lines)
│   │   ├── sessions.py           # Session management (264 lines)
│   │   ├── events_api.py         # Events API
│   │   ├── memory_api.py         # Memory API
│   │   ├── replay_api.py         # Replay API
│   │   ├── taqwin_router.py      # TAQWIN routing
│   │   ├── cognitive_api.py      # Cognitive API
│   │   ├── mcp_api.py            # MCP API
│   │   └── perception_api.py      # Perception API
│   ├── models/                   # Model backends
│   │   ├── base.py               # Base interface (62 lines)
│   │   ├── local_backend.py      # Local Ollama (130 lines)
│   │   └── cloud_backend.py      # Cloud backend (23 lines - stub)
│   ├── router/                   # Routing
│   │   ├── router.py             # Main router (180 lines)
│   │   ├── classifier.py         # Request classification
│   │   └── scorer.py             # Health scoring
│   ├── events/                   # Event system
│   │   ├── __init__.py
│   │   ├── schema.py             # Event schema (125 lines)
│   │   ├── emitter.py            # Event emission
│   │   ├── store.py              # Event persistence (121 lines)
│   │   ├── reader.py             # Event query
│   │   └── api.py                # Events API endpoint
│   ├── memory/                   # Memory system
│   │   ├── __init__.py
│   │   ├── models.py             # Memory models
│   │   ├── store.py              # Memory persistence (89 lines)
│   │   ├── api.py                # Memory API
│   │   ├── knowledge_store.py    # Vector knowledge
│   │   └── gate.py               # Memory gate
│   ├── sessions/                 # Session management
│   │   └── store.py              # Session persistence (541 lines)
│   ├── checkpoints/              # Checkpoint system
│   │   ├── checkpoint_model.py
│   │   ├── reader.py
│   │   ├── redis_stream.py
│   │   └── sqlite_writer.py
│   ├── failover/                 # Failover
│   │   ├── manager.py
│   │   ├── health.py
│   │   └── continuation.py
│   ├── replay/                   # Replay system
│   │   ├── __init__.py
│   │   ├── engine.py
│   │   ├── models.py
│   │   ├── phases.py
│   │   ├── reflection.py
│   │   ├── insights.py
│   │   ├── stats.py
│   │   ├── summary.py
│   │   └── api.py
│   ├── telemetry/                # Metrics
│   │   └── metrics.py            # Prometheus metrics (53 lines)
│   └── utils/                    # Utilities
│       ├── exceptions.py         # Custom exceptions
│       └── tokenizer.py          # Token counting
├── cognitive/                    # Cognitive layer (separate module)
│   ├── api.py
│   ├── governance.py
│   ├── audit.py
│   ├── dashboard.py
│   ├── docs.py
│   └── runbook.py
├── mcp/                          # MCP integration (separate module)
│   ├── api.py
│   └── servers/
├── perception/                   # Perception layer (separate module)
│   └── api.py
└── compat/                       # Compatibility layer
    ├── api.py
    ├── app.py
    └── feature_flags.py
```

### Frontend Structure (knez-control-app)

```
knez-control-app/
├── src/
│   ├── App.tsx                    # Main app component
│   ├── main.tsx                   # Entry point
│   ├── index.css                  # Global styles
│   ├── App.css                    # App styles
│   │
│   ├── domain/                    # Domain models
│   │   ├── DataContracts.ts       # Data structures (200 lines)
│   │   └── Errors.ts              # Error definitions
│   │
│   ├── config/                    # Configuration
│   │   └── features.ts           # Feature flags
│   │
│   ├── contexts/                  # React contexts
│   │   ├── StatusProvider.tsx
│   │   ├── ThemeContext.tsx
│   │   └── useStatus.ts
│   │
│   ├── hooks/                     # Custom hooks
│   │   ├── useTaqwinActivationStatus.ts
│   │   └── useTaqwinMcpStatus.ts
│   │
│   ├── services/                  # Service layer (45+ services)
│   │   ├── ChatService.ts         # Chat state (828 lines)
│   │   ├── KnezClient.ts          # Backend client (923 lines)
│   │   ├── SessionDatabase.ts     # IndexedDB storage
│   │   ├── SessionController.ts   # Session lifecycle
│   │   ├── McpTypes.ts            # MCP types
│   │   ├── ToolExecutionService.ts # Tool execution (147 lines)
│   │   ├── ToolExposureService.ts # Tool catalog
│   │   ├── GovernanceService.ts   # Governance
│   │   ├── McpOrchestrator.ts     # MCP orchestration
│   │   ├── MemoryEventSourcingService.ts
│   │   ├── MemoryBackupService.ts
│   │   ├── MemoryCompressionService.ts
│   │   ├── MemoryCRDTService.ts
│   │   ├── MemoryBloomFilterService.ts
│   │   ├── MemoryBinarySerializationService.ts
│   │   ├── AnalyticsService.ts
│   │   ├── DiagnosticsService.ts
│   │   ├── ErrorClassifier.ts
│   │   ├── FallbackStrategy.ts
│   │   ├── GracefulDegradation.ts
│   │   ├── LatencyOptimizer.ts
│   │   ├── LogService.ts
│   │   ├── JsonRepair.ts
│   │   ├── DeterminismTestSuite.ts
│   │   ├── ExecutionGraphTracker.ts
│   │   ├── FailurePatternLearner.ts
│   │   ├── IncrementalResultBuilder.ts
│   │   ├── IntentClarification.ts
│   │   ├── ContextCompressionEngine.ts
│   │   ├── DOMAwarenessInjector.ts
│   │   ├── ContentExtractionHeuristics.ts
│   │   ├── EventBasedUIProtocol.ts
│   │   ├── ExtractionService.ts
│   │   ├── KnezProfiles.ts        # Connection profiles
│   │   ├── StaticMemoryLoader.ts
│   │   └── agent/                 # Agent services
│   │       ├── AgentTracer.ts
│   │       └── AgentRuntime.ts
│   │
│   ├── mcp/                       # MCP integration
│   │   ├── McpOrchestrator.ts     # Main orchestrator
│   │   ├── McpErrorTaxonomy.ts    # Error classification
│   │   ├── authority.ts           # Authority management
│   │   ├── index.ts
│   │   ├── mcpBoot.ts             # Bootstrap
│   │   ├── rustEventBridge.ts     # Rust bridge
│   │   └── inspector/             # Inspector
│   │       └── McpInspectorService.ts
│   │
│   ├── presence/                  # Presence engine
│   │   └── PresenceEngine.ts
│   │
│   ├── components/                # Shared components
│   │   ├── layout/
│   │   └── ui/
│   │
│   ├── design/                    # Design system
│   │   └── tokens.ts              # Design tokens
│   │
│   ├── features/                  # Feature modules (22 features)
│   │   ├── chat/                  # Chat feature
│   │   │   ├── ChatPane.tsx       # Main chat (200+ lines)
│   │   │   ├── ChatTerminalPane.tsx
│   │   │   ├── MessageItem.tsx    # Message render (552 lines)
│   │   │   ├── DebugPanel.tsx
│   │   │   ├── MemoryModal.tsx
│   │   │   ├── LineagePanel.tsx
│   │   │   ├── SessionInspectorModal.tsx
│   │   │   ├── ChatMemorySyncModal.tsx
│   │   │   ├── TaqwinToolsModal.tsx
│   │   │   ├── ToolApprovalModal.tsx
│   │   │   ├── blocks/            # Message blocks (5 files)
│   │   │   ├── components/        # Chat components (2 files)
│   │   │   ├── modals/            # Chat modals (5 files)
│   │   │   └── ChatUtils.ts
│   │   ├── mcp/
│   │   ├── memory/
│   │   ├── cognitive/
│   │   ├── governance/
│   │   ├── diagnostics/
│   │   ├── drift/
│   │   ├── events/
│   │   ├── extraction/
│   │   ├── infrastructure/
│   │   ├── logs/
│   │   ├── mistakes/
│   │   ├── perception/
│   │   ├── performance/
│   │   ├── presence/
│   │   ├── reflection/
│   │   ├── replay/
│   │   ├── settings/
│   │   ├── skills/
│   │   ├── system/
│   │   ├── timeline/
│   │   ├── updates/
│   │   └── voice/
│   │
│   └── assets/                    # Static assets
│
├── public/                        # Public assets
│   └── memory/                    # Static memory files
│
├── scripts/                       # Build scripts
│   ├── clean.mjs
│   └── dev-all.ps1
│
└── src-tauri/                     # Tauri Rust backend
    └── src/
```

---

## Backend File Structure Issues

### Issue 1: Monolithic sessions/store.py

**Problem**: `sessions/store.py` is 541 lines, containing:
- Session lineage tracking
- Resume snapshot management
- MCP tool call tracking
- Failover event logging
- Multiple data models

**Impact**:
- Hard to maintain
- Difficult to test individual components
- Violates single responsibility principle

**Recommendation**: Split into:
- `session_lineage.py` - Session lineage
- `resume_snapshot.py` - Resume snapshots
- `tool_call_store.py` - Tool call tracking
- `failover_store.py` - Failover events

---

### Issue 2: Inconsistent API Organization

**Problem**: API endpoints scattered across multiple locations:
- `knez_core/api/` - Core APIs
- `cognitive/` - Cognitive APIs (separate module)
- `mcp/` - MCP APIs (separate module)
- `perception/` - Perception APIs (separate module)
- `compat/` - Compatibility APIs (separate module)

**Impact**:
- Confusing structure
- Hard to find endpoints
- Inconsistent patterns

**Recommendation**: Consolidate all APIs under `knez_core/api/`:
```
knez_core/api/
├── completions.py
├── health.py
├── sessions.py
├── events.py
├── memory.py
├── replay.py
├── cognitive.py      # Moved from cognitive/
├── mcp.py            # Moved from mcp/
├── perception.py     # Moved from perception/
└── compat.py         # Moved from compat/
```

---

### Issue 3: Stub Cloud Backend

**Problem**: `cloud_backend.py` is a 23-line stub with no implementation

**Impact**:
- Misleading structure
- Suggests functionality that doesn't exist
- Blocks cloud backend development

**Recommendation**: Either:
- Implement cloud backend, or
- Remove file and document as future work

---

### Issue 4: Missing __init__.py Files

**Problem**: Some directories lack `__init__.py`:
- `knez_core/models/`
- `knez_core/router/`
- `knez_core/events/` (has one)
- `knez_core/memory/` (has one)

**Impact**:
- Inconsistent Python module structure
- Potential import issues

**Recommendation**: Add `__init__.py` to all directories for consistency

---

### Issue 5: Utils Directory Underutilized

**Problem**: `utils/` only has 2 files:
- `exceptions.py`
- `tokenizer.py`

**Impact**:
- Wasted directory structure
- Could consolidate into other locations

**Recommendation**: Either:
- Move utils to appropriate locations, or
- Expand utils to include common utilities

---

## Frontend File Structure Issues

### Issue 1: Over-Engineered Memory Services

**Problem**: 7 memory services, many unused:
- MemoryEventSourcingService
- MemoryBackupService
- MemoryCompressionService
- MemoryCRDTService
- MemoryBloomFilterService
- MemoryBinarySerializationService
- (Plus others in services/)

**Impact**:
- Unnecessary complexity
- Maintenance overhead
- Confusing for developers

**Recommendation**: Consolidate to 3 services:
- `MemoryService.ts` - Core CRUD operations
- `MemoryBackupService.ts` - Backup/restore
- Remove unused services

---

### Issue 2: Large Service Files

**Problem**: Several service files are too large:
- `ChatService.ts` - 828 lines
- `KnezClient.ts` - 923 lines

**Impact**:
- Hard to navigate
- Difficult to test
- Violates single responsibility

**Recommendation**: Split into smaller modules:

**ChatService.ts** split:
- `ChatStateService.ts` - State management
- `StreamProcessor.ts` - SSE parsing
- `ToolCoordinator.ts` - Tool execution flow
- `PhaseManager.ts` - Phase transitions

**KnezClient.ts** split:
- `KnezHttpClient.ts` - HTTP operations
- `KnezStreamClient.ts` - SSE streaming
- `KnezProfileManager.ts` - Profile management

---

### Issue 3: Services Directory Bloat

**Problem**: 45+ services in single directory, no organization

**Impact**:
- Hard to find services
- No logical grouping
- Maintenance nightmare

**Recommendation**: Organize by domain:
```
services/
├── chat/
│   ├── ChatService.ts
│   ├── StreamProcessor.ts
│   ├── ToolCoordinator.ts
│   └── PhaseManager.ts
├── backend/
│   ├── KnezHttpClient.ts
│   ├── KnezStreamClient.ts
│   └── KnezProfileManager.ts
├── session/
│   ├── SessionDatabase.ts
│   └── SessionController.ts
├── mcp/
│   ├── McpOrchestrator.ts
│   ├── ToolExecutionService.ts
│   └── ToolExposureService.ts
├── memory/
│   ├── MemoryService.ts
│   └── MemoryBackupService.ts
├── governance/
│   └── GovernanceService.ts
└── analytics/
    ├── AnalyticsService.ts
    └── DiagnosticsService.ts
```

---

### Issue 4: Feature Module Inconsistency

**Problem**: 22 feature modules with inconsistent structure:
- Some have subdirectories (chat/blocks, chat/modals)
- Some are single files
- Some have components, some don't

**Impact**:
- Inconsistent patterns
- Hard to navigate
- Unclear where to add new features

**Recommendation**: Standardize feature structure:
```
features/
└── {feature}/
    ├── index.tsx              # Main component
    ├── components/            # Feature-specific components
    ├── hooks/                 # Feature-specific hooks
    ├── services/              # Feature-specific services
    └── types.ts               # Feature-specific types
```

---

### Issue 5: Duplicate MCP Integration

**Problem**: MCP integration in two locations:
- `services/McpOrchestrator.ts`
- `mcp/McpOrchestrator.ts`

**Impact**:
- Confusion about which to use
- Potential divergence
- Maintenance overhead

**Recommendation**: Consolidate to single location:
- Keep `mcp/McpOrchestrator.ts` as main
- Remove `services/McpOrchestrator.ts`
- Update imports

---

### Issue 6: Components Directory Underutilized

**Problem**: `components/` directory exists but most components are in `features/`

**Impact**:
- Misleading structure
- Unclear where to put shared components

**Recommendation**: Either:
- Move shared components to `components/`
- Remove directory if unused

---

## Modularization Assessment

### Backend Modularization Score: 7/10

**Strengths**:
- Clear separation between API, models, services
- Event system well-isolated
- Memory system modular

**Weaknesses**:
- Monolithic sessions/store.py
- Inconsistent API organization
- Stub cloud backend

**Improvements Needed**:
- Split large files
- Consolidate API endpoints
- Implement or remove stubs

---

### Frontend Modularization Score: 5/10

**Strengths**:
- Feature-based organization
- Service layer separation
- Domain models isolated

**Weaknesses**:
- Services directory bloat (45+ files)
- Over-engineered memory services
- Large service files
- Duplicate MCP integration

**Improvements Needed**:
- Organize services by domain
- Remove unused services
- Split large files
- Consolidate duplicates

---

## Code Organization Issues

### Issue 1: Mixed Concerns in ChatService

**Problem**: ChatService handles:
- State management
- SSE parsing
- Tool execution coordination
- Phase transitions
- Message persistence

**Impact**: Violates single responsibility principle

**Recommendation**: Split into focused services

---

### Issue 2: API and Service Logic Mixed

**Problem**: Some API files contain business logic that should be in services

**Example**: `api/completions.py` contains streaming logic

**Recommendation**: Move business logic to service layer, keep API thin

---

### Issue 3: Type Definitions Scattered

**Problem**: Type definitions in multiple locations:
- `domain/DataContracts.ts`
- `services/McpTypes.ts`
- Inline types in components

**Impact**: Type duplication, inconsistency risk

**Recommendation**: Consolidate all types in `domain/`

---

## Dependency Issues

### Backend Dependency Graph

```
app.py
  ├─► router/router.py
  │     ├─► models/base.py
  │     ├─► models/local_backend.py
  │     ├─► router/scorer.py
  │     └─► memory/gate.py
  ├─► api/completions.py
  │     ├─► router/router.py
  │     ├─► events/emitter.py
  │     └─► sessions/store.py
  ├─► api/health.py
  │     └─► models/local_backend.py
  └─► api/sessions.py
        └─► sessions/store.py
```

**Issues**:
- Circular dependency potential
- Deep dependency chains
- Tight coupling

---

### Frontend Dependency Graph

```
ChatPane.tsx
  ├─► ChatService.ts
  │     ├─► KnezClient.ts
  │     ├─► SessionDatabase.ts
  │     ├─► ToolExecutionService.ts
  │     └─► McpOrchestrator.ts
  ├─► MessageItem.tsx
  └─► DebugPanel.tsx

KnezClient.ts
  ├─► @tauri-apps/api/http
  └─► @tauri-apps/plugin-shell

McpOrchestrator.ts
  └─► McpInspectorService.ts
```

**Issues**:
- ChatPane depends on many services
- Services depend on each other
- Tight coupling to Tauri

---

## Naming Convention Issues

### Backend Naming

**Inconsistencies**:
- Some files use snake_case (Python standard)
- Some directories use camelCase (non-standard)
- API files inconsistent naming

**Examples**:
- `completions.py` (good)
- `taqwin_router.py` (inconsistent underscore)
- `api/` (good)
- `cognitive/` (good, but separate module)

**Recommendation**: Standardize to snake_case for all Python files and directories

---

### Frontend Naming

**Inconsistencies**:
- Service files use PascalCase (TypeScript standard)
- Some use camelCase
- Feature directories inconsistent

**Examples**:
- `ChatService.ts` (good)
- `McpOrchestrator.ts` (good)
- `chat/` (good)
- `mcp/` (inconsistent acronym)

**Recommendation**: Standardize to PascalCase for files, lowercase for directories

---

## File Size Issues

### Backend Files Over 300 Lines

| File | Lines | Issue |
|------|-------|-------|
| sessions/store.py | 541 | Monolithic |
| api/completions.py | 306 | Mixed concerns |
| api/sessions.py | 264 | Large |

**Recommendation**: Split files over 300 lines

---

### Frontend Files Over 500 Lines

| File | Lines | Issue |
|------|-------|-------|
| ChatService.ts | 828 | Too large |
| KnezClient.ts | 923 | Too large |
| MessageItem.tsx | 552 | Large component |

**Recommendation**: Split files over 500 lines

---

## Circular Dependency Issues

### Potential Circular Dependencies

**Backend**:
```
router/router.py
  ├─► memory/gate.py
  └─► events/emitter.py
        └─► events/store.py
              └─► (no circular)
```

**Frontend**:
```
ChatService.ts
  ├─► ToolExecutionService.ts
  │     └─► McpOrchestrator.ts
  │           └─► ToolExposureService.ts
  └─► KnezClient.ts
```

**Current Status**: No confirmed circular dependencies, but risk exists

**Recommendation**: Use dependency injection to reduce coupling

---

## Proposed Restructuring

### Backend Restructuring

**Before**:
```
KNEZ/knez/
├── knez_core/
│   ├── api/
│   ├── models/
│   ├── router/
│   ├── events/
│   ├── memory/
│   ├── sessions/
│   ├── checkpoints/
│   ├── failover/
│   ├── replay/
│   ├── telemetry/
│   └── utils/
├── cognitive/
├── mcp/
├── perception/
└── compat/
```

**After**:
```
KNEZ/knez/
├── knez_core/
│   ├── __init__.py
│   ├── app.py
│   ├── agents.py
│   │
│   ├── api/                      # All API endpoints
│   │   ├── __init__.py
│   │   ├── completions.py
│   │   ├── health.py
│   │   ├── sessions.py
│   │   ├── events.py
│   │   ├── memory.py
│   │   ├── cognitive.py
│   │   ├── mcp.py
│   │   ├── perception.py
│   │   ├── replay.py
│   │   └── compat.py
│   │
│   ├── models/                   # Model backends
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── local_backend.py
│   │   └── cloud_backend.py
│   │
│   ├── routing/                  # Routing logic
│   │   ├── __init__.py
│   │   ├── router.py
│   │   ├── classifier.py
│   │   └── scorer.py
│   │
│   ├── events/                   # Event system
│   │   ├── __init__.py
│   │   ├── schema.py
│   │   ├── emitter.py
│   │   ├── store.py
│   │   └── reader.py
│   │
│   ├── memory/                   # Memory system
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── store.py
│   │   ├── gate.py
│   │   └── knowledge_store.py
│   │
│   ├── sessions/                 # Session management
│   │   ├── __init__.py
│   │   ├── lineage.py           # Session lineage
│   │   ├── snapshot.py          # Resume snapshots
│   │   ├── tool_calls.py        # Tool call tracking
│   │   └── failover.py          # Failover events
│   │
│   ├── checkpoints/              # Checkpoint system
│   │   ├── __init__.py
│   │   ├── model.py
│   │   ├── reader.py
│   │   ├── redis_stream.py
│   │   └── sqlite_writer.py
│   │
│   ├── failover/                 # Failover
│   │   ├── __init__.py
│   │   ├── manager.py
│   │   ├── health.py
│   │   └── continuation.py
│   │
│   ├── replay/                   # Replay system
│   │   ├── __init__.py
│   │   ├── engine.py
│   │   ├── models.py
│   │   ├── phases.py
│   │   ├── reflection.py
│   │   ├── insights.py
│   │   ├── stats.py
│   │   └── summary.py
│   │
│   ├── telemetry/                # Metrics
│   │   ├── __init__.py
│   │   └── metrics.py
│   │
│   └── utils/                    # Utilities
│       ├── __init__.py
│       ├── exceptions.py
│       └── tokenizer.py
```

---

### Frontend Restructuring

**Before**:
```
src/
├── services/                    # 45+ files, flat
├── mcp/                         # MCP integration
├── presence/
├── components/
├── features/                    # 22 features
└── domain/
```

**After**:
```
src/
├── domain/                      # Domain models
│   ├── DataContracts.ts
│   ├── Errors.ts
│   └── types/                   # Additional types
│
├── services/                    # Organized by domain
│   ├── chat/
│   │   ├── ChatStateService.ts
│   │   ├── StreamProcessor.ts
│   │   ├── ToolCoordinator.ts
│   │   └── PhaseManager.ts
│   ├── backend/
│   │   ├── KnezHttpClient.ts
│   │   ├── KnezStreamClient.ts
│   │   └── KnezProfileManager.ts
│   ├── session/
│   │   ├── SessionDatabase.ts
│   │   └── SessionController.ts
│   ├── mcp/
│   │   ├── McpOrchestrator.ts
│   │   ├── ToolExecutionService.ts
│   │   └── ToolExposureService.ts
│   ├── memory/
│   │   ├── MemoryService.ts
│   │   └── MemoryBackupService.ts
│   ├── governance/
│   │   └── GovernanceService.ts
│   └── analytics/
│       ├── AnalyticsService.ts
│       └── DiagnosticsService.ts
│
├── mcp/                         # MCP integration
│   ├── McpOrchestrator.ts
│   ├── McpErrorTaxonomy.ts
│   ├── authority.ts
│   └── inspector/
│       └── McpInspectorService.ts
│
├── presence/
│   └── PresenceEngine.ts
│
├── components/                  # Shared components
│   ├── layout/
│   └── ui/
│
├── features/                     # Feature modules
│   └── {feature}/
│       ├── index.tsx
│       ├── components/
│       ├── hooks/
│       └── services/
│
├── contexts/
├── hooks/
├── config/
└── assets/
```

---

## Migration Strategy

### Backend Migration

**Phase 1: Add __init__.py Files**
- Add to all directories
- No breaking changes

**Phase 2: Split sessions/store.py**
- Create new files
- Migrate code
- Update imports
- Test thoroughly

**Phase 3: Consolidate APIs**
- Move cognitive/ to api/cognitive.py
- Move mcp/ to api/mcp.py
- Move perception/ to api/perception.py
- Move compat/ to api/compat.py
- Update imports
- Test thoroughly

**Phase 4: Implement or Remove Cloud Backend**
- Either implement full cloud backend
- Or remove file and document

**Phase 5: Rename for Consistency**
- Standardize to snake_case
- Update all imports
- Test thoroughly

---

### Frontend Migration

**Phase 1: Remove Unused Memory Services**
- Identify unused services
- Remove files
- Update imports
- Test thoroughly

**Phase 2: Split ChatService.ts**
- Create new service files
- Migrate code
- Update imports
- Test thoroughly

**Phase 3: Split KnezClient.ts**
- Create new client files
- Migrate code
- Update imports
- Test thoroughly

**Phase 4: Organize Services by Domain**
- Create domain directories
- Move service files
- Update imports
- Test thoroughly

**Phase 5: Consolidate MCP Integration**
- Keep mcp/McpOrchestrator.ts
- Remove services/McpOrchestrator.ts
- Update imports
- Test thoroughly

**Phase 6: Standardize Feature Structure**
- Create standard template
- Migrate features to new structure
- Update imports
- Test thoroughly

---

## Modularization Recommendations

### Backend Recommendations

1. **Split Large Files**: Any file over 300 lines should be split
2. **Consolidate APIs**: All API endpoints in single location
3. **Standardize Naming**: Use snake_case consistently
4. **Add __init__.py**: All directories should have __init__.py
5. **Remove Stubs**: Implement or remove stub files
6. **Domain-Based Services**: Organize by business domain

---

### Frontend Recommendations

1. **Split Large Files**: Any file over 500 lines should be split
2. **Organize Services**: Group services by domain
3. **Remove Unused Services**: Delete unused memory services
4. **Consolidate Duplicates**: Remove duplicate MCP integration
5. **Standardize Features**: Use consistent feature structure
6. **Centralize Types**: All types in domain/

---

## Conclusion

### Key Issues Identified

**Backend**:
- Monolithic sessions/store.py (541 lines)
- Inconsistent API organization
- Stub cloud backend
- Missing __init__.py files

**Frontend**:
- Services directory bloat (45+ files)
- Over-engineered memory services (7 services)
- Large service files (ChatService 828 lines, KnezClient 923 lines)
- Duplicate MCP integration

### Priority Actions

**High Priority**:
1. Split backend sessions/store.py
2. Split frontend ChatService.ts and KnezClient.ts
3. Remove unused frontend memory services
4. Consolidate frontend MCP integration

**Medium Priority**:
5. Consolidate backend APIs
6. Organize frontend services by domain
7. Standardize naming conventions

**Low Priority**:
8. Implement or remove cloud backend
9. Standardize feature structure
10. Add __init__.py files

### Expected Impact

- **Maintainability**: 40-50% improvement
- **Navigation**: 60-70% improvement
- **Code Clarity**: 30-40% improvement
- **Testing**: 50% improvement (smaller, focused modules)

---

**Document Version**: 1.0  
**Last Updated**: 2025-04-21  
**Author**: TAQWIN Architecture Analysis  
**Related Documents**: DOC-01 (KNEZ Backend), DOC-02 (knez-control-app), DOC-04 (Component Analysis)
