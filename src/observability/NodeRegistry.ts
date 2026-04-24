/**
 * Node Registry
 * 
 * Centralized node ID constants for KNEZ Observatory System
 * Ensures consistency across ExecutionFlowRunner, GraphStateEngine, and UI
 */

export const NodeIds = {
  // User Interface Layer
  UI: 'UI',
  
  // Service Layer
  ChatService: 'ChatService',
  
  // Routing Layer
  Router: 'Router',
  
  // Model Layer
  Model: 'Model',
  
  // Tool Layer
  Tool: 'Tool',
  
  // Memory Layer
  Memory: 'Memory',
  
  // Response Layer
  Response: 'Response',
  
  // System Nodes
  System: 'system',
  EventBus: 'event_bus',
  ExecutionFlowRunner: 'ExecutionFlowRunner'
} as const;

export type NodeId = typeof NodeIds[keyof typeof NodeIds];

export const NodePaths = {
  chat_basic: [NodeIds.UI, NodeIds.ChatService, NodeIds.Router, NodeIds.Model, NodeIds.Response],
  chat_tool: [NodeIds.UI, NodeIds.ChatService, NodeIds.Router, NodeIds.Model, NodeIds.Tool, NodeIds.Response],
  chat_memory: [NodeIds.UI, NodeIds.ChatService, NodeIds.Router, NodeIds.Model, NodeIds.Memory, NodeIds.Response],
  full_agent: [NodeIds.UI, NodeIds.ChatService, NodeIds.Router, NodeIds.Model, NodeIds.Tool, NodeIds.Memory, NodeIds.Response]
} as const;
