# TAQWIN MCP Server — AI Model Usage Guide

## 📋 OVERVIEW

This document provides **complete instructions** for AI models to use the TAQWIN MCP Server and call its tools correctly.

---

## ⚠️ CORE LAW

```text
MCP = JSON-RPC PROTOCOL
MCP ≠ Python API
MCP ≠ Direct Function Call
```

**NEVER** attempt to:
- Import MCP tools as Python modules
- Call tools directly via subprocess
- Bypass the MCP transport layer
- Execute tools via Python scripts

**ALWAYS** use:
- MCP protocol (JSON-RPC 2.0)
- Proper tool calls via MCP client
- Required request_rationale in all calls

---

## 🧨 MANDATORY REQUIREMENTS

### 1. Request Rationale

**EVERY tool call MUST include**:

```json
{
  "arguments": {
    "request_rationale": {
      "what": "Specific action being performed",
      "why": "Reason for performing this action",
      "memory_context": "Optional: Relevant context from memory"
    }
  }
}
```

**Rules:**
- `what`: Describe the specific action (e.g., "Get server status")
- `why`: Explain the purpose (e.g., "To verify system health")
- Both fields are REQUIRED
- Omitting either causes immediate rejection

### 2. MCP Protocol Structure

**Valid MCP Request Format:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tool_name",
    "arguments": {
      "request_rationale": {
        "what": "...",
        "why": "..."
      },
      "tool_specific_arg": "value"
    }
  }
}
```

**Validation Rules:**
- `jsonrpc`: MUST be "2.0"
- `method`: MUST be "tools/call"
- `id`: REQUIRED (any integer or string)
- `params.name`: MUST be a valid tool name
- `params.arguments`: MUST be a dict with request_rationale

---

## 🛠️ AVAILABLE TOOLS

### Core Tools

| Tool Name | Purpose | Required Arguments |
|-----------|---------|-------------------|
| `test_tool` | Test MCP connectivity | request_rationale |
| `get_server_status` | Get comprehensive system status | request_rationale, force_refresh (optional) |
| `connection_info` | Get debug connection information | request_rationale |
| `debug_test` | Debug test with message | request_rationale, message, include_env (optional) |
| `scan_database` | Database scanning and analysis | request_rationale, action, database_type (optional) |
| `session` | Session management | request_rationale, action, session_id (optional), name (optional) |
| `web_intelligence` | Web access and analysis | request_rationale, action, query (optional), url (optional) |
| `deploy_real_taqwin_council` | TAQWIN Council management | request_rationale, action, topic (optional) |
| `activate_taqwin_unified_consciousness` | Unified consciousness activation | request_rationale, query, level (optional) |

---

## 📝 TOOL-SPECIFIC GUIDES

### test_tool

**Purpose:** Test MCP connectivity and basic functionality

**Request:**
```json
{
  "name": "test_tool",
  "arguments": {
    "request_rationale": {
      "what": "Test MCP connectivity",
      "why": "Verify MCP server is responding correctly"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "SUCCESS",
    "message": "Test successful",
    "timestamp": "2026-04-13T00:00:00"
  }
}
```

---

### get_server_status

**Purpose:** Get comprehensive TAQWIN system status

**Request:**
```json
{
  "name": "get_server_status",
  "arguments": {
    "request_rationale": {
      "what": "Get server status",
      "why": "Check system health and performance metrics"
    },
    "force_refresh": false,
    "include_db_analysis": false
  }
}
```

**Optional Arguments:**
- `force_refresh` (boolean): Force refresh of cached data
- `include_db_analysis` (boolean): Include detailed database analysis (slower)

**Response:**
```json
{
  "success": true,
  "data": {
    "server_overview": {...},
    "system_performance": {...},
    "database_status": {...},
    "module_status": {...},
    "execution_time_ms": 123.45
  }
}
```

---

### connection_info

**Purpose:** Get debug connection information

**Request:**
```json
{
  "name": "connection_info",
  "arguments": {
    "request_rationale": {
      "what": "Get connection info",
      "why": "Debug MCP connection issues"
    }
  }
}
```

---

### debug_test

**Purpose:** Debug test with custom message

**Request:**
```json
{
  "name": "debug_test",
  "arguments": {
    "request_rationale": {
      "what": "Run debug test",
      "why": "Test MCP tool execution with custom message"
    },
    "message": "Test message",
    "include_env": false
  }
}
```

---

### scan_database

**Purpose:** Database scanning and analysis

**Actions:** `scan_overview`, `schema_analysis`, `execute_query`, `search_content`, `analyze_integrity`

**Request:**
```json
{
  "name": "scan_database",
  "arguments": {
    "request_rationale": {
      "what": "Scan database",
      "why": "Analyze database structure and content"
    },
    "action": "scan_overview",
    "database_type": "sessions"
  }
}
```

**Database Types:** `sessions`, `agents`, `memory`, `all`

---

### session

**Purpose:** Session management

**Actions:** `session_start`, `session_attach`, `session_context_query`, `session_event_proposal`, `session_summary_request`, `session_close`

**Request:**
```json
{
  "name": "session",
  "arguments": {
    "request_rationale": {
      "what": "Start session",
      "why": "Create new tracking session for operations"
    },
    "action": "session_start",
    "name": "Session Name",
    "type": "GENERAL",
    "description": "Session description",
    "tags": ["tag1", "tag2"],
    "privacy_level": "STANDARD",
    "auto_record": true
  }
}
```

**Session Types:** `GENERAL`, `CODE_ANALYSIS`, `RESEARCH`, `PLANNING`, `DEBUGGING`, `LEARNING`, `CREATIVE`, `PROBLEM_SOLVING`

**Privacy Levels:** `LOW`, `STANDARD`, `HIGH`, `MAXIMUM`

---

### web_intelligence

**Purpose:** Web access, content analysis, and research

**Actions:** `get_content`, `search_web`, `analyze_content`, `monitor_content`, `get_status`, `agent_research`

**Request:**
```json
{
  "name": "web_intelligence",
  "arguments": {
    "request_rationale": {
      "what": "Search web",
      "why": "Find information about a specific topic"
    },
    "action": "search_web",
    "query": "search query here",
    "max_results": 10
  }
}
```

**Lightweight Mode:**
```json
{
  "name": "web_intelligence",
  "arguments": {
    "request_rationale": {
      "what": "Get web intelligence status",
      "why": "Check if web intelligence system is active"
    },
    "action": "get_status",
    "mode": "light"
  }
}
```

---

### deploy_real_taqwin_council

**Purpose:** TAQWIN Council agent management

**Actions:** `deploy`, `status`, `consult`, `get_agent_profile`, `agent_self_reflection`

**Request:**
```json
{
  "name": "deploy_real_taqwin_council",
  "arguments": {
    "request_rationale": {
      "what": "Get council status",
      "why": "Check TAQWIN Council agent availability"
    },
    "action": "status"
  }
}
```

**Lightweight Mode:**
```json
{
  "name": "deploy_real_taqwin_council",
  "arguments": {
    "request_rationale": {
      "what": "Get council status (lightweight)",
      "why": "Quick check of council availability"
    },
    "action": "status",
    "mode": "light"
  }
}
```

---

### activate_taqwin_unified_consciousness

**Purpose:** Activate and manage TAQWIN Unified Consciousness

**Request:**
```json
{
  "name": "activate_taqwin_unified_consciousness",
  "arguments": {
    "request_rationale": {
      "what": "Activate unified consciousness",
      "why": "Enable TAQWIN consciousness for advanced analysis"
    },
    "query": "Task or question to process",
    "level": "superintelligence"
  }
}
```

**Consciousness Levels:** `basic`, `enhanced`, `full`, `quantum`, `superintelligence`

**Lightweight Mode:**
```json
{
  "name": "activate_taqwin_unified_consciousness",
  "arguments": {
    "request_rationale": {
      "what": "Check consciousness status",
      "why": "Verify consciousness system is ready"
    },
    "mode": "light"
  }
}
```

---

## ⚠️ COMMON ERRORS AND SOLUTIONS

### Error: Missing request_rationale

**Cause:** Omitting request_rationale from arguments

**Solution:**
```json
{
  "arguments": {
    "request_rationale": {
      "what": "Describe action",
      "why": "Explain purpose"
    }
  }
}
```

---

### Error: Invalid request_rationale structure

**Cause:** request_rationale missing `what` or `why` field

**Solution:**
```json
{
  "request_rationale": {
    "what": "Required field",
    "why": "Required field"
  }
}
```

---

### Error: Invalid JSON-RPC version

**Cause:** Missing or incorrect jsonrpc field

**Solution:**
```json
{
  "jsonrpc": "2.0"
}
```

---

### Error: Invalid method

**Cause:** Using wrong method name

**Solution:**
```json
{
  "method": "tools/call"
}
```

---

### Error: Tool execution timeout

**Cause:** Tool taking too long to execute

**Solution:**
- Use lightweight mode for heavy tools
- Check if include_db_analysis is set to false
- Reduce query complexity

---

## 🚀 BEST PRACTICES

### 1. Always Include Request Rationale

**✅ CORRECT:**
```json
{
  "arguments": {
    "request_rationale": {
      "what": "Get server status",
      "why": "Check system health"
    }
  }
}
```

**❌ INCORRECT:**
```json
{
  "arguments": {}
}
```

---

### 2. Use Lightweight Mode for Heavy Tools

**Heavy Tools:** `web_intelligence`, `deploy_real_taqwin_council`, `activate_taqwin_unified_consciousness`

**✅ CORRECT:**
```json
{
  "name": "web_intelligence",
  "arguments": {
    "request_rationale": {...},
    "action": "get_status",
    "mode": "light"
  }
}
```

---

### 3. Handle Timeouts Gracefully

Tools have built-in timeout protection. If a tool times out, it returns a partial response with degraded status.

**Expected Timeout Response:**
```json
{
  "success": true,
  "partial": true,
  "timeout": true,
  "data": {
    "tool_name": "...",
    "status": "degraded",
    "message": "Tool operating in degraded mode"
  }
}
```

---

### 4. Check Response Format

All tools return:
```json
{
  "success": true,
  "data": {...}
}
```

Or on error:
```json
{
  "success": false,
  "error": "Error message"
}
```

---

### 5. Use Proper Tool Names

**✅ CORRECT:**
- `get_server_status`
- `deploy_real_taqwin_council`
- `activate_taqwin_unified_consciousness`

**❌ INCORRECT:**
- `server_status`
- `council`
- `consciousness`

---

## 🧠 TESTING MCP CONNECTIVITY

### Step 1: Test Basic Connectivity

Call `test_tool` to verify MCP server is responding:

```json
{
  "name": "test_tool",
  "arguments": {
    "request_rationale": {
      "what": "Test MCP connectivity",
      "why": "Verify MCP server is operational"
    }
  }
}
```

### Step 2: Test Server Status

Call `get_server_status` to verify full functionality:

```json
{
  "name": "get_server_status",
  "arguments": {
    "request_rationale": {
      "what": "Get server status",
      "why": "Verify system health and performance"
    },
    "force_refresh": false
  }
}
```

---

## 📊 RESPONSE FORMATS

### Success Response

```json
{
  "success": true,
  "data": {
    "result": "...",
    "metadata": {...}
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "error_code": -32001
}
```

### Partial Response (Timeout)

```json
{
  "success": true,
  "partial": true,
  "timeout": true,
  "data": {
    "tool_name": "...",
    "status": "degraded"
  }
}
```

---

## 🔒 SECURITY CONSIDERATIONS

### 1. Never Expose Sensitive Data in Rationale

**❌ INCORRECT:**
```json
{
  "request_rationale": {
    "what": "Get API key",
    "why": "Access secret credentials"
  }
}
```

**✅ CORRECT:**
```json
{
  "request_rationale": {
    "what": "Check system status",
    "why": "Verify operational readiness"
  }
}
```

---

### 2. Validate Tool Arguments

Always validate tool-specific arguments before sending the request.

---

### 3. Use Privacy Levels Appropriately

When creating sessions, use appropriate privacy levels:
- `LOW`: Public information
- `STANDARD`: Normal operations
- `HIGH`: Sensitive operations
- `MAXIMUM`: Critical operations

---

## 📞 TROUBLESHOOTING

### Issue: Transport Closed Error

**Cause:** Attempting to bypass MCP protocol

**Solution:**
- Ensure using MCP protocol (JSON-RPC 2.0)
- Do not use Python scripts to call tools
- Verify MCP server is running

---

### Issue: Tool Not Found

**Cause:** Incorrect tool name

**Solution:**
- Check tool name against available tools list
- Use exact tool name (case-sensitive)

---

### Issue: Validation Error

**Cause:** Missing or invalid request_rationale

**Solution:**
- Ensure request_rationale is present
- Verify both `what` and `why` fields are included
- Check that request_rationale is a dict

---

## 🎯 QUICK REFERENCE

### Minimal Valid Request

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "test_tool",
    "arguments": {
      "request_rationale": {
        "what": "Test",
        "why": "Verify connectivity"
      }
    }
  }
}
```

### All Available Tools

1. `test_tool`
2. `get_server_status`
3. `connection_info`
4. `debug_test`
5. `scan_database`
6. `session`
7. `web_intelligence`
8. `deploy_real_taqwin_council`
9. `activate_taqwin_unified_consciousness`

### Required Fields

- `jsonrpc`: "2.0"
- `method`: "tools/call"
- `id`: Any value
- `params.name`: Tool name
- `params.arguments.request_rationale.what`: Action description
- `params.arguments.request_rationale.why`: Action purpose

---

## 📚 ADDITIONAL RESOURCES

- `.taqwin/PROTOCOL.md` - MCP protocol details
- `.taqwin/IDE_INTEGRATION.md` - IDE integration guide
- `.taqwin/INDEX.md` - Governance artifacts index

---

## ⚠️ FINAL REMINDER

**MCP is a protocol, not an API.**

**NEVER**:
- Import tools as Python modules
- Use subprocess to call tools
- Bypass MCP transport

**ALWAYS**:
- Use JSON-RPC 2.0 protocol
- Include request_rationale
- Validate response format

---

*Last Updated: 2026-04-13*
*Version: 1.0.0*
