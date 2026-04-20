/**
 * KNEZ Architecture Data Structure
 * Defines the 10 layers of KNEZ architecture with their components and status
 */

export type NodeStatus = 'working' | 'partial' | 'not_working' | 'planned';

export interface LayerNode {
  id: string;
  name: string;
  status: NodeStatus;
  description: string;
  fileRef: string;
  dependencies: string[];
  metrics?: {
    lastActive?: string;
    errorCount?: number;
    performance?: number;
  };
}

export interface Layer {
  id: string;
  name: string;
  description: string;
  order: number;
  nodes: LayerNode[];
}

export interface Connection {
  from: string; // node ID
  to: string; // node ID
  type: 'dependency' | 'data_flow' | 'control_flow';
}

export interface KNEZArchitecture {
  layers: Layer[];
  connections: Connection[];
}

/**
 * KNEZ Architecture Definition
 * Based on actual codebase analysis
 */
export const knezArchitecture: KNEZArchitecture = {
  layers: [
    {
      id: 'layer-1-observability',
      name: 'Observability Layer',
      description: 'Monitoring, logging, and debugging capabilities',
      order: 1,
      nodes: [
        {
          id: 'knez-events-panel',
          name: 'KnezEventsPanel',
          status: 'working',
          description: 'Real-time event stream visualization',
          fileRef: 'src/features/events/KnezEventsPanel.tsx',
          dependencies: ['knez-client']
        },
        {
          id: 'logs-panel',
          name: 'LogsPanel',
          status: 'working',
          description: 'System log viewer with filtering',
          fileRef: 'src/features/logs/LogsPanel.tsx',
          dependencies: ['log-service']
        },
        {
          id: 'debug-panel',
          name: 'DebugPanel',
          status: 'working',
          description: 'Tool execution debugging and history',
          fileRef: 'src/features/chat/DebugPanel.tsx',
          dependencies: ['chat-service', 'tool-execution-service']
        },
        {
          id: 'session-inspector-modal',
          name: 'SessionInspectorModal',
          status: 'working',
          description: 'Detailed session inspection',
          fileRef: 'src/features/chat/SessionInspectorModal.tsx',
          dependencies: ['session-database', 'chat-service']
        },
        {
          id: 'analytics-service',
          name: 'AnalyticsService',
          status: 'partial',
          description: 'Analytics and metrics collection',
          fileRef: 'src/services/AnalyticsService.ts',
          dependencies: ['knez-client']
        },
        {
          id: 'determinism-test-suite',
          name: 'DeterminismTestSuite',
          status: 'planned',
          description: 'Test reproducibility of tool execution',
          fileRef: 'src/services/DeterminismTestSuite.ts',
          dependencies: ['tool-execution-service']
        },
        {
          id: 'error-classifier',
          name: 'ErrorClassifier',
          status: 'working',
          description: 'Classify and categorize errors',
          fileRef: 'src/services/ErrorClassifier.ts',
          dependencies: ['log-service']
        },
        {
          id: 'event-based-ui-protocol',
          name: 'EventBasedUIProtocol',
          status: 'working',
          description: 'Event-driven UI updates',
          fileRef: 'src/services/EventBasedUIProtocol.ts',
          dependencies: ['event-emitter']
        },
        {
          id: 'execution-graph-tracker',
          name: 'ExecutionGraphTracker',
          status: 'planned',
          description: 'Track execution flow as a graph',
          fileRef: 'src/services/ExecutionGraphTracker.ts',
          dependencies: ['agent-orchestrator']
        }
      ]
    },
    {
      id: 'layer-2-governance',
      name: 'Governance & Control Layer',
      description: 'Policy enforcement and approval workflows',
      order: 2,
      nodes: [
        {
          id: 'governance-panel',
          name: 'GovernancePanel',
          status: 'partial',
          description: 'Governance UI for policy management',
          fileRef: 'src/features/governance/GovernancePanel.tsx',
          dependencies: ['governance-service']
        },
        {
          id: 'approval-panel',
          name: 'ApprovalPanel',
          status: 'working',
          description: 'Approval request management',
          fileRef: 'src/features/governance/ApprovalPanel.tsx',
          dependencies: ['governance-service']
        },
        {
          id: 'governance-service',
          name: 'GovernanceService',
          status: 'partial',
          description: 'Governance logic and policy enforcement',
          fileRef: 'src/services/GovernanceService.ts',
          dependencies: ['session-database']
        },
        {
          id: 'audit-modal',
          name: 'AuditModal',
          status: 'working',
          description: 'Audit trail viewer',
          fileRef: 'src/features/chat/modals/AuditModal.tsx',
          dependencies: ['governance-service']
        }
      ]
    },
    {
      id: 'layer-3-cognitive',
      name: 'Cognitive & Intelligence Layer',
      description: 'Context management and drift detection',
      order: 3,
      nodes: [
        {
          id: 'cognitive-panel',
          name: 'CognitivePanel',
          status: 'working',
          description: 'Cognitive state visualization',
          fileRef: 'src/features/cognitive/CognitivePanel.tsx',
          dependencies: ['cognitive-state-backend']
        },
        {
          id: 'drift-visualizer',
          name: 'DriftVisualizer',
          status: 'working',
          description: 'Drift detection and visualization',
          fileRef: 'src/features/drift/DriftVisualizer.tsx',
          dependencies: ['drift-metric-events']
        },
        {
          id: 'context-compression-engine',
          name: 'ContextCompressionEngine',
          status: 'working',
          description: 'Compress context for efficiency',
          fileRef: 'src/services/ContextCompressionEngine.ts',
          dependencies: ['chat-service']
        },
        {
          id: 'dom-awareness-injector',
          name: 'DOMAwarenessInjector',
          status: 'planned',
          description: 'Inject DOM awareness into context',
          fileRef: 'src/services/DOMAwarenessInjector.ts',
          dependencies: ['browser-tools']
        }
      ]
    },
    {
      id: 'layer-4-infrastructure',
      name: 'Infrastructure & System Layer',
      description: 'System orchestration and performance monitoring',
      order: 4,
      nodes: [
        {
          id: 'infrastructure-panel',
          name: 'InfrastructurePanel',
          status: 'working',
          description: 'Main infrastructure dashboard (Observatory)',
          fileRef: 'src/features/infrastructure/InfrastructurePanel.tsx',
          dependencies: ['system-panel', 'performance-panel', 'knez-client']
        },
        {
          id: 'system-panel',
          name: 'SystemPanel',
          status: 'working',
          description: 'System control and orchestration',
          fileRef: 'src/features/system/SystemPanel.tsx',
          dependencies: ['system-orchestrator']
        },
        {
          id: 'performance-panel',
          name: 'PerformancePanel',
          status: 'partial',
          description: 'Real-time performance metrics',
          fileRef: 'src/features/performance/PerformancePanel.tsx',
          dependencies: ['performance-metrics-stream']
        },
        {
          id: 'system-orchestrator',
          name: 'useSystemOrchestrator',
          status: 'working',
          description: 'System orchestration hook',
          fileRef: 'src/features/system/useSystemOrchestrator.ts',
          dependencies: ['system-orchestration-backend']
        },
        {
          id: 'knez-client',
          name: 'KnezClient',
          status: 'working',
          description: 'KNEZ backend API client',
          fileRef: 'src/services/KnezClient.ts',
          dependencies: ['knez-backend-http-api']
        },
        {
          id: 'diagnostics-service',
          name: 'DiagnosticsService',
          status: 'working',
          description: 'System diagnostics',
          fileRef: 'src/services/DiagnosticsService.ts',
          dependencies: ['knez-backend']
        },
        {
          id: 'test-panel',
          name: 'TestPanel',
          status: 'working',
          description: 'Diagnostic testing UI',
          fileRef: 'src/features/diagnostics/TestPanel.tsx',
          dependencies: ['diagnostics-service']
        }
      ]
    },
    {
      id: 'layer-5-mcp',
      name: 'MCP Integration Layer',
      description: 'External tool connections via Model Context Protocol',
      order: 5,
      nodes: [
        {
          id: 'mcp-orchestrator',
          name: 'McpOrchestrator',
          status: 'working',
          description: 'Central MCP coordination',
          fileRef: 'src/mcp/McpOrchestrator.ts',
          dependencies: ['mcp-clients', 'mcp-host-config']
        },
        {
          id: 'mcp-builtin-client',
          name: 'McpBuiltinClient',
          status: 'working',
          description: 'Built-in MCP client for local tools',
          fileRef: 'src/mcp/client/McpBuiltinClient.ts',
          dependencies: []
        },
        {
          id: 'mcp-http-client',
          name: 'McpHttpClient',
          status: 'working',
          description: 'HTTP-based MCP client',
          fileRef: 'src/mcp/client/McpHttpClient.ts',
          dependencies: ['http-transport']
        },
        {
          id: 'mcp-stdio-client',
          name: 'McpStdioClient',
          status: 'working',
          description: 'Stdio-based MCP client',
          fileRef: 'src/mcp/client/McpStdioClient.ts',
          dependencies: ['process-spawning']
        },
        {
          id: 'mcp-rust-client',
          name: 'McpRustClient',
          status: 'working',
          description: 'Rust-based MCP client',
          fileRef: 'src/mcp/client/McpRustClient.ts',
          dependencies: ['tauri-rust-bridge']
        },
        {
          id: 'mcp-registry-view',
          name: 'McpRegistryView',
          status: 'working',
          description: 'MCP registry visualization',
          fileRef: 'src/features/mcp/McpRegistryView.tsx',
          dependencies: ['mcp-orchestrator']
        },
        {
          id: 'mcp-inspector-service',
          name: 'McpInspectorService',
          status: 'working',
          description: 'MCP traffic inspection and testing',
          fileRef: 'src/mcp/inspector/McpInspectorService.ts',
          dependencies: ['mcp-clients']
        },
        {
          id: 'mcp-traffic',
          name: 'McpTraffic',
          status: 'working',
          description: 'Traffic data structures',
          fileRef: 'src/mcp/inspector/McpTraffic.ts',
          dependencies: []
        },
        {
          id: 'mcp-boot',
          name: 'McpBoot',
          status: 'working',
          description: 'MCP boot sequence',
          fileRef: 'src/mcp/mcpBoot.ts',
          dependencies: ['mcp-orchestrator']
        },
        {
          id: 'taqwin-mcp-service',
          name: 'TaqwinMcpService',
          status: 'working',
          description: 'TAQWIN-specific MCP service',
          fileRef: 'src/mcp/taqwin/TaqwinMcpService.ts',
          dependencies: ['taqwin-backend']
        }
      ]
    },
    {
      id: 'layer-6-tool-execution',
      name: 'Tool Execution Layer',
      description: 'Tool catalog and execution management',
      order: 6,
      nodes: [
        {
          id: 'tool-execution-service',
          name: 'ToolExecutionService',
          status: 'working',
          description: 'Tool execution service',
          fileRef: 'src/services/ToolExecutionService.ts',
          dependencies: ['mcp-orchestrator']
        },
        {
          id: 'tool-exposure-service',
          name: 'ToolExposureService',
          status: 'working',
          description: 'Tool catalog and exposure',
          fileRef: 'src/services/ToolExposureService.ts',
          dependencies: ['mcp-registry']
        },
        {
          id: 'tool-result-validator',
          name: 'ToolResultValidator',
          status: 'working',
          description: 'Tool result validation',
          fileRef: 'src/services/ToolResultValidator.ts',
          dependencies: ['tool-schemas']
        },
        {
          id: 'tool-approval-modal',
          name: 'ToolApprovalModal',
          status: 'working',
          description: 'Tool approval UI',
          fileRef: 'src/features/chat/ToolApprovalModal.tsx',
          dependencies: ['tool-execution-service']
        },
        {
          id: 'available-tools-modal',
          name: 'AvailableToolsModal',
          status: 'working',
          description: 'Available tools viewer',
          fileRef: 'src/features/chat/modals/AvailableToolsModal.tsx',
          dependencies: ['tool-exposure-service']
        },
        {
          id: 'taqwin-tools-modal',
          name: 'TaqwinToolsModal',
          status: 'working',
          description: 'TAQWIN tools viewer',
          fileRef: 'src/features/chat/TaqwinToolsModal.tsx',
          dependencies: ['taqwin-mcp-service']
        }
      ]
    },
    {
      id: 'layer-7-agent',
      name: 'Agent Runtime Layer',
      description: 'Central brain for autonomous agent execution',
      order: 7,
      nodes: [
        {
          id: 'agent-orchestrator',
          name: 'AgentOrchestrator',
          status: 'working',
          description: 'Central agent orchestration',
          fileRef: 'src/services/agent/AgentOrchestrator.ts',
          dependencies: ['agent-loop-service', 'tool-execution-service', 'knez-client']
        },
        {
          id: 'agent-loop-service',
          name: 'AgentLoopService',
          status: 'working',
          description: 'Agent loop control',
          fileRef: 'src/services/agent/AgentLoopService.ts',
          dependencies: ['agent-context']
        },
        {
          id: 'agent-context',
          name: 'AgentContext',
          status: 'working',
          description: 'Agent context management',
          fileRef: 'src/services/agent/AgentContext.ts',
          dependencies: []
        },
        {
          id: 'loop-controller',
          name: 'LoopController',
          status: 'working',
          description: 'Loop decision logic',
          fileRef: 'src/services/agent/LoopController.ts',
          dependencies: ['agent-context']
        },
        {
          id: 'retry-strategy-engine',
          name: 'RetryStrategyEngine',
          status: 'working',
          description: 'Retry strategy determination',
          fileRef: 'src/services/agent/RetryStrategyEngine.ts',
          dependencies: ['failure-classifier']
        },
        {
          id: 'execution-sandbox',
          name: 'ExecutionSandbox',
          status: 'working',
          description: 'Tool execution sandbox',
          fileRef: 'src/services/agent/ExecutionSandbox.ts',
          dependencies: []
        },
        {
          id: 'tool-result-normalizer',
          name: 'ToolResultNormalizer',
          status: 'working',
          description: 'Tool result normalization',
          fileRef: 'src/services/agent/ToolResultNormalizer.ts',
          dependencies: ['tool-schemas']
        },
        {
          id: 'security-layer',
          name: 'SecurityLayer',
          status: 'working',
          description: 'Security validation',
          fileRef: 'src/services/agent/SecurityLayer.ts',
          dependencies: ['security-policies']
        },
        {
          id: 'agent-tracer',
          name: 'AgentTracer',
          status: 'working',
          description: 'Agent execution tracing',
          fileRef: 'src/services/agent/AgentTracer.ts',
          dependencies: []
        },
        {
          id: 'agent-pane',
          name: 'AgentPane',
          status: 'working',
          description: 'Agent UI',
          fileRef: 'src/features/agent/AgentPane.tsx',
          dependencies: ['agent-orchestrator']
        }
      ]
    },
    {
      id: 'layer-8-chat',
      name: 'Chat & Communication Layer',
      description: 'User interface for AI interaction',
      order: 8,
      nodes: [
        {
          id: 'chat-service',
          name: 'ChatService',
          status: 'working',
          description: 'Core chat service',
          fileRef: 'src/services/ChatService.ts',
          dependencies: ['knez-client', 'tool-execution-service', 'session-database']
        },
        {
          id: 'chat-pane',
          name: 'ChatPane',
          status: 'working',
          description: 'Main chat UI',
          fileRef: 'src/features/chat/ChatPane.tsx',
          dependencies: ['chat-service', 'message-item']
        },
        {
          id: 'message-item',
          name: 'MessageItem',
          status: 'working',
          description: 'Message rendering',
          fileRef: 'src/features/chat/MessageItem.tsx',
          dependencies: ['data-contracts']
        },
        {
          id: 'chat-input',
          name: 'ChatInput',
          status: 'working',
          description: 'Chat input component',
          fileRef: 'src/features/chat/components/ChatInput.tsx',
          dependencies: ['chat-service']
        },
        {
          id: 'chat-terminal-pane',
          name: 'ChatTerminalPane',
          status: 'working',
          description: 'Terminal-style chat view',
          fileRef: 'src/features/chat/ChatTerminalPane.tsx',
          dependencies: ['chat-service']
        },
        {
          id: 'chat-utils',
          name: 'ChatUtils',
          status: 'working',
          description: 'Chat utility functions',
          fileRef: 'src/features/chat/ChatUtils.ts',
          dependencies: []
        },
        {
          id: 'use-chat-state',
          name: 'useChatState',
          status: 'working',
          description: 'Chat state hook',
          fileRef: 'src/features/chat/hooks/useChatState.ts',
          dependencies: ['chat-service']
        }
      ]
    },
    {
      id: 'layer-9-memory',
      name: 'Memory & Knowledge Layer',
      description: 'Event-sourced memory and knowledge management',
      order: 9,
      nodes: [
        {
          id: 'memory-event-sourcing-service',
          name: 'MemoryEventSourcingService',
          status: 'partial',
          description: 'Event-sourced memory',
          fileRef: 'src/services/MemoryEventSourcingService.ts',
          dependencies: ['session-database']
        },
        {
          id: 'memory-vector-search-service',
          name: 'MemoryVectorSearchService',
          status: 'planned',
          description: 'Vector-based semantic search',
          fileRef: 'src/services/MemoryVectorSearchService.ts',
          dependencies: ['vector-database']
        },
        {
          id: 'memory-knowledge-graph-service',
          name: 'MemoryKnowledgeGraphService',
          status: 'planned',
          description: 'Knowledge graph operations',
          fileRef: 'src/services/MemoryKnowledgeGraphService.ts',
          dependencies: ['graph-database']
        },
        {
          id: 'memory-compression-service',
          name: 'MemoryCompressionService',
          status: 'working',
          description: 'Memory compression',
          fileRef: 'src/services/MemoryCompressionService.ts',
          dependencies: []
        },
        {
          id: 'memory-multi-level-cache-service',
          name: 'MemoryMultiLevelCacheService',
          status: 'working',
          description: 'Multi-level caching',
          fileRef: 'src/services/MemoryMultiLevelCacheService.ts',
          dependencies: []
        },
        {
          id: 'memory-backup-service',
          name: 'MemoryBackupService',
          status: 'working',
          description: 'Memory backup',
          fileRef: 'src/services/MemoryBackupService.ts',
          dependencies: ['file-system']
        },
        {
          id: 'memory-loader-service',
          name: 'MemoryLoaderService',
          status: 'working',
          description: 'File-based memory injection',
          fileRef: 'src/services/MemoryLoaderService.ts',
          dependencies: ['file-system']
        },
        {
          id: 'memory-modal',
          name: 'MemoryModal',
          status: 'partial',
          description: 'Memory visualization UI',
          fileRef: 'src/features/chat/MemoryModal.tsx',
          dependencies: ['memory-services']
        },
        {
          id: 'lineage-panel',
          name: 'LineagePanel',
          status: 'working',
          description: 'Session lineage visualization',
          fileRef: 'src/features/chat/LineagePanel.tsx',
          dependencies: ['session-database']
        }
      ]
    },
    {
      id: 'layer-10-data',
      name: 'Data Processing Layer',
      description: 'Data extraction, persistence, and session management',
      order: 10,
      nodes: [
        {
          id: 'extraction-panel',
          name: 'ExtractionPanel',
          status: 'working',
          description: 'Data extraction UI',
          fileRef: 'src/features/extraction/ExtractionPanel.tsx',
          dependencies: ['content-extraction-heuristics']
        },
        {
          id: 'content-extraction-heuristics',
          name: 'ContentExtractionHeuristics',
          status: 'working',
          description: 'Content extraction logic',
          fileRef: 'src/services/ContentExtractionHeuristics.ts',
          dependencies: []
        },
        {
          id: 'presence-engine',
          name: 'PresenceEngine',
          status: 'working',
          description: 'Presence state tracking',
          fileRef: 'src/presence/PresenceEngine.ts',
          dependencies: []
        },
        {
          id: 'persistence-service',
          name: 'PersistenceService',
          status: 'working',
          description: 'Persistence abstraction',
          fileRef: 'src/services/PersistenceService.ts',
          dependencies: ['session-database']
        },
        {
          id: 'session-database',
          name: 'SessionDatabase',
          status: 'working',
          description: 'Session storage',
          fileRef: 'src/services/SessionDatabase.ts',
          dependencies: ['sqlite', 'dexie']
        },
        {
          id: 'session-controller',
          name: 'SessionController',
          status: 'working',
          description: 'Session lifecycle management',
          fileRef: 'src/services/SessionController.ts',
          dependencies: ['session-database']
        }
      ]
    }
  ],
  connections: [
    // Agent Runtime dependencies
    { from: 'agent-orchestrator', to: 'tool-execution-service', type: 'dependency' },
    { from: 'agent-orchestrator', to: 'knez-client', type: 'dependency' },
    { from: 'agent-orchestrator', to: 'agent-loop-service', type: 'dependency' },
    
    // Chat dependencies
    { from: 'chat-service', to: 'knez-client', type: 'dependency' },
    { from: 'chat-service', to: 'tool-execution-service', type: 'dependency' },
    { from: 'chat-service', to: 'session-database', type: 'dependency' },
    
    // Tool Execution dependencies
    { from: 'tool-execution-service', to: 'mcp-orchestrator', type: 'dependency' },
    { from: 'tool-exposure-service', to: 'mcp-registry', type: 'dependency' },
    
    // MCP dependencies
    { from: 'mcp-orchestrator', to: 'mcp-builtin-client', type: 'dependency' },
    { from: 'mcp-orchestrator', to: 'mcp-http-client', type: 'dependency' },
    { from: 'mcp-orchestrator', to: 'mcp-stdio-client', type: 'dependency' },
    { from: 'mcp-orchestrator', to: 'mcp-rust-client', type: 'dependency' },
    
    // Memory dependencies
    { from: 'memory-event-sourcing-service', to: 'session-database', type: 'dependency' },
    { from: 'memory-loader-service', to: 'file-system', type: 'dependency' },
    
    // Infrastructure dependencies
    { from: 'infrastructure-panel', to: 'system-panel', type: 'dependency' },
    { from: 'infrastructure-panel', to: 'performance-panel', type: 'dependency' },
    { from: 'infrastructure-panel', to: 'knez-client', type: 'dependency' },
    { from: 'knez-client', to: 'knez-backend-http-api', type: 'dependency' },
    
    // Observability cross-cutting
    { from: 'debug-panel', to: 'chat-service', type: 'data_flow' },
    { from: 'debug-panel', to: 'tool-execution-service', type: 'data_flow' },
    { from: 'session-inspector-modal', to: 'session-database', type: 'dependency' },
    { from: 'session-inspector-modal', to: 'chat-service', type: 'dependency' },
    
    // Governance cross-cutting
    { from: 'governance-service', to: 'session-database', type: 'dependency' },
    { from: 'approval-panel', to: 'governance-service', type: 'dependency' },
    { from: 'audit-modal', to: 'governance-service', type: 'dependency' },
    
    // Data Processing dependencies
    { from: 'persistence-service', to: 'session-database', type: 'dependency' },
    { from: 'session-controller', to: 'session-database', type: 'dependency' },
    
    // Cognitive dependencies
    { from: 'context-compression-engine', to: 'chat-service', type: 'dependency' },
    { from: 'drift-visualizer', to: 'drift-metric-events', type: 'data_flow' }
  ]
};

/**
 * Get status color for UI rendering
 */
export function getStatusColor(status: NodeStatus): string {
  switch (status) {
    case 'working':
      return 'bg-emerald-500';
    case 'partial':
      return 'bg-yellow-500';
    case 'not_working':
      return 'bg-red-500';
    case 'planned':
      return 'bg-gray-500';
    default:
      return 'bg-gray-500';
  }
}

/**
 * Get status label for display
 */
export function getStatusLabel(status: NodeStatus): string {
  switch (status) {
    case 'working':
      return 'WORKING';
    case 'partial':
      return 'PARTIAL';
    case 'not_working':
      return 'NOT WORKING';
    case 'planned':
      return 'PLANNED';
    default:
      return 'UNKNOWN';
  }
}
