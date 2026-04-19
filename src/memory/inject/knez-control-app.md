# What is knez-control-app?

Domain: knez-control-app
Tags: overview, introduction, architecture
Type: learning

knez-control-app is a Tauri-based desktop application that serves as an AI control interface for the KNEZ system. It provides a user-friendly interface for interacting with AI models, managing MCP (Model Context Protocol) servers, and maintaining a memory system for learning and knowledge retention.

The application is built with React and TypeScript for the frontend, with Rust backend capabilities provided by Tauri. It features a modern UI with chat capabilities, memory visualization, and comprehensive tool execution debugging.

---

# Technology Stack

Domain: knez-control-app
Tags: technology, stack, dependencies
Type: learning

**Frontend:**
- React 19.1.0 - UI framework
- TypeScript 5.8.3 - Type-safe JavaScript
- Tailwind CSS 4.1.18 - Styling framework
- Vite 7.0.4 - Build tool and dev server
- Lucide React 0.563.0 - Icon library

**Backend:**
- Rust (via Tauri 2.10.0) - Native desktop capabilities
- Tauri Plugins:
  - @tauri-apps/plugin-fs - File system access
  - @tauri-apps/plugin-opener - URL opening
  - @tauri-apps/plugin-shell - Shell command execution

**Database:**
- SQLite (via better-sqlite3) - Event-sourced memory storage
- Dexie 4.3.0 - IndexedDB wrapper for browser storage

**MCP Integration:**
- Model Context Protocol client implementations
- Support for stdio, HTTP, and Rust MCP servers
- MCP inspector for traffic analysis

**Testing:**
- Vitest 4.0.18 - Unit testing
- Playwright 1.58.1 - E2E testing
- Puppeteer - Browser automation

---

# Key Features

Domain: knez-control-app
Tags: features, capabilities
Type: learning

**Chat Interface:**
- Real-time AI chat with streaming responses
- Tool execution with live status updates
- Debug panel for tool call history
- Session management

**Memory System:**
- Event-sourced memory storage
- Vector-based semantic search
- Knowledge graph visualization
- Multi-level caching (L1/L2/L3)
- Memory compression and deduplication
- Time-series metrics tracking

**MCP Management:**
- MCP server configuration
- Server health monitoring
- Traffic inspection and debugging
- Tool execution tracking

**Memory Visualization:**
- Graph visualization with force-directed layout
- Learning and mistakes timeline
- Pattern analysis dashboard
- Domain-based filtering

**Development Tools:**
- Hot module replacement (HMR)
- TypeScript compilation
- Tauri dev mode with hot reload
- E2E testing framework

---

# Memory System Architecture

Domain: knez-control-app
Tags: architecture, memory, event-sourcing
Type: pattern

The memory system in knez-control-app uses an event-sourcing architecture:

**Event Types:**
- MEMORY_CREATED - Initial memory creation
- MEMORY_UPDATED - Memory modifications
- MEMORY_TAGGED - Tag additions
- MEMORY_UNTAGGED - Tag removals
- MEMORY_RELATED - Relationship creation
- MEMORY_UNRELATED - Relationship removal

**Storage Layers:**
1. Event Store (SQLite) - Append-only event log
2. Materialized Views - Fast query access
3. Vector Database - Semantic search
4. Knowledge Graph - Relationship tracking
5. Multi-Level Cache - L1/L2/L3 caching
6. Content-Addressable Storage - Deduplication
7. Compression Layer - GZIP/deflate compression

**Services:**
- MemoryEventSourcingService - Core event sourcing
- MemoryVectorSearchService - Semantic search
- MemoryKnowledgeGraphService - Graph operations
- MemoryCompressionService - Compression
- MemoryMultiLevelCacheService - Caching
- MemoryBackupService - Backup and recovery

---

# Package Structure

Domain: knez-control-app
Tags: packages, structure, organization
Type: learning

**Source Structure:**
```
src/
├── features/
│   ├── chat/ - Chat interface and components
│   ├── memory/ - Memory management UI
│   └── mcp/ - MCP server management
├── services/ - Business logic services
├── domain/ - Type definitions and contracts
├── hooks/ - React hooks
└── mcp/ - MCP client implementations
```

**Key Services:**
- ChatService.ts - Chat and tool execution
- MemoryEventSourcingService.ts - Memory event sourcing
- MemoryVectorSearchService.ts - Semantic search
- MemoryKnowledgeGraphService.ts - Graph operations
- MemoryLoaderService.ts - File-based memory injection

**MCP Components:**
- McpOrchestrator.ts - MCP server coordination
- McpBuiltinClient.ts - Built-in MCP client
- McpHttpClient.ts - HTTP-based MCP client
- McpStdioClient.ts - Stdio-based MCP client
