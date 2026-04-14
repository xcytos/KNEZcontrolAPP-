# MCP Inspector - Doctor Mode for MCP Diagnostics

## Purpose
The MCP Inspector serves as a diagnostic tool ("doctor") to identify, diagnose, and fix MCP server configuration and runtime issues through stress testing and real-time monitoring.

## Doctor Mode Capabilities

### 1. Configuration Validation
- **Syntax Checking**: Validates MCP config JSON structure
- **Schema Validation**: Checks against MCP schema requirements
- **Path Validation**: Validates command paths, script paths, and working directories
- **Environment Variable Validation**: Ensures required env vars are present

### 2. Runtime Diagnostics
- **Server Lifecycle Tracking**: Monitors IDLE → STARTING → INITIALIZED → READY → ERROR states
- **Process Monitoring**: Tracks PID, runtime state, and process health
- **Traffic Analysis**: Captures all MCP protocol traffic (requests, responses, errors)
- **Log Monitoring**: Real-time stdout/stderr tail for process output

### 3. Stress Testing
- **AI Client Tool Examples**: Pre-configured tool calls from Claude, ChatGPT, Windsurf, Cursor
- **Batch Tool Execution**: Test multiple tools in sequence
- **Timeout Testing**: Validate timeout handling
- **Error Injection**: Test error handling and recovery

### 4. Performance Metrics
- **Initialization Duration**: Time to initialize MCP server
- **Tools List Duration**: Time to retrieve tool list
- **Tool Call Duration**: Individual tool execution time
- **Success Rate**: Pass/fail statistics for tool calls

## Doctor Workflow

### Step 1: Load Configuration
1. Open MCP Inspector in Control App
2. Click "Load Test Config" to load test configuration
3. Or manually paste MCP config into the config editor
4. Click "Apply" to validate and load configuration

### Step 2: Validate Configuration
- Review "Issues" section for validation errors
- Check for missing required fields
- Verify paths are absolute and exist
- Ensure environment variables are properly set

### Step 3: Start Server
1. Select server from "Servers" list
2. Click "▶ Start" button (animated with progress indicator)
3. Monitor server state transitions
4. Check for errors in stdout/stderr tails

### Step 4: Initialize and Handshake
1. Click "Initialize" to initialize MCP server
2. Click "Test Connect" to perform full handshake
3. Monitor initialization duration
4. Verify tools are loaded successfully

### Step 5: Stress Testing with AI Client Examples
1. Use "AI Client Tool Examples" buttons for quick testing:
   - **Claude**: Tests mcp0_activate_taqwin_unified_consciousness, mcp0_get_server_status, mcp0_scan_database
   - **ChatGPT**: Tests mcp0_activate_taqwin_unified_consciousness, mcp0_web_intelligence
   - **Windsurf**: Tests mcp0_session, mcp0_deploy_real_taqwin_council
   - **Cursor**: Tests mcp0_debug_test, mcp0_connection_info
2. Monitor tool execution results
3. Check for errors in tool results
4. Review traffic logs for protocol issues

### Step 6: Manual Tool Testing
1. Select tool from tools list
2. Edit tool arguments in JSON textarea
3. Click "Call Tool" to execute
4. Review results in result display
5. Check for errors in error display

### Step 7: Diagnose Issues
- **Traffic Tab**: Review MCP protocol traffic for errors
- **Stdout Tab**: Check process output for diagnostic messages
- **Stderr Tab**: Check error output for process errors
- **Parse Tab**: Check JSON parsing errors

### Step 8: Fix Issues
Based on diagnostics:
- Fix configuration errors (paths, env vars, args)
- Update Python script if tool implementations are broken
- Adjust timeout values if tools are timing out
- Modify tool arguments if validation fails
- Restart server and re-test

## Common Issues and Fixes

### Issue: Server fails to start
**Symptoms**: State stuck on "STARTING", error in stderr
**Diagnosis**: Check command path, script path, working directory
**Fix**: Ensure paths are absolute and exist, use full Python path

### Issue: Tools list timeout
**Symptoms**: State stuck on "LISTING_TOOLS", timeout error
**Diagnosis**: Tool list taking too long to generate
**Fix**: Increase toolsListTimeoutMs, check server performance

### Issue: Tool execution fails
**Symptoms**: Tool call returns error, error display shows message
**Diagnosis**: Check tool implementation, argument validation, permissions
**Fix**: Fix tool implementation, correct arguments, check permissions

### Issue: Process crashes
**Symptoms**: State changes to "ERROR", process_closed event
**Diagnosis**: Check stderr for crash details, Python errors
**Fix**: Fix Python script errors, handle exceptions properly

## Stress Testing Results

### Pass Criteria
- Server starts successfully
- Initialization completes within timeout
- Tools list loads successfully
- All AI client example tools execute without errors
- Manual tool calls execute successfully
- No process crashes
- Traffic shows proper MCP protocol compliance

### Fail Criteria
- Server fails to start
- Initialization times out
- Tools list fails to load
- Tool execution returns errors
- Process crashes during operation
- Traffic shows protocol violations

## Doctor Mode Best Practices

1. **Start Simple**: Test with basic config before complex configurations
2. **Monitor Continuously**: Keep Traffic tab open during testing
3. **Test Incrementally**: Test tools one at a time before batch testing
4. **Document Results**: Note which tools pass/fail for future reference
5. **Use AI Examples**: Use pre-configured AI client examples for quick testing
6. **Check Logs First**: Always check stdout/stderr before configuration
7. **Validate Paths**: Ensure all paths are absolute and exist
8. **Test Timeouts**: Adjust timeouts based on actual tool execution times

## Current TAQWIN MCP Configuration

```json
{
  "schema_version": "1",
  "mcpServers": {
    "taqwin": {
      "command": "C:\\Users\\syedm\\AppData\\Local\\Programs\\Python\\Python313\\python.exe",
      "args": [
        "-u",
        "C:\\Users\\syedm\\Downloads\\ASSETS\\controlAPP\\TAQWIN_V1\\main.py"
      ],
      "env": {
        "PYTHONUNBUFFERED": "1"
      },
      "disabled": false
    }
  }
}
```

## Testing Instructions

1. **Open Dev Server**: Click the browser preview button to open http://localhost:5173/
2. **Navigate to MCP Inspector**: Find MCP Inspector in the app
3. **Load Config**: The updated config is already in mcp.config.json
4. **Start Testing**: Use the AI Client Tool Examples to stress test
5. **Monitor Results**: Watch traffic, stdout, stderr for diagnostics
6. **Document**: Note which tools pass and which fail

## Linked Memory
- .taqwin/memory/mcp/ (MCP tool memory)
- .taqwin/memory/development/ (development memory)

## Linked History
- .taqwin/history/R003.md (MCP Inspector implementation)
- .taqwin/history/R004.md (Bug fix: tool execution enabled)

## Linked Tickets
- TICKET-003 (MCP Inspector implementation)
- TICKET-004 (MCP config testing and stress testing)

## Created
2026-04-12

## Status
DOCTOR MODE DOCUMENTED - READY FOR STRESS TESTING
