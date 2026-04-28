# Workflow Guide Documentation

## Overview

This guide provides step-by-step workflows for common tasks in the KNEZ system, covering both the knez-control-app frontend and the KNEZ backend.

## Getting Started

### Prerequisites

**For Frontend (knez-control-app):**
- Node.js 18+
- npm or yarn
- Tauri CLI (for desktop builds)

**For Backend (KNEZ):**
- Python 3.10+
- pip
- Ollama (for local LLM)
- Redis (optional, for caching)

### Installation

#### Frontend Installation

```bash
cd knez-control-app
npm install
```

#### Backend Installation

```bash
cd KNEZ
pip install -r requirements.txt
```

### Starting the System

#### Start Backend

```bash
cd KNEZ
python -m knez.knez_core.app
```

The backend will start on `http://localhost:8000`

#### Start Frontend

```bash
cd knez-control-app
npm run dev
```

The frontend will open as a Tauri desktop application

## Common Workflows

### Workflow 1: Basic Chat Interaction

**Goal:** Send a message to the AI and receive a response

**Steps:**

1. **Launch knez-control-app**
   - Open the desktop application
   - Wait for connection to KNEZ backend

2. **Create or Select Session**
   - Click "New Session" or select existing session
   - Session ID is auto-generated

3. **Send Message**
   - Type message in input field
   - Press Enter or click Send button
   - Observe phase progress indicator

4. **View Response**
   - AI response appears in chat
   - Tool execution blocks show if tools were used
   - Metrics display response time and token count

**Expected Outcome:**
- Message sent successfully
- AI response received
- Phase transitions: idle → sending → thinking → streaming → done

### Workflow 2: Tool Execution with Debug Panel

**Goal:** Execute a tool and monitor execution via debug panel

**Steps:**

1. **Open Debug Panel**
   - Click bug icon in ChatPane header
   - Debug panel opens as modal

2. **Trigger Tool Execution**
   - Send message that requires tool use (e.g., "Search for Python tutorials")
   - AI initiates tool execution

3. **Monitor Tool Execution**
   - Debug panel shows tool call history
   - Status badges update: pending → running → completed
   - Execution time displays when available
   - MCP latency displays when available

4. **View Tool Details**
   - Click tool call to expand details
   - View tool parameters
   - View tool result
   - View execution metrics

**Expected Outcome:**
- Tool execution visible in debug panel
- Status transitions visible
- Execution time and latency displayed
- Tool details accessible

### Workflow 3: Session Management

**Goal:** Create, fork, rename, and delete sessions

**Steps:**

#### Create New Session
1. Click "New Session" button
2. Session created with auto-generated ID
3. Session name defaults to timestamp
4. Chat interface ready for input

#### Rename Session
1. Click session name in header
2. Rename modal opens
3. Enter new name
4. Click "Rename" or press Enter

#### Fork Session
1. Click "Fork" button in session menu
2. Fork modal opens
3. Select fork point (message)
4. Enter new session name
5. Click "Fork"

#### Delete Session
1. Click "History" button
2. History modal opens
3. Select session to delete
4. Click "Delete" (confirmation required)

**Expected Outcome:**
- Sessions created, renamed, forked, deleted
- Session lineage tracked
- Chat history preserved for each session

### Workflow 4: MCP Server Management

**Goal:** Start, stop, and monitor MCP servers

**Steps:**

#### Start MCP Server
1. Navigate to Settings → MCP Servers
2. Select server from list
3. Click "Start" button
4. Server status changes to "running"
5. Tools become available

#### Stop MCP Server
1. Navigate to Settings → MCP Servers
2. Select running server
3. Click "Stop" button
4. Server status changes to "stopped"
5. Tools become unavailable

#### Monitor MCP Server
1. Navigate to Settings → MCP Servers
2. View server status (running/stopped/crashed)
3. View crash history
4. View last error message
5. View PID (if running)

**Expected Outcome:**
- MCP servers started and stopped
- Server status monitored
- Crash history tracked
- Tools available when server running

### Workflow 5: Influence Contract Creation

**Goal:** Create an influence contract to modify AI behavior

**Steps:**

1. **Navigate to Influence System**
   - Go to Settings → Influence
   - View existing contracts

2. **Create New Contract**
   - Click "Create Contract" button
   - Fill in contract details:
     - Domain: routing, tool_selection, or parameters
     - Influence type: backend_preference, tool_preference, etc.
     - Scope: global or specific
     - Max weight: 0.0-1.0
     - No override: true/false
     - Reversible: true/false

3. **Submit for Approval**
   - Click "Submit"
   - Contract added to approval queue
   - Wait for approval

4. **Approve Contract**
   - Navigate to Approvals
   - Select pending contract
   - Click "Approve"
   - Contract becomes active

**Expected Outcome:**
- Influence contract created
- Contract approved
- AI behavior modified according to contract
- Influence execution trace visible in events

### Workflow 6: Approval Workflow

**Goal:** Request and approve sensitive operations

**Steps:**

#### Request Approval
1. AI initiates sensitive operation
2. Operation added to approval queue
3. Notification displayed

#### Review Approval
1. Navigate to Approvals
2. View pending approvals
3. Review operation details
4. Assess risk

#### Approve or Deny
1. Select approval
2. Click "Approve" or "Deny"
3. Add decision reason
4. Submit decision

**Expected Outcome:**
- Approval requested for sensitive operation
- Approval reviewed and decided
- Operation executed if approved
- Audit trail created

### Workflow 7: Memory Management

**Goal:** View and manage memory entries

**Steps:**

#### View Memory
1. Click "Memory" button in header
2. Memory modal opens
3. View memory entries for current session
4. Filter by memory type

#### Add Memory (Manual)
1. Click "Add Memory" button
2. Enter memory details:
   - Memory type: fact, preference, context, pattern
   - Summary: Memory content
   - Confidence: 0.0-1.0
   - Retention policy: short, medium, long
3. Click "Save"

#### Delete Memory
1. Select memory entry
2. Click "Delete"
3. Confirm deletion

**Expected Outcome:**
- Memory entries viewed
- Memory added manually
- Memory deleted
- Memory hints used in routing

### Workflow 8: Backend Configuration

**Goal:** Configure multiple backends for inference

**Steps:**

#### Add Local Backend (Ollama)
1. Navigate to Settings → Backends
2. Click "Add Backend"
3. Select type: Local
4. Configure:
   - Name: ollama
   - Endpoint: http://localhost:11434
   - Model: llama3.2
5. Click "Save"

#### Add Cloud Backend (OpenAI)
1. Navigate to Settings → Backends
2. Click "Add Backend"
3. Select type: Cloud
4. Configure:
   - Name: openai
   - API Key: (enter key)
   - Model: gpt-4
5. Click "Save"

#### Test Backend
1. Select backend from list
2. Click "Test Connection"
3. View health status
4. View response time

**Expected Outcome:**
- Backends configured
- Backend health tested
- Router selects backend based on health
- Fallback on failure

### Workflow 9: Event Analysis

**Goal:** Analyze events for debugging and auditing

**Steps:**

1. **Access Event Logs**
   - Navigate to Settings → Events
   - Event viewer opens

2. **Filter Events**
   - Filter by session ID
   - Filter by event type (INPUT, ANALYSIS, DECISION, ACTION, ERROR)
   - Filter by source (KNEZ_CORE, COGNITIVE, MCP, BACKEND)
   - Filter by severity (DEBUG, INFO, WARNING, ERROR)
   - Filter by time range

3. **View Event Details**
   - Click event to expand
   - View event payload
   - View event tags
   - View timestamp

4. **Export Events**
   - Click "Export" button
   - Select format (JSON, CSV)
   - Download file

**Expected Outcome:**
- Events filtered and viewed
- Event details accessible
- Events exported for analysis
- Audit trail available

### Workflow 10: System Health Monitoring

**Goal:** Monitor system health and performance

**Steps:**

1. **Access Dashboard**
   - Navigate to Dashboard
   - System overview displayed

2. **View Health Metrics**
   - Backend health scores
   - System resource usage
   - Error rates
   - Response times

3. **View Cognitive State**
   - Governance status
   - Influence status
   - Memory status
   - Perception status

4. **View Metrics**
   - Request latency
   - Token generation rate
   - Tool execution time
   - Backend usage

**Expected Outcome:**
- System health visible
- Performance metrics accessible
- Cognitive state monitored
- Issues identified early

## Advanced Workflows

### Workflow 11: Custom Tool Development

**Goal:** Develop and integrate a custom MCP tool

**Steps:**

1. **Create MCP Server**
   - Create new Python project
   - Implement MCP server with JSON-RPC 2.0
   - Register tools

2. **Configure MCP Server**
   - Add server to knez-control-app config
   - Configure command and arguments
   - Set auto-start if desired

3. **Start MCP Server**
   - Start server via knez-control-app
   - Verify server status
   - Check tool registration

4. **Test Tool**
   - Send message that uses tool
   - Monitor tool execution
   - Verify tool result

**Expected Outcome:**
- Custom MCP server created
- Tool registered and available
- Tool executes successfully
- Tool result displayed

### Workflow 12: Cognitive Module Development

**Goal:** Develop a custom cognitive module

**Steps:**

1. **Create Module**
   - Create new Python module in `knez/cognitive/`
   - Implement module interface
   - Add API endpoints

2. **Register Module**
   - Add module to cognitive system
   - Register event handlers
   - Configure module settings

3. **Test Module**
   - Trigger module events
   - Verify module behavior
   - Check event logs

4. **Integrate with Dashboard**
   - Add module state to dashboard
   - Add module metrics
   - Add module controls

**Expected Outcome:**
- Custom cognitive module created
- Module integrated with system
- Module behavior verified
- Module visible in dashboard

### Workflow 13: Runbook Generation

**Goal:** Generate and review runbook for a session

**Steps:**

1. **Select Session**
   - Navigate to session history
   - Select session to analyze

2. **Generate Runbook**
   - Click "Generate Runbook"
   - System analyzes session events
   - Runbook generated

3. **Review Runbook**
   - View timeline of events
   - View key decisions
   - View rejected actions
   - View safety checks
   - View final outcome

4. **Export Runbook**
   - Click "Export"
   - Select format (PDF, Markdown)
   - Download file

**Expected Outcome:**
- Runbook generated for session
- Key decisions documented
- Safety checks verified
- Runbook exported for review

### Workflow 14: Audit Consistency Check

**Goal:** Run consistency audit and review results

**Steps:**

1. **Access Audit System**
   - Navigate to Settings → Audit
   - Audit controls displayed

2. **Run Audit**
   - Click "Run All Audits"
   - System runs consistency checks
   - Audit results displayed

3. **Review Results**
   - View check status (pass/fail/warning)
   - View check details
   - View recommendations

4. **Address Issues**
   - Fix failed checks
   - Address warnings
   - Re-run audit

**Expected Outcome:**
- Audit checks executed
- Results reviewed
- Issues addressed
- System consistency verified

### Workflow 15: Perception Snapshot

**Goal:** Capture and analyze perception snapshot

**Steps:**

1. **Capture Snapshot**
   - Navigate to Perception
   - Click "Take Snapshot"
   - System captures current state

2. **View Snapshot**
   - View active window title
   - View active window process
   - View system state (CPU, memory, etc.)

3. **Analyze Snapshot**
   - Compare with previous snapshots
   - Identify patterns
   - Generate insights

4. **Export Snapshot**
   - Click "Export"
   - Download snapshot data

**Expected Outcome:**
- Perception snapshot captured
- System state analyzed
- Patterns identified
- Snapshot exported

## Troubleshooting Workflows

### Workflow 16: Debug Tool Execution Failure

**Goal:** Debug a failed tool execution

**Steps:**

1. **Identify Failure**
   - Check debug panel for failed status
   - Note tool name and error message

2. **View Tool Details**
   - Expand tool call in debug panel
   - View error message
   - View tool parameters
   - View execution time

3. **Check MCP Server**
   - Navigate to MCP Servers
   - Check server status
   - Check crash history
   - Restart server if needed

4. **Retry Tool Execution**
   - Send message again
   - Monitor execution
   - Verify success

**Expected Outcome:**
- Tool failure identified
- Root cause determined
- Issue resolved
- Tool execution successful

### Workflow 17: Resolve Backend Connection Issues

**Goal:** Resolve backend connection failures

**Steps:**

1. **Check Backend Status**
   - Navigate to Settings → Backends
   - Check backend health
   - Check connection status

2. **Test Connection**
   - Click "Test Connection"
   - View error message
   - Identify issue

3. **Resolve Issue**
   - If Ollama: Start Ollama service
   - If OpenAI: Check API key
   - If network: Check firewall/proxy

4. **Verify Resolution**
   - Test connection again
   - Verify health status
   - Send test message

**Expected Outcome:**
- Connection issue identified
- Issue resolved
- Backend connected
- Inference working

### Workflow 18: Resolve Session Sync Issues

**Goal:** Resolve session synchronization problems

**Steps:**

1. **Identify Issue**
   - Messages not appearing
   - Session not updating
   - Phase stuck

2. **Check WebSocket**
   - Check WebSocket connection status
   - Verify session ID
   - Reconnect if needed

3. **Check Backend**
   - Verify backend is running
   - Check event stream
   - Check session database

4. **Refresh Session**
   - Reload session
   - Clear cache
   - Re-sync messages

**Expected Outcome:**
- Sync issue identified
- Connection restored
- Session synchronized
- Messages displayed

## Best Practices

### Chat Interaction
- Use clear, specific prompts
- Provide context when needed
- Review tool execution details
- Check debug panel for issues

### Session Management
- Create sessions for different topics
- Rename sessions for clarity
- Fork sessions for exploration
- Export important sessions

### MCP Management
- Start only needed servers
- Monitor server health
- Review crash history
- Update server configurations

### Influence Contracts
- Start with low weights
- Test contracts before approval
- Monitor influence effects
- Use kill switches for emergencies

### Security
- Keep API keys secure
- Use approval workflows for sensitive operations
- Review audit logs regularly
- Update system components

## Summary

This workflow guide covers:
- **Basic Workflows:** Chat, tool execution, session management
- **Advanced Workflows:** Custom tools, cognitive modules, runbooks
- **Troubleshooting:** Debug failures, resolve issues
- **Best Practices:** Security, efficiency, optimization

These workflows provide step-by-step guidance for common tasks in the KNEZ system.
