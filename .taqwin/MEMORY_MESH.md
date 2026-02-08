# Memory Mesh

This file tracks the document graph for persistent understanding of the overall codebase and roadmap.

## Nodes
- N1: [.TAQWIN.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.TAQWIN.md)
- N2: [ROADMAP.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.TAQWIN/ROADMAP.md)
- N3: [ARCHITECTURE.md](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.TAQWIN/ARCHITECTURE.md)
- N4: [CP00 tickets](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.TAQWIN/checkpoints/CP00_STABILIZE/TICKETS.md)
- N5: [CP01 tickets](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.TAQWIN/checkpoints/CP01_MCP_REGISTRY/TICKETS.md)
- N6: [CP02 tickets](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/.TAQWIN/checkpoints/CP02_SESSION_MEMORY_ANALYSIS/TICKETS.md)
- N7: [mcp.config.json](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/knez-control-app/src-tauri/mcp/mcp.config.json)
- N8: [TAQWIN MCP handshake test](file:///c:/Users/syedm/Downloads/ASSETS/controlAPP/TAQWIN_V1/tools/mcp_handshake_test.py)

## Edges
- N1 → N2 (current checkpoint drives roadmap execution)
- N2 → N4/N5/N6 (roadmap checkpoints reference ticket sets)
- N4 → N7/N8 (CP00 validates MCP runtime and config)
- N3 → N4/N5/N6 (architecture informs acceptance criteria)

## Activation Nodes
- N9: TAQWIN ACTIVATE tool (taqwin_activate)
- N10: [IDENTITY_INDEX.json](file:///C:/Users/syedm/Downloads/ASSETS/controlAPP/.TAQWIN/IDENTITY_INDEX.json)
- N11: [IDENTITY_INDEX.md](file:///C:/Users/syedm/Downloads/ASSETS/controlAPP/.TAQWIN/IDENTITY_INDEX.md)

### Activation Edges
- N1 → N10 (checkpoint state drives identity index)
- N10 → N11 (human-readable mirror)
- N9 → N10 (activation writes identity index)

