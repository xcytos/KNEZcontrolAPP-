# KNEZ Architecture - Deep Notes

## Layer 1: Observability Layer

### Purpose
Provides comprehensive monitoring, logging, and debugging capabilities across the entire KNEZ system. This layer is the "eyes" of the system, allowing developers and operators to understand what's happening at runtime.

### Components Breakdown

**KnezEventsPanel.tsx**
- Location: `src/features/events/KnezEventsPanel.tsx`
- Purpose: Real-time event stream visualization
- Key Features: Event filtering, timeline view, event details
- Dependencies: KNEZ backend event stream
- Status: Working

**LogsPanel.tsx**
- Location: `src/features/logs/LogsPanel.tsx`
- Purpose: System log viewer with filtering
- Key Features: Log level filtering, search, export
- Dependencies: LogService
- Status: Working

**DebugPanel.tsx**
- Location: `src/features/chat/DebugPanel.tsx`
- Purpose: Tool execution debugging and history
- Key Features: Tool call history, execution time tracking, MCP latency, statistics dashboard
- Dependencies: ChatService, tool execution events
- Status: Working (recently integrated)

**SessionInspectorModal.tsx**
- Location: `src/features/chat/SessionInspectorModal.tsx`
- Purpose: Detailed session inspection
- Key Features: Session timeline, message flow, tool execution sequence
- Dependencies: SessionDatabase, ChatService
- Status: Working

**AnalyticsService.ts**
- Location: `src/services/AnalyticsService.ts`
- Purpose: Analytics and metrics collection
- Key Features: Usage tracking, performance metrics, error rates
- Dependencies: KNEZ backend
- Status: Partially implemented

**DeterminismTestSuite.ts**
- Location: `src/services/DeterminismTestSuite.ts`
- Purpose: Test reproducibility of tool execution
- Key Features: Determinism tests, replay capability
- Dependencies: ToolExecutionService
- Status: Planned

**ErrorClassifier.ts**
- Location: `src/services/ErrorClassifier.ts`
- Purpose: Classify and categorize errors
- Key Features: Error taxonomy, pattern detection
- Dependencies: LogService
- Status: Working

**EventBasedUIProtocol.ts**
- Location: `src/services/EventBasedUIProtocol.ts`
- Purpose: Event-driven UI updates
- Key Features: Event subscription, UI state synchronization
- Dependencies: Event emitter
- Status: Working

**ExecutionGraphTracker.ts**
- Location: `src/services/ExecutionGraphTracker.ts`
- Purpose: Track execution flow as a graph
- Key Features: Execution graph construction, dependency tracking
- Dependencies: AgentOrchestrator
- Status: Planned

## Layer 2: Governance & Control Layer

### Purpose
Enforces policies, manages approval workflows, and provides audit trails for system operations.

### Components Breakdown

**GovernancePanel.tsx**
- Location: `src/features/governance/GovernancePanel.tsx`
- Purpose: Governance UI for policy management
- Key Features: Policy configuration, approval workflows
- Dependencies: GovernanceService
- Status: Partially implemented

**ApprovalPanel.tsx**
- Location: `src/features/governance/ApprovalPanel.tsx`
- Purpose: Approval request management
- Key Features: Pending approvals, approval history
- Dependencies: GovernanceService
- Status: Working

**GovernanceService.ts**
- Location: `src/services/GovernanceService.ts`
- Purpose: Governance logic and policy enforcement
- Key Features: Policy validation, approval workflow
- Dependencies: SessionDatabase
- Status: Partially implemented

**AuditModal.tsx**
- Location: `src/features/chat/modals/AuditModal.tsx`
- Purpose: Audit trail viewer
- Key Features: Audit log, compliance checks
- Dependencies: GovernanceService
- Status: Working

## Layer 3: Cognitive & Intelligence Layer

### Purpose
Manages context, detects drift, and provides intelligent compression for efficient AI operations.

### Components Breakdown

**CognitivePanel.tsx**
- Location: `src/features/cognitive/CognitivePanel.tsx`
- Purpose: Cognitive state visualization
- Key Features: Governance insights, influence tracking, stability metrics
- Dependencies: CognitiveState from backend
- Status: Working

**DriftVisualizer.tsx**
- Location: `src/features/drift/DriftVisualizer.tsx`
- Purpose: Drift detection and visualization
- Key Features: Scope drift, rule drift, focus drift
- Dependencies: DriftMetric events
- Status: Working

**ContextCompressionEngine.ts**
- Location: `src/services/ContextCompressionEngine.ts`
- Purpose: Compress context for efficiency
- Key Features: Token optimization, relevance scoring
- Dependencies: ChatService
- Status: Working

**DOMAwarenessInjector.ts**
- Location: `src/services/DOMAwarenessInjector.ts`
- Purpose: Inject DOM awareness into context
- Key Features: Page structure awareness, element detection
- Dependencies: Browser tools
- Status: Planned

## Layer 4: Infrastructure & System Layer

### Purpose
Provides system orchestration, health monitoring, and performance tracking for the entire KNEZ system.

### Components Breakdown

**InfrastructurePanel.tsx**
- Location: `src/features/infrastructure/InfrastructurePanel.tsx`
- Purpose: Main infrastructure dashboard (Observatory)
- Key Features: System control, performance metrics, backend health, system integrity audit
- Dependencies: SystemPanel, PerformancePanel, knezClient
- Status: Working

**SystemPanel.tsx**
- Location: `src/features/system/SystemPanel.tsx`
- Purpose: System control and orchestration
- Key Features: Start/stop system, health checks, output viewer
- Dependencies: useSystemOrchestrator
- Status: Working

**PerformancePanel.tsx**
- Location: `src/features/performance/PerformancePanel.tsx`
- Purpose: Real-time performance metrics
- Key Features: Latency, TTFT, tokens/sec visualization
- Dependencies: Performance metrics stream
- Status: Working (mock data, needs real integration)

**useSystemOrchestrator.ts**
- Location: `src/features/system/useSystemOrchestrator.ts`
- Purpose: System orchestration hook
- Key Features: System lifecycle management, health probing
- Dependencies: System orchestration backend
- Status: Working

**KnezClient.ts**
- Location: `src/services/KnezClient.ts`
- Purpose: KNEZ backend API client
- Key Features: Chat completions, event streaming, health checks
- Dependencies: KNEZ backend HTTP API
- Status: Working

**DiagnosticsService.ts**
- Location: `src/services/DiagnosticsService.ts`
- Purpose: System diagnostics
- Key Features: Health checks, system status, error reporting
- Dependencies: KNEZ backend
- Status: Working

**TestPanel.tsx**
- Location: `src/features/diagnostics/TestPanel.tsx`
- Purpose: Diagnostic testing UI
- Key Features: System tests, health checks
- Dependencies: DiagnosticsService
- Status: Working

## Layer 5: MCP Integration Layer

### Purpose
Manages external tool connections through the Model Context Protocol (MCP), providing standardized tool integration.

### Components Breakdown

**McpOrchestrator.ts**
- Location: `src/mcp/McpOrchestrator.ts`
- Purpose: Central MCP coordination
- Key Features: Server management, tool aggregation, lifecycle control
- Dependencies: MCP clients, McpHostConfig
- Status: Working

**McpBuiltinClient.ts**
- Location: `src/mcp/client/McpBuiltinClient.ts`
- Purpose: Built-in MCP client for local tools
- Key Features: Local tool execution, no external process
- Dependencies: None (self-contained)
- Status: Working

**McpHttpClient.ts**
- Location: `src/mcp/client/McpHttpClient.ts`
- Purpose: HTTP-based MCP client
- Key Features: Remote MCP server communication
- Dependencies: HTTP transport
- Status: Working

**McpStdioClient.ts**
- Location: `src/mcp/client/McpStdioClient.ts`
- Purpose: Stdio-based MCP client
- Key Features: Process-based MCP communication
- Dependencies: Process spawning
- Status: Working

**McpRustClient.ts**
- Location: `src/mcp/client/McpRustClient.ts`
- Purpose: Rust-based MCP client
- Key Features: Native Rust MCP integration
- Dependencies: Tauri Rust bridge
- Status: Working

**McpRegistryView.tsx**
- Location: `src/features/mcp/McpRegistryView.tsx`
- Purpose: MCP registry visualization
- Key Features: Server list, status, capabilities
- Dependencies: McpOrchestrator
- Status: Working

**McpInspectorService.ts**
- Location: `src/mcp/inspector/McpInspectorService.ts`
- Purpose: MCP traffic inspection and testing
- Key Features: Tool simulation, stress testing, traffic analysis
- Dependencies: MCP clients
- Status: Working

**McpTraffic.ts**
- Location: `src/mcp/inspector/McpTraffic.ts`
- Purpose: Traffic data structures
- Key Features: Request/response tracking
- Dependencies: None (data structures)
- Status: Working

**McpBoot.ts**
- Location: `src/mcp/mcpBoot.ts`
- Purpose: MCP boot sequence
- Key Features: Server initialization, health checks
- Dependencies: McpOrchestrator
- Status: Working

**TaqwinMcpService.ts**
- Location: `src/mcp/taqwin/TaqwinMcpService.ts`
- Purpose: TAQWIN-specific MCP service
- Key Features: TAQWIN tool integration
- Dependencies: TAQWIN backend
- Status: Working

## Layer 6: Tool Execution Layer

### Purpose
Manages tool catalog, execution, and validation for all MCP tools.

### Components Breakdown

**ToolExecutionService.ts**
- Location: `src/services/ToolExecutionService.ts`
- Purpose: Tool execution service
- Key Features: Tool invocation, timeout handling, result normalization
- Dependencies: McpOrchestrator
- Status: Working

**ToolExposureService.ts**
- Location: `src/services/ToolExposureService.ts`
- Purpose: Tool catalog and exposure
- Key Features: Tool registration, catalog management, model tool filtering
- Dependencies: MCP registry
- Status: Working

**ToolResultValidator.ts**
- Location: `src/services/ToolResultValidator.ts`
- Purpose: Tool result validation
- Key Features: Schema validation, error detection
- Dependencies: Tool schemas
- Status: Working

**ToolApprovalModal.tsx**
- Location: `src/features/chat/ToolApprovalModal.tsx`
- Purpose: Tool approval UI
- Key Features: Approval requests, tool details
- Dependencies: ToolExecutionService
- Status: Working

**AvailableToolsModal.tsx**
- Location: `src/features/chat/modals/AvailableToolsModal.tsx`
- Purpose: Available tools viewer
- Key Features: Tool list, tool descriptions
- Dependencies: ToolExposureService
- Status: Working

**TaqwinToolsModal.tsx**
- Location: `src/features/chat/TaqwinToolsModal.tsx`
- Purpose: TAQWIN tools viewer
- Key Features: TAQWIN-specific tools
- Dependencies: TaqwinMcpService
- Status: Working

## Layer 7: Agent Runtime Layer

### Purpose
Central brain for autonomous agent execution, managing the agent loop, context, and decision-making.

### Components Breakdown

**AgentOrchestrator.ts**
- Location: `src/services/agent/AgentOrchestrator.ts`
- Purpose: Central agent orchestration
- Key Features: Agent loop, tool execution, retry logic, final answer generation
- Dependencies: AgentLoopService, ToolExecutionService, knezClient
- Status: Working

**AgentLoopService.ts**
- Location: `src/services/agent/AgentLoopService.ts`
- Purpose: Agent loop control
- Key Features: Loop state management, context initialization
- Dependencies: AgentContext
- Status: Working

**AgentContext.ts**
- Location: `src/services/agent/AgentContext.ts`
- Purpose: Agent context management
- Key Features: Context storage, state tracking
- Dependencies: None (in-memory)
- Status: Working

**LoopController.ts**
- Location: `src/services/agent/LoopController.ts`
- Purpose: Loop decision logic
- Key Features: Stop conditions, force answer logic
- Dependencies: AgentContext
- Status: Working

**RetryStrategyEngine.ts**
- Location: `src/services/agent/RetryStrategyEngine.ts`
- Purpose: Retry strategy determination
- Key Features: Failure classification, retry delay calculation, argument refinement
- Dependencies: FailureClassifier
- Status: Working

**ExecutionSandbox.ts**
- Location: `src/services/agent/ExecutionSandbox.ts`
- Purpose: Tool execution sandbox
- Key Features: Timeout enforcement, cancellation
- Dependencies: None (execution wrapper)
- Status: Working

**ToolResultNormalizer.ts**
- Location: `src/services/agent/ToolResultNormalizer.ts`
- Purpose: Tool result normalization
- Key Features: Result parsing, structured data extraction
- Dependencies: Tool schemas
- Status: Working

**SecurityLayer.ts**
- Location: `src/services/agent/SecurityLayer.ts`
- Purpose: Security validation
- Key Features: Tool call validation, security checks
- Dependencies: Security policies
- Status: Working

**AgentTracer.ts**
- Location: `src/services/agent/AgentTracer.ts`
- Purpose: Agent execution tracing
- Key Features: Step logging, failure tracking, retry logging
- Dependencies: None (logging)
- Status: Working

**AgentPane.tsx**
- Location: `src/features/agent/AgentPane.tsx`
- Purpose: Agent UI
- Key Features: Agent control, execution visualization
- Dependencies: AgentOrchestrator
- Status: Working

## Layer 8: Chat & Communication Layer

### Purpose
User interface for AI interaction, managing chat sessions, messages, and streaming responses.

### Components Breakdown

**ChatService.ts**
- Location: `src/services/ChatService.ts`
- Purpose: Core chat service
- Key Features: Message handling, streaming, tool execution integration, session management
- Dependencies: knezClient, ToolExecutionService, SessionDatabase
- Status: Working

**ChatPane.tsx**
- Location: `src/features/chat/ChatPane.tsx`
- Purpose: Main chat UI
- Key Features: Message display, input, debug panel integration
- Dependencies: ChatService, MessageItem
- Status: Working

**MessageItem.tsx**
- Location: `src/features/chat/MessageItem.tsx`
- Purpose: Message rendering
- Key Features: Message types, tool execution blocks, status badges
- Dependencies: DataContracts
- Status: Working

**ChatInput.tsx**
- Location: `src/features/chat/components/ChatInput.tsx`
- Purpose: Chat input component
- Key Features: Text input, send button
- Dependencies: ChatService
- Status: Working

**ChatTerminalPane.tsx**
- Location: `src/features/chat/ChatTerminalPane.tsx`
- Purpose: Terminal-style chat view
- Key Features: Terminal UI, command history
- Dependencies: ChatService
- Status: Working

**ChatUtils.ts**
- Location: `src/features/chat/ChatUtils.ts`
- Purpose: Chat utility functions
- Key Features: Helper functions, formatting
- Dependencies: None (utilities)
- Status: Working

**useChatState.ts**
- Location: `src/features/chat/hooks/useChatState.ts`
- Purpose: Chat state hook
- Key Features: State management, subscriptions
- Dependencies: ChatService
- Status: Working

## Layer 9: Memory & Knowledge Layer

### Purpose
Event-sourced memory system with vector search, knowledge graph, and multi-level caching.

### Components Breakdown

**MemoryEventSourcingService.ts**
- Location: `src/services/MemoryEventSourcingService.ts`
- Purpose: Event-sourced memory
- Key Features: Event log, materialized views, replay
- Dependencies: SessionDatabase
- Status: Partially implemented

**MemoryVectorSearchService.ts**
- Location: `src/services/MemoryVectorSearchService.ts`
- Purpose: Vector-based semantic search
- Key Features: Embeddings, similarity search
- Dependencies: Vector database
- Status: Planned

**MemoryKnowledgeGraphService.ts**
- Location: `src/services/MemoryKnowledgeGraphService.ts`
- Purpose: Knowledge graph operations
- Key Features: Graph construction, relationship tracking
- Dependencies: Graph database
- Status: Planned

**MemoryCompressionService.ts**
- Location: `src/services/MemoryCompressionService.ts`
- Purpose: Memory compression
- Key Features: GZIP compression, deduplication
- Dependencies: None (compression)
- Status: Working

**MemoryMultiLevelCacheService.ts**
- Location: `src/services/MemoryMultiLevelCacheService.ts`
- Purpose: Multi-level caching
- Key Features: L1/L2/L3 cache hierarchy
- Dependencies: None (in-memory)
- Status: Working

**MemoryBackupService.ts**
- Location: `src/services/MemoryBackupService.ts`
- Purpose: Memory backup
- Key Features: Backup creation, restoration
- Dependencies: File system
- Status: Working

**MemoryLoaderService.ts**
- Location: `src/services/MemoryLoaderService.ts`
- Purpose: File-based memory injection
- Key Features: Markdown parsing, memory creation
- Dependencies: File system
- Status: Working

**MemoryModal.tsx**
- Location: `src/features/chat/MemoryModal.tsx`
- Purpose: Memory visualization UI
- Key Features: Graph view, timeline, filtering
- Dependencies: Memory services
- Status: Partially implemented

**LineagePanel.tsx**
- Location: `src/features/chat/LineagePanel.tsx`
- Purpose: Session lineage visualization
- Key Features: Session tree, fork/resume tracking
- Dependencies: SessionDatabase
- Status: Working

## Layer 10: Data Processing Layer

### Purpose
Data extraction, presence tracking, persistence, and session management.

### Components Breakdown

**ExtractionPanel.tsx**
- Location: `src/features/extraction/ExtractionPanel.tsx`
- Purpose: Data extraction UI
- Key Features: Extraction rules, content analysis
- Dependencies: ContentExtractionHeuristics
- Status: Working

**ContentExtractionHeuristics.ts**
- Location: `src/services/ContentExtractionHeuristics.ts`
- Purpose: Content extraction logic
- Key Features: Pattern matching, content parsing
- Dependencies: None (heuristics)
- Status: Working

**PresenceEngine.ts**
- Location: `src/presence/PresenceEngine.ts`
- Purpose: Presence state tracking
- Key Features: Presence detection, state transitions
- Dependencies: None (state machine)
- Status: Working

**PersistenceService.ts**
- Location: `src/services/PersistenceService.ts`
- Purpose: Persistence abstraction
- Key Features: Database operations, caching
- Dependencies: SessionDatabase
- Status: Working

**SessionDatabase.ts**
- Location: `src/services/SessionDatabase.ts`
- Purpose: Session storage
- Key Features: SQLite operations, IndexedDB sync
- Dependencies: SQLite, Dexie
- Status: Working

**SessionController.ts**
- Location: `src/services/SessionController.ts`
- Purpose: Session lifecycle management
- Key Features: Session creation, deletion, switching
- Dependencies: SessionDatabase
- Status: Working
