# TICKETSET012: Services Modularization Plan

## Objective
Organize orphaned files under `src/services/` into a modular folder structure based on domain/responsibility.

## Current State

### Already Organized Folders
- `agent/` (14 items) - Agent-related services
- `analytics/` (3 items) - Analytics services
- `backend/` (1 item) - Backend services
- `chat/` (9 items) - Chat services (newly modularized)
- `governance/` (2 items) - Governance services
- `mcp/` (8 items) - MCP services
- `memory/` (4 items) - Memory services
- `session/` (4 items) - Session services
- `stubs/` (2 items) - Stub services
- `utils/` (11 items) - Utility services

### Orphaned Files at Root Level (42 files)

## Categorization Analysis

### 1. Memory Services (13 files)
**Current Location:** `src/services/` (root)
**Target Location:** `src/services/memory/` (expand existing)

**Files:**
- `MemoryBinarySerializationService.ts` - Binary serialization for memory
- `MemoryBloomFilterService.ts` - Bloom filter for memory deduplication
- `MemoryCRDTService.ts` - CRDT-based memory sync
- `MemoryCompressionService.ts` - Memory compression
- `MemoryContentAddressableStorage.ts` - CAS-based memory storage
- `MemoryEventSourcingService.ts` - Event sourcing for memory
- `MemoryIndexingStrategyService.ts` - Memory indexing strategies
- `MemoryKnowledgeGraphService.ts` - Knowledge graph for memory
- `MemoryLoaderService.ts` - Memory loading utilities
- `MemoryMultiLevelCacheService.ts` - Multi-level caching for memory
- `MemoryShardingStrategyService.ts` - Sharding strategies for memory
- `MemoryTimeSeriesTrackingService.ts` - Time-series tracking for memory
- `MemoryVectorSearchService.ts` - Vector search for memory

**Rationale:** All these services are memory-related. The existing `memory/` folder has only 4 files. These 13 files should be organized into subcategories within `memory/`.

**Proposed Substructure:**
```
memory/
├── core/ (existing)
├── storage/
│   ├── MemoryBinarySerializationService.ts
│   ├── MemoryContentAddressableStorage.ts
│   └── MemoryEventSourcingService.ts
├── indexing/
│   ├── MemoryIndexingStrategyService.ts
│   └── MemoryVectorSearchService.ts
├── compression/
│   ├── MemoryCompressionService.ts
│   └── MemoryShardingStrategyService.ts
├── sync/
│   ├── MemoryCRDTService.ts
│   └── MemoryMultiLevelCacheService.ts
├── tracking/
│   ├── MemoryBloomFilterService.ts
│   ├── MemoryTimeSeriesTrackingService.ts
│   └── MemoryKnowledgeGraphService.ts
└── MemoryLoaderService.ts (root level)
```

---

### 2. Chat/Messaging Services (2 files)
**Current Location:** `src/services/` (root)
**Target Location:** `src/services/chat/` (expand existing)

**Files:**
- `ChatService.ts` - Main chat service (already modularized)
- `ChatMemorySyncService.ts` - Sync chat with memory system

**Rationale:** Chat-related services. The existing `chat/` folder already has the modular chat core. `ChatMemorySyncService.ts` should be moved to `chat/memory/` or `chat/sync/`.

**Proposed Substructure:**
```
chat/
├── core/ (existing - MessageStore, RequestController, etc.)
├── tools/ (existing - ToolExecutionBridge)
├── utils/ (existing - IdGenerator, MessageHelpers)
└── sync/
    └── ChatMemorySyncService.ts
```

---

### 3. KNEZ/Backend Services (3 files)
**Current Location:** `src/services/` (root)
**Target Location:** `src/services/knez/` (new folder)

**Files:**
- `KnezClient.ts` - KNEZ backend client
- `KnezClient.test.ts` - KNEZ client tests
- `KnezProfiles.ts` - KNEZ profile management

**Rationale:** These are KNEZ-specific services. Should be in their own `knez/` folder.

**Proposed Substructure:**
```
knez/
├── KnezClient.ts
├── KnezClient.test.ts
└── KnezProfiles.ts
```

---

### 4. Content/Context Processing (4 files)
**Current Location:** `src/services/` (root)
**Target Location:** `src/services/content/` (new folder)

**Files:**
- `ContentExtractionHeuristics.ts` - Content extraction strategies
- `ContextCompressionEngine.ts` - Context compression
- `DOMAwarenessInjector.ts` - DOM injection utilities
- `ProgressiveContentLoader.ts` - Progressive content loading

**Rationale:** These services handle content extraction, compression, and loading. Should be in `content/` folder.

**Proposed Substructure:**
```
content/
├── extraction/
│   └── ContentExtractionHeuristics.ts
├── compression/
│   └── ContextCompressionEngine.ts
└── loading/
    ├── DOMAwarenessInjector.ts
    └── ProgressiveContentLoader.ts
```

---

### 5. Execution/Tracking Services (3 files)
**Current Location:** `src/services/` (root)
**Target Location:** `src/services/execution/` (new folder)

**Files:**
- `ExecutionGraphTracker.ts` - Tracks tool execution dependencies as DAG
- `NavigationStateTracker.ts` - Tracks navigation state
- `IncrementalResultBuilder.ts` - Builds results incrementally

**Rationale:** These services track execution and build results. Should be in `execution/` folder.

**Proposed Substructure:**
```
execution/
├── tracking/
│   ├── ExecutionGraphTracker.ts
│   └── NavigationStateTracker.ts
└── building/
    └── IncrementalResultBuilder.ts
```

---

### 6. Analytics/Learning Services (2 files)
**Current Location:** `src/services/` (root)
**Target Location:** `src/services/analytics/` (expand existing)

**Files:**
- `FailurePatternLearner.ts` - Learns failure patterns
- `UserFeedbackLoop.ts` - User feedback collection

**Rationale:** These are analytics/learning services. The existing `analytics/` folder has 3 files. These should be added.

**Proposed Substructure:**
```
analytics/
├── learning/
│   ├── FailurePatternLearner.ts
│   └── UserFeedbackLoop.ts
└── [existing files]
```

---

### 7. UI/Interaction Services (4 files)
**Current Location:** `src/services/` (root)
**Target Location:** `src/services/ui/` (new folder)

**Files:**
- `EventBasedUIProtocol.ts` - Event-based UI protocol
- `UiDriverService.ts` - UI driver
- `SmartPaginationController.ts` - Smart pagination
- `IntentClarification.ts` - Intent clarification

**Rationale:** These services handle UI interactions and protocols. Should be in `ui/` folder.

**Proposed Substructure:**
```
ui/
├── protocol/
│   └── EventBasedUIProtocol.ts
├── driver/
│   └── UiDriverService.ts
├── pagination/
│   └── SmartPaginationController.ts
└── intent/
    └── IntentClarification.ts
```

---

### 8. Streaming Services (2 files)
**Current Location:** `src/services/` (root)
**Target Location:** `src/services/streaming/` (new folder)

**Files:**
- `StreamController.ts` - Stream controller (legacy, may conflict with chat/core/StreamController)
- `StreamingChannelIsolator.ts` - Streaming channel isolation

**Rationale:** These are streaming-related services. Should be in `streaming/` folder.

**Note:** There's a potential conflict with `chat/core/StreamController.ts`. Need to investigate if these are the same or different controllers.

**Proposed Substructure:**
```
streaming/
├── StreamController.ts (legacy - investigate conflict)
└── StreamingChannelIsolator.ts
```

---

### 9. Testing Services (2 files)
**Current Location:** `src/services/` (root)
**Target Location:** `src/services/testing/` (new folder)

**Files:**
- `DeterminismTestSuite.ts` - Determinism testing
- `TestRunner.ts` - Test runner

**Rationale:** These are testing utilities. Should be in `testing/` folder.

**Proposed Substructure:**
```
testing/
├── DeterminismTestSuite.ts
└── TestRunner.ts
```

---

### 10. System/Infrastructure Services (6 files)
**Current Location:** `src/services/` (root)
**Target Location:** `src/services/infrastructure/` (new folder)

**Files:**
- `PersistenceService.ts` - Persistence service
- `Preferences.ts` - Preferences management
- `SkillsRegistry.ts` - Skills registry
- `TabErrorStore.ts` - Tab error store
- `TaqwinActivationService.ts` - Taqwin activation
- `Troubleshooter.ts` - Troubleshooting utilities

**Rationale:** These are system/infrastructure services. Should be in `infrastructure/` folder.

**Proposed Substructure:**
```
infrastructure/
├── persistence/
│   └── PersistenceService.ts
├── config/
│   ├── Preferences.ts
│   └── SkillsRegistry.ts
├── error/
│   └── TabErrorStore.ts
├── activation/
│   └── TaqwinActivationService.ts
└── Troubleshooter.ts
```

---

### 11. MCP Services (1 file)
**Current Location:** `src/services/` (root)
**Target Location:** `src/services/mcp/` (expand existing)

**Files:**
- `McpTypes.ts` - MCP type definitions

**Rationale:** MCP-related type definitions. Should be in `mcp/` folder.

**Proposed Substructure:**
```
mcp/
├── McpTypes.ts
└── [existing files]
```

---

## Proposed Final Folder Structure

```
src/services/
├── agent/ (14 items) - unchanged
├── analytics/ (3 items + 2 new = 5 items)
│   └── learning/
│       ├── FailurePatternLearner.ts
│       └── UserFeedbackLoop.ts
├── backend/ (1 item) - unchanged
├── chat/ (9 items + 1 new = 10 items)
│   ├── core/ (existing)
│   ├── tools/ (existing)
│   ├── utils/ (existing)
│   └── sync/
│       └── ChatMemorySyncService.ts
├── content/ (new folder, 4 files)
│   ├── extraction/
│   ├── compression/
│   └── loading/
├── execution/ (new folder, 3 files)
│   ├── tracking/
│   └── building/
├── governance/ (2 items) - unchanged
├── infrastructure/ (new folder, 6 files)
│   ├── persistence/
│   ├── config/
│   ├── error/
│   ├── activation/
│   └── Troubleshooter.ts
├── knez/ (new folder, 3 files)
│   ├── KnezClient.ts
│   ├── KnezClient.test.ts
│   └── KnezProfiles.ts
├── mcp/ (8 items + 1 new = 9 items)
│   └── McpTypes.ts
├── memory/ (4 items + 13 new = 17 items)
│   ├── core/ (existing)
│   ├── storage/
│   ├── indexing/
│   ├── compression/
│   ├── sync/
│   ├── tracking/
│   └── MemoryLoaderService.ts
├── session/ (4 items) - unchanged
├── streaming/ (new folder, 2 files)
│   ├── StreamController.ts
│   └── StreamingChannelIsolator.ts
├── stubs/ (2 items) - unchanged
├── testing/ (new folder, 2 files)
│   ├── DeterminismTestSuite.ts
│   └── TestRunner.ts
├── ui/ (new folder, 4 files)
│   ├── protocol/
│   ├── driver/
│   ├── pagination/
│   └── intent/
└── utils/ (11 items) - unchanged
```

## Implementation Plan

### Phase 1: Create New Folder Structure
1. Create new folders: `content/`, `execution/`, `infrastructure/`, `knez/`, `streaming/`, `testing/`, `ui/`
2. Create subfolders within new folders
3. Expand existing folders: `analytics/`, `chat/`, `mcp/`, `memory/`

### Phase 2: Move Files
1. Move files to their target locations
2. Update import statements in all affected files
3. Verify no broken imports

### Phase 3: Resolve Conflicts
1. Investigate `StreamController.ts` conflict with `chat/core/StreamController.ts`
2. Determine if they are the same or different controllers
3. Resolve naming conflict if needed

### Phase 4: Validation
1. Run TypeScript compiler to verify no type errors
2. Run tests to verify functionality
3. Verify all imports resolve correctly

## Risk Assessment

**Low Risk:**
- Moving files within the same project
- Folder reorganization is non-breaking if imports are updated correctly

**Medium Risk:**
- Import statement updates across multiple files
- Potential circular dependency issues

**High Risk:**
- StreamController naming conflict resolution
- Breaking changes if imports are missed

## Mitigation Strategies

1. **Backup:** Create a backup of the current state before moving files
2. **Incremental Moves:** Move files in small batches, verifying each batch
3. **Import Updates:** Use automated tools to update imports where possible
4. **Testing:** Run tests after each batch move
5. **Conflict Resolution:** Investigate StreamController conflict before moving

## Success Criteria

- All orphaned files moved to appropriate folders
- All import statements updated correctly
- No TypeScript compilation errors
- All tests pass
- No runtime errors
- Clean folder structure with clear domain separation
