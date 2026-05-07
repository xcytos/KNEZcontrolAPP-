# MCP Windows Automation

## Repository: https://github.com/mukul975/mcp-windows-automation

## Full Window Automation MCP Integration

### Overview
This MCP server provides comprehensive Windows automation capabilities for AI-controlled testing and interaction with desktop applications.

### Key Features
- **Window Detection**: Find and target specific application windows
- **UI Element Location**: Locate buttons, inputs, and controls
- **Mouse/Keyboard Automation**: Programmatic click and typing
- **Screenshot Capture**: Visual verification of test results
- **Process Management**: Launch and control applications
- **Element Recognition**: Template matching and OCR for UI elements

### Setup Instructions

#### 1. Clone Repository
```bash
git clone https://github.com/mukul975/mcp-windows-automation
cd mcp-windows-automation
```

#### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

#### 3. Configure MCP Server
```json
{
  "mcpServers": {
    "windows-automation": {
      "command": "python",
      "args": ["-m", "mcp_windows_automation.server"],
      "env": {}
    }
  }
}
```

### Testing Capabilities

#### Window Targeting
```python
# Find Tauri application window
window_info = await mcp.call("find_window", {
    "title_contains": "knez-control-app",
    "class_name": "Chrome_WidgetWin_1"
})
```

#### UI Element Detection
```python
# Locate scan button by text or image
scan_button = await mcp.call("find_element", {
    "window_id": window_info["handle"],
    "method": "text",
    "text": "Scan Projects",
    "confidence": 0.8
})
```

#### Automated Interaction
```python
# Click scan button
await mcp.call("click_element", {
    "window_id": window_info["handle"],
    "element_id": scan_button["id"],
    "click_type": "left"
})
```

#### Screenshot Verification
```python
# Capture window state
screenshot = await mcp.call("capture_window", {
    "window_id": window_info["handle"],
    "filename": "test_verification.png"
})
```

### Integration with TAQWIN Testing

#### Test Sequence for Extraction Dashboard
```python
async def test_extraction_dashboard():
    # 1. Find Tauri window
    window = await mcp.call("find_window", {"title_contains": "knez-control-app"})
    
    # 2. Navigate to Extraction tab
    extraction_tab = await mcp.call("find_element", {
        "window_id": window["handle"],
        "text": "Extraction"
    })
    await mcp.call("click_element", {
        "window_id": window["handle"],
        "element_id": extraction_tab["id"]
    })
    
    # 3. Test project scanning
    scan_button = await mcp.call("find_element", {
        "window_id": window["handle"],
        "text": "Scan Projects"
    })
    await mcp.call("click_element", {
        "window_id": window["handle"],
        "element_id": scan_button["id"]
    })
    
    # 4. Verify results with screenshot
    await mcp.call("capture_window", {
        "window_id": window["handle"],
        "filename": "scan_results.png"
    })
```

### Advanced Testing Features

#### Multi-Window Coordination
```python
# Test multiple applications simultaneously
tauri_window = await mcp.call("find_window", {"title": "knez-control-app"})
extractor_window = await mcp.call("find_window", {"title": "TAQWIN Extractor"})

# Coordinate interactions between windows
await mcp.call("switch_window", {"window_id": tauri_window["handle"]})
# Perform Tauri actions
await mcp.call("switch_window", {"window_id": extractor_window["handle"]})
# Perform Extractor actions
```

#### Element State Verification
```python
# Check if button is enabled
button_state = await mcp.call("get_element_state", {
    "window_id": window["handle"],
    "element_id": element_id,
    "properties": ["enabled", "visible", "text"]
})
```

#### Keyboard Input Simulation
```python
# Type in search fields
await mcp.call("type_text", {
    "window_id": window["handle"],
    "element_id": search_field["id"],
    "text": "test query"
})
```

### Error Handling and Recovery

#### Robust Test Execution
```python
async def robust_test():
    try:
        # Main test logic
        await test_extraction_dashboard()
    except WindowNotFoundError:
        # Retry window detection
        await mcp.call("wait_for_window", {
            "title_contains": "knez-control-app",
            "timeout": 10
        })
        await test_extraction_dashboard()
    except ElementNotFoundError:
        # Fallback to coordinate-based clicking
        await mcp.call("click_coordinates", {
            "x": 400, "y": 300,
            "window_id": window["handle"]
        })
```

### Performance Monitoring

#### Test Metrics Collection
```python
# Measure response times
start_time = time.time()
await mcp.call("click_element", {"element_id": button_id})
response_time = time.time() - start_time

# Log performance data
await mcp.call("log_test_result", {
    "test_name": "button_click",
    "response_time_ms": response_time * 1000,
    "success": True
})
```

### Integration with Existing Test Suite

#### Combine with Current Automation
```python
# Enhance existing test_tauri_app.py
from mcp_windows_automation import MCPWindowsAutomation

class EnhancedTauriTest:
    def __init__(self):
        self.mcp = MCPWindowsAutomation()
        
    async def comprehensive_test(self):
        # Use MCP for precise window targeting
        window = await self.mcp.find_window({"title_contains": "knez-control-app"})
        
        # Combine with existing pyautogui actions
        await self.test_with_mcp_precision(window["handle"])
```

### Best Practices

#### 1. Window Management
- Always verify window exists before interaction
- Use window handles for precise targeting
- Handle window focus changes gracefully

#### 2. Element Detection
- Use multiple detection methods (text, image, coordinates)
- Set appropriate confidence thresholds
- Handle dynamic UI elements

#### 3. Test Reliability
- Implement retry logic for flaky interactions
- Use explicit waits for async operations
- Capture screenshots at each verification point

#### 4. Error Recovery
- Log all failures with context
- Implement fallback interaction methods
- Provide clear test result reporting

### Configuration Options

#### MCP Server Settings
```json
{
  "windows-automation": {
    "command": "python",
    "args": ["-m", "mcp_windows_automation.server"],
    "env": {
      "PYTHONPATH": "./src",
      "LOG_LEVEL": "INFO"
    }
  }
}
```

#### Test Configuration
```python
test_config = {
    "window_title": "knez-control-app",
    "timeout_seconds": 30,
    "screenshot_path": "./test_results/",
    "retry_attempts": 3,
    "confidence_threshold": 0.8
}
```

This MCP integration provides enterprise-grade Windows automation capabilities for comprehensive testing of the TAQWIN extraction pipeline and Tauri desktop application.
