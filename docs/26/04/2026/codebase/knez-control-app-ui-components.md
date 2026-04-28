# knez-control-app UI Components Documentation

## Overview

The UI components in knez-control-app are built with React and TypeScript, using TailwindCSS for styling. This document covers the main UI components, their responsibilities, props, and usage patterns.

## Main Components

### App.tsx

**Location:** `src/App.tsx`

**Responsibilities:**
- Main application entry point
- View routing (chat, agent, memory, settings)
- Global state management
- System orchestration initialization
- Keyboard shortcut handling

**Key Features:**
- Manages `currentView` state for navigation
- Integrates ChatService, SessionController, useSystemOrchestrator
- Handles command palette (Ctrl+K)
- Loads static memory on mount
- Manages session ID and connection status

**Views:**
- `chat`: ChatPane for chat interface
- `agent`: AgentPane for agent management
- `memory`: MemoryPane for memory browsing
- `settings`: SettingsPane for configuration

## Chat Components

### ChatPane

**Location:** `src/features/chat/ChatPane.tsx`

**Responsibilities:**
- Primary chat interface
- Message rendering and display
- Input handling and message sending
- Tool execution visualization
- Session management operations
- Terminal integration
- Debug panel integration

**Props:**
```typescript
interface Props {
  sessionId: string | null;
  readOnly: boolean;
  systemStatus?: "idle" | "starting" | "running" | "failed" | "degraded";
}
```

**Key Features:**
- Message list with virtual scrolling
- Real-time phase progress indicator (AgentProgressBar)
- Tool execution status display
- Session export/import (JSON format)
- In-chat terminal with PowerShell integration
- Debug panel for tool execution history
- Voice input support
- Message editing and retry
- Session rename, fork, history

**State Management:**
- Syncs with ChatService for messages and phase
- Uses SessionController for session operations
- Subscribes to McpOrchestrator for MCP status
- Subscribes to ToolExposureService for tool catalog

**Terminal Integration:**
- PowerShell command execution via Tauri
- Directory picker for CWD selection
- Command history
- Output capture (stdout, stderr, exit code)

### AgentProgressBar

**Location:** `src/features/chat/ChatPane.tsx` (inline component)

**Responsibilities:**
- Displays current execution phase
- Shows tool execution status
- Auto-collapses when idle

**Phases Displayed:**
- `thinking`: Yellow, "Thinking..."
- `tool_running`: Green, "executing: {tool_name}"
- `streaming`: Purple, "generating response..."
- `failed`: Red, "failed"
- `sending`: "sending..."
- `error`: Red, "error"

**Features:**
- Collapsible with click-to-expand
- Auto-collapse 2s after phase completes
- Pulse animation for active phases

### MessageItem

**Location:** `src/features/chat/MessageItem.tsx`

**Responsibilities:**
- Renders individual chat messages
- Handles message-specific actions (edit, retry, stop)
- Displays message metadata

**Features:**
- User message rendering
- Assistant message rendering
- Tool execution message rendering
- Message actions (edit, retry, stop)
- Timestamp display

### AssistantMessageRenderer

**Location:** `src/features/chat/blocks/AssistantMessageRenderer.tsx`

**Responsibilities:**
- Renders assistant messages with block-based content
- Handles different content types (text, code, tool calls)

**Block Types:**
- Text blocks (markdown rendering)
- Code blocks (syntax highlighting)
- Tool call blocks (execution visualization)

### ToolCallBlock

**Location:** `src/features/chat/blocks/ToolCallBlock.tsx`

**Responsibilities:**
- Renders tool execution details
- Displays tool status with color-coded badges
- Shows execution time and MCP latency
- Expandable for detailed view

**Status Badges:**
- `pending`: Yellow
- `running`: Blue with pulse animation
- `calling`: Blue
- `succeeded`/`completed`: Green
- `failed`: Red

**Features:**
- Expand/collapse for details
- Execution time display
- MCP latency display
- Tool parameters display
- Tool result display

### DebugPanel

**Location:** `src/features/chat/DebugPanel.tsx`

**Responsibilities:**
- Displays tool execution history
- Session filtering
- Statistics calculation
- Individual tool call details

**Features:**
- Tool call history with timestamps
- Session filter dropdown
- Statistics (total calls, success rate, avg execution time)
- Individual tool call details
- Status badges
- Execution time tracking
- MCP latency tracking

**Statistics:**
- Total tool calls
- Successful calls
- Failed calls
- Success rate
- Average execution time
- Total execution time

## Modal Components

### SessionInspectorModal

**Location:** `src/features/chat/SessionInspectorModal.tsx`

**Responsibilities:**
- Displays session details
- Shows session metadata
- Lists session messages

**Features:**
- Session ID display
- Session name
- Created/updated timestamps
- Message list
- Close on ESC key

### HistoryModal

**Location:** `src/features/chat/modals/HistoryModal.tsx`

**Responsibilities:**
- Displays session history
- Allows session selection
- Session search/filter

**Features:**
- Session list with names and dates
- Search functionality
- Click to switch session
- Close on ESC key

### ForkModal

**Location:** `src/features/chat/modals/ForkModal.tsx`

**Responsibilities:**
- Confirms session fork operation
- Shows fork point message
- Input for new session name

**Features:**
- Fork point message preview
- New session name input
- Confirm/cancel buttons
- Close on ESC key

### RenameModal

**Location:** `src/features/chat/modals/RenameModal.tsx`

**Responsibilities:**
- Renames current session
- Input for new session name

**Features:**
- Current name display
- New name input
- Confirm/cancel buttons
- Close on ESC key

### AuditModal

**Location:** `src/features/chat/modals/AuditModal.tsx`

**Responsibilities:**
- Displays audit results
- Shows consistency checks

**Features:**
- Audit check list
- Status indicators (pass/fail)
- Details for each check
- Close on ESC key

### AvailableToolsModal

**Location:** `src/features/chat/modals/AvailableToolsModal.tsx`

**Responsibilities:**
- Displays available tools
- Shows tool descriptions
- Tool search/filter

**Features:**
- Tool list with names and descriptions
- Search functionality
- Tool provider display
- Close on ESC key

### MemoryModal

**Location:** `src/features/chat/MemoryModal.tsx`

**Responsibilities:**
- Displays memory entries
- Memory search/filter
- Memory detail view

**Features:**
- Memory list with summaries
- Search functionality
- Memory detail view
- Close on ESC key

### ChatMemorySyncModal

**Location:** `src/features/chat/ChatMemorySyncModal.tsx`

**Responsibilities:**
- Syncs chat with memory
- Shows sync status
- Handles sync conflicts

**Features:**
- Sync status display
- Conflict resolution
- Confirm/cancel buttons
- Close on ESC key

## Voice Input

### VoiceInput

**Location:** `src/features/voice/VoiceInput.tsx`

**Responsibilities:**
- Captures voice input
- Transcribes speech to text
- Appends to chat input

**Features:**
- Microphone button
- Recording indicator
- Transcript display
- Auto-append to input

## UI Primitives

### Toast

**Location:** `src/components/ui/Toast.tsx`

**Responsibilities:**
- Displays toast notifications
- Auto-dismiss after timeout
- Multiple toast support

**Types:**
- success: Green
- error: Red
- warning: Yellow
- info: Blue

**Features:**
- Auto-dismiss (configurable timeout)
- Manual dismiss button
- Stacked display for multiple toasts

## Component Patterns

### Subscription Pattern

Components subscribe to service updates:

```typescript
useEffect(() => {
  const unsub = chatService.subscribe((state) => {
    // Handle state update
  });
  return unsub;
}, []);
```

### Effect Pattern

Components use effects for side effects:

```typescript
useEffect(() => {
  // Side effect
  return () => {
    // Cleanup
  };
}, [dependencies]);
```

### State Pattern

Components use React state for local state:

```typescript
const [state, setState] = useState(initialValue);
```

### Memo Pattern

Components use useMemo for expensive computations:

```typescript
const computed = useMemo(() => {
  return expensiveComputation(data);
}, [data]);
```

## Styling

### TailwindCSS

All components use TailwindCSS utility classes for styling:

- Layout: flex, grid, etc.
- Spacing: p-, m-, gap-
- Colors: bg-, text-, border-
- Typography: text-, font-
- Effects: shadow-, rounded-, opacity-

### Theme

Dark theme with zinc color palette:
- Background: zinc-950, zinc-900
- Text: zinc-100, zinc-400, zinc-500
- Borders: zinc-800
- Accents: blue, green, red, yellow, purple

## Accessibility

### Keyboard Shortcuts

- ESC: Close modals
- Ctrl+K: Command palette (planned)

### Focus Management

- Modal focus trap
- Button focus states
- Input focus states

### ARIA Labels

Components include ARIA labels for screen readers:
- Button labels
- Input labels
- Modal descriptions

## Performance

### Virtual Scrolling

Message list uses virtual scrolling for performance:
- Only renders visible messages
- Lazy loading of messages
- Efficient memory usage

### Memoization

Expensive computations are memoized:
- Message filtering
- Tool catalog
- Statistics calculation

### Lazy Loading

Modals and panels are lazy loaded:
- Code splitting
- Dynamic imports
- Reduced initial bundle size

## Summary

UI components provide the user interface layer:
- **ChatPane**: Main chat interface
- **MessageItem**: Individual message rendering
- **AssistantMessageRenderer**: Assistant message blocks
- **ToolCallBlock**: Tool execution visualization
- **DebugPanel**: Tool execution history
- **Modals**: Various dialog components
- **VoiceInput**: Voice input capture
- **Toast**: Notification system

All components follow React best practices with hooks, subscriptions, and memoization for performance.
