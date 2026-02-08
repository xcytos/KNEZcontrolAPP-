# IDENTITY_INDEX
generated_at: 2026-02-08T15:06:21.075895+00:00

## Runtime Context
- session_id: N/A
- knez_endpoint: N/A
- requested_checkpoint: CP01_MCP_REGISTRY

## Checkpoint State
- current_checkpoint: UNKNOWN
- next_checkpoint: UNKNOWN

## MCP Servers (redacted)
- taqwin-v1-ultimate-session: command=python cwd=TAQWIN_V1

## ID Contracts
- session_id: uuid4().hex (opaque string)
- message_id: stable per stored message (opaque string)
- snapshot_id: opaque string emitted by resume snapshot compiler
- checkpoint: (session_id, token_index, sha) stored in checkpoints2
- mcp_framing: Content-Length framed UTF-8 JSON-RPC
