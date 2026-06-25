"""
Native Windows MCP Server
Provides Chrome DevTools MCP-style tools for Windows native application automation
"""

import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
import time

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backends.backend_selector import BackendSelector
from resolvers.ai_resolver import AIElementResolver
from recorder.session_recorder import SessionRecorder

# MCP SDK imports
try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import Tool, TextContent
except ImportError:
    print("Error: mcp package not found. Install with: pip install mcp", file=sys.stderr)
    sys.exit(1)


class NativeWindowsServer:
    """Native Windows MCP Server for .exe automation"""
    
    def __init__(self):
        self.backend: Optional[BackendSelector] = None
        self.resolver: Optional[AIElementResolver] = None
        self.recorder = SessionRecorder()
        self.connected_app = None
        self.elements_cache = []
        self.server = Server("native-windows-mcp")
        
        # Register tools
        self._register_tools()
        
    def _register_tools(self):
        """Register all MCP tools"""
        
        # Tool 1: Connect to Window
        @self.server.list_tools()
        async def list_tools() -> List[Tool]:
            return [
                Tool(
                    name="connect_window",
                    description="Connect to a Windows native application by name or window title",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "app_name": {
                                "type": "string",
                                "description": "Application name or window title (e.g., 'knez-control-app', 'notepad')"
                            },
                            "backend_strategy": {
                                "type": "string",
                                "enum": ["pywinauto", "cdp", "ui-labeller", "vision"],
                                "default": "cdp",
                                "description": "Backend automation strategy to use. CDP recommended for background automation (no cursor interference)"
                            }
                        },
                        "required": ["app_name"]
                    }
                ),
                Tool(
                    name="take_snapshot",
                    description="Capture text-based snapshot of all UI elements (similar to Chrome DevTools MCP take_snapshot)",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "verbose": {
                                "type": "boolean",
                                "default": False,
                                "description": "Include detailed element information"
                            },
                            "filePath": {
                                "type": "string",
                                "description": "Optional file path to save snapshot"
                            }
                        }
                    }
                ),
                Tool(
                    name="take_screenshot",
                    description="Capture visual screenshot of the window",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "Screenshot name (without extension)"
                            },
                            "filePath": {
                                "type": "string",
                                "description": "Optional absolute path to save screenshot"
                            }
                        }
                    }
                ),
                Tool(
                    name="click",
                    description="Click on an element using natural language query (e.g., 'sessions button', 'dashboard menu')",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "element": {
                                "type": "string",
                                "description": "Natural language description of element to click"
                            },
                            "includeSnapshot": {
                                "type": "boolean",
                                "default": False,
                                "description": "Include snapshot in response after click"
                            }
                        },
                        "required": ["element"]
                    }
                ),
                Tool(
                    name="hover",
                    description="Hover over an element",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "element": {
                                "type": "string",
                                "description": "Natural language description of element to hover"
                            }
                        },
                        "required": ["element"]
                    }
                ),
                Tool(
                    name="type_text",
                    description="Type text into an input element",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "element": {
                                "type": "string",
                                "description": "Natural language description of input element"
                            },
                            "text": {
                                "type": "string",
                                "description": "Text to type"
                            }
                        },
                        "required": ["element", "text"]
                    }
                ),
                Tool(
                    name="fill_form",
                    description="Fill multiple form fields at once",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "fields": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "element": {"type": "string"},
                                        "value": {"type": "string"}
                                    },
                                    "required": ["element", "value"]
                                },
                                "description": "Array of {element, value} objects to fill"
                            }
                        },
                        "required": ["fields"]
                    }
                ),
                Tool(
                    name="wait_for",
                    description="Wait for element or condition",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "condition": {
                                "type": "string",
                                "description": "Condition to wait for (e.g., 'loading spinner disappears', 'submit button visible')"
                            },
                            "timeout": {
                                "type": "integer",
                                "default": 5000,
                                "description": "Timeout in milliseconds"
                            }
                        },
                        "required": ["condition"]
                    }
                ),
                Tool(
                    name="list_elements",
                    description="List all available UI elements with optional filtering",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "filter": {
                                "type": "string",
                                "description": "Optional filter query (e.g., 'button', 'input', 'menu')"
                            },
                            "type": {
                                "type": "string",
                                "enum": ["button", "input", "menu", "pane", "all"],
                                "default": "all",
                                "description": "Filter by element type"
                            }
                        }
                    }
                ),
                Tool(
                    name="select_window",
                    description="Switch focus to another window",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "window_title": {
                                "type": "string",
                                "description": "Window title or application name"
                            }
                        },
                        "required": ["window_title"]
                    }
                ),
                Tool(
                    name="get_window_info",
                    description="Get information about current window",
                    inputSchema={
                        "type": "object",
                        "properties": {}
                    }
                )
            ]
        
        @self.server.call_tool()
        async def call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
            """Handle tool calls"""
            
            if name == "connect_window":
                return await self._connect_window(arguments)
            elif name == "take_snapshot":
                return await self._take_snapshot(arguments)
            elif name == "take_screenshot":
                return await self._take_screenshot(arguments)
            elif name == "click":
                return await self._click(arguments)
            elif name == "hover":
                return await self._hover(arguments)
            elif name == "type_text":
                return await self._type_text(arguments)
            elif name == "fill_form":
                return await self._fill_form(arguments)
            elif name == "wait_for":
                return await self._wait_for(arguments)
            elif name == "list_elements":
                return await self._list_elements(arguments)
            elif name == "select_window":
                return await self._select_window(arguments)
            elif name == "get_window_info":
                return await self._get_window_info(arguments)
            else:
                return [TextContent(type="text", text=f"Unknown tool: {name}")]
    
    async def _connect_window(self, args: Dict) -> List[TextContent]:
        """Connect to window"""
        app_name = args["app_name"]
        strategy = args.get("backend_strategy", "cdp")
        
        print(f"[DEBUG] connect_window: server instance ID = {id(self)}", file=sys.stderr)
        print(f"[DEBUG] Connecting to '{app_name}' with strategy '{strategy}'", file=sys.stderr)
        
        self.backend = BackendSelector(app_name)
        
        if self.backend.try_connect(strategy):
            self.connected_app = app_name
            
            # Scan elements
            self.elements_cache = self.backend.get_elements('deep')
            
            # Initialize resolver
            self.resolver = AIElementResolver(self.backend)
            self.resolver.update_registry(self.elements_cache)
            
            info = self.backend.get_window_info()
            
            print(f"[DEBUG] Connected successfully. Backend: {self.backend}, Elements: {len(self.elements_cache)}", file=sys.stderr)
            
            response = {
                "success": True,
                "app_name": app_name,
                "backend": strategy,
                "window_title": info.get('title'),
                "size": f"{info.get('size', {}).get('width')}x{info.get('size', {}).get('height')}",
                "elements_found": len(self.elements_cache)
            }
            
            return [TextContent(type="text", text=json.dumps(response, indent=2))]
        else:
            print(f"[DEBUG] Connection failed", file=sys.stderr)
            return [TextContent(type="text", text=json.dumps({
                "success": False,
                "error": f"Could not connect to '{app_name}'. Is the application running?"
            }, indent=2))]
    
    async def _take_snapshot(self, args: Dict) -> List[TextContent]:
        """Take text snapshot of elements"""
        if not self.backend:
            return [TextContent(type="text", text="Error: Not connected. Use connect_window first.")]
        
        # Rescan for latest state
        self.elements_cache = self.backend.get_elements('deep')
        if self.resolver:
            self.resolver.update_registry(self.elements_cache)
        
        verbose = args.get('verbose', False)
        visible_elements = [e for e in self.elements_cache if e.get('visible')]
        
        # Group by type
        by_type = {}
        for elem in visible_elements:
            elem_type = elem.get('type', 'unknown')
            by_type.setdefault(elem_type, []).append(elem)
        
        snapshot_lines = [
            f"Window: {self.connected_app}",
            f"Total Elements: {len(self.elements_cache)}",
            f"Visible Elements: {len(visible_elements)}",
            "",
            "Elements by Type:"
        ]
        
        for elem_type, elements in sorted(by_type.items()):
            snapshot_lines.append(f"\n{elem_type.upper()} ({len(elements)}):")
            for elem in elements[:15 if not verbose else None]:
                label = elem.get('label', 'N/A')
                if verbose:
                    text = elem.get('text', '')
                    visible = '[V]' if elem.get('visible') else '[H]'
                    enabled = '[E]' if elem.get('enabled') else '[D]'
                    snapshot_lines.append(f"  {visible}{enabled} {label} | {text}")
                else:
                    snapshot_lines.append(f"  • {label}")
            
            if len(elements) > 15 and not verbose:
                snapshot_lines.append(f"  ... and {len(elements) - 15} more")
        
        snapshot_text = "\n".join(snapshot_lines)
        
        # Save to file if requested
        if args.get('filePath'):
            filepath = Path(args['filePath'])
            filepath.parent.mkdir(parents=True, exist_ok=True)
            filepath.write_text(snapshot_text)
        
        return [TextContent(type="text", text=snapshot_text)]
    
    async def _take_screenshot(self, args: Dict) -> List[TextContent]:
        """Take visual screenshot"""
        if not self.backend:
            return [TextContent(type="text", text="Error: Not connected")]
        
        name = args.get('name', f"screenshot_{int(time.time())}")
        
        filepath = self.backend.capture_screenshot(name)
        
        if filepath:
            return [TextContent(type="text", text=json.dumps({
                "success": True,
                "filepath": str(filepath)
            }, indent=2))]
        else:
            return [TextContent(type="text", text=json.dumps({
                "success": False,
                "error": "Screenshot failed"
            }, indent=2))]
    
    async def _click(self, args: Dict) -> List[TextContent]:
        """Click element"""
        if not self.backend or not self.resolver:
            return [TextContent(type="text", text="Error: Not connected")]
        
        element_query = args["element"]
        
        # Rescan before action
        self.elements_cache = self.backend.get_elements('deep')
        self.resolver.update_registry(self.elements_cache)
        
        resolved = self.resolver.resolve(element_query, action='click')
        
        if not resolved:
            # Find similar
            similar = self.resolver.find_similar(element_query, limit=3)
            suggestions = [s.get('label') for s in similar]
            
            return [TextContent(type="text", text=json.dumps({
                "success": False,
                "error": f"Could not resolve element: '{element_query}'",
                "suggestions": suggestions
            }, indent=2))]
        
        elem = resolved['element']
        confidence = resolved['confidence']
        
        if self.backend.click_element(elem):
            # Wait for UI update
            time.sleep(0.5)
            
            response = {
                "success": True,
                "element": elem.get('label'),
                "type": elem.get('type'),
                "confidence": f"{confidence:.0%}"
            }
            
            # Include snapshot if requested
            if args.get('includeSnapshot'):
                time.sleep(0.5)
                snapshot_response = await self._take_snapshot({"verbose": False})
                response["snapshot"] = snapshot_response[0].text
            
            return [TextContent(type="text", text=json.dumps(response, indent=2))]
        else:
            return [TextContent(type="text", text=json.dumps({
                "success": False,
                "error": "Click action failed"
            }, indent=2))]
    
    async def _hover(self, args: Dict) -> List[TextContent]:
        """Hover over element"""
        if not self.backend or not self.resolver:
            return [TextContent(type="text", text="Error: Not connected")]
        
        element_query = args["element"]
        
        resolved = self.resolver.resolve(element_query, action='hover')
        
        if resolved and self.backend.hover_element(resolved['element']):
            return [TextContent(type="text", text=json.dumps({
                "success": True,
                "element": resolved['element'].get('label')
            }, indent=2))]
        else:
            return [TextContent(type="text", text=json.dumps({
                "success": False,
                "error": f"Could not hover: '{element_query}'"
            }, indent=2))]
    
    async def _type_text(self, args: Dict) -> List[TextContent]:
        """Type text into element"""
        if not self.backend or not self.resolver:
            return [TextContent(type="text", text="Error: Not connected")]
        
        element_query = args["element"]
        text = args["text"]
        
        resolved = self.resolver.resolve(element_query, action='type')
        
        if resolved:
            elem = resolved['element']
            self.backend.focus_element(elem)
            time.sleep(0.2)
            
            if self.backend.type_text(elem, text):
                return [TextContent(type="text", text=json.dumps({
                    "success": True,
                    "element": elem.get('label'),
                    "text": text
                }, indent=2))]
        
        return [TextContent(type="text", text=json.dumps({
            "success": False,
            "error": f"Could not type into: '{element_query}'"
        }, indent=2))]
    
    async def _fill_form(self, args: Dict) -> List[TextContent]:
        """Fill multiple form fields"""
        if not self.backend or not self.resolver:
            return [TextContent(type="text", text="Error: Not connected")]
        
        fields = args["fields"]
        results = []
        
        for field in fields:
            result = await self._type_text({
                "element": field["element"],
                "text": field["value"]
            })
            results.append(json.loads(result[0].text))
            time.sleep(0.3)
        
        return [TextContent(type="text", text=json.dumps({
            "success": True,
            "fields_filled": len([r for r in results if r.get('success')]),
            "results": results
        }, indent=2))]
    
    async def _wait_for(self, args: Dict) -> List[TextContent]:
        """Wait for condition"""
        # Simplified wait implementation
        timeout = args.get("timeout", 5000) / 1000
        condition = args["condition"]
        
        start = time.time()
        while (time.time() - start) < timeout:
            # Check condition
            # For now, just wait
            time.sleep(0.5)
        
        return [TextContent(type="text", text=json.dumps({
            "success": True,
            "condition": condition,
            "elapsed": f"{(time.time() - start)*1000:.0f}ms"
        }, indent=2))]
    
    async def _list_elements(self, args: Dict) -> List[TextContent]:
        """List elements"""
        print(f"[DEBUG] _list_elements called. self.backend = {self.backend}, self.connected_app = {self.connected_app}", file=sys.stderr)
        
        if not self.backend:
            return [TextContent(type="text", text="Error: Not connected")]
        
        # Check if backend is still connected
        if not self.backend.is_connected():
            print(f"[DEBUG] Backend is_connected() returned False", file=sys.stderr)
            return [TextContent(type="text", text="Error: Backend disconnected. Use connect_window again.")]
        
        # Rescan
        self.elements_cache = self.backend.get_elements('deep')
        
        filter_query = args.get('filter', '').lower()
        elem_type_filter = args.get('type', 'all')
        
        visible = [e for e in self.elements_cache if e.get('visible')]
        
        # Filter by type
        if elem_type_filter != 'all':
            visible = [e for e in visible if e.get('type') == elem_type_filter]
        
        # Filter by query
        if filter_query:
            visible = [e for e in visible if filter_query in e.get('label', '').lower()]
        
        elements_list = []
        for elem in visible[:50]:  # Limit to 50
            elements_list.append({
                "label": elem.get('label'),
                "type": elem.get('type'),
                "visible": elem.get('visible'),
                "enabled": elem.get('enabled')
            })
        
        return [TextContent(type="text", text=json.dumps({
            "total": len(self.elements_cache),
            "visible": len(visible),
            "elements": elements_list
        }, indent=2))]
    
    async def _select_window(self, args: Dict) -> List[TextContent]:
        """Select different window"""
        window_title = args["window_title"]
        
        # Disconnect current
        self.backend = None
        self.resolver = None
        
        # Connect to new window
        return await self._connect_window({"app_name": window_title})
    
    async def _get_window_info(self, args: Dict) -> List[TextContent]:
        """Get window info"""
        if not self.backend:
            return [TextContent(type="text", text="Error: Not connected")]
        
        info = self.backend.get_window_info()
        info["connected_app"] = self.connected_app
        info["elements_cached"] = len(self.elements_cache)
        
        return [TextContent(type="text", text=json.dumps(info, indent=2))]


async def serve():
    """Start the MCP server"""
    # Create single persistent instance
    server_instance = NativeWindowsServer()
    
    print("[INFO] Native Windows MCP Server starting...", file=sys.stderr)
    print(f"[INFO] Server instance ID: {id(server_instance)}", file=sys.stderr)
    
    async with stdio_server() as (read_stream, write_stream):
        await server_instance.server.run(
            read_stream,
            write_stream,
            server_instance.server.create_initialization_options()
        )


if __name__ == "__main__":
    import asyncio
    asyncio.run(serve())
