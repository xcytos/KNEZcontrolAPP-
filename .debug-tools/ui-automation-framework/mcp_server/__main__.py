"""
Native Windows MCP Server Entry Point
Provides MCP tools for Windows native application automation
"""

import asyncio
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from mcp_server.server import serve

if __name__ == "__main__":
    asyncio.run(serve())
