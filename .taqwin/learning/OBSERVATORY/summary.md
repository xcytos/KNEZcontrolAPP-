# KNEZ Architecture - AI Periodic Table Adapted

## Short Summary
The KNEZ system is organized into 10 architectural layers, each representing a specific domain of functionality. This adaptation of the AI Periodic Table framework maps generic AI concepts to the actual KNEZ codebase structure, providing a comprehensive understanding of how the knez-control-app is architected.

## Medium Summary
The KNEZ architecture consists of 10 distinct layers: Observability (top), Governance & Control, Cognitive & Intelligence, Infrastructure & System, MCP Integration, Tool Execution, Agent Runtime, Chat & Communication, Memory & Knowledge, and Data Processing (bottom). Each layer contains specific components that work together to provide a complete AI control interface. The Observability layer provides monitoring and debugging capabilities, while the Data Processing layer handles persistence and storage. The Agent Runtime layer serves as the central brain for autonomous execution, and the MCP Integration layer manages external tool connections through the Model Context Protocol.

## Full Summary

### KNEZ Layer Structure

**Layer 1: Observability Layer**
- Purpose: Monitoring, logging, and debugging
- Components: KnezEventsPanel, LogsPanel, DebugPanel, SessionInspectorModal, AnalyticsService, DeterminismTestSuite, ErrorClassifier, EventBasedUIProtocol, ExecutionGraphTracker
- Status: Mostly working, some components in development

**Layer 2: Governance & Control Layer**
- Purpose: Policy enforcement and approval workflows
- Components: GovernancePanel, ApprovalPanel, GovernanceService, AuditModal
- Status: Partially implemented

**Layer 3: Cognitive & Intelligence Layer**
- Purpose: Context management and drift detection
- Components: CognitivePanel, DriftVisualizer, ContextCompressionEngine, DOMAwarenessInjector
- Status: Partially implemented

**Layer 4: Infrastructure & System Layer**
- Purpose: System orchestration and performance monitoring
- Components: InfrastructurePanel, SystemPanel, PerformancePanel, useSystemOrchestrator, KnezClient, DiagnosticsService, TestPanel
- Status: Working

**Layer 5: MCP Integration Layer**
- Purpose: External tool connections via Model Context Protocol
- Components: McpOrchestrator, McpBuiltinClient, McpHttpClient, McpStdioClient, McpRustClient, McpRegistryView, McpInspectorService, McpTraffic, McpBoot, TaqwinMcpService
- Status: Working with some edge cases

**Layer 6: Tool Execution Layer**
- Purpose: Tool catalog and execution management
- Components: ToolExecutionService, ToolExposureService, ToolResultValidator, ToolApprovalModal, AvailableToolsModal, TaqwinToolsModal
- Status: Working

**Layer 7: Agent Runtime Layer**
- Purpose: Central brain for autonomous agent execution
- Components: AgentOrchestrator, AgentLoopService, AgentContext, LoopController, RetryStrategyEngine, ExecutionSandbox, ToolResultNormalizer, SecurityLayer, AgentTracer, AgentPane
- Status: Working

**Layer 8: Chat & Communication Layer**
- Purpose: User interface for AI interaction
- Components: ChatService, ChatPane, MessageItem, ChatInput, ChatTerminalPane, ChatUtils, useChatState
- Status: Working

**Layer 9: Memory & Knowledge Layer**
- Purpose: Event-sourced memory and knowledge management
- Components: MemoryEventSourcingService, MemoryVectorSearchService, MemoryKnowledgeGraphService, MemoryCompressionService, MemoryMultiLevelCacheService, MemoryBackupService, MemoryLoaderService, MemoryModal, LineagePanel
- Status: Partially implemented

**Layer 10: Data Processing Layer**
- Purpose: Data extraction, persistence, and session management
- Components: ExtractionPanel, ContentExtractionHeuristics, PresenceEngine, PersistenceService, SessionDatabase, SessionController
- Status: Partially implemented

### Key Patterns

1. **Event Sourcing**: Memory system uses append-only event log for state reconstruction
2. **Multi-Level Caching**: L1/L2/L3 caching for performance optimization
3. **Agent Loop**: Centralized loop control with retry strategies and security layers
4. **MCP Protocol**: Standardized tool integration through Model Context Protocol
5. **Observability First**: Comprehensive debugging and monitoring at every layer

### Integration Points

- Agent Runtime depends on Tool Execution and MCP Integration
- Chat & Communication depends on Agent Runtime and Memory
- Observability spans all layers for cross-cutting concerns
- Governance & Control provides policy enforcement across layers
- Infrastructure & System provides base services for all layers
