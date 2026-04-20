# KNEZ Architecture - Key Concepts

## Core Architectural Concepts

### Event Sourcing
**Definition:** A pattern where state changes are stored as a sequence of immutable events rather than direct state mutations.

**KNEZ Implementation:**
- `MemoryEventSourcingService` stores all memory operations as events (MEMORY_CREATED, MEMORY_UPDATED, MEMORY_TAGGED, etc.)
- Events are append-only to the event log
- State is reconstructed by replaying events
- Enables temporal queries and audit trails

**Benefits:**
- Complete audit trail
- Ability to replay state at any point in time
- Event-driven architecture
- Scalable event processing

**Related Components:** MemoryEventSourcingService, SessionDatabase, MemoryBackupService

---

### Multi-Level Caching
**Definition:** A caching strategy using multiple cache layers with different characteristics to optimize performance.

**KNEZ Implementation:**
- L1 Cache: In-memory, fastest access, smallest capacity
- L2 Cache: IndexedDB, medium speed, medium capacity
- L3 Cache: SQLite, slower access, largest capacity
- Cache hierarchy: Check L1 → L2 → L3 → source

**Benefits:**
- Reduced database load
- Faster access to frequently used data
- Automatic cache invalidation
- Configurable cache policies

**Related Components:** MemoryMultiLevelCacheService, SessionDatabase, PersistenceService

---

### MCP (Model Context Protocol)
**Definition:** A standardized protocol for connecting AI models to external tools and data sources.

**KNEZ Implementation:**
- Multiple client types: HTTP, Stdio, Rust, Builtin
- Tool catalog management via `ToolExposureService`
- Server registry and health monitoring
- Traffic inspection via `McpInspectorService`

**Key Concepts:**
- Tool namespacing
- Server capabilities negotiation
- Tool execution with timeout handling
- Error classification and retry strategies

**Benefits:**
- Standardized tool integration
- Pluggable tool ecosystem
- Runtime tool discovery
- Cross-language compatibility

**Related Components:** McpOrchestrator, McpBuiltinClient, McpHttpClient, McpStdioClient, McpRustClient, ToolExecutionService

---

### Agent Loop Pattern
**Definition:** A control loop pattern where an agent iteratively decides actions, executes tools, and updates context until a goal is achieved.

**KNEZ Implementation:**
- `AgentOrchestrator` manages the main loop
- `LoopController` makes stop/continue decisions
- `RetryStrategyEngine` handles failures with intelligent retries
- `SecurityLayer` validates tool calls before execution
- Maximum steps and timeout enforcement

**Loop Stages:**
1. Initialize context
2. Detect tool intent (bypass model if possible)
3. Call model for decision
4. Parse tool call from model output
5. Security validation
6. Execute tool with retry logic
7. Normalize result
8. Update context
9. Check stop conditions
10. Repeat or generate final answer

**Benefits:**
- Autonomous task execution
- Resilient to failures
- Security-first approach
- Configurable behavior

**Related Components:** AgentOrchestrator, AgentLoopService, LoopController, RetryStrategyEngine, ExecutionSandbox

---

### Context Compression
**Definition:** Techniques to reduce token usage while preserving relevant information for AI models.

**KNEZ Implementation:**
- `ContextCompressionEngine` applies compression strategies
- Token counting and optimization
- Relevance scoring for content
- DOM awareness for web context

**Strategies:**
- Remove redundant information
- Summarize long content
- Prioritize recent/relevant data
- Use structured formats

**Benefits:**
- Reduced API costs
- Faster model responses
- Better context window utilization
- Improved model performance

**Related Components:** ContextCompressionEngine, DOMAwarenessInjector, ChatService

---

### Observability Pattern
**Definition:** Cross-cutting concern of monitoring, logging, and debugging across all system layers.

**KNEZ Implementation:**
- Event-based UI updates via `EventBasedUIProtocol`
- Tool execution tracing via `AgentTracer`
- Real-time metrics via `AnalyticsService`
- Debug panel for tool call history
- Error classification via `ErrorClassifier`

**Observability Dimensions:**
- Performance: Latency, throughput, resource usage
- Reliability: Error rates, retry counts, success rates
- Correctness: Output validation, drift detection
- Security: Access logs, policy violations

**Benefits:**
- Rapid debugging
- Performance optimization
- System health monitoring
- Compliance reporting

**Related Components:** DebugPanel, KnezEventsPanel, LogsPanel, AnalyticsService, AgentTracer, ErrorClassifier

---

### Governance Pattern
**Definition:** Policy enforcement and approval workflows to control system behavior.

**KNEZ Implementation:**
- `GovernanceService` enforces policies
- `ApprovalPanel` manages approval requests
- `AuditModal` provides audit trails
- Phase-based restrictions (READ_ONLY vs READ_WRITE)

**Governance Dimensions:**
- Phase enforcement (preventing unauthorized actions)
- Tool approval (manual approval for sensitive tools)
- Audit logging (tracking all governance events)
- Policy configuration (flexible rule definition)

**Benefits:**
- Controlled autonomy
- Compliance enforcement
- Risk mitigation
- Auditability

**Related Components:** GovernancePanel, ApprovalPanel, GovernanceService, AuditModal

---

### Drift Detection
**Definition:** Monitoring system behavior over time to detect deviations from expected patterns.

**KNEZ Implementation:**
- `DriftVisualizer` visualizes drift metrics
- Three drift dimensions: scope, rule, focus
- DriftMetric events from backend
- Challenge system for drift mitigation

**Drift Dimensions:**
- Scope Drift: Unplanned expansion of task scope
- Rule Drift: Deviation from established rules
- Focus Drift: Loss of focus on primary objective

**Benefits:**
- Early warning system
- Behavioral consistency
- Quality assurance
- Autonomous correction triggers

**Related Components:** DriftVisualizer, CognitivePanel, ChallengeEvent

---

### Intent Detection
**Definition:** Bypassing the model for clear, deterministic actions by detecting user intent directly from natural language.

**KNEZ Implementation:**
- Pattern matching in `AgentOrchestrator.detectToolIntent()`
- Pre-model detection (step 0) for efficiency
- Post-model fallback for refusals
- Specific patterns for navigation, clicking, typing, screenshots

**Patterns Detected:**
- Navigation: "navigate to", "go to", "open" + URL
- Clicking: "click", "press", "tap" + element
- Typing: "type", "enter", "input" + text + field
- Screenshots: "take screenshot", "capture screen"
- TAQWIN tools: "server status", "web search"

**Benefits:**
- Faster execution (no model call needed)
- Reduced API costs
- More reliable for common actions
- Fallback for model refusals

**Related Components:** AgentOrchestrator, ToolExposureService

---

### Retry Strategy
**Definition:** Intelligent retry logic for handling tool execution failures.

**KNEZ Implementation:**
- `RetryStrategyEngine` determines retry strategy
- Failure classification (selector_not_found, navigation_failed, timeout, invalid_args)
- Configurable retry delays and argument refinement
- Maximum retry limits per attempt

**Strategy Components:**
- Failure type classification
- Retry decision (should retry or stop)
- Delay calculation (exponential backoff)
- Argument refinement (fix common issues)

**Benefits:**
- Resilient execution
- Automatic error recovery
- Reduced user intervention
- Better success rates

**Related Components:** RetryStrategyEngine, AgentOrchestrator, FailureClassifier

---

### Security Layer
**Definition:** Validation and enforcement of security policies before tool execution.

**KNEZ Implementation:**
- `SecurityLayer` validates tool calls
- Tool call validation against security policies
- Blocking of dangerous operations
- Security event logging

**Security Checks:**
- Tool permission validation
- Argument sanitization
- Resource limit enforcement
- Dangerous operation detection

**Benefits:**
- Prevents unauthorized actions
- Protects system resources
- Enables safe autonomy
- Audit trail for security events

**Related Components:** SecurityLayer, AgentOrchestrator, GovernanceService
