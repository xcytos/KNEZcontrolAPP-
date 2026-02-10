# MCP tools/list Audit — TAQWIN_V1

Stamped: 2026-02-10

## Evidence: Context Load

Recursive content digests (path + bytes) computed by reading every file stream:

```json
[
  {
    "root": "C:\\Users\\syedm\\Downloads\\ASSETS\\controlAPP\\TAQWIN_V1",
    "files": 649,
    "bytes": 1113066395,
    "sha256": "2304356f217735a46769fcc302cbb10550036f1eb5984addee16a9a1ccab23f8"
  },
  {
    "root": "C:\\Users\\syedm\\Downloads\\ASSETS\\controlAPP\\.taqwin\\identity",
    "files": 3,
    "bytes": 2143,
    "sha256": "bd2f8edeec36c5a593618a230196857ba4c651df21f149366a78de964ba2cffd"
  }
]
```

Governance context inputs:

- [.taqwin/rules.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/rules.md)
- [.taqwin/work/active.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/work/active.md)
- [.taqwin/identity/authority.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/identity/authority.md)
- [.taqwin/identity/persona.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/identity/persona.md)
- [.taqwin/identity/thinking-style.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.taqwin/identity/thinking-style.md)

## Mental Map: MCP Server Lifecycle

- Entrypoint: [main.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/main.py#L10-L106)
  - Default mode runs MCP server (`_run_mcp()` → `TaqwinMCPServer()` → `asyncio.run(server.run())`).
  - Primary AI interactive mode only via `--taqwin`.

- Server core: [core/mcp_server.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/mcp_server.py)
  - `TaqwinMCPServer.__init__` constructs registry/handler and registers tools lazily.
  - `TaqwinMCPServer.run` is the single-threaded request loop.

### Request Loop + Framing

- Read path: [TaqwinMCPServer.run](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/mcp_server.py#L514-L703)
  - Supports Content-Length framing (reads header lines then `read(n)` body) and newline-delimited JSON.
  - Resolves response framing once based on the first request framing (or `TAQWIN_MCP_OUTPUT_MODE`).
  - Writes responses either with Content-Length headers or line-delimited JSON.

### initialize Handler

- Handler: [handle_initialize](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/mcp_server.py#L173-L179)
- Response: [ResponseHandler.create_initialize_response](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/response_handler.py#L44-L53)

### tools/list Handler

- Handler: [handle_tools_list](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/mcp_server.py#L181-L190)
- Registry: [ToolRegistry.get_tool_definitions](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/tool_registry.py#L97-L164)
- Response: [ResponseHandler.create_tools_list_response](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/response_handler.py#L55-L60)

### tools/call Handler

- Handler: [handle_tools_call](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/mcp_server.py#L274-L473)
- Registry exec: [ToolRegistry.execute_tool](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/tool_registry.py#L165-L244)

## Tool Registry Construction

### Static contract definitions

- Contract: [core/contracts/tools_v1.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/contracts/tools_v1.py)
  - Provides `TOOL_DEFINITIONS_V1` used as static definitions when registering lazy tools.

### Lazy registration

- Registration occurs inside server init: [TaqwinMCPServer._register_tools](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/mcp_server.py#L67-L90)
  - Uses `register_lazy_tool(name, module, class, static_definition=defs_by_name[name])`.

## Permission Checks (Observed)

### Server-side checks

Server-side “governance” is currently enforced mainly in tools/call, not tools/list:

- Payload depth / size gates: [core/mcp_server.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/mcp_server.py#L595-L677) and [config.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/config.py#L62-L64)
- Storage directory init (tools/call only), with 2s timeout: [handle_tools_call](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/mcp_server.py#L339-L343)
- Per-tool timeouts (tools/call only): [core/mcp_server.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/mcp_server.py#L835-L848)

### Client-side gates (Control App)

The desktop client can block MCP usage entirely if not in Tauri runtime (web mode) or if stdin writes are denied by Tauri capabilities. These are surfaced in UI and normalized errors.

## Forensic: tools/list Work Inventory

### Imports executed during tools/list

Direct imports in `tools/list` handler are minimal:

- `handle_tools_list` itself does not import anything at call-time.
- `ToolRegistry.get_tool_definitions` can import tool modules synchronously via `importlib.import_module` if a lazy tool lacks static definition and triggers `_load_lazy_tool` ([tool_registry.py](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/tool_registry.py#L68-L96)).

### Filesystem access during tools/list

- Python imports are filesystem reads; `_load_lazy_tool` can cause high-latency IO if triggered.
- No explicit disk scans are present in `tools/list` itself.

### Permission checks during tools/list

- None explicitly. However, any tool constructor invoked during listing can perform arbitrary work (including disk or network), so the current design indirectly permits heavy work during tools/list.

### Async/sync boundaries

- tools/list handler is `async` but `get_tool_definitions()` is sync; any slow work inside it blocks the event loop.

### Loops / recursion

- `get_tool_definitions()` loops:
  - Over `lazy_tools` keys and may load missing defs.
  - Over registered `tools` and instantiates each tool instance to call `get_definition()`.

## Identified Stall Risks (Exact Blocking Lines)

These are the current high-risk operations inside tools/list:

- Synchronous module imports during listing if static defs missing: `_load_lazy_tool` → `importlib.import_module` ([tool_registry.py:L68-L96](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/tool_registry.py#L68-L96)).
- Tool instance creation during listing: `self.tool_instances[name] = tool_class()` ([tool_registry.py:L125-L133](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/tool_registry.py#L125-L133)).
- Dynamic `get_definition()` execution: `definition = self.tool_instances[name].get_definition()` ([tool_registry.py:L131-L134](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/core/tool_registry.py#L131-L134)).

## Conclusions (Pre-fix)

- tools/list is intended to be lightweight, but the current registry implementation still allows heavy work (imports, constructors) to run in the tools/list request path.\n+- This violates the hard rule that tools/list must be static and must never block.\n+
